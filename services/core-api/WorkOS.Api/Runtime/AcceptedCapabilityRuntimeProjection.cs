using System.Text.Json;

namespace WorkOS.Api.Runtime;

internal static class AcceptedCapabilityRuntimeProjection
{
    private const string ProjectionPath = "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json";
    private static readonly Lazy<JsonDocument> ProjectionDocument = new(() => JsonDocument.Parse(File.ReadAllText(LocateProjection())));

    public static string CapabilityId => Text("capabilityId");
    public static string WorkspaceId => Text("workspaceId");
    public static string LegacyResourceWorkspaceId => Text("legacyResourceWorkspaceId");
    public static string AcceptedGeneratedBundleDigest => Text("acceptedGeneratedBundleDigest");
    public static string SliceRuntimeStatus => Text("sliceRuntimeStatus");
    public static string RoomSetupConfirmCardId => Step(0).GetProperty("cardId").GetString() ?? string.Empty;
    public static string BedSetupConfirmCardId => Step(1).GetProperty("cardId").GetString() ?? string.Empty;
    public static string ResourceReadinessConfirmCardId => Step(2).GetProperty("cardId").GetString() ?? string.Empty;

    public static WorkspaceProjection Workspace() =>
        new(
            "AcceptedCapabilityRuntimeProjection",
            WorkspaceId,
            "stay",
            CapabilityId,
            Text("宿舍第一金链", "Первая золотая цепочка общежития"),
            Text(
                "按房间配置、床位配置、资源就绪三步办理。",
                "Три шага: комната, койка, готовность."),
            Steps().Select(Card).ToArray(),
            Text(
                "按页面顺序完成当前办理。",
                "Выполняйте действия по порядку."),
            Array.Empty<BlockerRule>());

