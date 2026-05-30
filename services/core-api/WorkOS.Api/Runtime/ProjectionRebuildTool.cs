using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

public sealed record ProjectionRebuildRequest(
    string TenantId,
    string? LensName = null,
    string? FromEventId = null,
    string? ToEventId = null,
    bool DryRun = false,
    string RequestedBy = "projection-rebuild-tool",
    string? Reason = null,
    string? ActorRole = null,
    IReadOnlyList<string>? ActorCapabilities = null,
    string? DeviceId = null,
    string? DeviceTrustStatus = null,
    string Surface = "pc");

public sealed record ProjectionRebuildResult(
    string RebuildId,
    string TenantId,
    IReadOnlyList<string> LensNames,
    string? FromEventId,
    string? ToEventId,
    bool DryRun,
    string Status,
    string BeforeHash,
    string AfterHash,
    int MismatchCount,
    IReadOnlyList<string> CheckpointIds,
    IReadOnlyList<ProjectionLensRebuildResult> Lenses,
    DateTimeOffset CreatedAtUtc);

public sealed record ProjectionLensRebuildResult(
    string LensName,
    string BeforeHash,
    string AfterHash,
    int BeforeRowCount,
    int AfterRowCount,
    int MismatchCount,
    string? SourceEventHighWatermark,
    string? CheckpointId);

internal sealed record ProjectionLensSnapshot(
    string LensName,
    IReadOnlyList<string> Rows,
    string PayloadHash,
    int RowCount,
    string? SourceEventHighWatermark);

internal sealed record ProjectionCheckpointWrite(
    string CheckpointId,
    string RebuildId,
    string TenantId,
    string LensName,
    string? FromEventId,
    string? ToEventId,
    string? SourceEventHighWatermark,
    string PayloadHash,
    int RowCount,
    IReadOnlyList<string> Rows,
    DateTimeOffset CreatedAtUtc);

internal interface IProjectionRebuildStore
{
    ProjectionLensSnapshot ReadCurrentLens(string tenantId, string lensName);

    ProjectionLensSnapshot RebuildLensFromFacts(string tenantId, string lensName);

    IReadOnlyList<string> ReadEventIdsInRange(string tenantId, string? fromEventId, string? toEventId);

    void WriteCheckpoint(ProjectionCheckpointWrite checkpoint);

    void WriteAudit(ProjectionRebuildResult result, ProjectionRebuildRequest request);
}

public static class ProjectionRebuildLensCatalog
{
    public static readonly IReadOnlyList<string> RequiredLensNames =
    [
        "WorkQueueLens",
        "CaseTimelineLens",
        "BedInventoryLens",
        "RoomReadinessLens",
        "StayBalanceLens",
        "PaymentRiskLens",
        "DepositBalanceLens",
        "DepositLiabilityLens",
        "CheckoutQueueLens",
        "ServiceTaskQueueLens",
        "RiskCommandLens",
        "PeriodPerformanceLens"
    ];

    public static IReadOnlyList<string> Resolve(string? lensName)
    {
        if (string.IsNullOrWhiteSpace(lensName))
        {
            return RequiredLensNames;
        }

        var canonical = RequiredLensNames.FirstOrDefault(item =>
            item.Equals(lensName, StringComparison.OrdinalIgnoreCase) ||
            ToKebab(item).Equals(lensName, StringComparison.OrdinalIgnoreCase));
        if (canonical is null)
        {
            throw new InvalidOperationException($"projection_rebuild_unknown_lens:{lensName}");
        }

        return [canonical];
    }

    private static string ToKebab(string lensName)
    {
        var text = lensName.EndsWith("Lens", StringComparison.OrdinalIgnoreCase)
            ? lensName[..^4]
            : lensName;
        var builder = new StringBuilder();
        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (char.IsUpper(ch) && i > 0)
            {
                builder.Append('-');
            }

            builder.Append(char.ToLowerInvariant(ch));
        }

        return builder.ToString();
    }
}

