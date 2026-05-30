using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class LedgerInspectionJob
{
    private static readonly HashSet<string> ValidJobModes = new(StringComparer.Ordinal)
    {
        "daily",
        "manual",
        "release_gate"
    };

    public static Task<LedgerInspectionRunOutput> Run(RunnerOptions options)
    {
        var releaseId = options.Get("releaseId", "v5.4-ledger-inspection");
        var mrId = options.Get("mrId", "local");
        var tenantId = options.Get("tenantId", "all-tenants");
        var sliceId = options.Get("sliceId", "LedgerInspection");
        var ciRunId = ResolveCiRunId(options);
        var jobMode = options.Get("job-mode", options.Get("mode", "manual"));
        if (!ValidJobModes.Contains(jobMode))
        {
            throw new InvalidOperationException($"ledger_inspection_job_mode_invalid:{jobMode}");
        }

        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "ledger-inspection-invariant-checks.json"));
        var reportPath = options.Get("report-out", Path.Combine(".tmp", "v5_4", "ledger-inspection-report.json"));
        var dashboardPath = options.Get("dashboard-out", Path.Combine(".tmp", "v5_4", "ledger-inspection-dashboard-summary.json"));
        var dryRun = options.GetBool("dry-run");
        var generatedAtUtc = DateTimeOffset.UtcNow;
        var jobRunId = options.Get("jobRunId", $"ledger-inspection-{jobMode}-{generatedAtUtc:yyyyMMddHHmmss}");
        var database = new ControlPlaneDatabase(ControlPlaneDatabase.ResolveConnectionString(options));

        if (!dryRun)
        {
            database.ApplyMigrations(Path.Combine("infra", "db", "migrations"));
            database.EnsureReleaseManifest(releaseId, mrId, ciRunId);
        }

        var service = new LedgerInspectionJobService(database);
        var output = service.Run(new LedgerInspectionRunContext(
            jobRunId,
            releaseId,
            mrId,
            tenantId,
            sliceId,
            ciRunId,
            jobMode,
            "ledger-inspection-job",
            generatedAtUtc));

        if (!dryRun)
        {
            var store = new ControlPlaneWriteStore(database.ConnectionString);
            foreach (var check in output.InvariantChecks)
            {
                store.WriteRuntimeInvariantCheck(new RuntimeInvariantCheckWrite(
                    check.InvariantCheckId,
                    check.ReleaseId,
                    check.TenantId,
                    check.SliceId,
                    check.InvariantKey,
                    check.Description,
                    check.Mode,
                    check.Severity,
                    check.SourceType,
                    check.CheckSql,
                    check.CheckRef,
                    check.Status,
                    check.ObservedValue,
                    check.Threshold,
                    check.ViolationCount,
                    check.SampleViolations,
                    check.GeneratedBy,
                    check.CiRunId,
                    check.CheckedAtUtc));
            }

            database.WriteLedgerInspectionJobReport(output.Report, output.DashboardSummary);
        }

        RunnerJson.Write(outputPath, output.InvariantChecks);
        RunnerJson.Write(reportPath, output.Report);
        RunnerJson.Write(dashboardPath, output.DashboardSummary);
        Console.WriteLine($"ledger-inspection: wrote {Path.GetRelativePath(Directory.GetCurrentDirectory(), reportPath)} status={output.Status} checks={output.InvariantChecks.Count}");
        return Task.FromResult(output);
    }

    private static string ResolveCiRunId(RunnerOptions options) =>
        options.Get("ciRunId")
        ?? Environment.GetEnvironmentVariable("GITHUB_RUN_ID")
        ?? "local";
}

public sealed class LedgerInspectionJobService
{
    private readonly ILedgerInspectionInvariantEvaluator evaluator;

    public LedgerInspectionJobService(ILedgerInspectionInvariantEvaluator evaluator)
    {
        this.evaluator = evaluator;
    }

