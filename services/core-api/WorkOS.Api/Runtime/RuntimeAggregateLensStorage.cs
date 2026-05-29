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
                    case when count(*) = 0 then 0 else count(b.booking_id)::numeric / count(*) end as reservation_rate
                from hostel_leads l
                left join hostel_bookings b on b.lead_id = l.lead_id
                left join hostel_stays s on s.stay_id = replace(b.booking_id, 'booking', 'stay')
                group by l.source_channel
                order by lead_count desc, l.source_channel
                """, reader => new
                {
                    lens = "LeadFunnelLens",
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
                where status <> 'confirmed'
                order by updated_at_utc, payment_id
                """, reader => new
                {
                    lens = "PaymentRiskLens",
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
                select task_id, workspace_id, task_type, room_id, bed_id, urgency, blocks_availability, status, actual_cost_amount, updated_at_utc
                from service_tasks
                where status not in ('verified', 'cancelled')
                order by updated_at_utc, task_id
                """, reader => new
                {
                    lens = "ServiceTaskQueueLens",
                    taskId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    taskType = reader.GetString(2),
                    roomId = reader.GetString(3),
                    bedId = reader.GetString(4),
                    urgency = reader.GetString(5),
                    blocksAvailability = reader.GetBoolean(6),
                    status = reader.GetString(7),
                    actualCostAmount = reader.GetDecimal(8),
                    updatedAtUtc = reader.GetDateTime(9)
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
                    r.updated_at_utc
                from period_reviews r
                left join period_metric_snapshots m on m.period_id = r.period_id
                left join period_finance_snapshots f on f.period_id = r.period_id
                left join (
                    select period_id, count(*) as action_count
                    from period_action_plans
                    group by period_id
                ) p on p.period_id = r.period_id
                order by r.updated_at_utc, r.period_id
                """, reader => new
                {
                    lens = "PeriodPerformanceLens",
                    periodId = reader.GetString(0),
                    workspaceId = reader.GetString(1),
                    status = reader.GetString(2),
                    averageOccupancyRate = reader.GetDecimal(3),
                    averageOccupancyRateStatus = reader.GetString(4),
                    periodNetCashFlow = reader.GetDecimal(5),
                    depositLiabilityEnd = reader.GetDecimal(6),
                    financeExceptionCount = reader.GetInt32(7),
                    actionPlanCount = reader.GetInt64(8),
                    updatedAtUtc = reader.GetDateTime(9)
                }),
            "risk-command" => Query("""
                select
                    (select coalesce(sum(balance), 0) from stay_balances where balance > 0) as debt_amount,
                    (select count(*) from hostel_payments where status <> 'confirmed') as pending_payment_count,
                    (select count(*) from service_tasks where status not in ('verified', 'cancelled')) as open_task_count,
                    (select count(*) from accommodation_beds where status ilike '%block%' or status ilike '%maintenance%' or status = 'blocked') as blocked_bed_count,
                    (select coalesce(sum(liability_balance), 0) from deposit_liabilities) as deposit_liability_balance,
                    (select count(*) from period_reviews where status <> 'closed') as open_period_count
                """, reader => new
                {
                    lens = "RiskCommandLens",
                    debtAmount = reader.GetDecimal(0),
                    pendingPaymentCount = reader.GetInt64(1),
                    openTaskCount = reader.GetInt64(2),
                    blockedBedCount = reader.GetInt64(3),
                    depositLiabilityBalance = reader.GetDecimal(4),
                    openPeriodCount = reader.GetInt64(5)
                }),
            _ => Array.Empty<object>()
        };

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
}
