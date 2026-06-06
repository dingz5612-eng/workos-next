using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

public interface IOperationsWorkItemStore
{
    WorkItem? Get(string workItemId);

    IReadOnlyList<WorkItem> List(string? tenantId = null, string? caseId = null);

    WorkItem Upsert(WorkItem workItem);

    void RecordTransition(WorkItemTransitionRecord transition);

    IReadOnlyList<WorkItemTransitionRecord> GetTransitions(string workItemId);
}

public sealed record WorkItemTransitionRecord(
    string TransitionId,
    string TenantId,
    string CaseId,
    string WorkItemId,
    string? FromState,
    string ToState,
    string? SubmissionId,
    string Reason,
    string? ActorId,
    DateTimeOffset OccurredAtUtc);

public sealed class InMemoryOperationsWorkItemStore : IOperationsWorkItemStore
{
    private readonly Dictionary<string, WorkItem> workItems = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<WorkItemTransitionRecord> transitions = new();

    public IReadOnlyList<WorkItemTransitionRecord> Transitions => transitions.ToArray();

    public WorkItem? Get(string workItemId) =>
        workItems.TryGetValue(workItemId, out var workItem) ? workItem : null;

    public IReadOnlyList<WorkItem> List(string? tenantId = null, string? caseId = null) =>
        workItems.Values
            .Where(item => string.IsNullOrWhiteSpace(tenantId) || item.TenantId.Equals(tenantId, StringComparison.OrdinalIgnoreCase))
            .Where(item => string.IsNullOrWhiteSpace(caseId) || item.CaseId?.Equals(caseId, StringComparison.OrdinalIgnoreCase) == true)
            .OrderBy(item => item.CreatedAtUtc)
            .ThenBy(item => item.WorkItemId, StringComparer.OrdinalIgnoreCase)
            .ToArray();

    public WorkItem Upsert(WorkItem workItem)
    {
        workItems[workItem.WorkItemId] = workItem;
        return workItem;
    }