    public LedgerInspectionRunOutput Run(LedgerInspectionRunContext context)
    {
        var checks = LedgerInspectionDefinitions.All
            .Select(definition => ExecuteDefinition(definition, context))
            .ToArray();
        var status = checks.Any(check => check.Status == "failed")
            ? "failed"
            : checks.Any(check => check.Status == "warning") ? "warning" : "passed";
        var failed = checks.Where(check => check.Status == "failed").ToArray();
        var warning = checks.Where(check => check.Status == "warning").ToArray();
        var reportItems = checks.Select(check => new LedgerInspectionReportItem(
            check.InvariantKey,
            check.Status,
            check.Severity,
            check.ViolationCount,
            check.ObservedValue,
            check.Threshold,
            check.SampleViolations)).ToArray();
        var report = new LedgerInspectionJobReport(
            context.JobRunId,
            context.ReleaseId,
            context.MrId,
            context.TenantId,
            context.JobMode,
            status,
            context.CiRunId,
            checks.Select(check => check.InvariantCheckId).ToArray(),
            reportItems,
            failed.Select(ToNoGoItem).ToArray(),
            checks.Where(check => check.Status == "passed").Select(check => check.InvariantKey).ToArray(),
            new Dictionary<string, object>
            {
                ["release_gate_safe"] = failed.Length == 0,
                ["manual_run_supported"] = true,
                ["daily_schedule_supported"] = true,
                ["pc_dashboard_summary"] = "control_plane.ledger_inspection_job_reports.dashboard_summary"
            },
            context.GeneratedBy,
            context.GeneratedAtUtc);
        var dashboardSummary = new LedgerInspectionDashboardSummary(
            context.JobRunId,
            context.TenantId,
            status,
            checks.Length,
            checks.Count(check => check.Status == "passed"),
            warning.Length,
            failed.Length,
            failed.Count(check => check.Severity == "P0"),
            HighestSeverity(failed),
            failed.Select(check => new LedgerInspectionDashboardItem(
                check.InvariantKey,
                check.Description,
                check.Severity,
                check.ViolationCount,
                check.SampleViolations.Take(3).ToArray(),
                ResolveAction(check.InvariantKey))).ToArray(),
            checks.Select(check => new LedgerInspectionDashboardCard(
                check.InvariantKey,
                ShortTitle(check.InvariantKey),
                check.Status,
                check.Severity,
                check.ViolationCount)).ToArray(),
            context.GeneratedAtUtc);

        return new LedgerInspectionRunOutput(
            context.JobRunId,
            context.ReleaseId,
            context.TenantId,
            context.JobMode,
            status,
            checks,
            report,
            dashboardSummary);
    }

    private InvariantCheckEvidence ExecuteDefinition(
        LedgerInspectionDefinition definition,
        LedgerInspectionRunContext context)
    {
        var evaluated = evaluator.ExecuteInvariantSql(definition.CheckSql);
        var status = evaluated.ViolationCount == 0
            ? "passed"
            : definition.Mode == "observing" ? "warning" : "failed";

        return new InvariantCheckEvidence(
            InvariantCheckId: $"{context.JobRunId}-{Sanitize(definition.InvariantKey)}",
            ReleaseId: context.ReleaseId,
            TenantId: context.TenantId,
            SliceId: context.SliceId,
            InvariantKey: definition.InvariantKey,
            Description: definition.Description,
            Mode: definition.Mode,
            Severity: definition.Severity,
            SourceType: "sql",
            CheckSql: definition.CheckSql,
            CheckRef: definition.CheckRef,
            Status: status,
            ObservedValue: evaluated.ObservedValue,
            Threshold: evaluated.Threshold,
            ViolationCount: evaluated.ViolationCount,
            SampleViolations: evaluated.SampleViolations,
            GeneratedBy: context.GeneratedBy,
            CiRunId: context.CiRunId,
            CheckedAtUtc: context.GeneratedAtUtc);
    }

    private static string ToNoGoItem(InvariantCheckEvidence check) =>
        $"{check.Severity}:{check.InvariantKey}:{check.ViolationCount}";

