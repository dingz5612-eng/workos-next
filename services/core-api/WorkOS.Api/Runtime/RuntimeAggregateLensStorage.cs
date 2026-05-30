using Npgsql;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeAggregateLensStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeAggregateLensStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public IReadOnlyList<object> GetAccommodationLens(string lensId) =>
        lensId switch
        {
            "bed-inventory" => Query("""
                select bed_id, workspace_id, room_id, bed_no, bunk_type, status, updated_at_utc
                from accommodation_beds
                order by room_id, bed_no
                """, reader => new
                {
                    lens = "BedInventoryLens",
                    bedId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    roomId = reader.GetString(2),
                    bedNo = reader.GetString(3),
                    bunkType = reader.GetString(4),
                    status = reader.GetString(5),
                    updatedAtUtc = reader.GetDateTime(6)
                }),
            "room-readiness" => Query("""
                select room_id, workspace_id, room_no, room_type, capacity, status, updated_at_utc
                from accommodation_rooms
                order by room_no
                """, reader => new
                {
                    lens = "RoomReadinessLens",
                    roomId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    roomNo = reader.GetString(2),
                    roomType = reader.GetString(3),
                    capacity = reader.GetInt32(4),
                    status = reader.GetString(5),
                    updatedAtUtc = reader.GetDateTime(6)
                }),
            "rate-plan" => Query("""
                select rate_plan_id, workspace_id, room_id, daily_rate_per_bed, weekly_rate_per_bed, monthly_rate_per_bed, currency, effective_from_utc, status, updated_at_utc
                from accommodation_rate_plans
                order by room_id, effective_from_utc
                """, reader => new
                {
                    lens = "RatePlanLens",
                    ratePlanId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    roomId = reader.GetString(2),
                    dailyRatePerBed = reader.GetDecimal(3),
                    weeklyRatePerBed = reader.GetDecimal(4),
                    monthlyRatePerBed = reader.GetDecimal(5),
                    currency = reader.GetString(6),
                    effectiveFromUtc = reader.GetDateTime(7),
                    status = reader.GetString(8),
                    updatedAtUtc = reader.GetDateTime(9)
                }),
            "blocked-bed" => Query("""
                select bed_id, workspace_id, room_id, bed_no, bunk_type, status, updated_at_utc
                from accommodation_beds
                where status ilike '%block%' or status ilike '%maintenance%' or status in ('维修阻断', 'blocked')
                order by updated_at_utc, room_id, bed_no
                """, reader => new
                {
                    lens = "BlockedBedLens",
                    bedId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    roomId = reader.GetString(2),
                    bedNo = reader.GetString(3),
                    bunkType = reader.GetString(4),
                    status = reader.GetString(5),
                    updatedAtUtc = reader.GetDateTime(6)
                }),
            "room-revenue-potential" => Query("""
                select
                    r.room_id,
                    r.workspace_id,
                    r.room_no,
                    r.capacity,
                    coalesce(p.monthly_rate_per_bed, 0),
                    coalesce(p.currency, 'KGS'),
                    r.capacity * coalesce(p.monthly_rate_per_bed, 0) as monthly_revenue_potential,
                    greatest(r.updated_at_utc, coalesce(p.updated_at_utc, r.updated_at_utc)) as updated_at_utc
                from accommodation_rooms r
                left join accommodation_rate_plans p on p.room_id = r.room_id and p.status = 'active'
                order by r.room_no
                """, reader => new
                {
                    lens = "RoomRevenuePotentialLens",
                    sourceOfTruthTables = new[] { "accommodation_rooms", "accommodation_rate_plans" },
                    projectionLagSeconds = LagSeconds(reader.GetDateTime(7)),
                    roomId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    roomNo = reader.GetString(2),
                    capacity = reader.GetInt32(3),
                    monthlyRatePerBed = reader.GetDecimal(4),
                    currency = reader.GetString(5),
                    monthlyRevenuePotential = reader.GetDecimal(6),
                    updatedAtUtc = reader.GetDateTime(7)
                }),
            "today-operations" => Query("""
                select
                    (select count(*) from hostel_stays where check_in_date::date = current_date) as today_checkins,
                    (select count(*) from checkout_settlements where updated_at_utc::date = current_date) as today_checkouts,
                    (select count(*) from hostel_payments where status <> 'confirmed') as pending_payments,
                    (select count(*) from deposit_liabilities where liability_balance > 0) as open_deposits,
                    (select count(*) from service_tasks where status not in ('verified', 'cancelled') and blocks_availability) as blocking_service_tasks,
                    (select count(*) from accommodation_beds where status ilike '%block%' or status ilike '%maintenance%' or status = 'blocked') as blocked_beds
                """, reader => new
                {
                    lens = "TodayOperationsLens",
                    todayCheckIns = reader.GetInt64(0),
                    todayCheckOuts = reader.GetInt64(1),
                    pendingPayments = reader.GetInt64(2),
                    openDeposits = reader.GetInt64(3),
                    blockingServiceTasks = reader.GetInt64(4),
                    blockedBeds = reader.GetInt64(5)
                }),
            "lead-funnel" => Query("""
                select
                    l.source_channel,
                    count(*) as lead_count,
                    count(b.booking_id) as reservation_count,
                    count(s.stay_id) as stay_count,
                    case when count(*) = 0 then 0 else count(b.booking_id)::numeric / count(*) end as reservation_rate,
                    max(greatest(l.updated_at_utc, coalesce(b.updated_at_utc, l.updated_at_utc), coalesce(s.updated_at_utc, l.updated_at_utc))) as updated_at_utc
                from hostel_leads l
                left join hostel_bookings b on b.lead_id = l.lead_id
                left join hostel_stays s on s.stay_id = replace(b.booking_id, 'booking', 'stay')
                group by l.source_channel
                order by lead_count desc, l.source_channel
                """, reader => new
                {
                    lens = "LeadFunnelLens",
                    sourceOfTruthTables = new[] { "hostel_leads", "hostel_bookings", "hostel_stays" },
                    projectionLagSeconds = LagSeconds(reader.GetDateTime(5)),
                    sourceChannel = reader.GetString(0),
                    leadCount = reader.GetInt64(1),
                    reservationCount = reader.GetInt64(2),
                    stayCount = reader.GetInt64(3),
                    reservationRate = reader.GetDecimal(4)
                }),
            "active-stay" => Query("""
                select stay_id, workspace_id, resident_name, phone, room_bed, check_in_date, planned_checkout_date, status, updated_at_utc
                from hostel_stays
                where status in ('active', 'reserved')
                order by planned_checkout_date, stay_id
                """, reader => new
                {
                    lens = "ActiveStayLens",
                    stayId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    residentName = reader.GetString(2),
                    phone = reader.GetString(3),
                    roomBed = reader.GetString(4),
                    checkInDate = reader.GetDateTime(5),
                    plannedCheckOutDate = reader.GetDateTime(6),
                    status = reader.GetString(7),
                    updatedAtUtc = reader.GetDateTime(8)
                }),
            "deposit-liability" => Query("""
                select deposit_id, workspace_id, folio_id, required_amount, received_amount, liability_balance, currency, status, updated_at_utc
                from deposit_liabilities
                order by updated_at_utc, deposit_id
                """, reader => new
                {
                    lens = "DepositLiabilityLens",
                    depositId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    folioId = reader.GetString(2),
                    requiredAmount = reader.GetDecimal(3),
                    receivedAmount = reader.GetDecimal(4),
                    liabilityBalance = reader.GetDecimal(5),
                    currency = reader.GetString(6),
                    status = reader.GetString(7),
                    updatedAtUtc = reader.GetDateTime(8)
                }),
            "payment-risk" => Query("""
                select payment_id, workspace_id, folio_id, amount, currency, method, purpose, status, updated_at_utc
                from hostel_payments
                where workspace_id = 'W-STAY-PAYMENT-LEDGER'
                  and status <> 'confirmed'
                order by updated_at_utc, payment_id
                """, reader => new
                {
                    lens = "PaymentRiskLens",
                    sourceOfTruthTables = new[] { "hostel_payments" },
                    projectionLagSeconds = LagSeconds(reader.GetDateTime(8)),
                    paymentId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    folioId = reader.GetString(2),
                    amount = reader.GetDecimal(3),
                    currency = reader.GetString(4),
                    method = reader.GetString(5),
                    purpose = reader.GetString(6),
                    status = reader.GetString(7),
                    updatedAtUtc = reader.GetDateTime(8)
                }),
            "stay-balance" => Query("""
                select stay_id, workspace_id, total_charges, confirmed_payments, allocated_payments, balance, currency, status, updated_at_utc
                from stay_balances
                order by updated_at_utc, stay_id
                """, reader => new
                {
                    lens = "StayBalanceLens",
                    stayId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    totalCharges = reader.GetDecimal(2),
                    confirmedPayments = reader.GetDecimal(3),
                    allocatedPayments = reader.GetDecimal(4),
                    balance = reader.GetDecimal(5),
                    currency = reader.GetString(6),
                    status = reader.GetString(7),
                    updatedAtUtc = reader.GetDateTime(8)
                }),
            "checkout-queue" => Query("""
                select checkout_id, workspace_id, stay_id, current_balance, deposit_held_amount, close_result, status, updated_at_utc
                from checkout_settlements
                where status <> 'closed'
                order by updated_at_utc, checkout_id
                """, reader => new
                {
                    lens = "CheckoutQueueLens",
                    sourceOfTruthTables = new[] { "checkout_settlements" },
                    projectionLagSeconds = LagSeconds(reader.GetDateTime(7)),
                    checkoutId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    stayId = reader.GetString(2),
                    currentBalance = reader.GetDecimal(3),
                    depositHeldAmount = reader.GetDecimal(4),
                    closeResult = reader.GetString(5),
                    status = reader.GetString(6),
                    updatedAtUtc = reader.GetDateTime(7)
                }),
            "service-task-queue" => Query("""
                select task_id, workspace_id, task_type, room_id, bed_id, urgency, blocks_availability, status, updated_at_utc
                from service_tasks
                where workspace_id = 'W-STAY-SERVICE-TASK'
                  and status not in ('verified', 'cancelled')
                order by updated_at_utc, task_id
                """, reader => new
                {
                    lens = "ServiceTaskQueueLens",
                    sourceOfTruthTables = new[] { "service_tasks" },
                    projectionLagSeconds = LagSeconds(reader.GetDateTime(8)),
                    taskId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    taskType = reader.GetString(2),
                    roomId = reader.GetString(3),
                    bedId = reader.GetString(4),
                    urgency = reader.GetString(5),
                    blocksAvailability = reader.GetBoolean(6),
                    status = reader.GetString(7),
                    updatedAtUtc = reader.GetDateTime(8)
                }),
            "expense-analytics" => Query("""
                select expense_category, currency, count(*) as expense_count, sum(amount) as total_amount, sum(approved_amount) as approved_amount
                from expenses
                group by expense_category, currency
                order by total_amount desc, expense_category
                """, reader => new
                {
                    lens = "ExpenseAnalyticsLens",
                    expenseCategory = reader.GetString(0),
                    currency = reader.GetString(1),
                    expenseCount = reader.GetInt64(2),
                    totalAmount = reader.GetDecimal(3),
                    approvedAmount = reader.GetDecimal(4)
                }),
            "period-performance" => Query("""
                select
                    r.period_id,
                    r.workspace_id,
                    r.status,
                    coalesce(m.average_occupancy_rate, 0),
                    coalesce(m.average_occupancy_rate_status, 'missing'),
                    coalesce(f.period_net_cash_flow, 0),
                    coalesce(f.deposit_liability_end, 0),
                    coalesce(f.finance_exception_count, 0),
                    coalesce(p.action_count, 0),
                    coalesce(f.expense_status, 'not_integrated'),
                    case
                        when coalesce(f.expense_status, 'not_integrated') = 'not_integrated'
                            then coalesce(f.body->>'expenseStatusWarning', '支出账本未接入，利润类指标不可用或待确认')
                        else coalesce(f.body->>'expenseStatusWarning', '')
                    end,
                    coalesce(
                        f.body->>'periodProfitMetricStatus',
                        case when coalesce(f.expense_status, 'not_integrated') = 'not_integrated' then 'disabled' else 'available' end),
                    coalesce(l.late_adjustment_count, 0),
                    r.updated_at_utc
                from period_reviews r
                left join period_metric_snapshots m on m.period_id = r.period_id
                left join period_finance_snapshots f on f.period_id = r.period_id
                left join (
                    select period_id, count(*) as action_count
                    from period_action_plans
                    group by period_id
                ) p on p.period_id = r.period_id
                left join (
                    select period_id, count(*) as late_adjustment_count
                    from period_late_adjustments
                    group by period_id
                ) l on l.period_id = r.period_id
                order by r.updated_at_utc, r.period_id
                """, reader => new
                {
                    lens = "PeriodPerformanceLens",
                    sourceOfTruthTables = new[] { "period_reviews", "period_metric_snapshots", "period_finance_snapshots", "expense_ledger_status", "period_action_plans", "period_late_adjustments" },
                    projectionLagSeconds = LagSeconds(reader.GetDateTime(13)),
                    periodId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    status = reader.GetString(2),
                    averageOccupancyRate = reader.GetDecimal(3),
                    averageOccupancyRateStatus = reader.GetString(4),
                    periodNetCashFlow = reader.GetDecimal(5),
                    depositLiabilityEnd = reader.GetDecimal(6),
                    financeExceptionCount = reader.GetInt32(7),
                    actionPlanCount = reader.GetInt64(8),
                    expenseStatus = reader.GetString(9),
                    expenseStatusWarning = reader.GetString(10),
                    periodProfitMetricStatus = reader.GetString(11),
                    lateAdjustmentCount = reader.GetInt64(12),
                    updatedAtUtc = reader.GetDateTime(13)
                }),
            "risk-command" => QueryRiskCommand(),
            _ => Array.Empty<object>()
        };

    private IReadOnlyList<object> QueryRiskCommand()
    {
        const string sql = """
            with debt_risk as (
                select
                    coalesce(sum(balance), 0) as amount,
                    count(*) as risk_count,
                    min(currency) as currency,
                    max(updated_at_utc) as updated_at_utc,
                    coalesce(array_agg(stay_id order by updated_at_utc, stay_id), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(created_event_id order by updated_at_utc, stay_id), array[]::text[]) as event_ids
                from stay_balances
                where balance > 0
            ),
            deposit_liability_risk as (
                select
                    coalesce(sum(liability_balance), 0) as amount,
                    count(*) as risk_count,
                    min(currency) as currency,
                    max(updated_at_utc) as updated_at_utc,
                    coalesce(array_agg(deposit_id order by updated_at_utc, deposit_id), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(created_event_id order by updated_at_utc, deposit_id), array[]::text[]) as event_ids
                from deposit_liabilities
                where liability_balance > 0
            ),
            pending_payment_risk as (
                select
                    coalesce(sum(amount), 0) as amount,
                    count(*) as risk_count,
                    min(currency) as currency,
                    max(updated_at_utc) as updated_at_utc,
                    coalesce(array_agg(payment_id order by updated_at_utc, payment_id), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(created_event_id order by updated_at_utc, payment_id), array[]::text[]) as event_ids
                from hostel_payments
                where workspace_id = 'W-STAY-PAYMENT-LEDGER'
                  and status <> 'confirmed'
            ),
            refund_payment_risk as (
                select
                    coalesce(sum(amount), 0) as amount,
                    count(*) as risk_count,
                    min(currency) as currency,
                    max(occurred_at_utc) as updated_at_utc,
                    coalesce(array_agg(transaction_id order by occurred_at_utc, transaction_id), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(created_event_id order by occurred_at_utc, transaction_id), array[]::text[]) as event_ids
                from deposit_transactions
                where transaction_type in ('refund_approved', 'refund_initiated', 'refund_failed', 'refund_partially_paid')
                  and status not in ('paid', 'closed', 'cancelled', 'resolved', 'superseded')
            ),
            blocked_bed_source as (
                select
                    bed_id as source_id,
                    bed_id as ledger_ref,
                    null::text as work_item_id,
                    created_event_id as event_id,
                    updated_at_utc
                from accommodation_beds
                where status ilike '%block%'
                   or status ilike '%maintenance%'
                   or status in ('维修阻断', 'blocked')
                union all
                select
                    coalesce(nullif(bed_id, ''), task_id) as source_id,
                    task_id as ledger_ref,
                    task_id as work_item_id,
                    created_event_id as event_id,
                    updated_at_utc
                from service_tasks
                where blocks_availability
                  and status not in ('verified', 'cancelled', 'closed')
            ),
            blocked_bed_risk as (
                select
                    count(distinct source_id) as risk_count,
                    max(updated_at_utc) as updated_at_utc,
                    coalesce(array_agg(distinct ledger_ref) filter (where ledger_ref is not null), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(distinct work_item_id) filter (where work_item_id is not null), array[]::text[]) as work_item_ids,
                    coalesce(array_agg(distinct event_id) filter (where event_id is not null), array[]::text[]) as event_ids
                from blocked_bed_source
            ),
            service_backlog_risk as (
                select
                    count(*) as risk_count,
                    max(updated_at_utc) as updated_at_utc,
                    coalesce(array_agg(task_id order by updated_at_utc, task_id), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(task_id order by updated_at_utc, task_id), array[]::text[]) as work_item_ids,
                    coalesce(array_agg(created_event_id order by updated_at_utc, task_id), array[]::text[]) as event_ids
                from service_tasks
                where workspace_id = 'W-STAY-SERVICE-TASK'
                  and status not in ('verified', 'cancelled', 'closed')
                  and task_type in ('cleaning', 'repair', 'maintenance', 'room_cleaning', 'bed_repair')
            ),
            open_period_risk as (
                select
                    count(*) as risk_count,
                    max(updated_at_utc) as updated_at_utc,
                    coalesce(array_agg(period_id order by updated_at_utc, period_id), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(created_event_id order by updated_at_utc, period_id), array[]::text[]) as event_ids
                from period_reviews
                where workspace_id = 'W-STAY-PERIOD-ANALYTICS'
                  and status <> 'closed'
            ),
            period_late_adjustment_risk as (
                select
                    count(*) as risk_count,
                    max(created_at_utc) as updated_at_utc,
                    coalesce(array_agg(late_adjustment_id order by created_at_utc, late_adjustment_id), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(event_id order by created_at_utc, late_adjustment_id), array[]::text[]) as event_ids,
                    min(period_id) as period_id,
                    min(created_by) as owner_actor_id
                from period_late_adjustments
            ),
            reconciliation_risk as (
                select
                    count(*) as risk_count,
                    max(coalesce(reconciliation_case.updated_at_utc, mismatch.created_at_utc)) as updated_at_utc,
                    coalesce(array_agg(distinct mismatch.mismatch_id), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(distinct reconciliation_case.case_id) filter (where reconciliation_case.case_id is not null), array[]::text[]) as case_refs,
                    coalesce(array_agg(distinct reconciliation_case.opened_event_id) filter (where reconciliation_case.opened_event_id is not null), array[]::text[]) as event_ids,
                    coalesce(min(reconciliation_case.owner_role), 'finance') as owner_role,
                    min(reconciliation_case.due_at_utc) as due_at,
                    bool_or(mismatch.mismatch_type in ('amount_mismatch', 'currency_mismatch', 'evidence_mismatch', 'duplicate_bank_transaction', 'refund_paid_without_bank_debit')) as has_p0
                from payment_mismatches mismatch
                left join reconciliation_cases reconciliation_case
                  on reconciliation_case.tenant_id = mismatch.tenant_id
                 and reconciliation_case.mismatch_id = mismatch.mismatch_id
                where mismatch.status in ('open', 'resolving')
                   or reconciliation_case.status in ('open', 'assigned', 'blocked')
            ),
            high_risk_correction as (
                select
                    count(*) as risk_count,
                    max(updated_at_utc) as updated_at_utc,
                    coalesce(array_agg(correction_request_id order by updated_at_utc, correction_request_id), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(case_id order by updated_at_utc, correction_request_id) filter (where case_id is not null), array[]::text[]) as case_refs,
                    coalesce(min(case_id) filter (where case_id is not null), null) as related_case_id,
                    bool_or(risk_level = 'critical') as has_critical
                from ledger_correction_requests
                where status in ('requested', 'pending_approval', 'approved')
                  and risk_level in ('high', 'critical')
            ),
            overdue_work_items as (
                select
                    count(*) as risk_count,
                    max(created_at_utc) as updated_at_utc,
                    coalesce(array_agg(work_item_id order by created_at_utc, work_item_id), array[]::text[]) as work_item_ids,
                    coalesce(array_agg(source_event_id order by created_at_utc, work_item_id), array[]::text[]) as event_ids,
                    coalesce(min(owner_role), 'manager') as owner_role,
                    min((body->>'dueAtUtc')::timestamptz) as due_at
                from process_work_item_intents
                where status not in ('done', 'completed', 'closed', 'cancelled', 'resolved')
                  and body ? 'dueAtUtc'
                  and body->>'dueAtUtc' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
                  and (body->>'dueAtUtc')::timestamptz < now()
            ),
            open_blockers as (
                select
                    count(*) as risk_count,
                    max(created_at_utc) as updated_at_utc,
                    coalesce(array_agg(intent_id order by created_at_utc, intent_id), array[]::text[]) as ledger_refs,
                    coalesce(array_agg(body->>'resolutionWorkItemId' order by created_at_utc, intent_id) filter (where body ? 'resolutionWorkItemId'), array[]::text[]) as work_item_ids,
                    coalesce(array_agg(source_event_id order by created_at_utc, intent_id), array[]::text[]) as event_ids,
                    coalesce(min(nullif(body->>'ownerRole', '')), 'manager') as owner_role,
                    min((body->>'dueAtUtc')::timestamptz) filter (where body->>'dueAtUtc' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T') as due_at,
                    bool_or(coalesce(body->>'severity', '') = 'P0') as has_p0
                from process_request_event_intents
                where request_event_type = 'Accommodation.CaseBlockerCreated'
                  and status not in ('resolved', 'waived', 'closed', 'cancelled')
            )
            select * from (
                select
                    'risk-debt-guests' as risk_id,
                    'debt_risk' as risk_type,
                    case when amount >= 10000 then 'P0' else 'P1' end as severity,
                    'StayBalance balance > 0 indicates unpaid ordinary charges.' as severity_reason,
                    amount,
                    risk_count,
                    currency,
                    'finance' as owner_role,
                    null::text as owner_actor_id,
                    'StayBalance' as related_object,
                    null::text as related_case_id,
                    array[]::text[] as work_item_ids,
                    ledger_refs,
                    array[]::text[] as evidence_refs,
                    event_ids,
                    'createPaymentAllocationWorkItem' as resolve_action,
                    null::timestamptz as due_at,
                    '/pc/finance/stay-balances?status=debt' as drilldown_url,
                    array['stay_balances']::text[] as source_tables,
                    updated_at_utc
                from debt_risk
                where amount > 0
                union all
                select
                    'risk-deposit-liability',
                    'deposit_liability',
                    case when amount >= 10000 then 'P1' else 'P2' end,
                    'DepositLedger liability_balance > 0 means tenant-held liability remains open.',
                    amount,
                    risk_count,
                    currency,
                    'finance',
                    null::text,
                    'DepositLiability',
                    null::text,
                    array[]::text[],
                    ledger_refs,
                    array[]::text[],
                    event_ids,
                    'openDepositLiabilityQueue',
                    null::timestamptz,
                    '/pc/finance/deposits?status=open',
                    array['deposit_liabilities']::text[],
                    updated_at_utc
                from deposit_liability_risk
                where amount > 0
                union all
                select
                    'risk-payment-pending-confirmation',
                    'payment_pending_confirmation',
                    case when amount >= 10000 or risk_count >= 5 then 'P1' else 'P2' end,
                    'PaymentRiskLens reads hostel_payments where status is not confirmed.',
                    amount,
                    risk_count,
                    currency,
                    'finance',
                    null::text,
                    'PaymentRisk',
                    null::text,
                    array[]::text[],
                    ledger_refs,
                    array[]::text[],
                    event_ids,
                    'openPaymentConfirmationQueue',
                    null::timestamptz,
                    '/pc/finance/payments?status=pending-confirmation',
                    array['hostel_payments']::text[],
                    updated_at_utc
                from pending_payment_risk
                where risk_count > 0
                union all
                select
                    'risk-refund-payment-pending',
                    'refund_payment_pending',
                    case when amount >= 10000 then 'P1' else 'P2' end,
                    'Deposit refund ledger entries are approved or initiated but not paid/closed.',
                    amount,
                    risk_count,
                    currency,
                    'finance',
                    null::text,
                    'DepositRefund',
                    null::text,
                    array[]::text[],
                    ledger_refs,
                    array[]::text[],
                    event_ids,
                    'openRefundPaymentQueue',
                    null::timestamptz,
                    '/pc/finance/refunds?status=pending',
                    array['deposit_transactions']::text[],
                    updated_at_utc
                from refund_payment_risk
                where risk_count > 0
                union all
                select
                    'risk-blocked-beds',
                    'blocked_beds',
                    case when risk_count >= 3 then 'P1' else 'P2' end,
                    'ResourceInventory bed status or blocking ServiceTask marks beds unavailable.',
                    null::numeric,
                    risk_count,
                    null::text,
                    'operations',
                    null::text,
                    'BedInventory',
                    null::text,
                    work_item_ids,
                    ledger_refs,
                    array[]::text[],
                    event_ids,
                    'openResourceReleaseWorkItem',
                    null::timestamptz,
                    '/pc/resources/beds?status=blocked',
                    array['accommodation_beds', 'service_tasks']::text[],
                    updated_at_utc
                from blocked_bed_risk
                where risk_count > 0
                union all
                select
                    'risk-service-backlog',
                    'service_task_backlog',
                    case when risk_count >= 5 then 'P1' else 'P2' end,
                    'ServiceTaskQueueLens reads service_tasks that are not verified or cancelled.',
                    null::numeric,
                    risk_count,
                    null::text,
                    'operations',
                    null::text,
                    'ServiceTaskQueue',
                    null::text,
                    work_item_ids,
                    ledger_refs,
                    array[]::text[],
                    event_ids,
                    'openServiceTaskQueue',
                    null::timestamptz,
                    '/pc/service-tasks?status=open',
                    array['service_tasks']::text[],
                    updated_at_utc
                from service_backlog_risk
                where risk_count > 0
                union all
                select
                    'risk-open-periods',
                    'period_not_closed',
                    case when risk_count >= 2 then 'P1' else 'P2' end,
                    'PeriodAnalytics period_reviews have reviews not closed.',
                    null::numeric,
                    risk_count,
                    null::text,
                    'manager',
                    null::text,
                    'PeriodReview',
                    null::text,
                    array[]::text[],
                    ledger_refs,
                    array[]::text[],
                    event_ids,
                    'openPeriodReview',
                    null::timestamptz,
                    '/pc/governance/periods?status=open',
                    array['period_reviews']::text[],
                    updated_at_utc
                from open_period_risk
                where risk_count > 0
                union all
                select
                    'risk-period-late-adjustments',
                    'period_late_adjustment',
                    case when risk_count >= 3 then 'P1' else 'P2' end,
                    'Closed period has append-only LateAdjustment entries requiring governance review.',
                    null::numeric,
                    risk_count,
                    null::text,
                    'manager',
                    owner_actor_id,
                    'PeriodReview',
                    period_id,
                    array[]::text[],
                    ledger_refs,
                    array[]::text[],
                    event_ids,
                    'openPeriodLateAdjustmentReview',
                    null::timestamptz,
                    '/pc/governance/periods/late-adjustments',
                    array['period_late_adjustments']::text[],
                    updated_at_utc
                from period_late_adjustment_risk
                where risk_count > 0
                union all
                select
                    'risk-reconciliation-mismatch',
                    'reconciliation_mismatch',
                    case when has_p0 then 'P0' else 'P1' end,
                    'Reconciliation mismatch cases remain open or resolving.',
                    null::numeric,
                    risk_count,
                    null::text,
                    owner_role,
                    null::text,
                    'ReconciliationCase',
                    case when array_length(case_refs, 1) = 1 then case_refs[1] else null end,
                    array[]::text[],
                    ledger_refs,
                    array[]::text[],
                    event_ids,
                    'openReconciliationCase',
                    due_at,
                    '/pc/finance/reconciliation?status=open',
                    array['payment_mismatches', 'reconciliation_cases']::text[],
                    updated_at_utc
                from reconciliation_risk
                where risk_count > 0
                union all
                select
                    'risk-high-risk-correction',
                    'high_risk_correction',
                    case when has_critical then 'P0' else 'P1' end,
                    'CorrectionCenter high or critical correction requests are not applied or rejected.',
                    null::numeric,
                    risk_count,
                    null::text,
                    'finance',
                    null::text,
                    'LedgerCorrectionRequest',
                    related_case_id,
                    array[]::text[],
                    ledger_refs,
                    array[]::text[],
                    array[]::text[],
                    'openCorrectionApproval',
                    null::timestamptz,
                    '/pc/finance/corrections?risk=high',
                    array['ledger_correction_requests']::text[],
                    updated_at_utc
                from high_risk_correction
                where risk_count > 0
                union all
                select
                    'risk-overdue-work-items',
                    'overdue_work_items',
                    case when risk_count >= 5 then 'P1' else 'P2' end,
                    'WorkQueueLens/SLA process intents have dueAtUtc before now.',
                    null::numeric,
                    risk_count,
                    null::text,
                    owner_role,
                    null::text,
                    'WorkQueue',
                    null::text,
                    work_item_ids,
                    array[]::text[],
                    array[]::text[],
                    event_ids,
                    'openOverdueWorkQueue',
                    due_at,
                    '/pc/work-items?status=overdue',
                    array['process_work_item_intents']::text[],
                    updated_at_utc
                from overdue_work_items
                where risk_count > 0
                union all
                select
                    'risk-open-blockers',
                    'open_blockers',
                    case when has_p0 then 'P0' else 'P1' end,
                    'BlockerEngine request intents are open and require resolution.',
                    null::numeric,
                    risk_count,
                    null::text,
                    owner_role,
                    null::text,
                    'BlockerEngine',
                    null::text,
                    work_item_ids,
                    ledger_refs,
                    array[]::text[],
                    event_ids,
                    'openBlockerResolution',
                    due_at,
                    '/pc/governance/blockers?status=open',
                    array['process_request_event_intents']::text[],
                    updated_at_utc
                from open_blockers
                where risk_count > 0
            ) risk_items
            order by
                case severity when 'P0' then 0 when 'P1' then 1 else 2 end,
                risk_type
            """;

        var inputs = Query(sql, reader => new RiskCommandLensInput(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetDecimal(4),
            reader.IsDBNull(5) ? null : reader.GetInt64(5),
            reader.IsDBNull(6) ? null : reader.GetString(6),
            reader.GetString(7),
            reader.IsDBNull(8) ? null : reader.GetString(8),
            reader.GetString(9),
            reader.IsDBNull(10) ? null : reader.GetString(10),
            TextArray(reader, 11),
            TextArray(reader, 12),
            TextArray(reader, 13),
            TextArray(reader, 14),
            reader.GetString(15),
            reader.IsDBNull(16) ? null : reader.GetDateTime(16),
            reader.GetString(17),
            TextArray(reader, 18),
            reader.IsDBNull(19) ? 0 : LagSeconds(reader.GetDateTime(19))));

        return RiskCommandLensBuilder.Build(inputs.Cast<RiskCommandLensInput>()).Cast<object>().ToArray();
    }

    private IReadOnlyList<object> Query(string sql, Func<NpgsqlDataReader, object> map)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = command.ExecuteReader();
        var items = new List<object>();
        while (reader.Read())
        {
            items.Add(map(reader));
        }

        return items;
    }

    private static string[] TextArray(NpgsqlDataReader reader, int ordinal) =>
        reader.IsDBNull(ordinal) ? [] : reader.GetFieldValue<string[]>(ordinal);

    private static long LagSeconds(DateTime updatedAtUtc) =>
        Math.Max(0, Convert.ToInt64((DateTime.UtcNow - DateTime.SpecifyKind(updatedAtUtc, DateTimeKind.Utc)).TotalSeconds));
}
