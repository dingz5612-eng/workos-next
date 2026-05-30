using System.Text.Json;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeProcessManagerStorage : ICheckoutServiceProcessRunSink
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeProcessManagerStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public bool TryRecordProcessRun(
        ProcessRunRecord processRun,
        IReadOnlyList<ProcessWorkItemIntentRecord> workItemIntents,
        IReadOnlyList<ProcessRequestEventIntentRecord> requestEventIntents)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);

        using (var command = db.CreateCommand("""
            insert into process_runs(process_run_id, tenant_id, trigger_event_id, trigger_event_type, process_rule_id, status, created_at_utc, body)
            values (@processRunId, @tenantId, @triggerEventId, @triggerEventType, @processRuleId, @status, @createdAtUtc, @body::jsonb)
            on conflict(tenant_id, trigger_event_id, process_rule_id) do nothing
            """))
        {
            command.Parameters.AddWithValue("processRunId", processRun.ProcessRunId);
            command.Parameters.AddWithValue("tenantId", processRun.TenantId);
            command.Parameters.AddWithValue("triggerEventId", processRun.TriggerEventId);
            command.Parameters.AddWithValue("triggerEventType", processRun.TriggerEventType);
            command.Parameters.AddWithValue("processRuleId", processRun.ProcessRuleId);
            command.Parameters.AddWithValue("status", processRun.Status);
            command.Parameters.AddWithValue("createdAtUtc", processRun.CreatedAtUtc);
            command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(processRun, PostgresProjectionStore.JsonOptions));
            if (command.ExecuteNonQuery() == 0)
            {
                db.Commit();
                return false;
            }
        }

        foreach (var intent in workItemIntents)
        {
            using var command = db.CreateCommand("""
                insert into process_work_item_intents(intent_id, process_run_id, tenant_id, work_item_id, work_item_type, target_workspace_id, owner_role, source_event_id, status, created_at_utc, body)
                values (@intentId, @processRunId, @tenantId, @workItemId, @workItemType, @targetWorkspaceId, @ownerRole, @sourceEventId, @status, @createdAtUtc, @body::jsonb)
                on conflict(intent_id) do nothing
                """);
            command.Parameters.AddWithValue("intentId", intent.IntentId);
            command.Parameters.AddWithValue("processRunId", intent.ProcessRunId);
            command.Parameters.AddWithValue("tenantId", intent.TenantId);
            command.Parameters.AddWithValue("workItemId", intent.WorkItemId);
            command.Parameters.AddWithValue("workItemType", intent.WorkItemType);
            command.Parameters.AddWithValue("targetWorkspaceId", intent.TargetWorkspaceId);
            command.Parameters.AddWithValue("ownerRole", intent.OwnerRole);
            command.Parameters.AddWithValue("sourceEventId", intent.SourceEventId);
            command.Parameters.AddWithValue("status", intent.Status);
            command.Parameters.AddWithValue("createdAtUtc", intent.CreatedAtUtc);
            command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(intent, PostgresProjectionStore.JsonOptions));
            command.ExecuteNonQuery();
        }

        foreach (var intent in requestEventIntents)
        {
            using var command = db.CreateCommand("""
                insert into process_request_event_intents(intent_id, process_run_id, tenant_id, request_event_type, target_slice_id, source_event_id, status, created_at_utc, body)
                values (@intentId, @processRunId, @tenantId, @requestEventType, @targetSliceId, @sourceEventId, @status, @createdAtUtc, @body::jsonb)
                on conflict(intent_id) do nothing
                """);
            command.Parameters.AddWithValue("intentId", intent.IntentId);
            command.Parameters.AddWithValue("processRunId", intent.ProcessRunId);
            command.Parameters.AddWithValue("tenantId", intent.TenantId);
            command.Parameters.AddWithValue("requestEventType", intent.RequestEventType);
            command.Parameters.AddWithValue("targetSliceId", intent.TargetSliceId);
            command.Parameters.AddWithValue("sourceEventId", intent.SourceEventId);
            command.Parameters.AddWithValue("status", intent.Status);
            command.Parameters.AddWithValue("createdAtUtc", intent.CreatedAtUtc);
            command.Parameters.AddWithValue("body", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(intent, PostgresProjectionStore.JsonOptions));
            command.ExecuteNonQuery();
        }

        db.Commit();
        return true;
    }

    public IReadOnlyList<ProcessRunRecord> GetProcessRuns(string? tenantId = null) =>
        Query(
            tenantId,
            "select body from process_runs order by created_at_utc, process_run_id",
            "select body from process_runs where tenant_id = @tenantId order by created_at_utc, process_run_id",
            reader => JsonSerializer.Deserialize<ProcessRunRecord>(reader.GetString(0), PostgresProjectionStore.JsonOptions)!);

    public IReadOnlyList<ProcessWorkItemIntentRecord> GetWorkItemIntents(string? tenantId = null) =>
        Query(
            tenantId,
            "select body from process_work_item_intents order by created_at_utc, intent_id",
            "select body from process_work_item_intents where tenant_id = @tenantId order by created_at_utc, intent_id",
            reader => JsonSerializer.Deserialize<ProcessWorkItemIntentRecord>(reader.GetString(0), PostgresProjectionStore.JsonOptions)!);

    public IReadOnlyList<ProcessRequestEventIntentRecord> GetRequestEventIntents(string? tenantId = null) =>
        Query(
            tenantId,
            "select body from process_request_event_intents order by created_at_utc, intent_id",
            "select body from process_request_event_intents where tenant_id = @tenantId order by created_at_utc, intent_id",
            reader => JsonSerializer.Deserialize<ProcessRequestEventIntentRecord>(reader.GetString(0), PostgresProjectionStore.JsonOptions)!);

    private IReadOnlyList<T> Query<T>(string? tenantId, string allSql, string tenantSql, Func<Npgsql.NpgsqlDataReader, T> map)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = tenantId is null ? allSql : tenantSql;
        if (tenantId is not null)
        {
            command.Parameters.AddWithValue("tenantId", tenantId);
        }

        using var reader = command.ExecuteReader();
        var items = new List<T>();
        while (reader.Read())
        {
            items.Add(map(reader));
        }

        return items;
    }
}