    private static string HighestSeverity(IReadOnlyList<InvariantCheckEvidence> failed)
    {
        if (failed.Any(check => check.Severity == "P0"))
        {
            return "P0";
        }

        if (failed.Any(check => check.Severity == "P1"))
        {
            return "P1";
        }

        return failed.Any() ? "P2" : "none";
    }

    private static string ResolveAction(string invariantKey) =>
        invariantKey switch
        {
            "ledger.payment_allocation_lte_confirmed_available" => "openPaymentCorrectionRequest",
            "ledger.deposit_held_amount_non_negative" => "openDepositCorrectionRequest",
            "ledger.deposit_refund_lte_available_refund" => "openRefundCorrectionRequest",
            "ledger.refund_failed_not_double_counted" => "openRefundAuditCase",
            "ledger.stay_balance_projection_matches_rebuild" => "runStayBalanceProjectionRebuild",
            "ledger.deposit_balance_projection_matches_rebuild" => "runDepositBalanceProjectionRebuild",
            "period.finance_snapshot_source_consistency" => "regeneratePeriodFinanceSnapshot",
            "correction.applied_balance_consistency" => "openCorrectionAudit",
            _ => "openLedgerInspectionReport"
        };

    private static string ShortTitle(string invariantKey) =>
        invariantKey switch
        {
            "ledger.payment_allocation_lte_confirmed_available" => "Payment allocation",
            "ledger.deposit_held_amount_non_negative" => "Deposit held amount",
            "ledger.deposit_refund_lte_available_refund" => "Deposit refund",
            "ledger.refund_failed_not_double_counted" => "Refund failed",
            "ledger.stay_balance_projection_matches_rebuild" => "Stay balance",
            "ledger.deposit_balance_projection_matches_rebuild" => "Deposit balance",
            "period.finance_snapshot_source_consistency" => "Period finance",
            "correction.applied_balance_consistency" => "Correction balance",
            _ => invariantKey
        };

    private static string Sanitize(string value) =>
        new(value.Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray());
}

public interface ILedgerInspectionInvariantEvaluator
{
    SqlInvariantResult ExecuteInvariantSql(string sql);
}