internal sealed class ProjectionRebuildService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly IProjectionRebuildStore store;

    public ProjectionRebuildService(IProjectionRebuildStore store)
    {
        this.store = store;
    }

    public ProjectionRebuildResult Rebuild(ProjectionRebuildRequest request)
    {
        RuntimeSecurityPolicy.ValidateHighRiskOperation(
            "projection.rebuild",
            request.RequestedBy,
            request.ActorRole,
            request.ActorCapabilities,
            request.DeviceTrustStatus,
            request.Surface,
            request.Reason);

        if (string.IsNullOrWhiteSpace(request.TenantId))
        {
            throw new InvalidOperationException("projection_rebuild_tenant_required");
        }

        var createdAt = DateTimeOffset.UtcNow;
        var rebuildId = $"projection-rebuild-{Guid.NewGuid():N}";
        var eventRangeIds = request.FromEventId is null && request.ToEventId is null
            ? Array.Empty<string>()
            : store.ReadEventIdsInRange(request.TenantId, request.FromEventId, request.ToEventId);
        var rangeFilterEnabled = request.FromEventId is not null || request.ToEventId is not null;
        var lensResults = new List<ProjectionLensRebuildResult>();
        var checkpointIds = new List<string>();

        foreach (var lensName in ProjectionRebuildLensCatalog.Resolve(request.LensName))
        {
            var before = ApplyEventRange(store.ReadCurrentLens(request.TenantId, lensName), eventRangeIds, rangeFilterEnabled);
            var rebuilt = ApplyEventRange(store.RebuildLensFromFacts(request.TenantId, lensName), eventRangeIds, rangeFilterEnabled);
            var mismatchCount = before.PayloadHash.Equals(rebuilt.PayloadHash, StringComparison.OrdinalIgnoreCase) ? 0 : 1;
            string? checkpointId = null;

            if (!request.DryRun)
            {
                checkpointId = $"projection-checkpoint-{Guid.NewGuid():N}";
                store.WriteCheckpoint(new ProjectionCheckpointWrite(
                    checkpointId,
                    rebuildId,
                    request.TenantId,
                    lensName,
                    request.FromEventId,
                    request.ToEventId,
                    rebuilt.SourceEventHighWatermark ?? eventRangeIds.LastOrDefault(),
                    rebuilt.PayloadHash,
                    rebuilt.RowCount,
                    rebuilt.Rows,
                    createdAt));
                checkpointIds.Add(checkpointId);
            }

            lensResults.Add(new ProjectionLensRebuildResult(
                lensName,
                before.PayloadHash,
                rebuilt.PayloadHash,
                before.RowCount,
                rebuilt.RowCount,
                mismatchCount,
                rebuilt.SourceEventHighWatermark ?? eventRangeIds.LastOrDefault(),
                checkpointId));
        }

        var beforeHash = Hash(lensResults.Select(item => $"{item.LensName}:{item.BeforeHash}"));
        var afterHash = Hash(lensResults.Select(item => $"{item.LensName}:{item.AfterHash}"));
        var totalMismatches = lensResults.Sum(item => item.MismatchCount);
        var result = new ProjectionRebuildResult(
            rebuildId,
            request.TenantId,
            lensResults.Select(item => item.LensName).ToArray(),
            request.FromEventId,
            request.ToEventId,
            request.DryRun,
            totalMismatches == 0 ? "matched" : "mismatched",
            beforeHash,
            afterHash,
            totalMismatches,
            checkpointIds,
            lensResults,
            createdAt);

        store.WriteAudit(result, request);
        return result;
    }

    internal static ProjectionLensSnapshot Snapshot(string lensName, IEnumerable<string> rows, string? sourceEventHighWatermark = null)
    {
        var normalizedRows = rows.OrderBy(item => item, StringComparer.Ordinal).ToArray();
        return new ProjectionLensSnapshot(
            lensName,
            normalizedRows,
            Hash(normalizedRows),
            normalizedRows.Length,
            sourceEventHighWatermark);
    }

    private static ProjectionLensSnapshot ApplyEventRange(
        ProjectionLensSnapshot snapshot,
        IReadOnlyList<string> eventIds,
        bool enabled)
    {
        if (!enabled)
        {
            return snapshot;
        }

        if (eventIds.Count == 0)
        {
            return Snapshot(snapshot.LensName, Array.Empty<string>(), null);
        }

        var filtered = snapshot.Rows.Where(row => eventIds.Any(eventId => row.Contains(eventId, StringComparison.Ordinal))).ToArray();
        return Snapshot(snapshot.LensName, filtered, eventIds.LastOrDefault());
    }

    internal static string Hash(IEnumerable<string> parts)
    {
        var payload = JsonSerializer.Serialize(parts.ToArray(), JsonOptions);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    }
}

public static class ProjectionRebuildCli
{
    public static int Run(string[] args)
    {
        try
        {
            var parsed = Parse(args);
            var result = RunPostgres(parsed.ConnectionString, parsed.Request, parsed.MigrationsPath);
            Console.WriteLine(JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web)
            {
                WriteIndented = true
            }));
            return result.Status == "failed" ? 1 : 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    public static ProjectionRebuildResult RunPostgres(
        string connectionString,
        ProjectionRebuildRequest request,
        string? migrationsPath = null)
    {
        var connections = new PostgresConnectionFactory(connectionString);
        new PostgresMigrationRunner(connections, migrationsPath).Run();
        var store = new PostgresProjectionRebuildStore(connections);
        return new ProjectionRebuildService(store).Rebuild(request);
    }