    public void RecordTransition(WorkItemTransitionRecord transition)
    {
        if (transitions.Any(item => item.TransitionId.Equals(transition.TransitionId, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        transitions.Add(transition);
        if (workItems.TryGetValue(transition.WorkItemId, out var workItem))
        {
            workItems[transition.WorkItemId] = workItem with { Status = transition.ToState };
        }
    }

    public IReadOnlyList<WorkItemTransitionRecord> GetTransitions(string workItemId) =>
        transitions
            .Where(item => item.WorkItemId.Equals(workItemId, StringComparison.OrdinalIgnoreCase))
            .OrderBy(item => item.OccurredAtUtc)
            .ThenBy(item => item.TransitionId, StringComparer.OrdinalIgnoreCase)
            .ToArray();
}

public sealed class PostgresOperationsWorkItemStore : IOperationsWorkItemStore
{
    private const string MissingTable = "42P01";
    private const string MissingSchema = "3F000";
    private readonly PostgresConnectionFactory connections;

    public PostgresOperationsWorkItemStore(string connectionString)
    {
        connections = new PostgresConnectionFactory(connectionString);
    }

    public WorkItem? Get(string workItemId)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = SelectSql + " where work_item_id = @workItemId";
            command.Parameters.AddWithValue("workItemId", workItemId);
            using var reader = command.ExecuteReader();
            return reader.Read() ? ReadWorkItem(reader) : null;
        }
        catch (PostgresException ex) when (ex.SqlState is MissingTable or MissingSchema)
        {
            return null;
        }
    }

    public IReadOnlyList<WorkItem> List(string? tenantId = null, string? caseId = null)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = SelectSql + """
                where (cast(@tenantId as text) is null or tenant_id = @tenantId)
                  and (cast(@caseId as text) is null or case_id = @caseId)
                order by created_at_utc, work_item_id
                """;
            command.Parameters.AddWithValue("tenantId", (object?)tenantId ?? DBNull.Value);
            command.Parameters.AddWithValue("caseId", (object?)caseId ?? DBNull.Value);
            using var reader = command.ExecuteReader();
            var items = new List<WorkItem>();
            while (reader.Read())
            {
                items.Add(ReadWorkItem(reader));
            }

            return items;
        }
        catch (PostgresException ex) when (ex.SqlState is MissingTable or MissingSchema)
        {
            return Array.Empty<WorkItem>();
        }
    }

    public WorkItem Upsert(WorkItem workItem)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into operations_work_items(
                work_item_id, tenant_id, case_id, work_item_type, definition_version_id,
                lifecycle_state, owner_role, owner_actor_id, backup_owner_id,
                escalation_owner_role, due_at_utc, priority, risk_level,
                idempotency_scope, required_evidence_refs, affected_fact_refs,
                workspace_id, source_event_id, source_refs, metadata,
                created_at_utc, updated_at_utc, closed_at_utc)
            values (
                @workItemId, @tenantId, @caseId, @workItemType, @definitionVersionId,
                @lifecycleState, @ownerRole, @ownerActorId, @backupOwnerId,
                @escalationOwnerRole, @dueAtUtc, @priority, @riskLevel,
                @idempotencyScope, @requiredEvidenceRefs, @affectedFactRefs,
                @workspaceId, @sourceEventId, @sourceRefs::jsonb, @metadata::jsonb,
                @createdAtUtc, @updatedAtUtc, @closedAtUtc)
            on conflict(work_item_id) do update
            set tenant_id = excluded.tenant_id,
                case_id = excluded.case_id,
                work_item_type = excluded.work_item_type,
                definition_version_id = excluded.definition_version_id,
                lifecycle_state = excluded.lifecycle_state,
                owner_role = excluded.owner_role,
                owner_actor_id = excluded.owner_actor_id,
                backup_owner_id = excluded.backup_owner_id,
                escalation_owner_role = excluded.escalation_owner_role,
                due_at_utc = excluded.due_at_utc,
                priority = excluded.priority,
                risk_level = excluded.risk_level,
                idempotency_scope = excluded.idempotency_scope,
                required_evidence_refs = excluded.required_evidence_refs,
                affected_fact_refs = excluded.affected_fact_refs,
                workspace_id = excluded.workspace_id,
                source_event_id = excluded.source_event_id,
                source_refs = excluded.source_refs,
                metadata = excluded.metadata,
                updated_at_utc = excluded.updated_at_utc,
                closed_at_utc = excluded.closed_at_utc
            """;
        command.Parameters.AddWithValue("workItemId", workItem.WorkItemId);
        command.Parameters.AddWithValue("tenantId", workItem.TenantId);
        command.Parameters.AddWithValue("caseId", workItem.CaseId ?? $"case-{workItem.TenantId}");
        command.Parameters.AddWithValue("workItemType", workItem.WorkItemType);
        command.Parameters.AddWithValue("definitionVersionId", workItem.DefinitionVersionId);
        command.Parameters.AddWithValue("lifecycleState", workItem.Status);
        command.Parameters.AddWithValue("ownerRole", workItem.OwnerRole);
        command.Parameters.AddWithValue("ownerActorId", (object?)workItem.OwnerActorId ?? DBNull.Value);
        command.Parameters.AddWithValue("backupOwnerId", (object?)workItem.BackupOwnerId ?? DBNull.Value);
        command.Parameters.AddWithValue("escalationOwnerRole", (object?)workItem.EscalationOwnerRole ?? DBNull.Value);
        command.Parameters.AddWithValue("dueAtUtc", (object?)workItem.DueAtUtc ?? DBNull.Value);
        command.Parameters.AddWithValue("priority", (object?)workItem.Priority ?? DBNull.Value);
        command.Parameters.AddWithValue("riskLevel", (object?)workItem.RiskLevel ?? DBNull.Value);
        command.Parameters.AddWithValue("idempotencyScope", workItem.IdempotencyScope);
        command.Parameters.AddWithValue("requiredEvidenceRefs", (workItem.RequiredEvidenceRefs ?? Array.Empty<string>()).ToArray());
        command.Parameters.AddWithValue("affectedFactRefs", (workItem.AffectedFactRefs ?? Array.Empty<string>()).ToArray());
        command.Parameters.AddWithValue("workspaceId", (object?)workItem.WorkspaceId ?? DBNull.Value);
        command.Parameters.AddWithValue("sourceEventId", (object?)workItem.SourceEventId ?? DBNull.Value);
        command.Parameters.AddWithValue("sourceRefs", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["workspaceId"] = workItem.WorkspaceId,
            ["sourceEventId"] = workItem.SourceEventId,
            ["payload"] = workItem.Payload
        }));
        command.Parameters.AddWithValue("metadata", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["source"] = workItem.Source
        }));
        command.Parameters.AddWithValue("createdAtUtc", workItem.CreatedAtUtc);
        command.Parameters.AddWithValue("updatedAtUtc", DateTimeOffset.UtcNow);
        command.Parameters.AddWithValue("closedAtUtc", workItem.Status is "closed" or "confirmed" or "done" ? (object)DateTimeOffset.UtcNow : DBNull.Value);
        command.ExecuteNonQuery();
        return Get(workItem.WorkItemId) ?? workItem;
    }

    public void RecordTransition(WorkItemTransitionRecord transition)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        using (var eventLog = db.CreateCommand("""
            insert into operations_work_item_state_event_log(
                transition_id, tenant_id, case_id, work_item_id, from_state, to_state,
                submission_id, reason, actor_id, occurred_at_utc, metadata)
            values (
                @transitionId, @tenantId, @caseId, @workItemId, @fromState, @toState,
                @submissionId, @reason, @actorId, @occurredAtUtc, '{}'::jsonb)
            on conflict(transition_id) do nothing
            """))
        {
            eventLog.Parameters.AddWithValue("transitionId", transition.TransitionId);
            eventLog.Parameters.AddWithValue("tenantId", transition.TenantId);
            eventLog.Parameters.AddWithValue("caseId", transition.CaseId);
            eventLog.Parameters.AddWithValue("workItemId", transition.WorkItemId);
            eventLog.Parameters.AddWithValue("fromState", (object?)transition.FromState ?? DBNull.Value);
            eventLog.Parameters.AddWithValue("toState", transition.ToState);
            eventLog.Parameters.AddWithValue("submissionId", (object?)transition.SubmissionId ?? DBNull.Value);
            eventLog.Parameters.AddWithValue("reason", transition.Reason);
            eventLog.Parameters.AddWithValue("actorId", (object?)transition.ActorId ?? DBNull.Value);
            eventLog.Parameters.AddWithValue("occurredAtUtc", transition.OccurredAtUtc);
            eventLog.ExecuteNonQuery();
        }

        using (var update = db.CreateCommand("""
            update operations_work_items
            set lifecycle_state = @toState,
                updated_at_utc = @occurredAtUtc,
                closed_at_utc = case when @toState in ('closed', 'confirmed', 'done') then @occurredAtUtc else closed_at_utc end
            where work_item_id = @workItemId
            """))
        {
            update.Parameters.AddWithValue("toState", transition.ToState);
            update.Parameters.AddWithValue("occurredAtUtc", transition.OccurredAtUtc);
            update.Parameters.AddWithValue("workItemId", transition.WorkItemId);
            update.ExecuteNonQuery();
        }

        db.Commit();
    }

    public IReadOnlyList<WorkItemTransitionRecord> GetTransitions(string workItemId)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                select transition_id, tenant_id, case_id, work_item_id, from_state, to_state,
                       submission_id, reason, actor_id, occurred_at_utc
                from operations_work_item_state_event_log
                where work_item_id = @workItemId
                order by occurred_at_utc, transition_id
                """;
            command.Parameters.AddWithValue("workItemId", workItemId);
            using var reader = command.ExecuteReader();
            var items = new List<WorkItemTransitionRecord>();
            while (reader.Read())
            {
                items.Add(ReadTransition(reader));
            }

            return items;
        }
        catch (PostgresException ex) when (ex.SqlState is MissingTable or MissingSchema)
        {
            return Array.Empty<WorkItemTransitionRecord>();
        }
    }

    private const string SelectSql = """
        select work_item_id, tenant_id, case_id, work_item_type, definition_version_id,
               lifecycle_state, owner_role, owner_actor_id, backup_owner_id,
               escalation_owner_role, due_at_utc, priority, risk_level,
               idempotency_scope, required_evidence_refs, affected_fact_refs,
               workspace_id, source_event_id, source_refs, metadata, created_at_utc
        from operations_work_items

        """;

    private static WorkItem ReadWorkItem(NpgsqlDataReader reader)
    {
        var metadata = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(reader.GetString(19)) ?? new Dictionary<string, JsonElement>();
        var sourceRefs = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(reader.GetString(18)) ?? new Dictionary<string, JsonElement>();
        var payload = sourceRefs.TryGetValue("payload", out var payloadElement) && payloadElement.ValueKind == JsonValueKind.Object
            ? payloadElement.EnumerateObject().ToDictionary(item => item.Name, item => item.Value.GetString() ?? item.Value.ToString(), StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        return new WorkItem(
            reader.GetString(0),
            reader.GetString(3),
            reader.GetString(5),
            reader.GetString(2),
            reader.GetString(1),
            reader.IsDBNull(16) ? string.Empty : reader.GetString(16),
            reader.GetString(6),
            metadata.TryGetValue("source", out var source) ? source.GetString() ?? "operations-work-item-store" : "operations-work-item-store",
            reader.IsDBNull(17) ? null : reader.GetString(17),
            reader.GetFieldValue<DateTimeOffset>(20),
            payload,
            reader.GetString(4),
            reader.IsDBNull(10) ? null : reader.GetFieldValue<DateTimeOffset>(10),
            reader.IsDBNull(11) ? null : reader.GetString(11),
            reader.IsDBNull(12) ? null : reader.GetString(12),
            reader.GetString(13),
            reader.IsDBNull(7) ? null : reader.GetString(7),
            reader.IsDBNull(8) ? null : reader.GetString(8),
            reader.IsDBNull(9) ? null : reader.GetString(9),
            reader.GetFieldValue<string[]>(14),
            reader.GetFieldValue<string[]>(15));
    }

    private static WorkItemTransitionRecord ReadTransition(NpgsqlDataReader reader) =>
        new(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetString(4),
            reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetString(6),
            reader.GetString(7),
            reader.IsDBNull(8) ? null : reader.GetString(8),
            reader.GetFieldValue<DateTimeOffset>(9));
}