    public static IReadOnlyDictionary<string, string> StartAdapterDefinitionIds() =>
        Steps().ToDictionary(
            step => $"{WorkspaceId}:{Required(step, "cardId")}",
            step => Required(step, "definitionId"),
            StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyList<string> DerivedFieldKeys(string? cardId)
    {
        if (!Root.TryGetProperty("derivedFieldKeys", out var items))
        {
            return Array.Empty<string>();
        }

        foreach (var item in items.EnumerateArray())
        {
            if (!Required(item, "cardId").Equals(cardId ?? string.Empty, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return item.TryGetProperty("derivedFieldKeys", out var keys)
                ? keys.EnumerateArray().Select(value => value.GetString() ?? string.Empty).Where(value => value.Length > 0).ToArray()
                : Array.Empty<string>();
        }

        return Array.Empty<string>();
    }

    public static IReadOnlyList<SearchCommandDefinition> SearchCommands() =>
        Root.TryGetProperty("commandCatalog", out var commands)
            ? commands.EnumerateArray().Select(Command).ToArray()
            : Array.Empty<SearchCommandDefinition>();

    public static SliceRuntimeCapability RuntimeCapability() =>
        new(CapabilityId, WorkspaceId, SliceRuntimeStatus);

    private static CardProjection Card(JsonElement step) =>
        new(
            "AcceptedCapabilityCardProjection",
            Required(step, "cardId"),
            StepStatus(step),
            Localized(step.GetProperty("title")),
            new FieldSet(
                Array.Empty<FieldProjection>(),
                Fields(step).Select(BusinessField).ToArray(),
                Array.Empty<FieldProjection>()),
            Evidence(step).Select(EvidenceRequirement).ToArray(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            new[] { new EventDefinition(Required(step, "eventType"), true, ProjectionTargets(step)) },
            new TransitionDefinition($"{Required(step, "cardId")}.prepared", $"{Required(step, "cardId")}.confirmed", $"{Required(step, "cardId")}.blocked"),
            new ConfirmationPolicy(false, true, "operator", Text("仅测试消费确认", "Только тестовое подтверждение")));

    private static FieldProjection BusinessField(JsonElement field)
    {
        var fieldId = Required(field, "fieldId");
        var optionSet = Optional(field, "optionSet");
        var controlType = string.IsNullOrWhiteSpace(optionSet) ? Optional(field, "controlType") : "select";
        if (string.IsNullOrWhiteSpace(controlType))
        {
            controlType = fieldId.Equals("capacity", StringComparison.OrdinalIgnoreCase) ? "number" : "text";
        }

        var userSubmitted = !field.TryGetProperty("userSubmitted", out var userSubmittedElement) || userSubmittedElement.GetBoolean();
        var readOnly = field.TryGetProperty("readonly", out var readOnlyElement) && readOnlyElement.GetBoolean();
        return new FieldProjection(
            fieldId,
            FieldLabel(fieldId),
            "business",
            controlType == "number" || fieldId.Equals("capacity", StringComparison.OrdinalIgnoreCase) ? "number" : "text",
            userSubmitted,
            Optional(field, "submitValueSource") is { Length: > 0 } submitValueSource ? submitValueSource : Required(field, "source"),
            true,
            string.Empty,
            new FieldUi(
                controlType,
                optionSet,
                Options(optionSet),
                Optional(field, "defaultValue"),
                string.Empty,
                readOnly),
            Text("按当前业务规则带入。", "Заполнено по текущим правилам."));
    }

    private static EvidenceRequirement EvidenceRequirement(string evidenceId) =>
        new(
            evidenceId,
            FieldLabel(evidenceId),
            true,
            "accepted-capability-runtime-projection",
            evidenceId,
            Text("测试消费证据，不开放生产确认。", "Тестовое доказательство без production confirm."));

    private static IReadOnlyList<FieldOption> Options(string optionSet)
    {
        if (string.IsNullOrWhiteSpace(optionSet) ||
            !Root.TryGetProperty("optionSets", out var optionSets) ||
            !optionSets.TryGetProperty(optionSet, out var values))
        {
            return Array.Empty<FieldOption>();
        }

        return values.EnumerateArray()
            .Select(item => new FieldOption(Required(item, "value"), Localized(item.GetProperty("label"))))
            .ToArray();
    }

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
            command.GetProperty("keywords").EnumerateArray().Select(item => item.GetString() ?? string.Empty).Where(item => item.Length > 0).ToArray());

    private static IReadOnlyList<JsonElement> Steps() =>
        Root.GetProperty("steps").EnumerateArray().ToArray();

    private static JsonElement Step(int index) => Steps()[index];

    private static IEnumerable<JsonElement> Fields(JsonElement step) =>
        step.GetProperty("fields").EnumerateArray();

    private static IReadOnlyList<string> Evidence(JsonElement step) =>
        step.GetProperty("evidenceIds").EnumerateArray().Select(item => item.GetString() ?? string.Empty).Where(item => item.Length > 0).ToArray();

    private static IReadOnlyList<string> ProjectionTargets(JsonElement step) =>
        step.GetProperty("projectionTargets").EnumerateArray().Select(item => item.GetString() ?? string.Empty).Where(item => item.Length > 0).ToArray();

    private static string StepStatus(JsonElement step) =>
        step.GetProperty("index").GetInt32() == 1 ? "ready" : "notStarted";

    private static IReadOnlyDictionary<string, string> FieldLabel(string id) =>
        Root.TryGetProperty("fieldLabels", out var labels) && labels.TryGetProperty(id, out var label)
            ? Localized(label)
            : Text(id, id);

    private static IReadOnlyDictionary<string, string> Localized(JsonElement value) =>
        value.EnumerateObject().ToDictionary(item => item.Name, item => item.Value.GetString() ?? string.Empty, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Text(string zhCn, string ruRu) =>
        new Dictionary<string, string> { ["zh-CN"] = zhCn, ["ru-RU"] = ruRu };

    private static string Text(string propertyName) => Required(Root, propertyName);

    private static string Required(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) ? value.GetString() ?? string.Empty : string.Empty;

    private static string Optional(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) ? value.GetString() ?? string.Empty : string.Empty;

    private static JsonElement Root => ProjectionDocument.Value.RootElement;

    private static string LocateProjection()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, ProjectionPath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, ProjectionPath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {ProjectionPath}.");
    }
}