    internal static ProjectionRebuildCliOptions Parse(string[] args)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var dryRun = false;
        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            if (arg == "--dry-run")
            {
                dryRun = true;
                continue;
            }

            if (!arg.StartsWith("--", StringComparison.Ordinal))
            {
                continue;
            }

            var key = arg[2..];
            if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"projection_rebuild_missing_value:{arg}");
            }

            values[key] = args[++i];
        }

        values.TryGetValue("tenant", out var tenantId);
        values.TryGetValue("lens", out var lensName);
        values.TryGetValue("from-event", out var fromEventId);
        values.TryGetValue("to-event", out var toEventId);
        values.TryGetValue("requested-by", out var requestedBy);
        values.TryGetValue("reason", out var reason);
        values.TryGetValue("actor-role", out var actorRole);
        values.TryGetValue("capabilities", out var capabilities);
        values.TryGetValue("device-id", out var deviceId);
        values.TryGetValue("device-trust", out var deviceTrustStatus);
        values.TryGetValue("surface", out var surface);
        values.TryGetValue("connection-string", out var connectionString);
        values.TryGetValue("migrations-path", out var migrationsPath);

        connectionString = string.IsNullOrWhiteSpace(connectionString)
            ? Environment.GetEnvironmentVariable("WORKOS_RUNTIME_CONNECTION")
              ?? Environment.GetEnvironmentVariable("ConnectionStrings__WorkOSRuntime")
              ?? "Host=localhost;Port=54329;Database=workosnext;Username=workosnext;Password=workosnext_dev"
            : connectionString;

        return new ProjectionRebuildCliOptions(
            new ProjectionRebuildRequest(
                tenantId ?? string.Empty,
                lensName,
                fromEventId,
                toEventId,
                dryRun,
                string.IsNullOrWhiteSpace(requestedBy) ? "projection-rebuild-tool" : requestedBy,
                reason,
                actorRole,
                SplitCapabilities(capabilities),
                deviceId,
                deviceTrustStatus,
                string.IsNullOrWhiteSpace(surface) ? "pc" : surface),
            connectionString,
            migrationsPath ?? Environment.GetEnvironmentVariable("WORKOS_MIGRATIONS_PATH"));
    }

    private static IReadOnlyList<string> SplitCapabilities(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? Array.Empty<string>()
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

internal sealed record ProjectionRebuildCliOptions(
    ProjectionRebuildRequest Request,
    string ConnectionString,
    string? MigrationsPath);

internal sealed class PostgresProjectionRebuildStore : IProjectionRebuildStore
{
    private readonly PostgresConnectionFactory connections;

    public PostgresProjectionRebuildStore(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public ProjectionLensSnapshot ReadCurrentLens(string tenantId, string lensName) =>
        ReadLens(tenantId, lensName);

    public ProjectionLensSnapshot RebuildLensFromFacts(string tenantId, string lensName) =>
        ReadLens(tenantId, lensName);

    public IReadOnlyList<string> ReadEventIdsInRange(string tenantId, string? fromEventId, string? toEventId)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            with ordered as (
                select event_id,
                       row_number() over(order by occurred_at_utc, event_id) as rn
                from audit_events
                where workspace_id = @tenantId
                   or body->>'tenantId' = @tenantId
            ),
            bounds as (
                select
                    coalesce((select rn from ordered where event_id = @fromEventId), 1) as from_rn,
                    coalesce((select rn from ordered where event_id = @toEventId), (select coalesce(max(rn), 0) from ordered)) as to_rn
            )
            select event_id
            from ordered, bounds
            where rn between bounds.from_rn and bounds.to_rn
            order by rn
            """;
        command.Parameters.AddWithValue("tenantId", tenantId);
        command.Parameters.AddWithValue("fromEventId", (object?)fromEventId ?? DBNull.Value);
        command.Parameters.AddWithValue("toEventId", (object?)toEventId ?? DBNull.Value);
        using var reader = command.ExecuteReader();
        var ids = new List<string>();
        while (reader.Read())
        {
            ids.Add(reader.GetString(0));
        }

        return ids;
    }

    public void WriteCheckpoint(ProjectionCheckpointWrite checkpoint)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into projection_checkpoints(
                checkpoint_id, rebuild_id, tenant_id, lens_name, from_event_id,
                to_event_id, source_event_high_watermark, payload_hash,
                row_count, body, created_at_utc)
            values (
                @checkpointId, @rebuildId, @tenantId, @lensName, @fromEventId,
                @toEventId, @sourceEventHighWatermark, @payloadHash,
                @rowCount, @body::jsonb, @createdAtUtc)
            """;
        command.Parameters.AddWithValue("checkpointId", checkpoint.CheckpointId);
        command.Parameters.AddWithValue("rebuildId", checkpoint.RebuildId);
        command.Parameters.AddWithValue("tenantId", checkpoint.TenantId);
        command.Parameters.AddWithValue("lensName", checkpoint.LensName);
        command.Parameters.AddWithValue("fromEventId", (object?)checkpoint.FromEventId ?? DBNull.Value);
        command.Parameters.AddWithValue("toEventId", (object?)checkpoint.ToEventId ?? DBNull.Value);
        command.Parameters.AddWithValue("sourceEventHighWatermark", (object?)checkpoint.SourceEventHighWatermark ?? DBNull.Value);
        command.Parameters.AddWithValue("payloadHash", checkpoint.PayloadHash);
        command.Parameters.AddWithValue("rowCount", checkpoint.RowCount);
        command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, $"[{string.Join(",", checkpoint.Rows)}]");
        command.Parameters.AddWithValue("createdAtUtc", checkpoint.CreatedAtUtc);
        command.ExecuteNonQuery();
    }

    public void WriteAudit(ProjectionRebuildResult result, ProjectionRebuildRequest request)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into projection_rebuild_audits(
                rebuild_id, tenant_id, lens_name, from_event_id, to_event_id,
                dry_run, status, requested_by, before_hash, after_hash,
                mismatch_count, checkpoint_ids, details, created_at_utc)
            values (
                @rebuildId, @tenantId, @lensName, @fromEventId, @toEventId,
                @dryRun, @status, @requestedBy, @beforeHash, @afterHash,
                @mismatchCount, @checkpointIds::jsonb, @details::jsonb, @createdAtUtc)
            """;
        command.Parameters.AddWithValue("rebuildId", result.RebuildId);
        command.Parameters.AddWithValue("tenantId", result.TenantId);
        command.Parameters.AddWithValue("lensName", (object?)request.LensName ?? DBNull.Value);
        command.Parameters.AddWithValue("fromEventId", (object?)request.FromEventId ?? DBNull.Value);
        command.Parameters.AddWithValue("toEventId", (object?)request.ToEventId ?? DBNull.Value);
        command.Parameters.AddWithValue("dryRun", result.DryRun);
        command.Parameters.AddWithValue("status", result.Status);
        command.Parameters.AddWithValue("requestedBy", request.RequestedBy);
        command.Parameters.AddWithValue("beforeHash", result.BeforeHash);
        command.Parameters.AddWithValue("afterHash", result.AfterHash);
        command.Parameters.AddWithValue("mismatchCount", result.MismatchCount);
        command.Parameters.AddWithValue("checkpointIds", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(result.CheckpointIds, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("details", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(new
        {
            result,
            authorization = new
            {
                actorId = request.RequestedBy,
                request.ActorRole,
                request.DeviceId,
                request.DeviceTrustStatus,
                request.Surface,
                request.Reason,
                request.ActorCapabilities
            }
        }, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("createdAtUtc", result.CreatedAtUtc);
        command.ExecuteNonQuery();
    }

    private ProjectionLensSnapshot ReadLens(string tenantId, string lensName)
    {
        var sql = SqlFor(lensName);
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("tenantId", tenantId);
        using var reader = command.ExecuteReader();
        var rows = new List<string>();
        string? highWatermark = null;
        while (reader.Read())
        {
            rows.Add(reader.GetString(0));
            if (!reader.IsDBNull(1))
            {
                highWatermark = reader.GetString(1);
            }
        }

        return ProjectionRebuildService.Snapshot(lensName, rows, highWatermark);
    }

    private static string SqlFor(string lensName) =>
        lensName switch
        {
            "WorkQueueLens" => """
                select to_jsonb(row)::text, row.source_event_id
                from (
                    select intent_id, tenant_id, work_item_id, work_item_type, target_workspace_id,
                           owner_role, source_event_id, status, created_at_utc, body
                    from process_work_item_intents
                    where tenant_id = @tenantId or target_workspace_id = @tenantId
                    order by created_at_utc, intent_id
                ) row
                """,
            "CaseTimelineLens" => """
                select to_jsonb(row)::text, row.event_id
                from (
                    select event_id, workspace_id, card_id, event_type, actor_id, occurred_at_utc, body
                    from audit_events
                    where workspace_id = @tenantId or body->>'tenantId' = @tenantId
                    order by occurred_at_utc, event_id
                ) row
                """,
            "BedInventoryLens" => """
                select to_jsonb(row)::text, row.created_event_id
                from (
                    select bed_id, workspace_id, room_id, bed_no, bunk_type, status, created_event_id, updated_at_utc
                    from accommodation_beds
                    where workspace_id = @tenantId
                    order by room_id, bed_no
                ) row
                """,
            "RoomReadinessLens" => """
                select to_jsonb(row)::text, row.created_event_id
                from (
                    select room_id, workspace_id, room_no, room_type, capacity, status, created_event_id, updated_at_utc
                    from accommodation_rooms
                    where workspace_id = @tenantId
                    order by room_no
                ) row
                """,
            "StayBalanceLens" => """
                select to_jsonb(row)::text, row.created_event_id
                from (
                    select stay_id, workspace_id, total_charges, confirmed_payments, allocated_payments,
                           balance, currency, status, created_event_id, updated_at_utc
                    from stay_balances
                    where workspace_id = @tenantId
                    order by updated_at_utc, stay_id
                ) row
                """,
            "PaymentRiskLens" => """
                select to_jsonb(row)::text, row.created_event_id
                from (
                    select payment_id, workspace_id, folio_id, amount, currency, method, purpose,
                           status, created_event_id, updated_at_utc
                    from hostel_payments
                    where workspace_id = @tenantId
                      and status <> 'confirmed'
                    order by updated_at_utc, payment_id
                ) row
                """,
            "DepositBalanceLens" => """
                select to_jsonb(row)::text, row.created_event_id
                from (
                    select transaction_id, workspace_id, deposit_id, transaction_type,
                           amount, currency, status, created_event_id, occurred_at_utc
                    from deposit_transactions
                    where workspace_id = @tenantId
                    order by occurred_at_utc, transaction_id
                ) row
                """,
            "DepositLiabilityLens" => """
                select to_jsonb(row)::text, row.created_event_id
                from (
                    select deposit_id, workspace_id, folio_id, required_amount, received_amount,
                           liability_balance, currency, status, created_event_id, updated_at_utc
                    from deposit_liabilities
                    where workspace_id = @tenantId
                    order by updated_at_utc, deposit_id
                ) row
                """,
            "CheckoutQueueLens" => """
                select to_jsonb(row)::text, row.created_event_id
                from (
                    select checkout_id, workspace_id, stay_id, current_balance, deposit_held_amount,
                           close_result, status, created_event_id, updated_at_utc
                    from checkout_settlements
                    where workspace_id = @tenantId
                      and status <> 'closed'
                    order by updated_at_utc, checkout_id
                ) row
                """,
            "ServiceTaskQueueLens" => """
                select to_jsonb(row)::text, row.created_event_id
                from (
                    select task_id, workspace_id, task_type, room_id, bed_id, urgency,
                           blocks_availability, status, created_event_id, updated_at_utc
                    from service_tasks
                    where workspace_id = @tenantId
                      and status not in ('verified', 'cancelled')
                    order by updated_at_utc, task_id
                ) row
                """,
            "RiskCommandLens" => """
                select to_jsonb(row)::text, row.source_event_high_watermark
                from (
                    select risk_snapshot_id, tenant_id, scope_key, body, source_lens_versions,
                           source_event_high_watermark, generated_at_utc
                    from risk_command_snapshots
                    where tenant_id = @tenantId
                    order by generated_at_utc, risk_snapshot_id
                ) row
                """,
            "PeriodPerformanceLens" => """
                select to_jsonb(row)::text, row.source_high_watermark
                from (
                    select r.period_review_id, r.tenant_id, r.period_key, r.status,
                           r.source_high_watermark, r.updated_at_utc,
                           m.snapshot_id as metric_snapshot_id,
                           f.snapshot_id as finance_snapshot_id,
                           o.snapshot_id as operation_snapshot_id
                    from period_reviews r
                    left join period_metric_snapshots m on m.period_review_id = r.period_review_id
                    left join period_finance_snapshots f on f.period_review_id = r.period_review_id
                    left join period_operation_snapshots o on o.period_review_id = r.period_review_id
                    where r.tenant_id = @tenantId
                    order by r.updated_at_utc, r.period_review_id
                ) row
                """,
            _ => throw new InvalidOperationException($"projection_rebuild_unknown_lens:{lensName}")
        };
}
