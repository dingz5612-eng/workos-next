using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

public interface IOperationsCaseStore
{
    OperationCase? Get(string caseId);

    IReadOnlyList<OperationCase> List(string? tenantId = null);

    OperationCase Upsert(OperationCase operationCase);
}

public sealed class InMemoryOperationsCaseStore : IOperationsCaseStore
{
    private readonly Dictionary<string, OperationCase> cases = new(StringComparer.OrdinalIgnoreCase);

    public OperationCase? Get(string caseId) =>
        cases.TryGetValue(caseId, out var operationCase) ? operationCase : null;

    public IReadOnlyList<OperationCase> List(string? tenantId = null) =>
        cases.Values
            .Where(item => string.IsNullOrWhiteSpace(tenantId) || item.TenantId?.Equals(tenantId, StringComparison.OrdinalIgnoreCase) == true)
            .OrderBy(item => item.CaseId, StringComparer.OrdinalIgnoreCase)
            .ToArray();

    public OperationCase Upsert(OperationCase operationCase)
    {
        cases[operationCase.CaseId] = operationCase;
        return operationCase;
    }
}

public sealed class PostgresOperationsCaseStore : IOperationsCaseStore
{
    private const string MissingTable = "42P01";
    private const string MissingSchema = "3F000";
    private readonly PostgresConnectionFactory connections;

    public PostgresOperationsCaseStore(string connectionString)
    {
        connections = new PostgresConnectionFactory(connectionString);
    }

    public OperationCase? Get(string caseId)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                select case_id, tenant_id, case_type, definition_version_id, status,
                       owner_role, owner_actor_id, source_refs, metadata
                from operations_cases
                where case_id = @caseId
                """;
            command.Parameters.AddWithValue("caseId", caseId);
            using var reader = command.ExecuteReader();
            return reader.Read() ? ReadCase(reader) : null;
        }
        catch (PostgresException ex) when (ex.SqlState is MissingTable or MissingSchema)
        {
            return null;
        }
    }

    public IReadOnlyList<OperationCase> List(string? tenantId = null)
    {
        try
        {
            using var connection = connections.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                select case_id, tenant_id, case_type, definition_version_id, status,
                       owner_role, owner_actor_id, source_refs, metadata
                from operations_cases
                where cast(@tenantId as text) is null or tenant_id = @tenantId
                order by opened_at_utc, case_id
                """;
            command.Parameters.AddWithValue("tenantId", (object?)tenantId ?? DBNull.Value);
            using var reader = command.ExecuteReader();
            var items = new List<OperationCase>();
            while (reader.Read())
            {
                items.Add(ReadCase(reader));
            }

            return items;
        }
        catch (PostgresException ex) when (ex.SqlState is MissingTable or MissingSchema)
        {
            return Array.Empty<OperationCase>();
        }
    }

    public OperationCase Upsert(OperationCase operationCase)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into operations_cases(
                case_id, tenant_id, case_type, definition_version_id, status,
                opened_at_utc, closed_at_utc, owner_role, owner_actor_id,
                source_refs, metadata)
            values (
                @caseId, @tenantId, @caseType, @definitionVersionId, @status,
                @openedAtUtc, null, @ownerRole, @ownerActorId,
                @sourceRefs::jsonb, @metadata::jsonb)
            on conflict(case_id) do update
            set tenant_id = excluded.tenant_id,
                case_type = excluded.case_type,
                definition_version_id = excluded.definition_version_id,
                status = excluded.status,
                owner_role = excluded.owner_role,
                owner_actor_id = excluded.owner_actor_id,
                source_refs = excluded.source_refs,
                metadata = excluded.metadata
            """;
        command.Parameters.AddWithValue("caseId", operationCase.CaseId);
        command.Parameters.AddWithValue("tenantId", operationCase.TenantId ?? operationCase.CaseId);
        command.Parameters.AddWithValue("caseType", operationCase.CaseType);
        command.Parameters.AddWithValue("definitionVersionId", operationCase.DefinitionVersionId);
        command.Parameters.AddWithValue("status", operationCase.Status);
        command.Parameters.AddWithValue("openedAtUtc", DateTimeOffset.UtcNow);
        command.Parameters.AddWithValue("ownerRole", operationCase.OwnerRole);
        command.Parameters.AddWithValue("ownerActorId", (object?)operationCase.OwnerActorId ?? DBNull.Value);
        command.Parameters.AddWithValue("sourceRefs", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(SourceRefsFor(operationCase)));
        command.Parameters.AddWithValue("metadata", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["projectionStatus"] = operationCase.ProjectionStatus,
            ["source"] = operationCase.Source,
            ["workspaceId"] = operationCase.WorkspaceId,
            ["workItemIds"] = operationCase.WorkItemIds
        }));
        command.ExecuteNonQuery();
        return Get(operationCase.CaseId) ?? operationCase;
    }

    private static OperationCase ReadCase(NpgsqlDataReader reader)
    {
        var metadata = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(reader.GetString(8)) ?? new Dictionary<string, JsonElement>();
        var workItemIds = metadata.TryGetValue("workItemIds", out var ids) && ids.ValueKind == JsonValueKind.Array
            ? ids.EnumerateArray().Select(item => item.GetString() ?? string.Empty).Where(item => !string.IsNullOrWhiteSpace(item)).ToArray()
            : Array.Empty<string>();
        return new OperationCase(
            reader.GetString(0),
            reader.GetString(4),
            reader.GetString(1),
            metadata.TryGetValue("workspaceId", out var workspaceId) ? workspaceId.GetString() : null,
            workItemIds,
            metadata.TryGetValue("projectionStatus", out var projectionStatus) ? projectionStatus.GetString() ?? "persisted" : "persisted",
            metadata.TryGetValue("source", out var source) ? source.GetString() ?? "operations-case-store" : "operations-case-store",
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetString(6));
    }

    private static Dictionary<string, object?> SourceRefsFor(OperationCase operationCase) =>
        new()
        {
            ["workspaceId"] = operationCase.WorkspaceId,
            ["workItemIds"] = operationCase.WorkItemIds
        };
}