public static class LedgerInspectionDefinitions
{
    public static readonly IReadOnlyList<LedgerInspectionDefinition> All =
    [
        new(
            "ledger.payment_allocation_lte_confirmed_available",
            "Payment allocation must not exceed confirmed available amount.",
            "blocking",
            "P0",
            "sql/ledger/payment_allocation_lte_confirmed_available",
            """
            /* invariant:ledger.payment_allocation_lte_confirmed_available */
            with confirmed as (
                select payment_id, coalesce(sum(confirmed_amount), 0) as confirmed_amount
                from finance_reconciliations
                where status = 'confirmed'
                group by payment_id
            ),
            allocated as (
                select payment_id, coalesce(sum(allocated_amount), 0) as allocated_amount
                from payment_allocations
                where status not in ('rejected', 'cancelled', 'superseded')
                group by payment_id
            ),
            payments as (
                select payment_id from hostel_payments
                union select payment_id from confirmed
                union select payment_id from allocated
            ),
            checked as (
                select
                    payments.payment_id,
                    coalesce(confirmed.confirmed_amount, 0) as confirmed_amount,
                    coalesce(allocated.allocated_amount, 0) as allocated_amount,
                    coalesce(allocated.allocated_amount, 0) - coalesce(confirmed.confirmed_amount, 0) as over_allocated_amount
                from payments
                left join confirmed on confirmed.payment_id = payments.payment_id
                left join allocated on allocated.payment_id = payments.payment_id
            ),
            violations as (
                select *
                from checked
                where allocated_amount > confirmed_amount
            )
            select
                count(*)::int as violation_count,
                jsonb_build_object(
                    'checked_payments', (select count(*) from checked),
                    'max_over_allocated_amount', coalesce(max(over_allocated_amount), 0)
                ) as observed_value,
                jsonb_build_object('max_over_allocated_amount', 0) as threshold,
                coalesce(jsonb_agg(to_jsonb(violations) order by payment_id) filter (where payment_id is not null), '[]'::jsonb) as sample_violations
            from violations
            """),
        new(
            "ledger.deposit_held_amount_non_negative",
            "Deposit heldAmount must never be negative.",
            "blocking",
            "P0",
            "sql/ledger/deposit_held_amount_non_negative",
            """
            /* invariant:ledger.deposit_held_amount_non_negative */
            with transaction_totals as (
                select
                    deposit_id,
                    workspace_id,
                    coalesce(sum(amount) filter (where transaction_type in ('confirmed', 'confirmed_received')), 0) as confirmed,
                    coalesce(sum(amount) filter (where transaction_type = 'deducted'), 0) as deducted,
                    coalesce(sum(amount) filter (where transaction_type = 'applied_to_balance'), 0) as applied,
                    coalesce(sum(amount) filter (where transaction_type = 'refund_paid'), 0) as refund_paid
                from deposit_transactions
                group by deposit_id, workspace_id
            ),
            checked as (
                select
                    liability.deposit_id,
                    liability.workspace_id,
                    liability.liability_balance as projected_held_amount,
                    coalesce(totals.confirmed - totals.deducted - totals.applied - totals.refund_paid, liability.liability_balance) as rebuilt_held_amount
                from deposit_liabilities liability
                left join transaction_totals totals on totals.deposit_id = liability.deposit_id and totals.workspace_id = liability.workspace_id
            ),
            violations as (
                select *
                from checked
                where projected_held_amount < 0
                   or rebuilt_held_amount < 0
            )
            select
                count(*)::int as violation_count,
                jsonb_build_object(
                    'checked_deposits', (select count(*) from checked),
                    'min_projected_held_amount', coalesce(min(projected_held_amount), 0),
                    'min_rebuilt_held_amount', coalesce(min(rebuilt_held_amount), 0)
                ) as observed_value,
                jsonb_build_object('min_held_amount', 0) as threshold,
                coalesce(jsonb_agg(to_jsonb(violations) order by deposit_id) filter (where deposit_id is not null), '[]'::jsonb) as sample_violations
            from violations
            """),
        new(
            "ledger.deposit_refund_lte_available_refund",
            "Deposit refund approvals and paid refunds must not exceed availableRefund.",
            "blocking",
            "P0",
            "sql/ledger/deposit_refund_lte_available_refund",
            """
            /* invariant:ledger.deposit_refund_lte_available_refund */
            with totals as (
                select
                    deposit_id,
                    workspace_id,
                    coalesce(sum(amount) filter (where transaction_type in ('confirmed', 'confirmed_received')), 0) as confirmed,
                    coalesce(sum(amount) filter (where transaction_type = 'deducted'), 0) as deducted,
                    coalesce(sum(amount) filter (where transaction_type = 'applied_to_balance'), 0) as applied,
                    coalesce(sum(amount) filter (where transaction_type = 'refund_approved'), 0) as refund_approved,
                    coalesce(sum(amount) filter (where transaction_type = 'refund_paid'), 0) as refund_paid
                from deposit_transactions
                group by deposit_id, workspace_id
            ),
            checked as (
                select
                    deposit_id,
                    workspace_id,
                    confirmed,
                    deducted,
                    applied,
                    refund_approved,
                    refund_paid,
                    greatest(refund_approved - refund_paid, 0) as approved_not_paid,
                    greatest(confirmed - deducted - applied - refund_paid, 0) as available_refund,
                    greatest(confirmed - deducted - applied, 0) as paid_ceiling
                from totals
            ),
            violations as (
                select *
                from checked
                where approved_not_paid > available_refund
                   or refund_paid > paid_ceiling
            )
            select
                count(*)::int as violation_count,
                jsonb_build_object(
                    'checked_deposits', (select count(*) from checked),
                    'max_refund_over_available', coalesce(max(approved_not_paid - available_refund), 0),
                    'max_paid_over_ceiling', coalesce(max(refund_paid - paid_ceiling), 0)
                ) as observed_value,
                jsonb_build_object('max_refund_over_available', 0, 'max_paid_over_ceiling', 0) as threshold,
                coalesce(jsonb_agg(to_jsonb(violations) order by deposit_id) filter (where deposit_id is not null), '[]'::jsonb) as sample_violations
            from violations
            """),
        new(
            "ledger.refund_failed_not_double_counted",
            "RefundFailed must not reduce heldAmount or approved-not-paid twice.",
            "blocking",
            "P0",
            "sql/ledger/refund_failed_not_double_counted",
            """
            /* invariant:ledger.refund_failed_not_double_counted */
            with totals as (
                select
                    deposit_id,
                    workspace_id,
                    coalesce(sum(amount) filter (where transaction_type in ('confirmed', 'confirmed_received')), 0) as confirmed,
                    coalesce(sum(amount) filter (where transaction_type = 'deducted'), 0) as deducted,
                    coalesce(sum(amount) filter (where transaction_type = 'applied_to_balance'), 0) as applied,
                    coalesce(sum(amount) filter (where transaction_type = 'refund_paid'), 0) as refund_paid,
                    coalesce(sum(amount) filter (where transaction_type = 'refund_failed'), 0) as refund_failed
                from deposit_transactions
                group by deposit_id, workspace_id
            ),
            checked as (
                select
                    liability.deposit_id,
                    liability.workspace_id,
                    liability.liability_balance as projected_held_amount,
                    greatest(totals.confirmed - totals.deducted - totals.applied - totals.refund_paid, 0) as expected_held_amount,
                    totals.refund_failed
                from totals
                join deposit_liabilities liability on liability.deposit_id = totals.deposit_id and liability.workspace_id = totals.workspace_id
            ),
            violations as (
                select *
                from checked
                where refund_failed > 0
                  and projected_held_amount < expected_held_amount
            )
            select
                count(*)::int as violation_count,
                jsonb_build_object(
                    'checked_failed_refunds', (select count(*) from checked where refund_failed > 0),
                    'max_failed_refund_amount', coalesce(max(refund_failed), 0)
                ) as observed_value,
                jsonb_build_object('failed_refund_balance_delta', 0) as threshold,
                coalesce(jsonb_agg(to_jsonb(violations) order by deposit_id) filter (where deposit_id is not null), '[]'::jsonb) as sample_violations
            from violations
            """),
        new(
            "ledger.stay_balance_projection_matches_rebuild",
            "StayBalance projection must equal a rebuild from charge and allocation ledgers.",
            "blocking",
            "P0",
            "sql/ledger/stay_balance_projection_matches_rebuild",
            """
            /* invariant:ledger.stay_balance_projection_matches_rebuild */
            with stay_ids as (
                select stay_id, workspace_id from stay_balances
                union select stay_id, workspace_id from guest_folios
                union select stay_id, workspace_id from hostel_charges
                union select folio_id as stay_id, workspace_id from hostel_payments
            ),
            guest_folio_charges as (
                select stay_id, workspace_id, coalesce(sum(charge_amount), 0) as amount
                from guest_folios
                group by stay_id, workspace_id
            ),
            charge_ledger as (
                select stay_id, workspace_id, coalesce(sum(amount), 0) as amount
                from hostel_charges
                group by stay_id, workspace_id
            ),
            confirmed as (
                select payment.folio_id as stay_id, payment.workspace_id, coalesce(sum(reconciliation.confirmed_amount), 0) as amount
                from finance_reconciliations reconciliation
                join hostel_payments payment on payment.payment_id = reconciliation.payment_id
                where reconciliation.status = 'confirmed'
                group by payment.folio_id, payment.workspace_id
            ),
            allocated as (
                select payment.folio_id as stay_id, payment.workspace_id, coalesce(sum(allocation.allocated_amount), 0) as amount
                from payment_allocations allocation
                join hostel_payments payment on payment.payment_id = allocation.payment_id
                group by payment.folio_id, payment.workspace_id
            ),
            rebuilt as (
                select
                    stay_ids.stay_id,
                    stay_ids.workspace_id,
                    greatest(coalesce(guest_folio_charges.amount, 0), coalesce(charge_ledger.amount, 0)) as total_charges,
                    coalesce(confirmed.amount, 0) as confirmed_payments,
                    coalesce(allocated.amount, 0) as allocated_payments,
                    greatest(greatest(coalesce(guest_folio_charges.amount, 0), coalesce(charge_ledger.amount, 0)) - coalesce(allocated.amount, 0), 0) as balance
                from stay_ids
                left join guest_folio_charges on guest_folio_charges.stay_id = stay_ids.stay_id and guest_folio_charges.workspace_id = stay_ids.workspace_id
                left join charge_ledger on charge_ledger.stay_id = stay_ids.stay_id and charge_ledger.workspace_id = stay_ids.workspace_id
                left join confirmed on confirmed.stay_id = stay_ids.stay_id and confirmed.workspace_id = stay_ids.workspace_id
                left join allocated on allocated.stay_id = stay_ids.stay_id and allocated.workspace_id = stay_ids.workspace_id
            ),
            violations as (
                select
                    balance.stay_id,
                    balance.workspace_id,
                    balance.total_charges as projected_total_charges,
                    rebuilt.total_charges as rebuilt_total_charges,
                    balance.confirmed_payments as projected_confirmed_payments,
                    rebuilt.confirmed_payments as rebuilt_confirmed_payments,
                    balance.allocated_payments as projected_allocated_payments,
                    rebuilt.allocated_payments as rebuilt_allocated_payments,
                    balance.balance as projected_balance,
                    rebuilt.balance as rebuilt_balance
                from stay_balances balance
                join rebuilt on rebuilt.stay_id = balance.stay_id and rebuilt.workspace_id = balance.workspace_id
                where abs(balance.total_charges - rebuilt.total_charges) > 0.01
                   or abs(balance.confirmed_payments - rebuilt.confirmed_payments) > 0.01
                   or abs(balance.allocated_payments - rebuilt.allocated_payments) > 0.01
                   or abs(balance.balance - rebuilt.balance) > 0.01
            )
            select
                count(*)::int as violation_count,
                jsonb_build_object(
                    'checked_stay_balances', (select count(*) from stay_balances),
                    'max_balance_delta', coalesce(max(abs(projected_balance - rebuilt_balance)), 0)
                ) as observed_value,
                jsonb_build_object('max_balance_delta', 0.01) as threshold,
                coalesce(jsonb_agg(to_jsonb(violations) order by stay_id) filter (where stay_id is not null), '[]'::jsonb) as sample_violations
            from violations
            """),
        new(
            "ledger.deposit_balance_projection_matches_rebuild",
            "DepositBalance projection must equal a rebuild from deposit entries.",
            "blocking",
            "P0",
            "sql/ledger/deposit_balance_projection_matches_rebuild",
            """
            /* invariant:ledger.deposit_balance_projection_matches_rebuild */
            with totals as (
                select
                    deposit_id,
                    workspace_id,
                    coalesce(sum(amount) filter (where transaction_type in ('received', 'received_pending')), 0) as received,
                    coalesce(sum(amount) filter (where transaction_type in ('confirmed', 'confirmed_received')), 0) as confirmed,
                    coalesce(sum(amount) filter (where transaction_type = 'deducted'), 0) as deducted,
                    coalesce(sum(amount) filter (where transaction_type = 'applied_to_balance'), 0) as applied,
                    coalesce(sum(amount) filter (where transaction_type = 'refund_paid'), 0) as refund_paid
                from deposit_transactions
                group by deposit_id, workspace_id
            ),
            rebuilt as (
                select
                    deposit_id,
                    workspace_id,
                    greatest(received, confirmed) as received_amount,
                    greatest(confirmed - deducted - applied - refund_paid, 0) as liability_balance
                from totals
            ),
            violations as (
                select
                    liability.deposit_id,
                    liability.workspace_id,
                    liability.received_amount as projected_received_amount,
                    rebuilt.received_amount as rebuilt_received_amount,
                    liability.liability_balance as projected_liability_balance,
                    rebuilt.liability_balance as rebuilt_liability_balance
                from deposit_liabilities liability
                left join rebuilt on rebuilt.deposit_id = liability.deposit_id and rebuilt.workspace_id = liability.workspace_id
                where abs(liability.received_amount - coalesce(rebuilt.received_amount, liability.received_amount)) > 0.01
                   or abs(liability.liability_balance - coalesce(rebuilt.liability_balance, liability.liability_balance)) > 0.01
            )
            select
                count(*)::int as violation_count,
                jsonb_build_object(
                    'checked_deposit_balances', (select count(*) from deposit_liabilities),
                    'max_liability_delta', coalesce(max(abs(projected_liability_balance - rebuilt_liability_balance)), 0)
                ) as observed_value,
                jsonb_build_object('max_liability_delta', 0.01) as threshold,
                coalesce(jsonb_agg(to_jsonb(violations) order by deposit_id) filter (where deposit_id is not null), '[]'::jsonb) as sample_violations
            from violations
            """),
        new(
            "period.finance_snapshot_source_consistency",
            "PeriodFinanceSnapshot must be machine-generated and internally consistent with its source metadata.",
            "blocking",
            "P1",
            "sql/period/finance_snapshot_source_consistency",
            """
            /* invariant:period.finance_snapshot_source_consistency */
            with checked as (
                select
                    snapshot_id,
                    period_id,
                    tenant_id,
                    generated_by,
                    expense_status,
                    source_ledger_versions,
                    body,
                    confirmed_payment_amount,
                    deposit_liability_end,
                    period_net_cash_flow,
                    ending_debt_amount
                from period_finance_snapshots
            ),
            violations as (
                select *
                from checked
                where lower(generated_by) in ('user', 'manual', 'frontend')
                   or expense_status not in ('not_integrated', 'manual_imported', 'ledger_verified')
                   or expense_status = 'zero_by_default'
                   or source_ledger_versions = '{}'::jsonb
                   or jsonb_typeof(body) <> 'object'
                   or (
                        body ? 'periodNetCashFlow'
                        and abs((body->>'periodNetCashFlow')::numeric - period_net_cash_flow) > 0.01
                   )
                   or (
                        body ? 'depositLiabilityEnd'
                        and abs((body->>'depositLiabilityEnd')::numeric - deposit_liability_end) > 0.01
                   )
                   or (
                        body ? 'ordinaryPaymentConfirmed'
                        and abs((body->>'ordinaryPaymentConfirmed')::numeric - confirmed_payment_amount) > 0.01
                   )
                   or (
                        body ? 'outstandingDebt'
                        and abs((body->>'outstandingDebt')::numeric - ending_debt_amount) > 0.01
                   )
            )
            select
                count(*)::int as violation_count,
                jsonb_build_object(
                    'checked_period_finance_snapshots', (select count(*) from checked),
                    'machine_generated_count', (select count(*) from checked where lower(generated_by) not in ('user', 'manual', 'frontend'))
                ) as observed_value,
                jsonb_build_object('invalid_snapshots', 0) as threshold,
                coalesce(jsonb_agg(to_jsonb(violations) order by period_id) filter (where period_id is not null), '[]'::jsonb) as sample_violations
            from violations
            """),
        new(
            "correction.applied_balance_consistency",
            "Applied corrections must have append-only correction evidence and rebuilt balance effects.",
            "blocking",
            "P0",
            "sql/correction/applied_balance_consistency",
            """
            /* invariant:correction.applied_balance_consistency */
            with applied as (
                select *
                from ledger_correction_requests
                where status = 'applied'
            ),
            checked as (
                select
                    request.correction_request_id,
                    request.tenant_id,
                    request.target_ledger_type,
                    request.target_entry_id,
                    exists (
                        select 1
                        from ledger_correction_entries entry
                        where entry.tenant_id = request.tenant_id
                          and entry.correction_request_id = request.correction_request_id
                    ) as has_correction_entry,
                    exists (
                        select 1
                        from ledger_reversal_entries reversal
                        where reversal.tenant_id = request.tenant_id
                          and reversal.correction_request_id = request.correction_request_id
                    ) as has_reversal_entry,
                    exists (
                        select 1
                        from correction_audit audit
                        where audit.tenant_id = request.tenant_id
                          and audit.correction_request_id = request.correction_request_id
                          and audit.action = 'applied'
                    ) as has_applied_audit,
                    exists (
                        select 1
                        from ledger_correction_entries entry
                        where entry.tenant_id = request.tenant_id
                          and entry.correction_request_id = request.correction_request_id
                          and entry.after_snapshot ? 'ledgerEffectId'
                          and entry.after_snapshot->>'status' = 'corrected'
                    ) as has_balance_effect
                from applied request
            ),
            violations as (
                select *
                from checked
                where not has_correction_entry
                   or not has_reversal_entry
                   or not has_applied_audit
                   or not has_balance_effect
            )
            select
                count(*)::int as violation_count,
                jsonb_build_object(
                    'checked_applied_corrections', (select count(*) from checked),
                    'corrections_missing_effects', count(*)
                ) as observed_value,
                jsonb_build_object('corrections_missing_effects', 0) as threshold,
                coalesce(jsonb_agg(to_jsonb(violations) order by correction_request_id) filter (where correction_request_id is not null), '[]'::jsonb) as sample_violations
            from violations
            """)
    ];
}

