using System.Text.Json;

namespace WorkOS.Api.Runtime;

internal static class Dormitory13ScenarioRuntimeProjection
{
    private const string RuntimeExecutionPath = "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioRuntimeExecution.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeExecution = new(() => JsonDocument.Parse(File.ReadAllText(LocateProjection())));

    public static IReadOnlyList<WorkspaceProjection> Workspaces() =>
        Scenarios().Select(Workspace).ToArray();

    public static IReadOnlyDictionary<string, string> StartAdapterDefinitionIds() =>
        Scenarios()
            .SelectMany(scenario => scenario.GetProperty("startAdapterDefinitionIds").EnumerateObject())
            .ToDictionary(item => item.Name, item => item.Value.GetString() ?? string.Empty, StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyList<SearchCommandDefinition> SearchCommands() =>
        Scenarios()
            .SelectMany(scenario => scenario.GetProperty("searchCommands").EnumerateArray())
            .Select(Command)
            .ToArray();

    public static IReadOnlyList<SliceRuntimeCapability> RuntimeCapabilities() =>
        Scenarios()
            .Select(scenario => new SliceRuntimeCapability(
                Required(scenario, "sliceId"),
                Required(scenario, "workspaceId"),
                Required(scenario, "status")))
            .ToArray();

    public static IReadOnlyList<GeneratedTransitionRule> TransitionRules() =>
        Scenarios()
            .SelectMany(scenario => scenario.GetProperty("transitions").EnumerateArray())
            .Select(item => new GeneratedTransitionRule(
                Required(item, "policyId"),
                Required(item, "fromDefinitionId"),
                Required(item, "toDefinitionId"),
                Required(item, "sourceContract"),
                null))
            .ToArray();

    public static bool IsWorkspace(string? workspaceId) =>
        ScenarioForWorkspace(workspaceId).HasValue;

    public static IReadOnlyDictionary<string, string> CanonicalizeSubmittedFieldValues(
        WorkItem workItem,
        IReadOnlyDictionary<string, string>? fieldValues)
    {
        var values = new Dictionary<string, string>(fieldValues ?? new Dictionary<string, string>(), StringComparer.Ordinal);
        if (values.Count == 0 || !IsWorkspace(workItem.WorkspaceId))
        {
            return values;
        }

        var step = StepFor(workItem.WorkspaceId, workItem.WorkItemType, PayloadValue(workItem.Payload, "cardId"));
        if (!step.HasValue)
        {
            return values;
        }

        foreach (var field in step.Value.GetProperty("fields").EnumerateArray())
        {
            var fieldId = Required(field, "fieldId");
            if (string.IsNullOrWhiteSpace(fieldId) ||
                !values.TryGetValue(fieldId, out var value) ||
                string.IsNullOrWhiteSpace(value))
            {
                continue;
            }

            var label = field.TryGetProperty("label", out var labelElement)
                ? Required(labelElement, "zh-CN")
                : string.Empty;
            ApplyCanonicalFieldValue(values, workItem.WorkItemType, label, value);
        }

        return values;
    }

    public static CardProjection? CardFor(
        string? workspaceId,
        string? cardId,
        IReadOnlyDictionary<string, string>? payload = null)
    {
        if (string.IsNullOrWhiteSpace(cardId))
        {
            return null;
        }

        var scenario = ScenarioForWorkspace(workspaceId);
        if (scenario.HasValue)
        {
            var card = Cards(scenario.Value).FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
            return card is null ? null : ApplyRuntimeResourceOptions(card, payload);
        }

        var matched = Scenarios()
            .SelectMany(Cards)
            .FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
        return matched is null ? null : ApplyRuntimeResourceOptions(matched, payload);
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
        var scenario = ScenarioForWorkspace(templateWorkspaceId);
        if (!scenario.HasValue)
        {
            return new Dictionary<string, string>();
        }

        var resource = ResolveOperableResource(workItems, actor, anchorPayload, anchorQuery);
        var anchor = resource?.ToAnchor() ?? ResolveDormitoryAnchor(anchorPayload, anchorQuery);
        var suffix = OperationsHash.Short(workspaceId, templateWorkspaceId, cardId, anchor.StableKey, "dormitory-13-runtime-context")[..12];
        var context = scenario.Value.TryGetProperty("startContext", out var startContext)
            ? startContext.EnumerateObject()
                .ToDictionary(item => item.Name, item => item.Value.GetString() ?? string.Empty, StringComparer.Ordinal)
            : new Dictionary<string, string>(StringComparer.Ordinal);
        var scenarioPackageNo = scenario.Value.TryGetProperty("scenarioPackageNo", out var packageNoElement)
            ? packageNoElement.GetInt32()
            : 0;
        context["startContextSource"] = RuntimeExecutionPath;
        context["startContextBoundByActorId"] = actor.ActorId;
        context["anchorQuery"] = anchor.Query;
        context["stayId"] = $"stay-{suffix}";
        context["residentId"] = $"resident-{suffix}";
        context["residentName"] = anchor.ResidentName;
        context["customerName"] = anchor.ResidentName;
        context["phone"] = anchor.Phone;
        context["contactPhone"] = anchor.Phone;
        context["buildingName"] = anchor.BuildingName;
        context["buildingContextRef"] = $"building:{Slug(actor.TenantId)}:{Slug(anchor.BuildingName)}";
        context["roomNo"] = anchor.RoomNo;
        context["roomId"] = $"room-{Slug(anchor.BuildingName)}-{Slug(anchor.RoomNo)}-{suffix}";
        context["roomStableRef"] = context["roomId"];
        context["targetRoomOrBed"] = $"{anchor.BuildingName} {anchor.RoomNo} 房间";
        context["operationResourceDisplayName"] = $"{anchor.BuildingName} {anchor.RoomNo} 房间";
        context["bedNo"] = anchor.BedNo;
        context["bedId"] = $"bed-{Slug(anchor.BuildingName)}-{Slug(anchor.RoomNo)}-{Slug(anchor.BedNo)}-{suffix}";
        context["bedRef"] = context["bedId"];
        context["bedType"] = anchor.BedType;
        context["bedTypeLabel"] = anchor.BedTypeLabel;
        if (resource is not null)
        {
            foreach (var (key, value) in resource.ToPayload(actor.ActorId))
            {
                context[key] = value;
            }
        }
        if (scenarioPackageNo == 8)
        {
            ApplyBedTransferTargetContext(context, anchor, suffix);
        }
        return context;
    }

    private static void ApplyBedTransferTargetContext(
        IDictionary<string, string> context,
        DormitoryAnchor anchor,
        string suffix)
    {
        var targetBedNo = NextBedLabel(anchor.BedNo);
        context["targetRoomOrBed"] = $"{anchor.BuildingName} {anchor.RoomNo}-{targetBedNo} 床位";
        context["targetBedNo"] = targetBedNo;
        context["targetBedRef"] = $"bed-{Slug(anchor.BuildingName)}-{Slug(anchor.RoomNo)}-{Slug(targetBedNo)}-{suffix}";
        context["targetResourceAvailable"] = "true";
        context["targetBedAvailable"] = "true";
        context["targetResourceAvailability"] = "可换入";
        context["targetBedAvailability"] = "可换入";
        context["targetResourceStatus"] = "可运营";
        context["targetOccupancyStatus"] = "空置";
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

        var payload = current.Payload
            .Where(item => !IsRuntimeIdentityPayloadKey(item.Key))
            .ToDictionary(item => item.Key, item => item.Value, StringComparer.Ordinal);
        if (fieldValues is not null)
        {
            foreach (var (key, value) in fieldValues)
            {
                if (!IsRuntimeIdentityPayloadKey(key) && !string.IsNullOrWhiteSpace(value))
                {
                    payload[key] = value;
                }
            }
        }

        payload["lastConfirmedDefinitionId"] = currentDefinition.DefinitionId;
        payload["lastConfirmedWorkItemType"] = current.WorkItemType;
        payload["carryForwardSource"] = RuntimeExecutionPath;
        ApplyGeneratedOutcomePayload(payload, current);
        return payload;
    }

    private static void ApplyGeneratedOutcomePayload(Dictionary<string, string> payload, WorkItem current)
    {
        if (current.WorkItemType.Equals("Dorm.InventoryHoldCreate", StringComparison.OrdinalIgnoreCase))
        {
            payload["inventoryHoldConfirmed"] = "true";
            payload["inventoryHoldActive"] = "true";
            payload["hasInventoryHold"] = "true";
            payload["inventoryHoldStatus"] = "held";
            payload["holdUntil"] = "2026-12-31";
            payload["inventoryHoldRef"] = $"hold-{OperationsHash.Short(current.WorkItemId, current.WorkspaceId, "inventory-hold")}";
            payload["inventoryHoldSummary"] = "库存锁定已由 Operations Runtime 确认";
        }

        if (current.WorkItemType.Equals("Dorm.ReservationDraftConfirm", StringComparison.OrdinalIgnoreCase))
        {
            payload["reservationDraftConfirmed"] = "true";
            payload["reservationPolicySnapshotBound"] = "true";
            payload["reservationPriceSnapshotBound"] = "true";
        }

        if (current.WorkItemType.Equals("Dorm.ReservationConfirm", StringComparison.OrdinalIgnoreCase))
        {
            payload["reservationConfirmed"] = "true";
            payload["reservationStatus"] = "confirmed";
            payload["reservationNo"] = $"RSV-{OperationsHash.Short(current.WorkItemId, current.WorkspaceId, "reservation")}";
        }

        if (current.WorkItemType.Equals("Dorm.CheckoutHandoverConfirm", StringComparison.OrdinalIgnoreCase))
        {
            payload["checkoutStatus"] = "handover-confirmed";
        }

        if (current.WorkItemType.Equals("Dorm.CheckoutInspectionConfirm", StringComparison.OrdinalIgnoreCase))
        {
            payload["checkoutInspectionCompleted"] = "true";
            payload["inspectionEvidenceBound"] = "true";
            payload["checkoutStatus"] = "inspection-confirmed";
        }

        if (current.WorkItemType.Equals("Dorm.CheckoutFeeCalculationGenerate", StringComparison.OrdinalIgnoreCase))
        {
            payload["feeSourceValid"] = "true";
            payload["feeSettlementCalculated"] = "true";
            payload["checkoutStatus"] = "fee-calculated";
        }

        if (current.WorkItemType.Equals("Dorm.CustomerSettlementConfirm", StringComparison.OrdinalIgnoreCase))
        {
            payload["customerConfirmedSettlement"] = "true";
            payload["customerConfirmationStatus"] = "客户确认";
            payload["checkoutStatus"] = "customer-confirmed";
        }

        if (current.WorkItemType.Equals("Dorm.CheckoutConfirm", StringComparison.OrdinalIgnoreCase))
        {
            payload["checkoutCompleted"] = "true";
            payload["checkoutStatus"] = "已退房";
            payload["resourceRecoveryTargetStatus"] = "待保洁";
        }
    }

    private static bool IsRuntimeIdentityPayloadKey(string key) =>
        new[]
        {
            "caseId",
            "cardId",
            "definitionId",
            "definitionMigrationRefs",
            "operationAxis",
            "sourceWorkItemId",
            "ownerRole",
            "actorRole",
            "role",
            "actorId",
            "actorTenantId",
            "dispatchedBy",
            "generatedTransitionPolicyId",
            "generatedTransitionSource"
        }.Contains(key, StringComparer.OrdinalIgnoreCase);

    private static WorkspaceProjection Workspace(JsonElement scenario) =>
        new(
            "Dormitory13ScenarioGeneratedRuntimeProjection",
            Required(scenario, "workspaceId"),
            "stay",
            Required(scenario, "taskId"),
            Localized(scenario.GetProperty("title")),
            Localized(scenario.GetProperty("summary")),
            Cards(scenario),
            Localized(scenario.GetProperty("next")),
            Array.Empty<BlockerRule>());

    private static IReadOnlyList<CardProjection> Cards(JsonElement scenario) =>
        scenario.GetProperty("steps").EnumerateArray().Select(Card).ToArray();

    private static CardProjection Card(JsonElement step) =>
        new(
            "Dormitory13ScenarioGeneratedRuntimeCard",
            Required(step, "cardId"),
            Required(step, "status"),
            Localized(step.GetProperty("title")),
            new FieldSet(
                step.TryGetProperty("readOnlySummary", out var readOnlySummary)
                    ? readOnlySummary.EnumerateArray().Select(Field).ToArray()
                    : Array.Empty<FieldProjection>(),
                step.GetProperty("fields").EnumerateArray().Select(Field).ToArray(),
                Array.Empty<FieldProjection>()),
            step.GetProperty("evidence").EnumerateArray().Select(Evidence).ToArray(),
            Array.Empty<SystemCheck>(),
            Array.Empty<BlockerRule>(),
            new[] { new EventDefinition(Required(step, "eventType"), true, ReadStringArray(step.GetProperty("projectionTargets"))) },
            new TransitionDefinition($"{Required(step, "cardId")}.prepared", $"{Required(step, "cardId")}.confirmed", $"{Required(step, "cardId")}.blocked"),
            new ConfirmationPolicy(false, true, ConfirmationPolicyCatalog.OwnerRoleForCard(Required(step, "cardId")), Localized(step.GetProperty("confirmationLabel"))));

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

    private static CardProjection ApplyRuntimeResourceOptions(
        CardProjection card,
        IReadOnlyDictionary<string, string>? payload)
    {
        if (!card.Id.Equals("cert.selectOperableResource", StringComparison.OrdinalIgnoreCase))
        {
            return card;
        }

        var option = OptionFromPayload(payload);
        if (option is null)
        {
            return card;
        }

        var fields = card.Fields.Business
            .Select(field => field.Id.Equals("targetRoomOrBed", StringComparison.OrdinalIgnoreCase) ||
                field.Id.Equals("sellableResourceSelection", StringComparison.OrdinalIgnoreCase)
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
            PayloadValue(payload, "roomStableRef"),
            PayloadValue(payload, "roomId"));
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var zh = FirstNonEmpty(
            PayloadValue(payload, "operationStatusSummary"),
            PayloadValue(payload, "operationResourceDisplayName"),
            PayloadValue(payload, "basicReadinessSummary"),
            value);
        return new FieldOption(value, new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["zh-CN"] = zh,
            ["ru-RU"] = FirstNonEmpty(PayloadValue(payload, "operationStatusSummaryRu"), zh),
            ["ky-KG"] = FirstNonEmpty(PayloadValue(payload, "operationStatusSummaryKy"), zh)
        });
    }

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

