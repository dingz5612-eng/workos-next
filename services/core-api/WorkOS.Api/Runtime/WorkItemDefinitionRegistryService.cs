using System.Text.Json;

namespace WorkOS.Api.Runtime;

public sealed class WorkItemDefinitionRegistryService
{
    private static readonly Lazy<WorkItemDefinitionRegistryService> Default = new(LoadDefaultRegistry);
    private readonly IReadOnlyList<WorkItemDefinition> definitions;
    private readonly IReadOnlyDictionary<string, WorkItemDefinition> byDefinitionId;
    private readonly IReadOnlyDictionary<string, WorkItemDefinition> bySourceCardId;
    private readonly IReadOnlyDictionary<string, WorkItemDefinition> byWorkItemType;

    public WorkItemDefinitionRegistryService(IReadOnlyList<WorkItemDefinition> definitions)
    {
        this.definitions = definitions;
        byDefinitionId = definitions
            .GroupBy(item => item.DefinitionId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        bySourceCardId = definitions
            .Where(item => !string.IsNullOrWhiteSpace(item.MigrationSourceCardId))
            .GroupBy(item => item.MigrationSourceCardId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        byWorkItemType = definitions
            .Where(item => !string.IsNullOrWhiteSpace(item.WorkItemType))
            .GroupBy(item => item.WorkItemType, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
    }

    public static WorkItemDefinitionRegistryService LoadDefault() => Default.Value;

    public IReadOnlyList<WorkItemDefinition> Definitions => definitions;

    public WorkItemDefinitionResolution Resolve(WorkItem workItem)
    {
        var payloadDefinitionId = PayloadValue(workItem.Payload, "definitionId");
        var definition = FindByDefinitionId(payloadDefinitionId)
            ?? FindByDefinitionId(workItem.DefinitionVersionId)
            ?? FindByWorkItemType(workItem.WorkItemType);

        return definition is null
            ? WorkItemDefinitionResolution.Unresolved(
                FirstNonEmpty(payloadDefinitionId, workItem.DefinitionVersionId),
                Array.Empty<DefinitionMigrationRef>(),
                GuessBusinessLine(workItem.WorkspaceId),
                "definition_registry_not_resolved")
            : WorkItemDefinitionResolution.FromDefinition(definition);
    }

    public WorkItemDefinitionResolution ResolveByWorkspaceCard(string? workspaceId, string? cardId)
    {
        var definition = definitions.FirstOrDefault(item =>
            (item.WorkspaceId ?? string.Empty).Equals(workspaceId ?? string.Empty, StringComparison.OrdinalIgnoreCase) &&
            item.MigrationSourceCardId.Equals(cardId ?? string.Empty, StringComparison.OrdinalIgnoreCase));
        return definition is null
            ? WorkItemDefinitionResolution.Unresolved(
                string.Empty,
                MigrationRefsForSourceCardId(cardId),
                GuessBusinessLine(workspaceId),
                "definition_registry_not_resolved")
            : WorkItemDefinitionResolution.FromDefinition(definition);
    }

    public WorkItemDefinition? FindByDefinitionId(string? definitionId) =>
        !string.IsNullOrWhiteSpace(definitionId) &&
        byDefinitionId.TryGetValue(definitionId, out var definition)
            ? definition
            : null;

    public WorkItemDefinition? FindBySourceCardId(string? sourceCardId) =>
        !string.IsNullOrWhiteSpace(sourceCardId) &&
        bySourceCardId.TryGetValue(sourceCardId, out var definition)
            ? definition
            : null;

    public WorkItemDefinition? FindByWorkItemType(string? workItemType) =>
        !string.IsNullOrWhiteSpace(workItemType) &&
        byWorkItemType.TryGetValue(workItemType, out var definition)
            ? definition
            : null;

    private static WorkItemDefinitionRegistryService LoadDefaultRegistry()
    {
        var path = LocateContract("definition", "workitem-definition-registry.json");
        var registry = JsonSerializer.Deserialize<WorkItemDefinitionRegistryDocument>(
            File.ReadAllText(path),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("workitem_definition_registry_invalid");
        return new WorkItemDefinitionRegistryService(registry.Definitions ?? Array.Empty<WorkItemDefinition>());
    }

    private static string LocateContract(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(new[] { current.FullName, "docs", "contracts" }.Concat(segments).ToArray());
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate docs/contracts/{string.Join("/", segments)}.");
    }

    private static string PayloadValue(IReadOnlyDictionary<string, string> payload, string key) =>
        payload.TryGetValue(key, out var value) ? value : string.Empty;

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static IReadOnlyList<DefinitionMigrationRef> MigrationRefsForSourceCardId(string? sourceCardId) =>
        string.IsNullOrWhiteSpace(sourceCardId)
            ? Array.Empty<DefinitionMigrationRef>()
            : new[]
            {
                new DefinitionMigrationRef(
                    "sourceCardId",
                    sourceCardId,
                    true,
                    false,
                    false,
                    false,
                    false,
                    false,
                    "docs/contracts/definition/source-id-migration-fence.json")
            };

    private static string GuessBusinessLine(string? workspaceId) =>
        string.IsNullOrWhiteSpace(workspaceId)
            ? "unknown"
            : workspaceId.StartsWith("W-STAY", StringComparison.OrdinalIgnoreCase) ||
              workspaceId.StartsWith("PC-GOVERNANCE", StringComparison.OrdinalIgnoreCase)
                ? "dormitory"
                : "unknown";
}

public sealed record WorkItemDefinitionRegistryDocument(
    string Version,
    IReadOnlyList<WorkItemDefinition>? Definitions);

public sealed record WorkItemDefinition(
    string DefinitionId,
    string BusinessLineId,
    string SliceId,
    string WorkspaceId,
    string WorkItemType,
    string CommandType,
    string OwnerSlice,
    IReadOnlyList<DefinitionMigrationRef>? MigrationRefs,
    IReadOnlyList<string> AllowedFacts,
    IReadOnlyList<string> ForbiddenFacts,
    string FieldContractRef,
    string EvidencePolicyRef,
    string RiskPolicyRef,
    string LedgerPolicyRef,
    string AdmissionPolicyRef,
    string SurfacePolicyRef,
    bool ProductionConfirmAllowed,
    string DefinitionMode,
    string RemovalImpact)
{
    public string MigrationSourceCardId =>
        MigrationRefs?.FirstOrDefault(item => item.Type.Equals("sourceCardId", StringComparison.OrdinalIgnoreCase))?.Value
        ?? string.Empty;
}

public sealed record DefinitionMigrationRef(
    string Type,
    string Value,
    bool ReadOnly,
    bool Executable,
    bool AffectsAdmission,
    bool AffectsRuntimeConfirm,
    bool AffectsBusinessIdentity,
    bool AffectsLedger,
    string DeletionProofRef);

public sealed record WorkItemDefinitionResolution(
    bool Resolved,
    WorkItemDefinition? Definition,
    string DefinitionId,
    IReadOnlyList<DefinitionMigrationRef> MigrationRefs,
    string BusinessLineId,
    string SliceId,
    string DefinitionMode,
    bool ProductionConfirmAllowed,
    string Reason)
{
    public static WorkItemDefinitionResolution FromDefinition(WorkItemDefinition definition) =>
        new(
            true,
            definition,
            definition.DefinitionId,
            definition.MigrationRefs ?? Array.Empty<DefinitionMigrationRef>(),
            definition.BusinessLineId,
            definition.SliceId,
            definition.DefinitionMode,
            definition.ProductionConfirmAllowed,
            "definition_resolved");

    public static WorkItemDefinitionResolution Unresolved(
        string definitionId,
        IReadOnlyList<DefinitionMigrationRef>? migrationRefs,
        string businessLineId,
        string reason) =>
        new(
            false,
            null,
            definitionId,
            migrationRefs ?? Array.Empty<DefinitionMigrationRef>(),
            businessLineId,
            string.Empty,
            "unregistered-definition",
            false,
            reason);

    public IReadOnlyDictionary<string, object> ToTrace() =>
        new Dictionary<string, object>
        {
            ["resolved"] = Resolved,
            ["definitionId"] = DefinitionId,
            ["migrationRefs"] = MigrationRefs,
            ["businessLineId"] = BusinessLineId,
            ["sliceId"] = SliceId,
            ["definitionMode"] = DefinitionMode,
            ["productionConfirmAllowed"] = ProductionConfirmAllowed,
            ["reason"] = Reason
        };
}
