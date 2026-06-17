using System.Text.Json;

namespace WorkOS.Api.Runtime;

internal static class DormitoryScenario2RuntimeProjection
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => JsonDocument.Parse(File.ReadAllText(LocateProjection())));

    public static string WorkspaceId => Required(Execution, "workspaceId");
    public static string SliceId => Required(Execution, "sliceId");

    public static WorkspaceProjection Workspace() =>
        new(
            "DormitoryScenario2GeneratedRuntimeProjection",
            WorkspaceId,
            "stay",
            Required(Execution, "taskId"),
            Localized(Execution.GetProperty("title")),
            Localized(Execution.GetProperty("summary")),
            Steps().Select(Card).ToArray(),
            Localized(Execution.GetProperty("next")),
            Array.Empty<BlockerRule>());

    public static IReadOnlyDictionary<string, string> StartAdapterDefinitionIds() =>
        Execution.GetProperty("startAdapterDefinitionIds")
            .EnumerateObject()
            .ToDictionary(item => item.Name, item => item.Value.GetString() ?? string.Empty, StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyList<SearchCommandDefinition> SearchCommands() =>
        Execution.GetProperty("searchCommands")
            .EnumerateArray()
            .Select(Command)
            .ToArray();

    public static SliceRuntimeCapability RuntimeCapability() =>
        new(SliceId, WorkspaceId, Required(Execution, "status"));

    public static IReadOnlyList<GeneratedTransitionRule> TransitionRules() =>
        Execution.GetProperty("transitions")
            .EnumerateArray()
            .Select(item => new GeneratedTransitionRule(
                Required(item, "policyId"),
                Required(item, "fromDefinitionId"),
                Required(item, "toDefinitionId"),
                Required(item, "sourceContract")))
            .ToArray();

    public static bool IsWorkspace(string? workspaceId) =>
        !string.IsNullOrWhiteSpace(workspaceId) &&
        (workspaceId.Equals(WorkspaceId, StringComparison.OrdinalIgnoreCase) ||
         workspaceId.StartsWith($"{WorkspaceId}-", StringComparison.OrdinalIgnoreCase));

    public static CardProjection? CardFor(string? cardId) =>
        string.IsNullOrWhiteSpace(cardId)
            ? null
            : Workspace().Cards.FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));

    public static IReadOnlyDictionary<string, string> StartContext(string workspaceId, string templateWorkspaceId, string cardId, RuntimeActorContext actor)
    {
        if (!IsWorkspace(templateWorkspaceId))
        {
            return new Dictionary<string, string>();
        }

        return new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["startContextSource"] = RuntimeMirrorPath,
            ["startContextKind"] = "scenario2-base-ready-resource",
            ["startContextBoundByActorId"] = actor.ActorId,
            ["baseReadyConfirmed"] = "true",
            ["baseReadySnapshotRef"] = "scenario1-basic-readiness.sample-room-a-3-301",
            ["basicReadinessSummary"] = "A 栋 3 层 301 房间 · 4 个床位 · 基础检查已完成",
            ["currentStatusVersion"] = "1",
            ["operationResourceRef"] = "sample-room-a-3-301",
            ["operationResourceDisplayName"] = "A 栋 3 层 301 房间"
        };
    }

    public static IReadOnlyDictionary<string, string> CarryForwardPayload(
        WorkItem current,
        WorkItemDefinitionResolution currentDefinition,
        IReadOnlyDictionary<string, string>? fieldValues)
    {
        if (!IsWorkspace(current.WorkspaceId))
        {
            return new Dictionary<string, string>();
        }

        var carriedKeys = new[]
        {
            "baseReadyConfirmed",
            "baseReadySnapshotRef",
            "basicReadinessSummary",
            "currentStatusVersion",
            "operationResourceRef",
            "operationResourceDisplayName",
            "roomOrBedScope",
            "targetRoomOrBed",
            "inspectionRef",
            "inspectionConclusion",
            "inspectionVersion",
            "newOperationStatus",
            "statusReasonCode",
            "impactScope",
            "expectedRestoreAt",
            "statusOwner",
            "blockerStatus"
        };
        var payload = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var key in carriedKeys)
        {
            var value = FirstNonEmpty(
                fieldValues is not null && fieldValues.TryGetValue(key, out var submittedValue) ? submittedValue : string.Empty,
                current.Payload.TryGetValue(key, out var existingValue) ? existingValue : string.Empty);
            if (!string.IsNullOrWhiteSpace(value))
            {
                payload[key] = value;
            }
        }

        if (currentDefinition.Definition?.WorkItemType.Equals("Dorm.OperationInspectionConfirm", StringComparison.OrdinalIgnoreCase) == true)
        {
            payload["inspectionRef"] = $"inspection-{OperationsHash.Short(current.WorkItemId, currentDefinition.DefinitionId, "scenario2-inspection")}";
            payload["inspectionVersion"] = "1";
        }

        if (currentDefinition.Definition?.WorkItemType.Equals("Dorm.OperationStatusChangeConfirm", StringComparison.OrdinalIgnoreCase) == true)
        {
            payload["currentStatusVersion"] = (IntValue(payload, "currentStatusVersion") + 1).ToString();
        }

        return payload;
    }

    public static IReadOnlyList<string> StatusOptionValues() =>
        Execution.GetProperty("optionSets")
            .GetProperty("operationStatus")
            .EnumerateArray()
            .Select(item => Required(item, "value"))
            .Where(value => value.Length > 0)
            .ToArray();

    private static CardProjection Card(JsonElement step) =>
        new(
            "DormitoryScenario2GeneratedRuntimeCard",
            Required(step, "cardId"),
            Required(step, "status"),
            Localized(step.GetProperty("title")),
            new FieldSet(
                Array.Empty<FieldProjection>(),
                step.GetProperty("fields").EnumerateArray().Select(Field).ToArray(),
                Array.Empty<FieldProjection>()),
            step.GetProperty("evidence").EnumerateArray().Select(Evidence).ToArray(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            new[] { new EventDefinition(Required(step, "eventType"), true, ReadStringArray(step.GetProperty("projectionTargets"))) },
            new TransitionDefinition($"{Required(step, "cardId")}.prepared", $"{Required(step, "cardId")}.confirmed", $"{Required(step, "cardId")}.blocked"),
            new ConfirmationPolicy(false, true, "operator", Localized(step.GetProperty("confirmationLabel"))));

    private static FieldProjection Field(JsonElement field)
    {
        var ui = field.GetProperty("ui");
        return new FieldProjection(
            Required(field, "fieldId"),
            Localized(field.GetProperty("label")),
            Required(field, "layer"),
            Required(field, "type"),
            field.TryGetProperty("required", out var required) && required.GetBoolean(),
            Required(field, "source"),
            !field.TryGetProperty("visibleToUser", out var visibleToUser) || visibleToUser.GetBoolean(),
            string.Empty,
            new FieldUi(
                Required(ui, "control"),
                Optional(ui, "optionSet"),
                ui.TryGetProperty("options", out var options)
                    ? options.EnumerateArray().Select(Option).ToArray()
                    : Array.Empty<FieldOption>(),
                Optional(ui, "defaultValue"),
                Optional(ui, "derivedFrom"),
                ui.TryGetProperty("readonly", out var readOnly) && readOnly.GetBoolean()),
            Localized(field.GetProperty("help")));
    }

    private static FieldOption Option(JsonElement item) =>
        new(Required(item, "value"), Localized(item.GetProperty("label")));

    private static EvidenceRequirement Evidence(JsonElement item) =>
        new(
            Required(item, "evidenceId"),
            Localized(item.GetProperty("label")),
            item.TryGetProperty("required", out var required) && required.GetBoolean(),
            Required(item, "source"),
            Required(item, "auditEventField"),
            Localized(item.GetProperty("help")));

    private static SearchCommandDefinition Command(JsonElement command) =>
        new(
            Required(command, "templateWorkspaceId"),
            Required(command, "firstCardId"),
            Required(command.GetProperty("title"), "zh-CN"),
            Required(command.GetProperty("title"), "ru-RU"),
            Required(command.GetProperty("title"), "ky-KG"),
            Required(command.GetProperty("subtitle"), "zh-CN"),
            Required(command.GetProperty("subtitle"), "ru-RU"),
            Required(command.GetProperty("subtitle"), "ky-KG"),
            command.GetProperty("keywords").EnumerateArray().Select(item => item.GetString() ?? string.Empty).Where(item => item.Length > 0).ToArray(),
            Required(command.GetProperty("nextAction"), "zh-CN"),
            Required(command.GetProperty("nextAction"), "ru-RU"),
            Required(command.GetProperty("nextAction"), "ky-KG"));

    private static IReadOnlyList<JsonElement> Steps() =>
        Execution.GetProperty("steps").EnumerateArray().ToArray();

    private static IReadOnlyDictionary<string, string> Localized(JsonElement value) =>
        value.EnumerateObject().ToDictionary(item => item.Name, item => item.Value.GetString() ?? string.Empty, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyList<string> ReadStringArray(JsonElement item) =>
        item.EnumerateArray()
            .Select(value => value.GetString() ?? string.Empty)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToArray();

    private static string Required(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) ? value.GetString() ?? string.Empty : string.Empty;

    private static string Optional(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) ? value.GetString() ?? string.Empty : string.Empty;

    private static int IntValue(IReadOnlyDictionary<string, string> payload, string key) =>
        payload.TryGetValue(key, out var value) && int.TryParse(value, out var parsed) ? parsed : 1;

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonElement Root => RuntimeMirror.Value.RootElement;

    private static JsonElement Execution => Root.GetProperty("runtimeExecution");

    private static string LocateProjection()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, RuntimeMirrorPath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, RuntimeMirrorPath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {RuntimeMirrorPath}.");
    }
}
