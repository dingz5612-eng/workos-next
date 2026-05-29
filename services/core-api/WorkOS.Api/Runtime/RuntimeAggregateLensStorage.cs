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
