using Npgsql;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeProductionObservabilityStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeProductionObservabilityStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public ProductionObservabilityDatabaseSnapshot GetSnapshot() =>
        new(
            ReplayCount: ScalarInt("""
                select count(*)
                from outbox_dead_letter_replay_audits
                where action = 'replay'
                """),
            RebuildCount: ScalarInt("select count(*) from projection_rebuild_audits"),
            StaleLensCount: ScalarInt("""
                with latest as (
                    select distinct on (tenant_id, lens_name)
                        tenant_id, lens_name, created_at_utc
                    from projection_checkpoints
                    order by tenant_id, lens_name, created_at_utc desc
                )
                select count(*)
                from latest
                where created_at_utc < now() - interval '1 hour'
                """),
            PaymentConfirmWithoutEvidenceViolations: ScalarInt("""
                select count(*)
                from audit_events
                where event_type = 'Accommodation.PaymentConfirmed'
                  and case
                        when jsonb_typeof(body->'evidenceIds') = 'array'
                            then jsonb_array_length(body->'evidenceIds')
                        else 0
                      end = 0
                """),
            AllocationOverAvailableViolations: ScalarInt("""
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
                        coalesce(allocated.allocated_amount, 0) as allocated_amount
                    from payments
                    left join confirmed on confirmed.payment_id = payments.payment_id
                    left join allocated on allocated.payment_id = payments.payment_id
                )
                select count(*)
                from checked
                where allocated_amount > confirmed_amount
                """),
            StayBalanceMismatchCount: ScalarInt("""
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
                )
                select count(*)
                from stay_balances balance
                join rebuilt on rebuilt.stay_id = balance.stay_id and rebuilt.workspace_id = balance.workspace_id
                where abs(balance.total_charges - rebuilt.total_charges) > 0.01
                   or abs(balance.confirmed_payments - rebuilt.confirmed_payments) > 0.01
                   or abs(balance.allocated_payments - rebuilt.allocated_payments) > 0.01
                   or abs(balance.balance - rebuilt.balance) > 0.01
                """),
            AvailableRefundNegativeCount: ScalarInt("""
                with totals as (
                    select
                        deposit_id,
                        coalesce(sum(amount) filter (where transaction_type in ('confirmed', 'confirmed_received')), 0) as confirmed,
                        coalesce(sum(amount) filter (where transaction_type = 'deducted'), 0) as deducted,
                        coalesce(sum(amount) filter (where transaction_type = 'applied_to_balance'), 0) as applied,
                        coalesce(sum(amount) filter (where transaction_type = 'refund_approved'), 0) as refund_approved,
                        coalesce(sum(amount) filter (where transaction_type = 'refund_paid'), 0) as refund_paid
                    from deposit_transactions
                    group by deposit_id
                )
                select count(*)
                from totals
                where confirmed - deducted - applied - refund_paid - greatest(refund_approved - refund_paid, 0) < 0
                """),
            RefundFailedDoubleCount: ScalarInt("""
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
                        liability.liability_balance as projected_held_amount,
                        greatest(totals.confirmed - totals.deducted - totals.applied - totals.refund_paid, 0) as expected_held_amount,
                        totals.refund_failed
                    from totals
                    join deposit_liabilities liability on liability.deposit_id = totals.deposit_id and liability.workspace_id = totals.workspace_id
                )
                select count(*)
                from checked
                where refund_failed > 0
                  and projected_held_amount < expected_held_amount
                """),
            HeldAmountNegativeCount: ScalarInt("""
                with totals as (
                    select
                        deposit_id,
                        coalesce(sum(amount) filter (where transaction_type in ('confirmed', 'confirmed_received')), 0) as confirmed,
                        coalesce(sum(amount) filter (where transaction_type = 'deducted'), 0) as deducted,
                        coalesce(sum(amount) filter (where transaction_type = 'applied_to_balance'), 0) as applied,
                        coalesce(sum(amount) filter (where transaction_type = 'refund_paid'), 0) as refund_paid
                    from deposit_transactions
                    group by deposit_id
                )
                select count(*)
                from (
                    select deposit_id
                    from deposit_liabilities
                    where liability_balance < 0
                    union
                    select deposit_id
                    from totals
                    where confirmed - deducted - applied - refund_paid < 0
                ) violations
                """),
            OpenBlockers: ScalarInt("""
                select count(*)
                from process_request_event_intents
                where request_event_type = 'Accommodation.CaseBlockerCreated'
                  and status not in ('resolved', 'waived', 'closed', 'cancelled')
                """),
            DuplicateBlockers: ScalarInt("""
                select count(*)
                from (
                    select
                        tenant_id,
                        coalesce(body->>'blockerCode', request_event_type) as blocker_code,
                        coalesce(body->>'relatedObjectId', body->>'relatedObject', body->>'caseId', source_event_id) as blocker_key,
                        count(*) as duplicate_count
                    from process_request_event_intents
                    where request_event_type = 'Accommodation.CaseBlockerCreated'
                      and status not in ('resolved', 'waived', 'closed', 'cancelled')
                    group by tenant_id, coalesce(body->>'blockerCode', request_event_type), coalesce(body->>'relatedObjectId', body->>'relatedObject', body->>'caseId', source_event_id)
                    having count(*) > 1
                ) duplicates
                """),
            FakeCloseAttempts: ScalarInt("""
                select count(*)
                from process_request_event_intents
                where request_event_type = 'Accommodation.CaseClosurePolicyEvaluationRequested'
                  and coalesce(body->>'closesCaseWithoutClosurePolicy', '') <> 'false'
                """),
            GateResultStatus: ScalarText("""
                select status
                from control_plane.gate_results
                order by generated_at_utc desc, gate_result_id
                limit 1
                """, "not_run"),
            RedShadowReports: ScalarInt("""
                select count(*)
                from control_plane.shadow_compare_reports
                where grade = 'red'
                """),
            BlockingInvariantFailures: ScalarInt("""
                select count(*)
                from control_plane.runtime_invariant_checks
                where mode = 'blocking'
                  and (status in ('failed', 'blocked') or violation_count > 0)
                """),
            ReleaseState: ScalarText("""
                select status
                from control_plane.release_manifests
                order by updated_at_utc desc, release_id
                limit 1
                """, "none"));

    private int ScalarInt(string sql) => Convert.ToInt32(Scalar(sql) ?? 0);

    private string ScalarText(string sql, string fallback) => Convert.ToString(Scalar(sql)) ?? fallback;

    private object? Scalar(string sql)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            return command.ExecuteScalar();
        }
        catch (PostgresException ex) when (ex.SqlState is "42P01" or "42703" or "3F000")
        {
            return null;
        }
    }
}