public sealed record LedgerInspectionDefinition(
    string InvariantKey,
    string Description,
    string Mode,
    string Severity,
    string CheckRef,
    string CheckSql);

public sealed record LedgerInspectionRunContext(
    string JobRunId,
    string ReleaseId,
    string MrId,
    string TenantId,
    string SliceId,
    string CiRunId,
    string JobMode,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc);

public sealed record LedgerInspectionRunOutput(
    string JobRunId,
    string ReleaseId,
    string TenantId,
    string JobMode,
    string Status,
    IReadOnlyList<InvariantCheckEvidence> InvariantChecks,
    LedgerInspectionJobReport Report,
    LedgerInspectionDashboardSummary DashboardSummary);

public sealed record LedgerInspectionJobReport(
    string JobRunId,
    string ReleaseId,
    string MrId,
    string TenantId,
    string JobMode,
    string Status,
    string? CiRunId,
    IReadOnlyList<string> InvariantCheckIds,
    IReadOnlyList<LedgerInspectionReportItem> Checks,
    IReadOnlyList<string> NoGoItems,
    IReadOnlyList<string> GoItems,
    IReadOnlyDictionary<string, object> Metadata,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc);

public sealed record LedgerInspectionReportItem(
    string InvariantKey,
    string Status,
    string Severity,
    int ViolationCount,
    IReadOnlyDictionary<string, object> ObservedValue,
    IReadOnlyDictionary<string, object> Threshold,
    IReadOnlyList<IReadOnlyDictionary<string, object>> SampleViolations);

public sealed record LedgerInspectionDashboardSummary(
    string JobRunId,
    string TenantId,
    string Status,
    int TotalChecks,
    int PassedChecks,
    int WarningChecks,
    int FailedChecks,
    int P0Failures,
    string HighestSeverity,
    IReadOnlyList<LedgerInspectionDashboardItem> CriticalItems,
    IReadOnlyList<LedgerInspectionDashboardCard> Cards,
    DateTimeOffset LastRunAtUtc);

public sealed record LedgerInspectionDashboardItem(
    string InvariantKey,
    string Description,
    string Severity,
    int ViolationCount,
    IReadOnlyList<IReadOnlyDictionary<string, object>> SampleViolations,
    string ResolveAction);

public sealed record LedgerInspectionDashboardCard(
    string InvariantKey,
    string Title,
    string Status,
    string Severity,
    int ViolationCount);