    private static JsonElement? ScenarioForWorkspace(string? workspaceId)
    {
        if (string.IsNullOrWhiteSpace(workspaceId))
        {
            return null;
        }

        foreach (var scenario in Scenarios())
        {
            var template = Required(scenario, "workspaceId");
            if (workspaceId.Equals(template, StringComparison.OrdinalIgnoreCase) ||
                workspaceId.StartsWith($"{template}-", StringComparison.OrdinalIgnoreCase))
            {
                return scenario;
            }
        }

        return null;
    }

    private static JsonElement? StepFor(string? workspaceId, string? workItemType, string? cardId)
    {
        var scenario = ScenarioForWorkspace(workspaceId);
        if (!scenario.HasValue)
        {
            return null;
        }

        foreach (var step in scenario.Value.GetProperty("steps").EnumerateArray())
        {
            if (!string.IsNullOrWhiteSpace(workItemType) &&
                Required(step, "workItemType").Equals(workItemType, StringComparison.OrdinalIgnoreCase))
            {
                return step;
            }

            if (!string.IsNullOrWhiteSpace(cardId) &&
                Required(step, "cardId").Equals(cardId, StringComparison.OrdinalIgnoreCase))
            {
                return step;
            }
        }

        return null;
    }

    private static void ApplyCanonicalFieldValue(
        IDictionary<string, string> values,
        string workItemType,
        string label,
        string value)
    {
        if (!workItemType.StartsWith("Dorm.Checkout", StringComparison.OrdinalIgnoreCase) &&
            !workItemType.Equals("Dorm.CustomerSettlementConfirm", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (value.Equals("confirmed", StringComparison.OrdinalIgnoreCase))
        {
            ApplyScenario9Selection(values, label);
            return;
        }

        if (value.Equals("not_applicable", StringComparison.OrdinalIgnoreCase))
        {
            ApplyScenario9NotApplicable(values, label);
            return;
        }

        var canonical = Scenario9TextFieldCanonicalKey(label);
        if (!string.IsNullOrWhiteSpace(canonical))
        {
            values[canonical] = value;
        }
    }

    private static void ApplyScenario9Selection(IDictionary<string, string> values, string label)
    {
        switch (label)
        {
            case "办理退房":
                values["checkoutStarted"] = "true";
                break;
            case "暂缓退房":
                values["checkoutDeferred"] = "true";
                break;
            case "返回在住管理":
            case "返回管理在住服务":
                values["returnToInStayManagement"] = "true";
                break;
            case "本人办理":
            case "代办":
            case "异常离店":
                values["handoverType"] = label;
                break;
            case "正常":
                values["inspectionResult"] = "正常";
                values["checkoutInspectionCompleted"] = "true";
                break;
            case "需保洁":
                values["resourceRecoveryTargetStatus"] = "待保洁";
                break;
            case "需维修":
                values["resourceRecoveryTargetStatus"] = "待维修";
                break;
            case "有损坏":
            case "有遗失":
                values["hasDamage"] = "true";
                values["inspectionResult"] = label;
                break;
            case "有争议":
            case "是否有争议":
                values["hasDispute"] = "true";
                break;
            case "费用项":
                values["feeItemsConfirmed"] = "true";
                break;
            case "是否提交负责人复核":
                values["managerReviewRequested"] = "true";
                break;
            case "客户确认":
                values["customerConfirmedSettlement"] = "true";
                values["customerConfirmationStatus"] = "客户确认";
                break;
            case "客户拒绝":
                values["customerConfirmedSettlement"] = "false";
                values["customerConfirmationStatus"] = "客户拒绝";
                break;
            case "转负责人复核":
            case "转人工复核":
                values["manualReviewRequested"] = "true";
                break;
            case "确认退房":
                values["checkoutConfirmed"] = "true";
                break;
            case "查看财务处理状态":
                values["financeRequestViewed"] = "true";
                break;
            case "查看资源恢复状态":
                values["resourceRecoveryRequestViewed"] = "true";
                break;
            case "补充证据":
                values["supplementEvidenceRequested"] = "true";
                break;
        }
    }

    private static void ApplyScenario9NotApplicable(IDictionary<string, string> values, string label)
    {
        switch (label)
        {
            case "代办":
            case "异常离店":
                if (!values.ContainsKey("handoverType"))
                {
                    values["handoverType"] = "本人办理";
                }
                break;
            case "有损坏":
            case "有遗失":
                values["hasDamage"] = "false";
                break;
            case "有争议":
            case "是否有争议":
                values["hasDispute"] = "false";
                break;
            case "客户拒绝":
                if (!values.ContainsKey("customerConfirmedSettlement"))
                {
                    values["customerConfirmedSettlement"] = "true";
                }
                break;
        }
    }

    private static string Scenario9TextFieldCanonicalKey(string label) => label switch
    {
        "实际离店时间" => "actualCheckoutAt",
        "交接备注" => "handoverNote",
        "客户确认方式" => "customerConfirmationMethod",
        "房间状态" => "roomCondition",
        "床位状态" => "bedCondition",
        "物品状态" => "itemCondition",
        "卫生状态" => "hygieneCondition",
        "损坏说明" => "damageDescription",
        "赔偿说明" => "compensationNote",
        "服务费说明" => "serviceFeeNote",
        "其他调整说明" => "settlementAdjustmentNote",
        "争议说明" => "disputeNote",
        _ => string.Empty
    };

    private static IReadOnlyList<JsonElement> Scenarios() =>
        Root.GetProperty("scenarios").EnumerateArray().ToArray();

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

    private static Scenario13OperableResource? ResolveOperableResource(
        IReadOnlyList<WorkItem> workItems,
        RuntimeActorContext actor,
        IReadOnlyDictionary<string, string>? anchorPayload,
        string? anchorQuery)
    {
        var query = FirstNonEmpty(anchorQuery, PayloadValue(anchorPayload, "anchorQuery"), PayloadValue(anchorPayload, "roomNo"));
        var candidates = workItems
            .Where(item => item.TenantId.Equals(actor.TenantId, StringComparison.OrdinalIgnoreCase))
            .Where(item => item.Status.Equals("confirmed", StringComparison.OrdinalIgnoreCase))
            .Where(item => item.WorkspaceId.Contains("RESOURCE-OPERATION-STATUS", StringComparison.OrdinalIgnoreCase) ||
                item.WorkItemType.StartsWith("Dorm.Operation", StringComparison.OrdinalIgnoreCase))
            .Select(Scenario13OperableResource.From)
            .Where(item => item is not null)
            .Cast<Scenario13OperableResource>()
            .Where(item => item.IsOperable)
            .OrderByDescending(item => item.MatchScore(query))
            .ThenByDescending(item => item.CreatedAtUtc)
            .ToArray();
        return candidates.FirstOrDefault();
    }

    private sealed record Scenario13OperableResource(
        string ResourceRef,
        string DisplayNameZh,
        string SummaryZh,
        string SummaryRu,
        string SummaryKy,
        string RoomNo,
        string Floor,
        string BedCount,
        string BedLabels,
        string RoomStableRef,
        string OperationStatus,
        DateTimeOffset CreatedAtUtc)
    {
        public bool IsOperable =>
            OperationStatus.Equals("operable", StringComparison.OrdinalIgnoreCase) ||
            OperationStatus.Equals("restored", StringComparison.OrdinalIgnoreCase);

        public static Scenario13OperableResource? From(WorkItem item)
        {
            var status = FirstNonEmpty(
                PayloadValue(item.Payload, "restoreConclusion"),
                PayloadValue(item.Payload, "newOperationStatus"),
                PayloadValue(item.Payload, "operationStatus"));
            var roomNo = FirstNonEmpty(
                PayloadValue(item.Payload, "roomNo"),
                PayloadValue(item.Payload, "targetRoomOrBed"),
                PayloadValue(item.Payload, "operationResourceDisplayName"));
            var bedCount = FirstNonEmpty(
                PayloadValue(item.Payload, "bedCount"),
                PayloadValue(item.Payload, "createdBedCount"));
            if (string.IsNullOrWhiteSpace(roomNo) || string.IsNullOrWhiteSpace(status))
            {
                return null;
            }

            var floor = PayloadValue(item.Payload, "floor");
            var roomStableRef = FirstNonEmpty(
                PayloadValue(item.Payload, "operationResourceRef"),
                PayloadValue(item.Payload, "roomStableRef"),
                PayloadValue(item.Payload, "targetRoomOrBed"),
                $"room:{NormalizeToken(roomNo)}");
            var bedLabels = FirstNonEmpty(
                PayloadValue(item.Payload, "bedLabels"),
                BuildBedLabels(bedCount));
            var displayName = FirstNonEmpty(
                PayloadValue(item.Payload, "operationResourceDisplayName"),
                string.IsNullOrWhiteSpace(floor) ? $"{roomNo} 房间" : $"{floor} 层 {roomNo} 房间");
            var bedSummary = string.IsNullOrWhiteSpace(bedCount) ? "床位已确认" : $"{bedCount} 个床位";
            var summaryZh = $"{displayName} · {bedSummary} · 可运营";
            var summaryRu = $"{roomNo} · {bedSummary} · operable";
            var summaryKy = $"{roomNo} · {bedSummary} · operable";
            return new Scenario13OperableResource(
                roomStableRef,
                displayName,
                summaryZh,
                summaryRu,
                summaryKy,
                roomNo,
                floor,
                bedCount,
                bedLabels,
                roomStableRef,
                status,
                item.CreatedAtUtc);
        }

        public DormitoryAnchor ToAnchor()
        {
            var building = BuildingFromRoom(RoomNo);
            return new DormitoryAnchor(
                RoomNo,
                ResourceRef,
                "真实浏览器客户",
                "13800001234",
                building,
                RoomNo,
                FirstBedLabel(BedLabels),
                "upper",
                BedTypeLabelFor("upper"));
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
                ["startContextKind"] = "scenario13-operable-resource",
                ["startContextBoundByActorId"] = actorId,
                ["operableConfirmed"] = "true",
                ["operationStatus"] = OperationStatus,
                ["operationStatusSummary"] = SummaryZh,
                ["operationStatusSummaryRu"] = SummaryRu,
                ["operationStatusSummaryKy"] = SummaryKy,
                ["operationResourceRef"] = ResourceRef,
                ["operationResourceDisplayName"] = DisplayNameZh,
                ["targetRoomOrBed"] = ResourceRef,
                ["sellableResourceSelection"] = ResourceRef,
                ["resourceScope"] = "room",
                ["roomNo"] = RoomNo,
                ["floor"] = Floor,
                ["bedCount"] = BedCount,
                ["bedLabels"] = BedLabels,
                ["roomStableRef"] = RoomStableRef
            };
    }

    private sealed record DormitoryAnchor(
        string Query,
        string StableKey,
        string ResidentName,
        string Phone,
        string BuildingName,
        string RoomNo,
        string BedNo,
        string BedType,
        string BedTypeLabel);

    private static DormitoryAnchor ResolveDormitoryAnchor(IReadOnlyDictionary<string, string>? payload, string? query)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (payload is not null)
        {
            foreach (var item in payload)
            {
                if (!string.IsNullOrWhiteSpace(item.Value)) values[item.Key] = item.Value.Trim();
            }
        }

        var rawQuery = FirstNonEmpty(query, Value(values, "anchorQuery"), Value(values, "businessAnchor"), Value(values, "phone"), Value(values, "roomNo"), Value(values, "residentName")) ?? "";
        var phone = FirstNonEmpty(Value(values, "phone"), PhoneFromQuery(rawQuery), Digits(rawQuery, 7), "13800001234") ?? "13800001234";
        var roomParts = RoomParts(rawQuery);
        var building = FirstNonEmpty(Value(values, "buildingName"), Value(values, "buildingId"), roomParts.Building, "A") ?? "A";
        var roomNo = FirstNonEmpty(Value(values, "roomNo"), roomParts.RoomNo, "301") ?? "301";
        var bedNo = FirstNonEmpty(Value(values, "bedNo"), roomParts.BedNo, "01") ?? "01";
        var resident = FirstNonEmpty(Value(values, "residentName"), Value(values, "customerName"), Value(values, "leadName"), NameFromQuery(rawQuery), "真实浏览器客户") ?? "真实浏览器客户";
        var bedType = FirstNonEmpty(Value(values, "bedType"), BedTypeFromQuery(rawQuery), "upper") ?? "upper";
        var bedTypeLabel = BedTypeLabelFor(bedType);
        var stable = FirstNonEmpty(Value(values, "stayId"), rawQuery, $"{resident}|{phone}|{building}|{roomNo}|{bedNo}") ?? "";
        return new DormitoryAnchor(rawQuery, stable, resident, phone, building, roomNo, bedNo, bedType, bedTypeLabel);
    }

    private static string Value(IReadOnlyDictionary<string, string> values, string key) =>
        values.TryGetValue(key, out var value) ? value : "";

    private static string? Digits(string value, int minLength)
    {
        var digits = new string((value ?? "").Where(char.IsDigit).ToArray());
        return digits.Length >= minLength ? digits : null;
    }

    private static string? PhoneFromQuery(string value)
    {
        var parts = (value ?? "")
            .Split(new[] { '/', '／', '·', ',', '，', ' ', '\t', '-' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(item => new string(item.Where(char.IsDigit).ToArray()))
            .Where(item => item.Length is >= 7 and <= 16)
            .ToArray();
        return parts.FirstOrDefault(item => item.Length >= 11) ?? parts.FirstOrDefault();
    }

    private static (string Building, string RoomNo, string BedNo) RoomParts(string value)
    {
        var parts = (value ?? "")
            .Split(new[] { '/', '／', '·', ',', '，', ' ', '\t', '-' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .ToArray();
        var buildingRoom = parts.FirstOrDefault(item => item.Any(char.IsLetter) && item.Any(char.IsDigit)) ?? "";
        var building = new string(buildingRoom.TakeWhile(ch => !char.IsDigit(ch)).ToArray());
        var roomFromBuilding = new string(buildingRoom.SkipWhile(ch => !char.IsDigit(ch)).ToArray());
        var roomNo = parts.FirstOrDefault(item => item.Any(char.IsDigit) && !item.Any(char.IsLetter) && item.Length >= 2) ?? roomFromBuilding;
        var bedNo = parts.LastOrDefault(item => item.All(char.IsDigit) && item.Length <= 2) ?? "";
        return (string.IsNullOrWhiteSpace(building) ? buildingRoom : building, roomNo, bedNo);
    }

    private static string NameFromQuery(string value)
    {
        var tokens = (value ?? "")
            .Split(new[] { '/', '／', '·', ',', '，', ' ', '\t', '-' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(item => item.Any(ch => char.IsLetter(ch) || IsCjk(ch)) && !item.Any(char.IsDigit) && !IsBedTypeToken(item))
            .ToArray();
        return tokens.FirstOrDefault() ?? "";
    }

    private static bool IsCjk(char value) =>
        value >= 0x4E00 && value <= 0x9FFF;

    private static bool IsBedTypeToken(string value)
    {
        var text = value ?? "";
        return text.Contains("上铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("下铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("平铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("upper", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("lower", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("whole", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("flat", StringComparison.OrdinalIgnoreCase);
    }

    private static string BedTypeFromQuery(string value)
    {
        var text = value ?? "";
        if (text.Contains("下铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("lower", StringComparison.OrdinalIgnoreCase))
        {
            return "lower";
        }

        if (text.Contains("平铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("whole", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("flat", StringComparison.OrdinalIgnoreCase))
        {
            return "whole";
        }

        if (text.Contains("上铺", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("upper", StringComparison.OrdinalIgnoreCase))
        {
            return "upper";
        }

        return string.Empty;
    }

    private static string BedTypeLabelFor(string value) =>
        value.Equals("lower", StringComparison.OrdinalIgnoreCase) ? "下铺" :
        value.Equals("whole", StringComparison.OrdinalIgnoreCase) ? "平铺" :
        value.Equals("flat", StringComparison.OrdinalIgnoreCase) ? "平铺" : "上铺";

    private static string PayloadValue(IReadOnlyDictionary<string, string>? payload, string key) =>
        payload is not null && payload.TryGetValue(key, out var value) ? value : string.Empty;

    private static string BuildBedLabels(string bedCount)
    {
        if (!int.TryParse(bedCount, out var count) || count <= 0)
        {
            return string.Empty;
        }

        return string.Join(", ", Enumerable.Range(1, count).Select(item => item.ToString("00")));
    }

    private static string FirstBedLabel(string bedLabels) =>
        (bedLabels ?? string.Empty)
            .Split(new[] { ',', '，', '/', '／', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault() ?? "01";

    private static string NextBedLabel(string bedLabel)
    {
        var value = FirstNonEmpty(bedLabel, "01");
        return int.TryParse(value, out var number)
            ? Math.Max(number + 1, 2).ToString("00")
            : $"{value}-2";
    }

    private static string BuildingFromRoom(string roomNo)
    {
        var building = new string((roomNo ?? string.Empty).TakeWhile(char.IsLetter).ToArray());
        return string.IsNullOrWhiteSpace(building) ? "A" : building;
    }

    private static string NormalizeToken(string value) => Slug(value);

    private static string Slug(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? "x"
            : FirstNonEmpty(new string(value.Trim().ToLowerInvariant().Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray()).Trim('-'), "x") ?? "x";

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonElement Root => RuntimeExecution.Value.RootElement;

    private static string LocateProjection()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, RuntimeExecutionPath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, RuntimeExecutionPath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {RuntimeExecutionPath}.");
    }
}
