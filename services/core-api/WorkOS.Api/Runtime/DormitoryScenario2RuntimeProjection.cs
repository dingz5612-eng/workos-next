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
                Required(item, "sourceContract"),
                TransitionCondition(item)))
            .ToArray();

    public static bool IsWorkspace(string? workspaceId) =>
        !string.IsNullOrWhiteSpace(workspaceId) &&
        (workspaceId.Equals(WorkspaceId, StringComparison.OrdinalIgnoreCase) ||
         workspaceId.StartsWith($"{WorkspaceId}-", StringComparison.OrdinalIgnoreCase));

    public static CardProjection? CardFor(string? cardId, IReadOnlyDictionary<string, string>? payload = null)
    {
        if (string.IsNullOrWhiteSpace(cardId))
        {
            return null;
        }

        var card = Workspace().Cards.FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
        return card is null ? null : ApplyRuntimeResourceOptions(card, payload);
    }

    public static IReadOnlyDictionary<string, string> StartContext(
        string workspaceId,
        string templateWorkspaceId,
        string cardId,
        RuntimeActorContext actor,
        IReadOnlyList<WorkItem> workItems,
        IReadOnlyDictionary<string, string>? anchorPayload = null,
        string? anchorQuery = null)
    {
        if (!IsWorkspace(templateWorkspaceId))
        {
            return new Dictionary<string, string>();
        }

        var resource = ResolveBaseReadyResource(workItems, actor, anchorPayload, anchorQuery);
        if (resource is null)
        {
            return new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["startContextSource"] = RuntimeMirrorPath,
                ["startContextKind"] = "scenario2-base-ready-resource",
                ["startContextBoundByActorId"] = actor.ActorId,
                ["baseReadyConfirmed"] = "false",
                ["baseReadyMissingReason"] = "scenario1_confirmed_resource_readiness_required"
            };
        }

        return resource.ToPayload(actor.ActorId);
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
            "blockerStatus",
            "progressUpdate",
            "blockerNotes",
            "allBlockersClosed",
            "blockerClosureSummary"
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

        if (currentDefinition.Definition?.WorkItemType.Equals("Dorm.OperationBlockerUpdate", StringComparison.OrdinalIgnoreCase) == true &&
            IsClosedBlocker(PayloadValue(payload, "blockerStatus")))
        {
            payload["allBlockersClosed"] = "true";
            payload["blockerClosureSummary"] = FirstNonEmpty(
                PayloadValue(payload, "blockerNotes"),
                PayloadValue(payload, "progressUpdate"),
                "全部相关阻断原因已关闭");
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

    private static CardProjection ApplyRuntimeResourceOptions(CardProjection card, IReadOnlyDictionary<string, string>? payload)
    {
        if (!card.Id.Equals("cert.selectBaseReadyResource", StringComparison.OrdinalIgnoreCase))
        {
            return card;
        }

        var option = OptionFromPayload(payload);
        if (option is null)
        {
            return card;
        }

        var fields = card.Fields.Business
            .Select(field => field.Id.Equals("targetRoomOrBed", StringComparison.OrdinalIgnoreCase)
                ? field with
                {
                    Ui = field.Ui with
                    {
                        Options = new[] { option }
                    }
                }
                : field)
            .ToArray();

        return card with
        {
            Fields = card.Fields with
            {
                Business = fields
            }
        };
    }

    private static FieldOption? OptionFromPayload(IReadOnlyDictionary<string, string>? payload)
    {
        if (payload is null)
        {
            return null;
        }

        var value = FirstNonEmpty(
            PayloadValue(payload, "operationResourceRef"),
            PayloadValue(payload, "targetRoomOrBed"),
            PayloadValue(payload, "baseReadySnapshotRef"),
            PayloadValue(payload, "basicReadinessStableRef"));
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var zh = FirstNonEmpty(
            PayloadValue(payload, "basicReadinessSummary"),
            PayloadValue(payload, "operationResourceDisplayName"),
            value);
        return new FieldOption(value, new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["zh-CN"] = zh,
            ["ru-RU"] = FirstNonEmpty(PayloadValue(payload, "basicReadinessSummaryRu"), zh),
            ["ky-KG"] = FirstNonEmpty(PayloadValue(payload, "basicReadinessSummaryKy"), zh)
        });
    }

    private static Scenario2BaseReadyResource? ResolveBaseReadyResource(
        IReadOnlyList<WorkItem> workItems,
        RuntimeActorContext actor,
        IReadOnlyDictionary<string, string>? anchorPayload,
        string? anchorQuery)
    {
        var query = FirstNonEmpty(anchorQuery, PayloadValue(anchorPayload, "anchorQuery"), PayloadValue(anchorPayload, "roomNo"));
        var candidates = workItems
            .Where(item => item.TenantId.Equals(actor.TenantId, StringComparison.OrdinalIgnoreCase))
            .Where(item => item.Status.Equals("confirmed", StringComparison.OrdinalIgnoreCase))
            .Where(item => item.WorkItemType.Equals("Dorm.ResourceReadinessConfirm", StringComparison.OrdinalIgnoreCase) ||
                PayloadValue(item.Payload, "definitionId").Equals("definition.dormitory.resourceReadinessConfirm.v1", StringComparison.OrdinalIgnoreCase))
            .Select(item => Scenario2BaseReadyResource.From(item))
            .Where(item => item is not null)
            .Cast<Scenario2BaseReadyResource>()
            .OrderByDescending(item => item.MatchScore(query))
            .ThenByDescending(item => item.CreatedAtUtc)
            .ToArray();
        return candidates.FirstOrDefault();
    }

    private static string PayloadValue(IReadOnlyDictionary<string, string>? payload, string key) =>
        payload is not null && payload.TryGetValue(key, out var value) ? value : string.Empty;

    private sealed record Scenario2BaseReadyResource(
        string ResourceRef,
        string SnapshotRef,
        string DisplayNameZh,
        string SummaryZh,
        string SummaryRu,
        string SummaryKy,
        string RoomNo,
        string Floor,
        string BedCount,
        string BedLabels,
        string RoomStableRef,
        string BasicReadinessStableRef,
        DateTimeOffset CreatedAtUtc)
    {
        public static Scenario2BaseReadyResource? From(WorkItem item)
        {
            var roomNo = FirstNonEmpty(
                PayloadValue(item.Payload, "roomNo"),
                PayloadValue(item.Payload, "roomRef"),
                PayloadValue(item.Payload, "operationResourceDisplayName"));
            var bedCount = FirstNonEmpty(
                PayloadValue(item.Payload, "bedCount"),
                PayloadValue(item.Payload, "room.bedCount"),
                PayloadValue(item.Payload, "createdBedCount"));
            if (string.IsNullOrWhiteSpace(roomNo) || string.IsNullOrWhiteSpace(bedCount))
            {
                return null;
            }

            var floor = PayloadValue(item.Payload, "floor");
            var roomStableRef = FirstNonEmpty(
                PayloadValue(item.Payload, "roomStableRef"),
                $"room:{NormalizeToken(roomNo)}");
            var readinessRef = FirstNonEmpty(
                PayloadValue(item.Payload, "basicReadinessStableRef"),
                PayloadValue(item.Payload, "basicReadinessRef"),
                PayloadValue(item.Payload, "roomReadinessStableRef"),
                $"basic-readiness:{NormalizeToken(roomNo)}:1");
            var bedLabels = FirstNonEmpty(
                PayloadValue(item.Payload, "bedLabels"),
                BuildBedLabels(bedCount));
            var displayName = string.IsNullOrWhiteSpace(floor)
                ? $"{roomNo} 房间"
                : $"{floor} 层 {roomNo} 房间";
            var bedCountText = $"{bedCount} 个床位";
            var summaryZh = $"{displayName} · {bedCountText} · 基础检查已完成";
            var summaryRu = $"{roomNo} · {bedCount} койки · базовая проверка завершена";
            var summaryKy = $"{roomNo} · {bedCount} койка · негизги текшерүү бүттү";
            return new Scenario2BaseReadyResource(
                roomStableRef,
                readinessRef,
                displayName,
                summaryZh,
                summaryRu,
                summaryKy,
                roomNo,
                floor,
                bedCount,
                bedLabels,
                roomStableRef,
                readinessRef,
                item.CreatedAtUtc);
        }

        public int MatchScore(string? query)
        {
            var text = (query ?? string.Empty).Trim();
            if (text.Length == 0)
            {
                return 0;
            }

            var normalizedQuery = NormalizeToken(text);
            var normalizedRoom = NormalizeToken(RoomNo);
            return text.Contains(RoomNo, StringComparison.OrdinalIgnoreCase) ||
                normalizedQuery.Contains(normalizedRoom, StringComparison.OrdinalIgnoreCase)
                ? 100
                : 0;
        }

        public IReadOnlyDictionary<string, string> ToPayload(string actorId) =>
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["startContextSource"] = RuntimeMirrorPath,
                ["startContextKind"] = "scenario2-base-ready-resource",
                ["startContextBoundByActorId"] = actorId,
                ["baseReadyConfirmed"] = "true",
                ["baseReadySnapshotRef"] = SnapshotRef,
                ["basicReadinessSummary"] = SummaryZh,
                ["basicReadinessSummaryRu"] = SummaryRu,
                ["basicReadinessSummaryKy"] = SummaryKy,
                ["currentStatusVersion"] = "1",
                ["operationResourceRef"] = ResourceRef,
                ["operationResourceDisplayName"] = DisplayNameZh,
                ["roomNo"] = RoomNo,
                ["floor"] = Floor,
                ["bedCount"] = BedCount,
                ["bedLabels"] = BedLabels,
                ["roomStableRef"] = RoomStableRef,
                ["basicReadinessStableRef"] = BasicReadinessStableRef
            };
    }

    private static string BuildBedLabels(string bedCount)
    {
        if (!int.TryParse(bedCount, out var count) || count <= 0)
        {
            return string.Empty;
        }

        return string.Join(", ", Enumerable.Range(1, count).Select(item => item.ToString("00")));
    }

    private static string NormalizeToken(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : new string(value.Trim().ToLowerInvariant().Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray()).Trim('-');

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

    private static GeneratedTransitionCondition? TransitionCondition(JsonElement transition)
    {
        if (!transition.TryGetProperty("condition", out var condition) ||
            condition.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        return new GeneratedTransitionCondition(
            Optional(condition, "conditionId"),
            Required(condition, "fieldId"),
            Required(condition, "operator"),
            condition.TryGetProperty("values", out var values)
                ? ReadStringArray(values)
                : Array.Empty<string>(),
            Optional(condition, "whenNotMet"),
            Optional(condition, "sourceAuthorityRuleZh"));
    }

    private static int IntValue(IReadOnlyDictionary<string, string> payload, string key) =>
        payload.TryGetValue(key, out var value) && int.TryParse(value, out var parsed) ? parsed : 1;

    private static bool IsClosedBlocker(string value) =>
        new[] { "closed", "已关闭" }.Contains(value, StringComparer.OrdinalIgnoreCase);

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
