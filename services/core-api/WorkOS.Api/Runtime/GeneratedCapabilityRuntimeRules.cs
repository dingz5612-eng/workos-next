using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace WorkOS.Api.Runtime;

internal static class GeneratedCapabilityRuntimeRulePipeline
{
    public static IReadOnlyList<string> ConfirmExecutionOrder => GeneratedRuleSourceMapRuntimeAdapter.ConfirmExecutionOrder;

    public static GeneratedCapabilityRuntimeValidationResult Validate(
        WorkItem workItem,
        ConfirmWorkItemRequest request,
        WorkItemDefinitionResolution definition)
    {
        if (!GeneratedRuleSourceMapRuntimeAdapter.AppliesTo(workItem, request, definition))
        {
            if (Scenario2ResourceOperationRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario2ResourceOperationRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario3ProductPricingRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario3ProductPricingRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario4InquiryQuoteRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario4InquiryQuoteRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario5ReservationInventoryRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario5ReservationInventoryRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario6PaymentDepositGuaranteeRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario6PaymentDepositGuaranteeRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario7CheckInProcessingRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario7CheckInProcessingRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario8InStayManagementRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario8InStayManagementRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario9CheckoutSettlementRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario9CheckoutSettlementRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario10CancelNoShowRefundRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario10CancelNoShowRefundRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario11HousekeepingMaintenanceOutOfServiceRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario11HousekeepingMaintenanceOutOfServiceRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario12ChannelCorporateCustomerRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario12ChannelCorporateCustomerRuntimeAdapter.Validate(workItem, request);
            }

            if (Scenario13ReportingAuditReviewRuntimeAdapter.AppliesTo(workItem))
            {
                return Scenario13ReportingAuditReviewRuntimeAdapter.Validate(workItem, request);
            }

            return GeneratedCapabilityRuntimeValidationResult.Success(request.FieldValues ?? new Dictionary<string, string>());
        }

        var fields = ObjectIdentityResolver.Resolve(workItem, request);
        var required = CapabilityInvariantValidator.ValidateRequiredInputs(workItem.WorkItemType, fields, request.EvidenceIds);
        if (!required.Allowed) return required;

        var readonlyResult = CapabilityInvariantValidator.ValidateReadonlySystemDerivedFields(workItem.WorkItemType, request.FieldValues ?? new Dictionary<string, string>());
        if (!readonlyResult.Allowed) return readonlyResult with { FieldValues = fields };

        var identity = ObjectIdentityResolver.Validate(workItem.WorkItemType, fields);
        if (!identity.Allowed) return identity with { FieldValues = fields };

        var bedCardinality = GeneratedBedCardinalityRuntimeAdapter.Validate(workItem.WorkItemType, fields);
        if (!bedCardinality.Allowed) return bedCardinality with { FieldValues = fields };

        var invariants = GeneratedInvariantRuntimeAdapter.Validate(workItem.WorkItemType, fields);
        if (!invariants.Allowed) return invariants with { FieldValues = fields };

        var uniqueness = ObjectUniquenessReservation.Reserve(workItem.WorkItemType, fields);
        if (!uniqueness.Allowed) return uniqueness with { FieldValues = fields };

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }
}

internal sealed record GeneratedCapabilityRuntimeValidationResult(
    bool Allowed,
    int StatusCode,
    string Code,
    string UserMessage,
    string GeneratedRuleId,
    IReadOnlyDictionary<string, string> FieldValues)
{
    public static GeneratedCapabilityRuntimeValidationResult Success(IReadOnlyDictionary<string, string> fields) =>
        new(true, StatusCodes.Status200OK, string.Empty, string.Empty, string.Empty, fields);

    public static GeneratedCapabilityRuntimeValidationResult Reject(
        int statusCode,
        string code,
        string userMessage,
        string generatedRuleId,
        IReadOnlyDictionary<string, string> fields) =>
        new(false, statusCode, code, userMessage, generatedRuleId, fields);
}

internal static class ObjectIdentityResolver
{
    public static IReadOnlyDictionary<string, string> Resolve(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var fields = new Dictionary<string, string>(request.FieldValues ?? new Dictionary<string, string>(), StringComparer.OrdinalIgnoreCase);
        var roomNo = FirstNonEmpty(Value(fields, "roomNo"), Value(workItem.Payload, "roomNo"));
        var bedNo = FirstNonEmpty(Value(fields, "bedNo"), Value(workItem.Payload, "bedNo"), "01");
        var bedCount = FirstNonEmpty(Value(fields, "room.bedCount"), Value(fields, "bedCount"), Value(fields, "capacity"), Value(workItem.Payload, "bedCount"), Value(workItem.Payload, "capacity"));
        var buildingContextRef = FirstNonEmpty(Value(workItem.Payload, "buildingContextRef"), $"building:{workItem.TenantId}:default");
        var normalizedRoomNo = NormalizeToken(roomNo);
        var normalizedBedNo = NormalizeBedNo(bedNo);

        PutIfMissing(fields, "buildingContextRef", buildingContextRef);
        PutIfMissing(fields, "normalizedRoomNo", normalizedRoomNo);
        PutIfMissing(fields, "room.bedCount", bedCount);
        PutIfMissing(fields, "roomStableRef", StableRef("room", buildingContextRef, normalizedRoomNo));
        PutIfMissing(fields, "bedSetVersion", "1");
        PutIfMissing(fields, "bedSetStableRef", StableRef("bed-set", Value(fields, "roomStableRef"), Value(fields, "bedSetVersion")));
        PutIfMissing(fields, "normalizedBedNo", normalizedBedNo);
        PutIfMissing(fields, "bedStableRef", StableRef("bed", Value(fields, "roomStableRef"), normalizedBedNo));
        PutIfMissing(fields, "readinessSnapshotVersion", "1");
        PutIfMissing(fields, "roomReadinessStableRef", StableRef("room-readiness", Value(fields, "roomStableRef"), Value(fields, "readinessSnapshotVersion")));
        PutIfMissing(fields, "basicReadinessRef", StableRef("basic-readiness", Value(fields, "roomStableRef"), Value(fields, "readinessSnapshotVersion")));
        PutIfMissing(fields, "basicReadinessStableRef", StableRef("basic-readiness", Value(fields, "roomStableRef"), Value(fields, "readinessSnapshotVersion")));
        PutIfMissing(fields, "createdBedCount", FirstNonEmpty(Value(fields, "createdBedCount"), bedCount));

        return fields;
    }

    public static GeneratedCapabilityRuntimeValidationResult Validate(string workItemType, IReadOnlyDictionary<string, string> fields)
    {
        if (GeneratedRuleSourceMapRuntimeAdapter.IsCurrentCommand(workItemType) &&
            string.IsNullOrWhiteSpace(Value(fields, "roomStableRef")))
        {
            return GeneratedFailureSemanticsRuntimeAdapter.Reject(
                workItemType,
                "readonly_stable_ref_violation",
                GeneratedRuleSourceMapRuntimeAdapter.RuleId("object_identity", "Dormitory.Room"),
                fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static void PutIfMissing(IDictionary<string, string> fields, string key, string value)
    {
        if (!string.IsNullOrWhiteSpace(value) && !fields.ContainsKey(key))
        {
            fields[key] = value;
        }
    }

    internal static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    internal static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static string StableRef(params string[] parts) =>
        string.Join(":", parts.Where(item => !string.IsNullOrWhiteSpace(item)));

    private static string NormalizeToken(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : new string(value.Trim().ToLowerInvariant().Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray()).Trim('-');

    private static string NormalizeBedNo(string value)
    {
        var text = string.IsNullOrWhiteSpace(value) ? "01" : value.Trim();
        return int.TryParse(text, out var number) ? number.ToString("00") : NormalizeToken(text);
    }
}

internal static class ObjectUniquenessReservation
{
    public static GeneratedCapabilityRuntimeValidationResult Reserve(string workItemType, IReadOnlyDictionary<string, string> fields)
    {
        if (workItemType.Equals("Dorm.RoomSetupConfirm", StringComparison.OrdinalIgnoreCase) &&
            IsDuplicateSignal(fields, "room"))
        {
            return GeneratedFailureSemanticsRuntimeAdapter.Reject(
                workItemType,
                "room_already_exists",
                GeneratedRuleSourceMapRuntimeAdapter.RuleId("business_invariant", "room_unique_within_building_context"),
                fields);
        }

        if (workItemType.Equals("Dorm.BedSetupConfirm", StringComparison.OrdinalIgnoreCase) &&
            IsDuplicateSignal(fields, "bed"))
        {
            return GeneratedFailureSemanticsRuntimeAdapter.Reject(
                workItemType,
                "bed_already_exists",
                GeneratedRuleSourceMapRuntimeAdapter.RuleId("business_invariant", "bed_unique_within_room"),
                fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static bool IsDuplicateSignal(IReadOnlyDictionary<string, string> fields, string scope)
    {
        var keys = scope.Equals("room", StringComparison.OrdinalIgnoreCase)
            ? new[] { "simulateDuplicateRoom", "existingRoomStableRef", "roomNo" }
            : new[] { "simulateDuplicateBed", "existingBedStableRef", "bedNo" };
        return keys.Any(key =>
            fields.TryGetValue(key, out var value) &&
            (value.Equals("true", StringComparison.OrdinalIgnoreCase) ||
             value.Contains("duplicate", StringComparison.OrdinalIgnoreCase) ||
             value.Contains("already_exists", StringComparison.OrdinalIgnoreCase)));
    }
}

internal static class CapabilityInvariantValidator
{
    public static GeneratedCapabilityRuntimeValidationResult ValidateRequiredInputs(
        string workItemType,
        IReadOnlyDictionary<string, string> fields,
        IReadOnlyList<string>? evidenceIds)
    {
        var command = GeneratedRuleSourceMapRuntimeAdapter.CommandContract(workItemType);
        if (command.ValueKind is not JsonValueKind.Object)
        {
            return GeneratedCapabilityRuntimeValidationResult.Success(fields);
        }

        foreach (var input in command.GetProperty("requiredInputs").EnumerateArray().Select(item => item.GetString() ?? string.Empty))
        {
            if (input.EndsWith("EvidenceRefs", StringComparison.OrdinalIgnoreCase))
            {
                if (evidenceIds is null || evidenceIds.Count == 0)
                {
                    return GeneratedFailureSemanticsRuntimeAdapter.Reject(
                        workItemType,
                        "missing_required_evidence",
                        GeneratedRuleSourceMapRuntimeAdapter.RuleId("command_contract", workItemType),
                        fields,
                        StatusCodes.Status422UnprocessableEntity);
                }

                continue;
            }

            if (string.IsNullOrWhiteSpace(ObjectIdentityResolver.Value(fields, input)))
            {
                return GeneratedFailureSemanticsRuntimeAdapter.Reject(
                    workItemType,
                    "required_input_missing",
                    GeneratedRuleSourceMapRuntimeAdapter.RuleId("command_contract", workItemType),
                    fields,
                    StatusCodes.Status422UnprocessableEntity);
            }
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    public static GeneratedCapabilityRuntimeValidationResult ValidateReadonlySystemDerivedFields(
        string workItemType,
        IReadOnlyDictionary<string, string> submittedFields)
    {
        foreach (var key in new[] { "roomId", "bedId", "roomStableRef", "bedStableRef", "buildingContextRef" })
        {
            if (submittedFields.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return GeneratedFailureSemanticsRuntimeAdapter.Reject(
                    workItemType,
                    "readonly_stable_ref_violation",
                    GeneratedRuleSourceMapRuntimeAdapter.RuleId("business_invariant", "readonly_stable_refs"),
                    submittedFields);
            }
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(submittedFields);
    }
}

internal static class GeneratedInvariantRuntimeAdapter
{
    public static GeneratedCapabilityRuntimeValidationResult Validate(string workItemType, IReadOnlyDictionary<string, string> fields)
    {
        if (!workItemType.Equals("Dorm.ResourceReadinessConfirm", StringComparison.OrdinalIgnoreCase))
        {
            return GeneratedCapabilityRuntimeValidationResult.Success(fields);
        }

        var readinessState = ObjectIdentityResolver.Value(fields, "readinessState");
        if (!GeneratedRuleSourceMapRuntimeAdapter.ClosedReadinessStates.Contains(readinessState, StringComparer.OrdinalIgnoreCase))
        {
            return GeneratedFailureSemanticsRuntimeAdapter.Reject(
                workItemType,
                "invalid_readiness_state",
                GeneratedRuleSourceMapRuntimeAdapter.RuleId("business_invariant", "readiness_closed_option_set"),
                fields);
        }

        if (readinessState.Equals("needs_supplement", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(ObjectIdentityResolver.Value(fields, "basicReadinessRemark")))
        {
            return GeneratedFailureSemanticsRuntimeAdapter.Reject(
                workItemType,
                "supplement_reason_required",
                GeneratedRuleSourceMapRuntimeAdapter.RuleId("business_invariant", "readiness_closed_option_set"),
                fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }
}

internal static class GeneratedBedCardinalityRuntimeAdapter
{
    public static GeneratedCapabilityRuntimeValidationResult Validate(string workItemType, IReadOnlyDictionary<string, string> fields)
    {
        if (!GeneratedRuleSourceMapRuntimeAdapter.IsCurrentCommand(workItemType))
        {
            return GeneratedCapabilityRuntimeValidationResult.Success(fields);
        }

        var bedCount = ParsePositive(ObjectIdentityResolver.Value(fields, "room.bedCount"));
        if ((workItemType.Equals("Dorm.RoomSetupConfirm", StringComparison.OrdinalIgnoreCase) ||
             workItemType.Equals("Dorm.BedSetupConfirm", StringComparison.OrdinalIgnoreCase)) &&
            bedCount <= 0)
        {
            return GeneratedFailureSemanticsRuntimeAdapter.Reject(
                workItemType,
                "bed_count_not_satisfied",
                GeneratedRuleSourceMapRuntimeAdapter.RuleId("bed_cardinality", "generated_bed_count_matches_room_bed_count"),
                fields);
        }

        if (workItemType.Equals("Dorm.ResourceReadinessConfirm", StringComparison.OrdinalIgnoreCase))
        {
            var createdBedCount = ParsePositive(ObjectIdentityResolver.Value(fields, "createdBedCount"));
            if (bedCount <= 0 || createdBedCount < bedCount)
            {
                return GeneratedFailureSemanticsRuntimeAdapter.Reject(
                    workItemType,
                    "bed_count_not_satisfied",
                    GeneratedRuleSourceMapRuntimeAdapter.RuleId("bed_cardinality", "resource_readiness_blocked_until_complete_bed_set"),
                    fields);
            }
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static int ParsePositive(string value) =>
        int.TryParse(value, out var parsed) && parsed > 0 ? parsed : 0;
}

internal static class GeneratedFailureSemanticsRuntimeAdapter
{
    public static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        string generatedRuleId,
        IReadOnlyDictionary<string, string> fields,
        int? fallbackStatus = null)
    {
        var status = fallbackStatus ?? GeneratedRuleSourceMapRuntimeAdapter.HttpStatusForFailureCode(code, workItemType);
        return GeneratedCapabilityRuntimeValidationResult.Reject(
            status,
            code,
            BusinessMessage(code),
            generatedRuleId,
            fields);
    }

    private static string BusinessMessage(string code) =>
        code switch
        {
            "room_already_exists" => "同一楼栋上下文中已存在该房间。",
            "bed_already_exists" => "该房间内已存在相同床位号。",
            "bed_count_not_satisfied" => "床位组必须完整，生成床位数量必须等于房间床位数量。",
            "readonly_stable_ref_violation" => "房间、床位和楼栋上下文标识由系统生成或上下文带入，不能由表单提交覆盖。",
            "invalid_readiness_state" => "基础就绪结论只能选择通过、不通过或需补充。",
            "not_saleable_reason_required" => "基础就绪结论不完整，请补充说明。",
            "service_verification_required" => "基础检查证据不完整，请补充证明。",
            "supplement_reason_required" => "选择需补充时，请填写需要补充的基础资料或检查说明。",
            "missing_required_evidence" => "基础就绪确认需要绑定必要证据。",
            "required_input_missing" => "当前确认缺少必填业务字段。",
            _ => "当前业务规则未通过，未写入任何业务结果。"
        };
}

internal static class Scenario2ResourceOperationRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (!HasBaseReady(fields))
        {
            return Reject(workItem.WorkItemType, "upstream_basic_readiness_missing", fields);
        }

        if (request.EvidenceIds is null || request.EvidenceIds.Count == 0)
        {
            return Reject(workItem.WorkItemType, "operation_evidence_missing", fields);
        }

        if (!workItem.WorkItemType.Equals("Dorm.OperationInspectionConfirm", StringComparison.OrdinalIgnoreCase) &&
            !HasInspection(fields))
        {
            return Reject(workItem.WorkItemType, "inspection_required", fields);
        }

        if (HasConcurrentConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_status_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasCrossScenarioPriceReservationAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "cross_scenario_price_reservation_forbidden", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.OperationStatusChangeConfirm", StringComparison.OrdinalIgnoreCase))
        {
            var nextStatus = Value(fields, "newOperationStatus");
            if (!StatusOptions.Contains(nextStatus, StringComparer.OrdinalIgnoreCase))
            {
                return Reject(workItem.WorkItemType, "invalid_status_transition", fields);
            }

            if (IsOperableStatus(nextStatus) && HasOpenBlocker(fields))
            {
                return Reject(workItem.WorkItemType, "unclosed_blocker_for_operable", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.OperationRestoreConfirm", StringComparison.OrdinalIgnoreCase) &&
            !RestoreIsAllowed(fields))
        {
            return Reject(workItem.WorkItemType, "restore_without_recheck_pass", fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> StatusOptions =>
        RuntimeMirror.Value.RootElement.GetProperty("operationStatusOptions")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Concat(DormitoryScenario2RuntimeProjection.StatusOptionValues())
            .Where(item => item.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario2.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("concurrent_status_conflict", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前业务规则未通过，未写入任何业务结果。";
            }
        }

        return "当前业务规则未通过，未写入任何业务结果。";
    }

    private static bool HasBaseReady(IReadOnlyDictionary<string, string> fields) =>
        Value(fields, "baseReadyConfirmed").Equals("true", StringComparison.OrdinalIgnoreCase) ||
        !string.IsNullOrWhiteSpace(Value(fields, "baseReadySnapshotRef")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "basicReadinessSummary"));

    private static bool HasInspection(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(Value(fields, "inspectionRef")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "inspectionConclusion")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "inspectionVersion"));

    private static bool HasConcurrentConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(Value(fields, "expectedStatusVersion"), Value(fields, "expectedVersion"));
        var current = FirstNonEmpty(Value(fields, "currentStatusVersion"), Value(fields, "statusVersion"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list" }.Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasCrossScenarioPriceReservationAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directPriceReservationAttempt")) ||
        IsTrue(Value(fields, "pricePlanIntent")) ||
        IsTrue(Value(fields, "quoteIntent")) ||
        IsTrue(Value(fields, "reservationIntent")) ||
        new[] { "price", "quote", "reservation", "价格", "报价", "预订" }.Contains(Value(fields, "targetNextAction"), StringComparer.OrdinalIgnoreCase);

    private static bool HasOpenBlocker(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "hasOpenBlocker")) ||
        IsTrue(Value(fields, "simulateUnclosedBlocker")) ||
        new[] { "open", "未关闭", "active" }.Contains(Value(fields, "blockerStatus"), StringComparer.OrdinalIgnoreCase);

    private static bool RestoreIsAllowed(IReadOnlyDictionary<string, string> fields) =>
        (IsTrue(Value(fields, "allBlockersClosed")) ||
         new[] { "closed", "已关闭" }.Contains(Value(fields, "blockerStatus"), StringComparer.OrdinalIgnoreCase)) &&
        new[] { "pass", "passed", "通过" }.Contains(Value(fields, "recheckResult"), StringComparer.OrdinalIgnoreCase);

    private static bool IsOperableStatus(string value) =>
        new[] { "可运营", "已恢复", "operable", "restored" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario3ProductPricingRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario3ProductAndPricing.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (HasDuplicateSubmission(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_submission", fields, StatusCodes.Status409Conflict);
        }

        if (HasConcurrentConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_price_version_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasDepositPaymentLedgerAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "deposit_payment_forbidden", fields);
        }

        if (HasCrossScenarioQuoteReservationAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "cross_scenario_quote_reservation_forbidden", fields);
        }

        if (!HasOperableUpstream(fields))
        {
            return Reject(workItem.WorkItemType, "upstream_operable_required", fields);
        }

        if (HasOperationBlocker(fields))
        {
            return Reject(workItem.WorkItemType, "operation_blocked_for_pricing", fields);
        }

        if (request.EvidenceIds is null || request.EvidenceIds.Count == 0)
        {
            return Reject(workItem.WorkItemType, "price_evidence_missing", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.AccommodationProductConfirm", StringComparison.OrdinalIgnoreCase))
        {
            if (!HasProductResourceBinding(fields))
            {
                var code = string.IsNullOrWhiteSpace(Value(fields, "productName"))
                    ? "product_resource_binding_required"
                    : "product_name_not_binding";
                return Reject(workItem.WorkItemType, code, fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.RatePlanDefinitionConfirm", StringComparison.OrdinalIgnoreCase))
        {
            if (!HasValidRequiredPrice(fields))
            {
                return Reject(workItem.WorkItemType, "price_value_invalid", fields);
            }

            if (string.IsNullOrWhiteSpace(Value(fields, "currency")))
            {
                return Reject(workItem.WorkItemType, "currency_required", fields);
            }

            if (string.IsNullOrWhiteSpace(FirstNonEmpty(Value(fields, "pricingPeriod"), Value(fields, "pricingPeriodOption"))))
            {
                return Reject(workItem.WorkItemType, "pricing_period_required", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.PriceVersionActivate", StringComparison.OrdinalIgnoreCase))
        {
            if (HasInvalidOptionalPrice(fields))
            {
                return Reject(workItem.WorkItemType, "price_value_invalid", fields);
            }

            if (HasInvalidDateRange(fields))
            {
                return Reject(workItem.WorkItemType, "date_range_invalid", fields);
            }

            if (HasPriceDateConflict(fields))
            {
                return Reject(workItem.WorkItemType, "price_date_conflict", fields);
            }

            if (HasPostEffectiveInlineEdit(fields))
            {
                return Reject(workItem.WorkItemType, "post_effective_inline_edit_forbidden", fields);
            }
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario3.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("concurrent_price_version_conflict", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("duplicate_submission", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前业务规则未通过，未写入任何业务结果。";
            }
        }

        return "当前业务规则未通过，未写入任何业务结果。";
    }

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicateSubmission(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicateSubmission")) ||
        IsTrue(Value(fields, "simulateDuplicateSubmission")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(
            Value(fields, "expectedPriceVersion"),
            Value(fields, "expectedPriceVersionNo"),
            Value(fields, "expectedVersion"),
            Value(fields, "expectedRatePlanVersion"),
            Value(fields, "expectedProductVersion"));
        var current = FirstNonEmpty(
            Value(fields, "currentPriceVersion"),
            Value(fields, "currentPriceVersionNo"),
            Value(fields, "currentVersion"),
            Value(fields, "currentRatePlanVersion"),
            Value(fields, "currentProductVersion"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasOperableUpstream(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "operationStatus"), Value(fields, "operationStatusSummary"));
        return IsTrue(Value(fields, "canEnterPriceMaintenance")) ||
            IsTrue(Value(fields, "operableConfirmed")) ||
            new[] { "可运营", "已恢复", "operable", "restored" }.Contains(status, StringComparer.OrdinalIgnoreCase) ||
            status.Contains("可运营", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasOperationBlocker(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "operationStatus"), Value(fields, "operationStatusSummary"));
        var reason = Value(fields, "operationBlockerReason");
        return IsTrue(Value(fields, "operationBlocked")) ||
            IsTrue(Value(fields, "hasOperationBlocker")) ||
            IsTrue(Value(fields, "blockerOpen")) ||
            new[] { "维修中", "停售", "暂停开放", "异常待处理", "maintenance", "suspended", "stopped", "abnormal" }
                .Contains(status, StringComparer.OrdinalIgnoreCase) ||
            (!string.IsNullOrWhiteSpace(reason) &&
             !new[] { "无", "none", "closed", "已关闭", "no" }.Contains(reason, StringComparer.OrdinalIgnoreCase));
    }

    private static bool HasProductResourceBinding(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(FirstNonEmpty(
            Value(fields, "resourceBindingSelection"),
            Value(fields, "sellableResourceSelection"),
            Value(fields, "targetRoomOrBed"),
            Value(fields, "resourceRef"),
            Value(fields, "upstreamReadonlyObjectRef")));

    private static bool HasValidRequiredPrice(IReadOnlyDictionary<string, string> fields)
    {
        var value = FirstNonEmpty(Value(fields, "basePrice"), Value(fields, "priceAmount"));
        return TryNonNegativePrice(value);
    }

    private static bool HasInvalidOptionalPrice(IReadOnlyDictionary<string, string> fields)
    {
        foreach (var value in new[] { Value(fields, "basePrice"), Value(fields, "newBasePrice"), Value(fields, "specialDatePrice"), Value(fields, "priceAmount") })
        {
            if (!string.IsNullOrWhiteSpace(value) && !TryNonNegativePrice(value))
            {
                return true;
            }
        }

        return false;
    }

    private static bool HasInvalidDateRange(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "dateRangeInvalid")))
        {
            return true;
        }

        var startText = FirstNonEmpty(Value(fields, "effectiveDate"), Value(fields, "effectiveFrom"));
        var endText = FirstNonEmpty(Value(fields, "expiryDate"), Value(fields, "effectiveTo"));
        if (string.IsNullOrWhiteSpace(startText) || string.IsNullOrWhiteSpace(endText))
        {
            return false;
        }

        if (!DateTime.TryParse(startText, out var start) || !DateTime.TryParse(endText, out var end))
        {
            return true;
        }

        return start.Date > end.Date;
    }

    private static bool HasPriceDateConflict(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "dateRangeConflict")) ||
        IsTrue(Value(fields, "hasPriceConflict")) ||
        IsTrue(Value(fields, "existingPriceOverlap")) ||
        IsTrue(Value(fields, "priceConflict"));

    private static bool HasPostEffectiveInlineEdit(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "priceStatus"), Value(fields, "currentPriceStatus"));
        return (status.Equals("已生效", StringComparison.OrdinalIgnoreCase) ||
                status.Equals("effective", StringComparison.OrdinalIgnoreCase)) &&
            (IsTrue(Value(fields, "inlineEditEffectivePrice")) ||
             IsTrue(Value(fields, "editInPlace")) ||
             IsTrue(Value(fields, "overwriteEffectivePrice")));
    }

    private static bool HasDepositPaymentLedgerAttempt(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "depositPaymentForbidden")) ||
            IsTrue(Value(fields, "paymentIntent")) ||
            IsTrue(Value(fields, "depositIntent")) ||
            IsTrue(Value(fields, "ledgerIntent")))
        {
            return true;
        }

        var forbiddenTokens = new[] { "deposit", "payment", "ledger", "refund", "receipt" };
        return fields.Any(item =>
            forbiddenTokens.Any(token => item.Key.Contains(token, StringComparison.OrdinalIgnoreCase)) &&
            !string.IsNullOrWhiteSpace(item.Value) &&
            !new[] { "false", "0", "no", "否" }.Contains(item.Value, StringComparer.OrdinalIgnoreCase));
    }

    private static bool HasCrossScenarioQuoteReservationAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "quoteIntent")) ||
        IsTrue(Value(fields, "reservationIntent")) ||
        IsTrue(Value(fields, "inventoryHoldIntent")) ||
        IsTrue(Value(fields, "stayIntent")) ||
        IsTrue(Value(fields, "directQuoteReservationAttempt")) ||
        new[] { "quote", "reservation", "inventory", "stay", "报价", "预订", "库存锁定", "入住" }
            .Contains(Value(fields, "targetNextAction"), StringComparer.OrdinalIgnoreCase);

    private static bool TryNonNegativePrice(string value) =>
        !string.IsNullOrWhiteSpace(value) &&
        decimal.TryParse(value, out var amount) &&
        amount >= 0m;

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario4InquiryQuoteRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario4InquiryAndQuote.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (HasDuplicateSubmission(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_submission", fields, StatusCodes.Status409Conflict);
        }

        if (HasConcurrentConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_quote_version_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasFinanceFactAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "finance_fact_forbidden", fields);
        }

        if (HasCrossScenarioInventoryReservationAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "cross_scenario_inventory_reservation_forbidden", fields);
        }

        if (request.EvidenceIds is null || request.EvidenceIds.Count == 0)
        {
            return Reject(workItem.WorkItemType, "quote_evidence_missing", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.InquiryRegister", StringComparison.OrdinalIgnoreCase))
        {
            if (!HasCustomerContact(fields))
            {
                return Reject(workItem.WorkItemType, "contact_required", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.StayDemandConfirm", StringComparison.OrdinalIgnoreCase))
        {
            if (HasInvalidStayDateRange(fields))
            {
                return Reject(workItem.WorkItemType, "date_range_invalid", fields);
            }

            if (!HasValidGuestCount(fields))
            {
                return Reject(workItem.WorkItemType, "guest_count_invalid", fields);
            }
        }

        if (RequiresQuoteableProductAndPrice(workItem.WorkItemType))
        {
            if (!HasValidProduct(fields))
            {
                return Reject(workItem.WorkItemType, "valid_product_required", fields);
            }

            if (!HasEffectivePrice(fields))
            {
                return Reject(workItem.WorkItemType, "effective_price_required", fields);
            }

            if (HasOperationBlocker(fields))
            {
                return Reject(workItem.WorkItemType, "operation_blocked_for_quote", fields);
            }
        }

        if (RequiresQuoteValidityAndSnapshot(workItem.WorkItemType))
        {
            if (!HasQuoteValidity(fields))
            {
                return Reject(workItem.WorkItemType, "quote_validity_required", fields);
            }

            if (HasDiscountOverAuthority(fields))
            {
                return Reject(workItem.WorkItemType, "discount_approval_required", fields);
            }

            if (HasPriceSnapshotMismatch(fields))
            {
                return Reject(workItem.WorkItemType, "price_snapshot_mismatch", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.ReservationPreparationStart", StringComparison.OrdinalIgnoreCase) &&
            HasExpiredQuote(fields))
        {
            return Reject(workItem.WorkItemType, "quote_expired_for_reservation_preparation", fields);
        }

        if (HasPostIssueInlineEdit(fields))
        {
            return Reject(workItem.WorkItemType, "post_issue_inline_edit_forbidden", fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario4.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("concurrent_quote_version_conflict", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("duplicate_submission", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前业务规则未通过，未写入任何业务结果。";
            }
        }

        return "当前业务规则未通过，未写入任何业务结果。";
    }

    private static bool RequiresQuoteableProductAndPrice(string workItemType) =>
        new[]
        {
            "Dorm.QuoteDraftGenerate",
            "Dorm.QuoteVersionConfirm",
            "Dorm.QuoteSend",
            "Dorm.RequoteCreate",
            "Dorm.ReservationPreparationStart"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool RequiresQuoteValidityAndSnapshot(string workItemType) =>
        new[]
        {
            "Dorm.QuoteDraftGenerate",
            "Dorm.QuoteVersionConfirm",
            "Dorm.QuoteSend",
            "Dorm.RequoteCreate"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicateSubmission(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicateSubmission")) ||
        IsTrue(Value(fields, "simulateDuplicateSubmission")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(
            Value(fields, "expectedQuoteVersion"),
            Value(fields, "expectedQuoteVersionNo"),
            Value(fields, "expectedVersion"),
            Value(fields, "expectedQuoteVersionRef"));
        var current = FirstNonEmpty(
            Value(fields, "currentQuoteVersion"),
            Value(fields, "currentQuoteVersionNo"),
            Value(fields, "currentVersion"),
            Value(fields, "currentQuoteVersionRef"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasFinanceFactAttempt(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "financeFactAttempt")) ||
            IsTrue(Value(fields, "paymentIntent")) ||
            IsTrue(Value(fields, "depositIntent")) ||
            IsTrue(Value(fields, "refundIntent")) ||
            IsTrue(Value(fields, "ledgerIntent")))
        {
            return true;
        }

        var forbiddenTokens = new[] { "payment", "deposit", "refund", "ledger", "receipt", "收款", "押金", "退款", "账务" };
        return fields.Any(item =>
            forbiddenTokens.Any(token => item.Key.Contains(token, StringComparison.OrdinalIgnoreCase)) &&
            !string.IsNullOrWhiteSpace(item.Value) &&
            !new[] { "false", "0", "no", "否" }.Contains(item.Value, StringComparer.OrdinalIgnoreCase));
    }

    private static bool HasCrossScenarioInventoryReservationAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "reservationIntent")) ||
        IsTrue(Value(fields, "inventoryHoldIntent")) ||
        IsTrue(Value(fields, "stayIntent")) ||
        IsTrue(Value(fields, "directReservationAttempt")) ||
        IsTrue(Value(fields, "directInventoryLockAttempt")) ||
        new[] { "reservation", "inventory", "inventoryHold", "stay", "预订", "库存锁定", "入住" }
            .Contains(Value(fields, "targetNextAction"), StringComparer.OrdinalIgnoreCase);

    private static bool HasCustomerContact(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(Value(fields, "customerName")) &&
        !string.IsNullOrWhiteSpace(FirstNonEmpty(
            Value(fields, "contactPhone"),
            Value(fields, "contactMobile"),
            Value(fields, "contactMethod"),
            Value(fields, "contactValue")));

    private static bool HasInvalidStayDateRange(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "dateRangeInvalid")))
        {
            return true;
        }

        var checkInText = FirstNonEmpty(Value(fields, "checkInDate"), Value(fields, "arrivalDate"));
        var checkOutText = FirstNonEmpty(Value(fields, "checkOutDate"), Value(fields, "departureDate"));
        if (string.IsNullOrWhiteSpace(checkInText) || string.IsNullOrWhiteSpace(checkOutText))
        {
            return true;
        }

        if (!DateTime.TryParse(checkInText, out var checkIn) || !DateTime.TryParse(checkOutText, out var checkOut))
        {
            return true;
        }

        return checkIn.Date >= checkOut.Date;
    }

    private static bool HasValidGuestCount(IReadOnlyDictionary<string, string> fields)
    {
        var value = FirstNonEmpty(Value(fields, "guestCount"), Value(fields, "guestCountValid"));
        return int.TryParse(value, out var guestCount) && guestCount > 0;
    }

    private static bool HasValidProduct(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(FirstNonEmpty(
            Value(fields, "productSummary"),
            Value(fields, "productRef"),
            Value(fields, "quoteOptionSelection"),
            Value(fields, "quoteOptionRef"),
            Value(fields, "productChoice")));

    private static bool HasEffectivePrice(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "priceStatus"), Value(fields, "priceVersionStatus"));
        return IsTrue(Value(fields, "priceEffective")) ||
            IsTrue(Value(fields, "canEnterInquiryQuote")) ||
            !string.IsNullOrWhiteSpace(Value(fields, "priceVersionRef")) ||
            status.Equals("已生效", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("effective", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasOperationBlocker(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "operationStatus"), Value(fields, "operationStatusSummary"));
        var reason = Value(fields, "operationBlockerReason");
        return IsTrue(Value(fields, "operationBlocked")) ||
            IsTrue(Value(fields, "hasOperationBlocker")) ||
            IsTrue(Value(fields, "blockerOpen")) ||
            new[] { "维修中", "停售", "暂停开放", "异常待处理", "maintenance", "suspended", "stopped", "abnormal" }
                .Contains(status, StringComparer.OrdinalIgnoreCase) ||
            (!string.IsNullOrWhiteSpace(reason) &&
             !new[] { "无", "none", "closed", "已关闭", "no" }.Contains(reason, StringComparer.OrdinalIgnoreCase));
    }

    private static bool HasQuoteValidity(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(FirstNonEmpty(
            Value(fields, "validUntil"),
            Value(fields, "quoteValidityOption"),
            Value(fields, "validityHours"),
            Value(fields, "quoteValidUntil")));

    private static bool HasDiscountOverAuthority(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "discountOverAuthority")) ||
        IsTrue(Value(fields, "discountApprovalRequired")) ||
        IsTrue(Value(fields, "discountBeyondLimit"));

    private static bool HasPriceSnapshotMismatch(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "snapshotMismatch")) ||
        IsTrue(Value(fields, "priceSnapshotMismatch")) ||
        Value(fields, "priceSnapshotStatus").Equals("mismatch", StringComparison.OrdinalIgnoreCase);

    private static bool HasExpiredQuote(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "quoteExpired")) ||
            IsTrue(Value(fields, "validityExpired")) ||
            Value(fields, "quoteStatus").Equals("报价过期", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var validUntil = FirstNonEmpty(Value(fields, "validUntil"), Value(fields, "quoteValidUntil"));
        return DateTime.TryParse(validUntil, out var validUntilDate) &&
            validUntilDate.Date < DateTime.UtcNow.Date;
    }

    private static bool HasPostIssueInlineEdit(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "quoteStatus"), Value(fields, "currentQuoteStatus"));
        return (new[] { "已报价", "报价已发送", "sent", "issued" }.Contains(status, StringComparer.OrdinalIgnoreCase)) &&
            (IsTrue(Value(fields, "inlineEditIssuedQuote")) ||
             IsTrue(Value(fields, "editInPlace")) ||
             IsTrue(Value(fields, "overwriteIssuedQuote")));
    }

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario5ReservationInventoryRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario5ReservationAndInventoryHold.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        if (submitted.TryGetValue("reservationNo", out var reservationNo) && !string.IsNullOrWhiteSpace(reservationNo))
        {
            return Reject(workItem.WorkItemType, "reservation_no_user_input_forbidden", fields);
        }

        foreach (var key in ForbiddenUserInputFields.Where(key => !key.Equals("reservationNo", StringComparison.OrdinalIgnoreCase)))
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (HasDuplicateSubmission(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_submission", fields, StatusCodes.Status409Conflict);
        }

        if (HasConcurrentReservationConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_reservation_version_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasFinanceFactAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "finance_fact_forbidden", fields);
        }

        if (HasCrossScenarioCheckInAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "cross_scenario_checkin_payment_forbidden", fields);
        }

        if (request.EvidenceIds is null || request.EvidenceIds.Count == 0)
        {
            return Reject(workItem.WorkItemType, "reservation_evidence_missing", fields);
        }

        if (RequiresQuoteAndDemand(workItem.WorkItemType))
        {
            if (HasExpiredQuote(fields))
            {
                return Reject(workItem.WorkItemType, "quote_expired_for_booking", fields);
            }

            if (!HasQuotePriceSnapshot(fields))
            {
                return Reject(workItem.WorkItemType, "quote_price_snapshot_required", fields);
            }

            if (!HasCustomerContact(fields))
            {
                return Reject(workItem.WorkItemType, "contact_required", fields);
            }

            if (HasInvalidStayDateRange(fields))
            {
                return Reject(workItem.WorkItemType, "date_range_invalid", fields);
            }

            if (!HasValidGuestCount(fields))
            {
                return Reject(workItem.WorkItemType, "guest_count_invalid", fields);
            }
        }

        if (RequiresAvailability(workItem.WorkItemType))
        {
            if (!HasEffectivePrice(fields))
            {
                return Reject(workItem.WorkItemType, "effective_price_required", fields);
            }

            if (HasOperationBlocker(fields))
            {
                return Reject(workItem.WorkItemType, "operation_blocked_for_booking", fields);
            }

            if (HasStayedOccupancy(fields))
            {
                return Reject(workItem.WorkItemType, "resource_already_stayed", fields);
            }

            if (HasReservationConflict(fields))
            {
                return Reject(workItem.WorkItemType, "resource_already_reserved", fields);
            }

            if (HasResourceLocked(fields))
            {
                return Reject(workItem.WorkItemType, "resource_already_locked", fields);
            }

            if (HasResourceUnavailable(fields))
            {
                return Reject(workItem.WorkItemType, "resource_unavailable_or_occupied", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.InventoryHoldCreate", StringComparison.OrdinalIgnoreCase))
        {
            if (HasConcurrentInventoryHoldConflict(fields))
            {
                return Reject(workItem.WorkItemType, "concurrent_inventory_hold_conflict", fields, StatusCodes.Status409Conflict);
            }

            if (!HasHoldUntil(fields))
            {
                return Reject(workItem.WorkItemType, "hold_until_required", fields);
            }
        }

        if (RequiresInventoryHold(workItem.WorkItemType))
        {
            if (!HasInventoryHold(fields))
            {
                return Reject(workItem.WorkItemType, "inventory_hold_required", fields);
            }

            if (HasExpiredHold(fields))
            {
                return Reject(workItem.WorkItemType, "hold_expired_for_reservation", fields);
            }

            if (HasPriceSnapshotMismatch(fields))
            {
                return Reject(workItem.WorkItemType, "price_snapshot_mismatch", fields);
            }
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario5.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("duplicate_submission", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("concurrent_inventory_hold_conflict", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("concurrent_reservation_version_conflict", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前业务规则未通过，未写入任何业务结果。";
            }
        }

        return "当前业务规则未通过，未写入任何业务结果。";
    }

    private static bool RequiresQuoteAndDemand(string workItemType) =>
        new[]
        {
            "Dorm.BookingPreparationStart",
            "Dorm.AvailabilityRecheck",
            "Dorm.InventoryHoldCreate",
            "Dorm.ReservationDraftConfirm",
            "Dorm.ReservationConfirm"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool RequiresAvailability(string workItemType) =>
        new[]
        {
            "Dorm.AvailabilityRecheck",
            "Dorm.InventoryHoldCreate",
            "Dorm.ReservationDraftConfirm",
            "Dorm.ReservationConfirm"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool RequiresInventoryHold(string workItemType) =>
        new[]
        {
            "Dorm.ReservationDraftConfirm",
            "Dorm.ReservationConfirm"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicateSubmission(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicateSubmission")) ||
        IsTrue(Value(fields, "simulateDuplicateSubmission")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentReservationConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(
            Value(fields, "expectedReservationVersion"),
            Value(fields, "expectedHoldVersion"),
            Value(fields, "expectedVersion"));
        var current = FirstNonEmpty(
            Value(fields, "currentReservationVersion"),
            Value(fields, "currentHoldVersion"),
            Value(fields, "currentVersion"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasFinanceFactAttempt(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "financeFactAttempt")) ||
            IsTrue(Value(fields, "paymentIntent")) ||
            IsTrue(Value(fields, "depositIntent")) ||
            IsTrue(Value(fields, "refundIntent")) ||
            IsTrue(Value(fields, "ledgerIntent")) ||
            IsTrue(Value(fields, "directPaymentAttempt")))
        {
            return true;
        }

        var forbiddenTokens = new[] { "payment", "deposit", "refund", "ledger", "receipt", "收款", "押金", "退款", "账务" };
        return fields.Any(item =>
            forbiddenTokens.Any(token => item.Key.Contains(token, StringComparison.OrdinalIgnoreCase)) &&
            !string.IsNullOrWhiteSpace(item.Value) &&
            !new[] { "false", "0", "no", "否" }.Contains(item.Value, StringComparer.OrdinalIgnoreCase));
    }

    private static bool HasCrossScenarioCheckInAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "checkInIntent")) ||
        IsTrue(Value(fields, "stayIntent")) ||
        IsTrue(Value(fields, "directCheckInAttempt")) ||
        new[] { "checkIn", "check-in", "stay", "入住", "办理入住" }
            .Contains(Value(fields, "targetNextAction"), StringComparer.OrdinalIgnoreCase);

    private static bool HasExpiredQuote(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "quoteExpired")) ||
            IsTrue(Value(fields, "quoteValidityExpired")) ||
            Value(fields, "quoteStatus").Equals("报价过期", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var validUntil = FirstNonEmpty(Value(fields, "quoteValidUntil"), Value(fields, "validUntil"));
        return DateTime.TryParse(validUntil, out var validUntilDate) &&
            validUntilDate.Date < DateTime.UtcNow.Date;
    }

    private static bool HasQuotePriceSnapshot(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(FirstNonEmpty(
            Value(fields, "quotePriceSnapshot"),
            Value(fields, "quoteSnapshotRef"),
            Value(fields, "priceSnapshot"),
            Value(fields, "reservationPriceSnapshot")));

    private static bool HasCustomerContact(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(Value(fields, "customerName")) &&
        !string.IsNullOrWhiteSpace(FirstNonEmpty(
            Value(fields, "contactPhone"),
            Value(fields, "contactMobile"),
            Value(fields, "contactMethod"),
            Value(fields, "contactValue")));

    private static bool HasInvalidStayDateRange(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "dateRangeInvalid")))
        {
            return true;
        }

        var checkInText = FirstNonEmpty(Value(fields, "checkInDate"), Value(fields, "arrivalDate"));
        var checkOutText = FirstNonEmpty(Value(fields, "checkOutDate"), Value(fields, "departureDate"));
        if (string.IsNullOrWhiteSpace(checkInText) || string.IsNullOrWhiteSpace(checkOutText))
        {
            return true;
        }

        if (!DateTime.TryParse(checkInText, out var checkIn) || !DateTime.TryParse(checkOutText, out var checkOut))
        {
            return true;
        }

        return checkIn.Date >= checkOut.Date;
    }

    private static bool HasValidGuestCount(IReadOnlyDictionary<string, string> fields)
    {
        var value = FirstNonEmpty(Value(fields, "guestCount"), Value(fields, "guestCountValid"));
        return int.TryParse(value, out var guestCount) && guestCount > 0;
    }

    private static bool HasEffectivePrice(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "priceStatus"), Value(fields, "priceVersionStatus"));
        return IsTrue(Value(fields, "priceEffective")) ||
            IsTrue(Value(fields, "quotePriceStillValid")) ||
            !string.IsNullOrWhiteSpace(Value(fields, "priceVersionRef")) ||
            status.Equals("已生效", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("effective", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasOperationBlocker(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "operationStatus"), Value(fields, "operationStatusSummary"));
        var reason = Value(fields, "operationBlockerReason");
        return IsTrue(Value(fields, "operationBlocked")) ||
            IsTrue(Value(fields, "hasOperationBlocker")) ||
            IsTrue(Value(fields, "blockerOpen")) ||
            new[] { "维修中", "停售", "暂停开放", "异常待处理", "maintenance", "suspended", "stopped", "abnormal" }
                .Contains(status, StringComparer.OrdinalIgnoreCase) ||
            (!string.IsNullOrWhiteSpace(reason) &&
             !new[] { "无", "none", "closed", "已关闭", "no" }.Contains(reason, StringComparer.OrdinalIgnoreCase));
    }

    private static bool HasStayedOccupancy(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "stayOccupied")) ||
        IsTrue(Value(fields, "occupiedByStay")) ||
        Value(fields, "resourceOccupancyStatus").Equals("在住占用", StringComparison.OrdinalIgnoreCase);

    private static bool HasReservationConflict(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "reservationExists")) ||
        IsTrue(Value(fields, "reservedByOther")) ||
        Value(fields, "resourceReservationStatus").Equals("已预订", StringComparison.OrdinalIgnoreCase);

    private static bool HasResourceLocked(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "resourceLocked")) ||
        IsTrue(Value(fields, "lockedByOther")) ||
        IsTrue(Value(fields, "activeHoldExists")) ||
        Value(fields, "resourceHoldStatus").Equals("已锁定", StringComparison.OrdinalIgnoreCase);

    private static bool HasResourceUnavailable(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "resourceUnavailable")) ||
        IsTrue(Value(fields, "resourceOccupied")) ||
        Value(fields, "resourceAvailability").Equals("不可订", StringComparison.OrdinalIgnoreCase);

    private static bool HasConcurrentInventoryHoldConflict(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "concurrentHoldConflict")) ||
        IsTrue(Value(fields, "simulateConcurrentHold")) ||
        IsTrue(Value(fields, "atomicLockConflict"));

    private static bool HasHoldUntil(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(FirstNonEmpty(
            Value(fields, "holdUntil"),
            Value(fields, "holdDurationOption"),
            Value(fields, "holdMinutes")));

    private static bool HasInventoryHold(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "holdStatus"), Value(fields, "inventoryHoldStatus"));
        return IsTrue(Value(fields, "inventoryHoldActive")) ||
            IsTrue(Value(fields, "hasInventoryHold")) ||
            !string.IsNullOrWhiteSpace(Value(fields, "inventoryHoldSummary")) ||
            status.Equals("已锁定", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("held", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasExpiredHold(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "holdExpired")) ||
            IsTrue(Value(fields, "inventoryHoldExpired")) ||
            Value(fields, "holdStatus").Equals("锁定过期", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var holdUntil = FirstNonEmpty(Value(fields, "holdUntil"), Value(fields, "inventoryHoldUntil"));
        return DateTime.TryParse(holdUntil, out var holdUntilDate) &&
            holdUntilDate.Date < DateTime.UtcNow.Date;
    }

    private static bool HasPriceSnapshotMismatch(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "snapshotMismatch")) ||
        IsTrue(Value(fields, "priceSnapshotMismatch")) ||
        Value(fields, "priceSnapshotStatus").Equals("mismatch", StringComparison.OrdinalIgnoreCase);

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario6PaymentDepositGuaranteeRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario6PaymentDepositAndGuarantee.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (HasDuplicateSubmission(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_submission", fields, StatusCodes.Status409Conflict);
        }

        if (HasConcurrentFinanceConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_finance_version_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasLedgerWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "ledger_write_forbidden", fields);
        }

        if (HasCrossScenarioCheckInAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "cross_scenario_checkin_forbidden", fields);
        }

        if (!HasConfirmedReservation(fields))
        {
            return Reject(workItem.WorkItemType, "reservation_not_confirmed", fields);
        }

        if (HasCancelledReservation(fields))
        {
            return Reject(workItem.WorkItemType, "reservation_cancelled", fields);
        }

        if (RequiresPriceSnapshot(workItem.WorkItemType) && !HasPriceSnapshot(fields))
        {
            return Reject(workItem.WorkItemType, "price_snapshot_required", fields);
        }

        if (HasInvalidRequirementSource(fields))
        {
            return Reject(workItem.WorkItemType, "payment_requirement_source_invalid", fields);
        }

        if (RequiresPositiveAmount(workItem.WorkItemType) && !HasPositiveAmount(fields))
        {
            return Reject(workItem.WorkItemType, "amount_must_be_positive", fields);
        }

        if (HasCurrencyMismatch(fields))
        {
            return Reject(workItem.WorkItemType, "currency_mismatch", fields);
        }

        if (HasDepositMarkedAsIncome(fields))
        {
            return Reject(workItem.WorkItemType, "deposit_marked_as_income_forbidden", fields);
        }

        if (HasGuaranteeMarkedAsPayment(fields))
        {
            return Reject(workItem.WorkItemType, "guarantee_marked_as_payment_forbidden", fields);
        }

        if (RequiresGuaranteeValidity(workItem.WorkItemType, fields) && !HasGuaranteeValidity(fields))
        {
            return Reject(workItem.WorkItemType, "guarantee_validity_required", fields);
        }

        if (HasPostSubmissionInlineEdit(fields))
        {
            return Reject(workItem.WorkItemType, "post_submission_inline_edit_forbidden", fields);
        }

        if (HasConfirmedFinanceInlineEdit(fields))
        {
            return Reject(workItem.WorkItemType, "confirmed_finance_inline_edit_forbidden", fields);
        }

        if (RequiresReceiptEvidence(workItem.WorkItemType) && (request.EvidenceIds is null || request.EvidenceIds.Count == 0))
        {
            return Reject(workItem.WorkItemType, "receipt_evidence_required", fields);
        }

        if (RequiresFinanceGate(workItem.WorkItemType) && !HasFinanceGateRoute(fields))
        {
            return Reject(workItem.WorkItemType, "finance_gate_required", fields);
        }

        if (RequiresAuthorizedFinanceRole(workItem.WorkItemType) && !HasAuthorizedFinanceRole(fields))
        {
            return Reject(workItem.WorkItemType, "unauthorized_finance_confirmation", fields);
        }

        if (RequiresFinanceEvidence(workItem.WorkItemType) && (request.EvidenceIds is null || request.EvidenceIds.Count == 0))
        {
            return Reject(workItem.WorkItemType, "finance_evidence_missing", fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario6.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("duplicate_submission", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("concurrent_finance_version_conflict", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前业务规则未通过，未写入任何业务结果。";
            }
        }

        return "当前业务规则未通过，未写入任何业务结果。";
    }

    private static bool RequiresPriceSnapshot(string workItemType) =>
        !workItemType.Equals("Dorm.FinanceGateReturn", StringComparison.OrdinalIgnoreCase) &&
        !workItemType.Equals("Dorm.FinanceEvidenceSupplement", StringComparison.OrdinalIgnoreCase);

    private static bool RequiresPositiveAmount(string workItemType) =>
        new[]
        {
            "Dorm.PaymentReceiptSubmit",
            "Dorm.DepositGuaranteeSubmit",
            "Dorm.FinanceReviewRequest",
            "Dorm.FinanceGateConfirm"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool RequiresReceiptEvidence(string workItemType) =>
        new[]
        {
            "Dorm.PaymentReceiptSubmit",
            "Dorm.DepositGuaranteeSubmit",
            "Dorm.FinanceReviewRequest"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool RequiresFinanceGate(string workItemType) =>
        new[]
        {
            "Dorm.FinanceGateConfirm",
            "Dorm.FinanceGateReturn"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase) ||
        IsTrueFromName(workItemType, "FinanceReviewRequest");

    private static bool RequiresAuthorizedFinanceRole(string workItemType) =>
        new[]
        {
            "Dorm.FinanceGateConfirm",
            "Dorm.FinanceGateReturn"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool RequiresFinanceEvidence(string workItemType) =>
        workItemType.Equals("Dorm.FinanceGateConfirm", StringComparison.OrdinalIgnoreCase);

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicateSubmission(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicateSubmission")) ||
        IsTrue(Value(fields, "simulateDuplicateSubmission")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentFinanceConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(
            Value(fields, "expectedFinanceVersion"),
            Value(fields, "expectedRequirementVersion"),
            Value(fields, "expectedVersion"));
        var current = FirstNonEmpty(
            Value(fields, "currentFinanceVersion"),
            Value(fields, "currentRequirementVersion"),
            Value(fields, "currentVersion"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasConfirmedReservation(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "reservationStatus"), Value(fields, "bookingStatus"));
        return IsTrue(Value(fields, "reservationConfirmed")) ||
            status.Equals("已预订", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("confirmed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasCancelledReservation(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "reservationCancelled")) ||
        Value(fields, "reservationStatus").Equals("已取消", StringComparison.OrdinalIgnoreCase) ||
        Value(fields, "bookingStatus").Equals("cancelled", StringComparison.OrdinalIgnoreCase);

    private static bool HasPriceSnapshot(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(FirstNonEmpty(
            Value(fields, "priceSnapshot"),
            Value(fields, "priceSnapshotRef"),
            Value(fields, "reservationPriceSnapshot"),
            Value(fields, "quotePriceSnapshot")));

    private static bool HasInvalidRequirementSource(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "manualFinalFinanceTruth")) ||
            IsTrue(Value(fields, "userOverridesFinanceTruth")))
        {
            return true;
        }

        var source = FirstNonEmpty(Value(fields, "amountSource"), Value(fields, "requirementSource"));
        return !string.IsNullOrWhiteSpace(source) &&
            !new[] { "priceSnapshot", "quoteVersion", "depositPolicy", "价格快照", "报价版本", "押金政策" }
                .Contains(source, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasPositiveAmount(IReadOnlyDictionary<string, string> fields)
    {
        var value = FirstNonEmpty(
            Value(fields, "receivedAmount"),
            Value(fields, "depositAmount"),
            Value(fields, "financeConfirmedAmount"),
            Value(fields, "amount"));
        return decimal.TryParse(value, out var amount) && amount > 0;
    }

    private static bool HasCurrencyMismatch(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "currencyMismatch"))) return true;
        var currency = FirstNonEmpty(Value(fields, "currency"), Value(fields, "submittedCurrency"));
        var expected = FirstNonEmpty(Value(fields, "expectedCurrency"), Value(fields, "requirementCurrency"));
        return !string.IsNullOrWhiteSpace(currency) &&
            !string.IsNullOrWhiteSpace(expected) &&
            !currency.Equals(expected, StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasDepositMarkedAsIncome(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "depositAsIncome")) ||
        IsTrue(Value(fields, "depositMarkedIncome")) ||
        Value(fields, "depositAccountingCategory").Equals("收入", StringComparison.OrdinalIgnoreCase) ||
        Value(fields, "depositAccountingCategory").Equals("income", StringComparison.OrdinalIgnoreCase);

    private static bool HasGuaranteeMarkedAsPayment(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "guaranteeAsPayment")) ||
        IsTrue(Value(fields, "guaranteeMarkedPaid")) ||
        IsTrue(Value(fields, "preAuthorizationAsPayment")) ||
        Value(fields, "guaranteeStatus").Equals("已收款", StringComparison.OrdinalIgnoreCase);

    private static bool RequiresGuaranteeValidity(string workItemType, IReadOnlyDictionary<string, string> fields) =>
        workItemType.Equals("Dorm.DepositGuaranteeSubmit", StringComparison.OrdinalIgnoreCase) &&
        (IsTrue(Value(fields, "guaranteeRequired")) ||
         IsTrue(Value(fields, "preAuthorizationOption")) ||
         Value(fields, "depositOption").Equals("担保", StringComparison.OrdinalIgnoreCase));

    private static bool HasGuaranteeValidity(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(FirstNonEmpty(
            Value(fields, "guaranteeValidUntil"),
            Value(fields, "preAuthorizationValidUntil")));

    private static bool HasPostSubmissionInlineEdit(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "inlineEditSubmittedEvidence")) ||
        IsTrue(Value(fields, "overwriteSubmittedEvidence")) ||
        (Value(fields, "financeStatus").Equals("待财务确认", StringComparison.OrdinalIgnoreCase) &&
         IsTrue(Value(fields, "inlineEditAttempt")));

    private static bool HasConfirmedFinanceInlineEdit(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "inlineEditConfirmedFinance")) ||
        (Value(fields, "financeStatus").Equals("财务已确认", StringComparison.OrdinalIgnoreCase) &&
         IsTrue(Value(fields, "inlineEditAttempt")));

    private static bool HasFinanceGateRoute(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "viaFinanceGate")) ||
        IsTrue(Value(fields, "financeGateTask")) ||
        Value(fields, "surface").Equals("finance-gate", StringComparison.OrdinalIgnoreCase);

    private static bool HasAuthorizedFinanceRole(IReadOnlyDictionary<string, string> fields)
    {
        var role = FirstNonEmpty(Value(fields, "actorRole"), Value(fields, "role"));
        return IsTrue(Value(fields, "authorizedFinanceRole")) ||
            IsTrue(Value(fields, "financeRole")) ||
            new[] { "finance", "finance-manager", "authorized-finance", "财务", "财务主管" }
                .Contains(role, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasLedgerWriteAttempt(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "ledgerWriteAttempt")) ||
            IsTrue(Value(fields, "directLedgerWrite")) ||
            IsTrue(Value(fields, "bypassFinanceGate")))
        {
            return true;
        }

        var forbiddenTokens = new[] { "ledgerEntry", "ledgerTransaction", "directLedger", "账务分录", "账务交易" };
        return fields.Any(item =>
            forbiddenTokens.Any(token => item.Key.Contains(token, StringComparison.OrdinalIgnoreCase)) &&
            !string.IsNullOrWhiteSpace(item.Value) &&
            !new[] { "false", "0", "no", "否" }.Contains(item.Value, StringComparer.OrdinalIgnoreCase));
    }

    private static bool HasCrossScenarioCheckInAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "checkInIntent")) ||
        IsTrue(Value(fields, "stayIntent")) ||
        IsTrue(Value(fields, "directCheckInAttempt")) ||
        new[] { "checkIn", "check-in", "stay", "入住", "办理入住" }
            .Contains(Value(fields, "targetNextAction"), StringComparer.OrdinalIgnoreCase);

    private static bool IsTrueFromName(string workItemType, string name) =>
        workItemType.Contains(name, StringComparison.OrdinalIgnoreCase);

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario7CheckInProcessingRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario7CheckInProcessing.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (submitted.TryGetValue("stayNo", out var stayNo) && !string.IsNullOrWhiteSpace(stayNo))
        {
            return Reject(workItem.WorkItemType, "stay_no_user_input_forbidden", fields);
        }

        if (HasDuplicateSubmission(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_checkin", fields, StatusCodes.Status409Conflict);
        }

        if (HasConcurrentOccupancyConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_occupancy_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasCrossScenarioCheckoutRefundOrFinanceAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "cross_scenario_checkout_refund_forbidden", fields);
        }

        if (HasCancelledReservation(fields))
        {
            return Reject(workItem.WorkItemType, "reservation_cancelled", fields);
        }

        if (HasExpiredReservation(fields))
        {
            return Reject(workItem.WorkItemType, "reservation_expired", fields);
        }

        if (HasAlreadyConvertedReservation(fields))
        {
            return Reject(workItem.WorkItemType, "reservation_already_converted", fields);
        }

        if (!HasValidReservation(fields))
        {
            return Reject(workItem.WorkItemType, "reservation_not_valid", fields);
        }

        if (RequiresFinanceReady(workItem.WorkItemType) && !HasFinanceReady(fields))
        {
            if (HasManagerException(fields))
            {
                if (!HasAuthorizedManagerException(fields, request.EvidenceIds))
                {
                    return Reject(workItem.WorkItemType, "manager_exception_approval_required", fields);
                }
            }
            else
            {
                return Reject(workItem.WorkItemType, "finance_rule_unmet_without_exception", fields);
            }
        }

        if (RequiresIdentity(workItem.WorkItemType))
        {
            if (!HasIdentityEvidence(fields, request.EvidenceIds))
            {
                return Reject(workItem.WorkItemType, "identity_evidence_required", fields);
            }

            if (HasIdentityVerificationFailed(fields))
            {
                return Reject(workItem.WorkItemType, "identity_verification_failed", fields);
            }

            if (HasGuestMismatchWithoutApproval(fields, request.EvidenceIds))
            {
                return Reject(workItem.WorkItemType, "guest_mismatch_without_approval", fields);
            }
        }

        if (RequiresAgreement(workItem.WorkItemType) && !HasAgreementConfirmed(fields))
        {
            return Reject(workItem.WorkItemType, "agreement_not_confirmed", fields);
        }

        if (RequiresResourceReady(workItem.WorkItemType))
        {
            if (HasResourceOccupied(fields))
            {
                return Reject(workItem.WorkItemType, "resource_already_occupied", fields);
            }

            if (HasResourceBlocked(fields))
            {
                return Reject(workItem.WorkItemType, "resource_blocked_for_checkin", fields);
            }

            if (!HasResourceAvailableForCheckIn(fields))
            {
                return Reject(workItem.WorkItemType, "resource_not_available_for_checkin", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.StayCredentialIssue", StringComparison.OrdinalIgnoreCase) &&
            !HasConfirmedStay(fields))
        {
            return Reject(workItem.WorkItemType, "credential_before_checkin_forbidden", fields);
        }

        if (HasConfirmedCheckInInlineEdit(fields))
        {
            return Reject(workItem.WorkItemType, "confirmed_checkin_inline_edit_forbidden", fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario7.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("duplicate_checkin", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("concurrent_occupancy_conflict", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前业务规则未通过，未写入任何业务结果。";
            }
        }

        return "当前业务规则未通过，未写入任何业务结果。";
    }

    private static bool RequiresFinanceReady(string workItemType) =>
        new[]
        {
            "Dorm.CheckInAgreementFinanceReview",
            "Dorm.RoomBedHandoverRecheck",
            "Dorm.StayConfirm",
            "Dorm.StayCredentialIssue"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool RequiresIdentity(string workItemType) =>
        new[]
        {
            "Dorm.GuestIdentityVerify",
            "Dorm.StayConfirm"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool RequiresAgreement(string workItemType) =>
        new[]
        {
            "Dorm.CheckInAgreementFinanceReview",
            "Dorm.StayConfirm"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool RequiresResourceReady(string workItemType) =>
        new[]
        {
            "Dorm.RoomBedHandoverRecheck",
            "Dorm.StayConfirm"
        }.Contains(workItemType, StringComparer.OrdinalIgnoreCase);

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicateSubmission(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicateSubmission")) ||
        IsTrue(Value(fields, "simulateDuplicateSubmission")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentOccupancyConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(
            Value(fields, "expectedOccupancyVersion"),
            Value(fields, "expectedStayVersion"),
            Value(fields, "expectedVersion"));
        var current = FirstNonEmpty(
            Value(fields, "currentOccupancyVersion"),
            Value(fields, "currentStayVersion"),
            Value(fields, "currentVersion"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasCrossScenarioCheckoutRefundOrFinanceAttempt(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "checkoutIntent")) ||
            IsTrue(Value(fields, "refundIntent")) ||
            IsTrue(Value(fields, "paymentIntent")) ||
            IsTrue(Value(fields, "depositIntent")) ||
            IsTrue(Value(fields, "ledgerWriteAttempt")) ||
            IsTrue(Value(fields, "directLedgerWrite")))
        {
            return true;
        }

        var target = Value(fields, "targetNextAction");
        if (new[] { "checkout", "refund", "payment", "deposit", "ledger", "退房", "退款", "收款", "押金", "账务" }
            .Contains(target, StringComparer.OrdinalIgnoreCase))
        {
            return true;
        }

        var forbiddenWriteKeys = new[] { "paymentWriteAttempt", "depositWriteAttempt", "refundWriteAttempt", "checkoutWriteAttempt", "ledgerEntryWriteAttempt", "ledgerTransactionWriteAttempt" };
        return forbiddenWriteKeys.Any(key => IsTrue(Value(fields, key)));
    }

    private static bool HasValidReservation(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "reservationStatus"), Value(fields, "bookingStatus"));
        if (IsFalse(Value(fields, "reservationConfirmed")) || IsFalse(Value(fields, "validReservation")))
        {
            return false;
        }

        return IsTrue(Value(fields, "reservationConfirmed")) ||
            IsTrue(Value(fields, "validReservation")) ||
            status.Equals("已预订", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("confirmed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasCancelledReservation(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "reservationCancelled")) ||
        Value(fields, "reservationStatus").Equals("已取消", StringComparison.OrdinalIgnoreCase) ||
        Value(fields, "bookingStatus").Equals("cancelled", StringComparison.OrdinalIgnoreCase);

    private static bool HasExpiredReservation(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "reservationExpired")) ||
            Value(fields, "reservationStatus").Equals("已过期", StringComparison.OrdinalIgnoreCase) ||
            Value(fields, "bookingStatus").Equals("expired", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var expiry = FirstNonEmpty(Value(fields, "reservationValidUntil"), Value(fields, "bookingValidUntil"));
        return DateTime.TryParse(expiry, out var validUntil) && validUntil.Date < DateTime.UtcNow.Date;
    }

    private static bool HasAlreadyConvertedReservation(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "reservationAlreadyConverted")) ||
        IsTrue(Value(fields, "reservationConvertedToStay")) ||
        Value(fields, "reservationStatus").Equals("已转入住", StringComparison.OrdinalIgnoreCase) ||
        Value(fields, "bookingStatus").Equals("converted", StringComparison.OrdinalIgnoreCase);

    private static bool HasFinanceReady(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "financeStatus"), Value(fields, "financeConfirmationStatus"));
        return IsTrue(Value(fields, "financeReady")) ||
            status.Equals("财务已确认", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("finance-confirmed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasManagerException(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "managerExceptionApproval")) ||
        IsTrue(Value(fields, "managerExceptionRequested")) ||
        IsTrue(Value(fields, "exceptionCheckIn"));

    private static bool HasAuthorizedManagerException(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds)
    {
        var role = FirstNonEmpty(Value(fields, "actorRole"), Value(fields, "role"));
        return (IsTrue(Value(fields, "authorizedManager")) ||
                IsTrue(Value(fields, "managerApproved")) ||
                new[] { "manager", "operations-manager", "负责人", "店长", "主管" }.Contains(role, StringComparer.OrdinalIgnoreCase)) &&
            (IsTrue(Value(fields, "managerExceptionEvidenceBound")) || (evidenceIds?.Count ?? 0) > 0);
    }

    private static bool HasIdentityEvidence(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds) =>
        IsTrue(Value(fields, "identityEvidenceBound")) ||
        IsTrue(Value(fields, "identityDocumentBound")) ||
        (evidenceIds?.Count ?? 0) > 0;

    private static bool HasIdentityVerificationFailed(IReadOnlyDictionary<string, string> fields)
    {
        var result = FirstNonEmpty(Value(fields, "identityVerificationResult"), Value(fields, "identityStatus"));
        return IsTrue(Value(fields, "identityVerificationFailed")) ||
            new[] { "失败", "不通过", "failed", "rejected" }.Contains(result, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasGuestMismatchWithoutApproval(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds) =>
        (IsTrue(Value(fields, "guestMismatch")) ||
         IsTrue(Value(fields, "guestMismatchWithReservation")) ||
         IsFalse(Value(fields, "guestMatchesReservation"))) &&
        !IsTrue(Value(fields, "guestMismatchApproved")) &&
        !IsTrue(Value(fields, "managerApproved")) &&
        !((evidenceIds?.Count ?? 0) > 0 && IsTrue(Value(fields, "guestMismatchApprovalEvidence")));

    private static bool HasAgreementConfirmed(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "agreementStatus"), Value(fields, "checkInAgreementStatus"));
        return IsTrue(Value(fields, "agreementConfirmed")) ||
            status.Equals("已确认", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("confirmed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasResourceAvailableForCheckIn(IReadOnlyDictionary<string, string> fields)
    {
        var availability = FirstNonEmpty(Value(fields, "resourceAvailability"), Value(fields, "roomBedAvailability"));
        return IsTrue(Value(fields, "resourceAvailableForCheckIn")) ||
            IsTrue(Value(fields, "resourceAvailable")) ||
            availability.Equals("可入住", StringComparison.OrdinalIgnoreCase) ||
            availability.Equals("available-for-checkin", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasResourceOccupied(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "resourceOccupied")) ||
        IsTrue(Value(fields, "occupancyExists")) ||
        Value(fields, "occupancyStatus").Equals("已占用", StringComparison.OrdinalIgnoreCase) ||
        Value(fields, "roomBedAvailability").Equals("已占用", StringComparison.OrdinalIgnoreCase);

    private static bool HasResourceBlocked(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "resourceBlocked")) ||
            IsTrue(Value(fields, "maintenanceBlocked")) ||
            IsTrue(Value(fields, "salePaused")) ||
            IsTrue(Value(fields, "resourceAbnormal")))
        {
            return true;
        }

        var status = FirstNonEmpty(Value(fields, "resourceStatus"), Value(fields, "operationStatus"), Value(fields, "resourceAvailability"));
        return new[] { "维修", "维修中", "停售", "暂停", "暂停开放", "异常", "maintenance", "sale-paused", "suspended", "abnormal" }
            .Contains(status, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasConfirmedStay(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "stayStatus"), Value(fields, "checkInStatus"));
        return IsTrue(Value(fields, "stayConfirmed")) ||
            status.Equals("已入住", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("checked-in", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasConfirmedCheckInInlineEdit(IReadOnlyDictionary<string, string> fields) =>
        (HasConfirmedStay(fields) || Value(fields, "checkInStatus").Equals("已入住", StringComparison.OrdinalIgnoreCase)) &&
        (IsTrue(Value(fields, "inlineEditAttempt")) ||
         IsTrue(Value(fields, "inlineEditConfirmedStay")) ||
         IsTrue(Value(fields, "overwriteConfirmedStay")));

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static bool IsFalse(string value) =>
        new[] { "false", "0", "no", "否" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario8InStayManagementRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario8InStayManagement.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (HasDuplicateSubmission(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_in_stay_submission", fields, StatusCodes.Status409Conflict);
        }

        if (HasConcurrentOccupancyConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_occupancy_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasUnauthorizedAction(fields))
        {
            return Reject(workItem.WorkItemType, "unauthorized_in_stay_action", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.AccessCredentialStatusChange", StringComparison.OrdinalIgnoreCase))
        {
            if (HasCheckedOut(fields))
            {
                return Reject(workItem.WorkItemType, "credential_after_checkout_forbidden", fields);
            }

            if (!HasEffectiveStay(fields))
            {
                return Reject(workItem.WorkItemType, "credential_without_effective_stay_forbidden", fields);
            }
        }

        if (!HasEffectiveStay(fields))
        {
            return Reject(workItem.WorkItemType, "no_effective_stay", fields);
        }

        if (HasCheckedOut(fields))
        {
            return Reject(workItem.WorkItemType, "stay_already_checked_out", fields);
        }

        if (!HasCurrentOccupancy(fields))
        {
            return Reject(workItem.WorkItemType, "current_occupancy_required", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.ResidentServiceRequestRegister", StringComparison.OrdinalIgnoreCase) ||
            workItem.WorkItemType.Equals("Dorm.ResidentServiceProgressUpdate", StringComparison.OrdinalIgnoreCase))
        {
            if (HasServiceFinanceWriteAttempt(fields))
            {
                return Reject(workItem.WorkItemType, "service_finance_write_forbidden", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.ResidentIncidentRegister", StringComparison.OrdinalIgnoreCase) ||
            workItem.WorkItemType.Equals("Dorm.ResidentIncidentClose", StringComparison.OrdinalIgnoreCase))
        {
            if (HasIncidentRefundOrCheckoutAttempt(fields))
            {
                return Reject(workItem.WorkItemType, "incident_refund_forbidden", fields);
            }

            if (HasHighRiskIncidentWithoutReview(fields, request.EvidenceIds))
            {
                return Reject(workItem.WorkItemType, "high_risk_incident_review_required", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.StayExtensionRequestSubmit", StringComparison.OrdinalIgnoreCase))
        {
            if (HasInvalidExtensionDate(fields))
            {
                return Reject(workItem.WorkItemType, "extension_date_invalid", fields);
            }

            if (HasDirectFinanceAttempt(fields))
            {
                return Reject(workItem.WorkItemType, "extension_finance_requires_finance_gate", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.BedTransferRequestSubmit", StringComparison.OrdinalIgnoreCase))
        {
            if (HasTargetBedOccupied(fields))
            {
                return Reject(workItem.WorkItemType, "target_bed_occupied", fields);
            }

            if (HasTargetResourceBlocked(fields))
            {
                return Reject(workItem.WorkItemType, "target_resource_blocked_for_transfer", fields);
            }

            if (!HasTargetResourceAvailable(fields))
            {
                return Reject(workItem.WorkItemType, "target_resource_unavailable", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.CheckoutPreparationSnapshotCreate", StringComparison.OrdinalIgnoreCase) &&
            HasCheckoutPreparationReleaseAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "checkout_preparation_release_forbidden", fields);
        }

        if (HasCrossScenarioCheckoutRefundLedgerAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "cross_scenario_checkout_refund_ledger_forbidden", fields);
        }

        if (HasConfirmedFactInlineEdit(fields))
        {
            return Reject(workItem.WorkItemType, "confirmed_fact_inline_edit_forbidden", fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario8.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("duplicate_in_stay_submission", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("concurrent_occupancy_conflict", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前业务规则未通过，未写入任何业务结果。";
            }
        }

        return "当前业务规则未通过，未写入任何业务结果。";
    }

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicateSubmission(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicateSubmission")) ||
        IsTrue(Value(fields, "simulateDuplicateSubmission")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentOccupancyConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(
            Value(fields, "expectedOccupancyVersion"),
            Value(fields, "expectedTransferVersion"),
            Value(fields, "expectedStayVersion"),
            Value(fields, "expectedVersion"));
        var current = FirstNonEmpty(
            Value(fields, "currentOccupancyVersion"),
            Value(fields, "currentTransferVersion"),
            Value(fields, "currentStayVersion"),
            Value(fields, "currentVersion"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasUnauthorizedAction(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "unauthorizedAction")) || IsTrue(Value(fields, "rolePermissionDenied")))
        {
            return true;
        }

        var role = FirstNonEmpty(Value(fields, "actorRole"), Value(fields, "role"));
        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        return !new[] { "operator", "manager", "operations-manager", "frontdesk", "负责人", "店长", "主管", "前台" }
            .Contains(role, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasEffectiveStay(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "stayStatus"), Value(fields, "currentStayStatus"), Value(fields, "checkInStatus"));
        if (IsFalse(Value(fields, "effectiveStay")) || IsFalse(Value(fields, "stayConfirmed")))
        {
            return false;
        }

        return IsTrue(Value(fields, "effectiveStay")) ||
            IsTrue(Value(fields, "stayConfirmed")) ||
            status.Equals("已入住", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("正常在住", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("在住", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("checked-in", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("in-stay", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasCheckedOut(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "stayStatus"), Value(fields, "currentStayStatus"), Value(fields, "checkInStatus"));
        return IsTrue(Value(fields, "checkoutCompleted")) ||
            IsTrue(Value(fields, "alreadyCheckedOut")) ||
            status.Equals("已退房", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("checked-out", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasCurrentOccupancy(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "occupancyStatus"), Value(fields, "currentOccupancyStatus"));
        if (IsFalse(Value(fields, "currentOccupancyBound")) || IsFalse(Value(fields, "validOccupancy")))
        {
            return false;
        }

        return IsTrue(Value(fields, "currentOccupancyBound")) ||
            IsTrue(Value(fields, "validOccupancy")) ||
            status.Equals("在住占用", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("有效占用", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("occupied-by-stay", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasServiceFinanceWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "serviceGeneratesPayment")) ||
        IsTrue(Value(fields, "serviceGeneratesExpense")) ||
        IsTrue(Value(fields, "expenseIntent")) ||
        IsTrue(Value(fields, "directExpenseWrite")) ||
        IsTrue(Value(fields, "paymentIntent")) ||
        IsTrue(Value(fields, "receiptIntent")) ||
        IsTrue(Value(fields, "ledgerWriteAttempt"));

    private static bool HasIncidentRefundOrCheckoutAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "incidentRefundIntent")) ||
        IsTrue(Value(fields, "refundIntent")) ||
        IsTrue(Value(fields, "checkoutIntent")) ||
        IsTrue(Value(fields, "ledgerWriteAttempt")) ||
        IsTrue(Value(fields, "directLedgerWrite"));

    private static bool HasHighRiskIncidentWithoutReview(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds)
    {
        var severity = FirstNonEmpty(Value(fields, "incidentSeverity"), Value(fields, "riskLevel"));
        var highRisk = IsTrue(Value(fields, "highRiskIncident")) ||
            new[] { "高", "高风险", "high", "critical" }.Contains(severity, StringComparer.OrdinalIgnoreCase);
        if (!highRisk)
        {
            return false;
        }

        var role = FirstNonEmpty(Value(fields, "actorRole"), Value(fields, "role"));
        var reviewer = IsTrue(Value(fields, "managerReviewed")) ||
            IsTrue(Value(fields, "responsiblePersonReviewed")) ||
            new[] { "manager", "operations-manager", "负责人", "店长", "主管" }.Contains(role, StringComparer.OrdinalIgnoreCase);
        var evidence = IsTrue(Value(fields, "reviewEvidenceBound")) || (evidenceIds?.Count ?? 0) > 0;
        return !reviewer || !evidence;
    }

    private static bool HasInvalidExtensionDate(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "extensionDateInvalid")))
        {
            return true;
        }

        var oldDateText = FirstNonEmpty(Value(fields, "oldPlannedCheckoutDate"), Value(fields, "currentPlannedCheckoutDate"), Value(fields, "plannedCheckoutDate"));
        var newDateText = FirstNonEmpty(Value(fields, "newPlannedCheckoutDate"), Value(fields, "newCheckoutDate"));
        if (string.IsNullOrWhiteSpace(oldDateText) || string.IsNullOrWhiteSpace(newDateText))
        {
            return false;
        }

        if (!DateTime.TryParse(oldDateText, out var oldDate) || !DateTime.TryParse(newDateText, out var newDate))
        {
            return true;
        }

        return newDate.Date <= oldDate.Date;
    }

    private static bool HasDirectFinanceAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "paymentIntent")) ||
        IsTrue(Value(fields, "depositIntent")) ||
        IsTrue(Value(fields, "ledgerWriteAttempt")) ||
        IsTrue(Value(fields, "directPaymentWrite")) ||
        IsTrue(Value(fields, "directLedgerWrite")) ||
        IsTrue(Value(fields, "financeFactWriteAttempt"));

    private static bool HasTargetBedOccupied(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "targetBedOccupied")) ||
        IsTrue(Value(fields, "targetOccupancyExists")) ||
        Value(fields, "targetOccupancyStatus").Equals("已占用", StringComparison.OrdinalIgnoreCase) ||
        Value(fields, "targetBedStatus").Equals("已占用", StringComparison.OrdinalIgnoreCase);

    private static bool HasTargetResourceBlocked(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "targetResourceBlocked")) ||
            IsTrue(Value(fields, "targetMaintenanceBlocked")) ||
            IsTrue(Value(fields, "targetSalePaused")) ||
            IsTrue(Value(fields, "targetResourceAbnormal")))
        {
            return true;
        }

        var status = FirstNonEmpty(Value(fields, "targetResourceStatus"), Value(fields, "targetOperationStatus"));
        return new[] { "维修", "维修中", "停售", "暂停", "暂停开放", "异常", "maintenance", "sale-paused", "suspended", "abnormal" }
            .Contains(status, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasTargetResourceAvailable(IReadOnlyDictionary<string, string> fields)
    {
        var availability = FirstNonEmpty(Value(fields, "targetResourceAvailability"), Value(fields, "targetBedAvailability"));
        return IsTrue(Value(fields, "targetResourceAvailable")) ||
            IsTrue(Value(fields, "targetBedAvailable")) ||
            availability.Equals("可用", StringComparison.OrdinalIgnoreCase) ||
            availability.Equals("可换入", StringComparison.OrdinalIgnoreCase) ||
            availability.Equals("available", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasCheckoutPreparationReleaseAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "releaseRoom")) ||
        IsTrue(Value(fields, "roomReleaseIntent")) ||
        IsTrue(Value(fields, "resourceReleaseIntent")) ||
        IsTrue(Value(fields, "checkoutSettlementIntent")) ||
        IsTrue(Value(fields, "settlementIntent")) ||
        IsTrue(Value(fields, "refundIntent"));

    private static bool HasCrossScenarioCheckoutRefundLedgerAttempt(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "checkoutIntent")) ||
            IsTrue(Value(fields, "refundIntent")) ||
            IsTrue(Value(fields, "paymentIntent")) ||
            IsTrue(Value(fields, "depositIntent")) ||
            IsTrue(Value(fields, "ledgerWriteAttempt")) ||
            IsTrue(Value(fields, "directLedgerWrite")) ||
            IsTrue(Value(fields, "roomReleaseIntent")) ||
            IsTrue(Value(fields, "resourceReleaseIntent")))
        {
            return true;
        }

        var target = Value(fields, "targetNextAction");
        return new[] { "checkout", "refund", "payment", "deposit", "ledger", "release", "退房", "退款", "收款", "押金", "账务", "释放房源" }
            .Contains(target, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasConfirmedFactInlineEdit(IReadOnlyDictionary<string, string> fields) =>
        (IsTrue(Value(fields, "confirmedFact")) ||
         IsTrue(Value(fields, "stayStatusConfirmed")) ||
         !new[] { "draft", "草稿" }.Contains(Value(fields, "factStatus"), StringComparer.OrdinalIgnoreCase)) &&
        (IsTrue(Value(fields, "inlineEditAttempt")) ||
         IsTrue(Value(fields, "editInPlace")) ||
         IsTrue(Value(fields, "overwriteConfirmedFact")));

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static bool IsFalse(string value) =>
        new[] { "false", "0", "no", "否" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario9CheckoutSettlementRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario9CheckoutSettlement.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (HasDuplicateSubmission(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_checkout_submission", fields, StatusCodes.Status409Conflict);
        }

        if (HasConcurrentCheckoutConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_checkout_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasUnauthorizedAction(fields))
        {
            return Reject(workItem.WorkItemType, "unauthorized_checkout_action", fields);
        }

        if (!HasEffectiveStay(fields))
        {
            return Reject(workItem.WorkItemType, "no_effective_stay", fields);
        }

        if (HasCheckedOut(fields))
        {
            return Reject(workItem.WorkItemType, "stay_already_checked_out", fields);
        }

        if (!HasCurrentOccupancy(fields))
        {
            return Reject(workItem.WorkItemType, "current_occupancy_required", fields);
        }

        if (HasHighRiskIncidentBlockingCheckout(fields))
        {
            return Reject(workItem.WorkItemType, "high_risk_incident_blocks_normal_checkout", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.CheckoutHandoverConfirm", StringComparison.OrdinalIgnoreCase) ||
            workItem.WorkItemType.Equals("Dorm.CheckoutConfirm", StringComparison.OrdinalIgnoreCase))
        {
            if (!HasActualCheckoutTime(fields))
            {
                return Reject(workItem.WorkItemType, "actual_checkout_time_required", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.CheckoutHandoverConfirm", StringComparison.OrdinalIgnoreCase) &&
            HasProxyOrAbnormalHandoverWithoutEvidence(fields, request.EvidenceIds))
        {
            return Reject(workItem.WorkItemType, "proxy_or_abnormal_handover_evidence_required", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.CheckoutConfirm", StringComparison.OrdinalIgnoreCase) &&
            !HasCredentialReturnedOrExceptionExplained(fields))
        {
            return Reject(workItem.WorkItemType, "credential_return_required", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.CheckoutInspectionConfirm", StringComparison.OrdinalIgnoreCase) ||
            workItem.WorkItemType.Equals("Dorm.CheckoutConfirm", StringComparison.OrdinalIgnoreCase))
        {
            if (!HasInspectionEvidence(fields, request.EvidenceIds))
            {
                return Reject(workItem.WorkItemType, "inspection_evidence_required", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.CheckoutInspectionConfirm", StringComparison.OrdinalIgnoreCase) &&
            HasDamageWithoutDescriptionEvidence(fields, request.EvidenceIds))
        {
            return Reject(workItem.WorkItemType, "damage_description_evidence_required", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.CheckoutFeeCalculationGenerate", StringComparison.OrdinalIgnoreCase))
        {
            if (!HasValidFeeSource(fields))
            {
                return Reject(workItem.WorkItemType, "fee_source_invalid", fields);
            }

            if (HasFinalLedgerTruthInput(fields))
            {
                return Reject(workItem.WorkItemType, "final_ledger_truth_manual_input_forbidden", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.CustomerSettlementConfirm", StringComparison.OrdinalIgnoreCase) ||
            workItem.WorkItemType.Equals("Dorm.CheckoutConfirm", StringComparison.OrdinalIgnoreCase))
        {
            if (HasDisputedSettlement(fields))
            {
                return Reject(workItem.WorkItemType, "disputed_settlement_requires_review", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.CheckoutConfirm", StringComparison.OrdinalIgnoreCase) &&
            !HasCustomerConfirmedSettlement(fields))
        {
            return Reject(workItem.WorkItemType, "customer_confirmation_required", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.CheckoutFinanceRequestCreate", StringComparison.OrdinalIgnoreCase) &&
            HasFinanceGateBypass(fields))
        {
            return Reject(workItem.WorkItemType, "finance_gate_required_for_refund_or_topup", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.ResourceRecoveryRequestCreate", StringComparison.OrdinalIgnoreCase) ||
            workItem.WorkItemType.Equals("Dorm.CheckoutConfirm", StringComparison.OrdinalIgnoreCase))
        {
            if (HasDirectOperationalRestore(fields))
            {
                return Reject(workItem.WorkItemType, "resource_operational_direct_restore_forbidden", fields);
            }
        }

        if (HasDirectPaymentRefundLedgerAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "direct_payment_refund_ledger_forbidden", fields);
        }

        if (HasConfirmedCheckoutInlineEdit(fields))
        {
            return Reject(workItem.WorkItemType, "confirmed_checkout_inline_edit_forbidden", fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario9.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("duplicate_checkout_submission", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("concurrent_checkout_conflict", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前退房结算规则未通过，未写入任何业务结果。";
            }
        }

        return "当前退房结算规则未通过，未写入任何业务结果。";
    }

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicateSubmission(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicateSubmission")) ||
        IsTrue(Value(fields, "simulateDuplicateSubmission")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentCheckoutConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(
            Value(fields, "expectedCheckoutVersion"),
            Value(fields, "expectedOccupancyVersion"),
            Value(fields, "expectedStayVersion"),
            Value(fields, "expectedVersion"));
        var current = FirstNonEmpty(
            Value(fields, "currentCheckoutVersion"),
            Value(fields, "currentOccupancyVersion"),
            Value(fields, "currentStayVersion"),
            Value(fields, "currentVersion"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasUnauthorizedAction(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "unauthorizedAction")) || IsTrue(Value(fields, "rolePermissionDenied")))
        {
            return true;
        }

        var role = FirstNonEmpty(Value(fields, "actorRole"), Value(fields, "role"));
        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        return !new[] { "operator", "manager", "operations-manager", "frontdesk", "finance", "负责人", "店长", "主管", "前台", "财务" }
            .Contains(role, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasEffectiveStay(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "stayStatus"), Value(fields, "currentStayStatus"), Value(fields, "checkInStatus"));
        if (IsFalse(Value(fields, "effectiveStay")) || IsFalse(Value(fields, "stayConfirmed")))
        {
            return false;
        }

        return IsTrue(Value(fields, "effectiveStay")) ||
            IsTrue(Value(fields, "stayConfirmed")) ||
            status.Equals("已入住", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("正常在住", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("在住", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("checked-in", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("in-stay", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasCheckedOut(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "checkoutStatus"), Value(fields, "stayStatus"), Value(fields, "currentStayStatus"));
        return IsTrue(Value(fields, "checkoutCompleted")) ||
            IsTrue(Value(fields, "alreadyCheckedOut")) ||
            IsTrue(Value(fields, "stayCheckedOut")) ||
            status.Equals("已退房", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("checked-out", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasCurrentOccupancy(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "occupancyStatus"), Value(fields, "currentOccupancyStatus"));
        if (IsFalse(Value(fields, "currentOccupancyBound")) || IsFalse(Value(fields, "validOccupancy")))
        {
            return false;
        }

        return IsTrue(Value(fields, "currentOccupancyBound")) ||
            IsTrue(Value(fields, "validOccupancy")) ||
            status.Equals("在住占用", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("有效占用", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("occupied-by-stay", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasHighRiskIncidentBlockingCheckout(IReadOnlyDictionary<string, string> fields)
    {
        var risk = FirstNonEmpty(Value(fields, "incidentRiskLevel"), Value(fields, "riskLevel"));
        return IsTrue(Value(fields, "highRiskIncidentBlocksCheckout")) ||
            IsTrue(Value(fields, "checkoutBlockedByIncident")) ||
            new[] { "禁止退房", "高风险", "blocked", "critical" }.Contains(risk, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasActualCheckoutTime(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(FirstNonEmpty(Value(fields, "actualCheckoutAt"), Value(fields, "actualCheckoutTime")));

    private static bool HasProxyOrAbnormalHandoverWithoutEvidence(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds)
    {
        var type = FirstNonEmpty(Value(fields, "handoverType"), Value(fields, "checkoutHandlingType"));
        var requiresEvidence = type.Equals("代办", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("异常离店", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("proxy", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("abnormal", StringComparison.OrdinalIgnoreCase);
        if (!requiresEvidence)
        {
            return false;
        }

        var hasNote = !string.IsNullOrWhiteSpace(FirstNonEmpty(Value(fields, "handoverNote"), Value(fields, "abnormalCheckoutNote")));
        var hasEvidence = IsTrue(Value(fields, "handoverEvidenceBound")) || (evidenceIds?.Count ?? 0) > 0;
        return !hasNote || !hasEvidence;
    }

    private static bool HasCredentialReturnedOrExceptionExplained(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "credentialReturnStatus"), Value(fields, "credentialStatus"));
        if (IsTrue(Value(fields, "credentialReturned")) ||
            IsTrue(Value(fields, "credentialReturnRecorded")) ||
            status.Equals("已回收", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("异常说明已记录", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return IsTrue(Value(fields, "credentialExceptionExplained")) &&
            !string.IsNullOrWhiteSpace(Value(fields, "credentialExceptionNote"));
    }

    private static bool HasInspectionEvidence(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds) =>
        IsTrue(Value(fields, "inspectionEvidenceBound")) ||
        IsTrue(Value(fields, "roomInspectionEvidenceBound")) ||
        IsTrue(Value(fields, "checkoutInspectionCompleted")) ||
        (evidenceIds?.Count ?? 0) > 0;

    private static bool HasDamageWithoutDescriptionEvidence(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds)
    {
        var hasDamage = IsTrue(Value(fields, "hasDamage")) ||
            IsTrue(Value(fields, "hasLostItem")) ||
            new[] { "有损坏", "有遗失", "damage", "lost" }.Contains(Value(fields, "inspectionResult"), StringComparer.OrdinalIgnoreCase);
        if (!hasDamage)
        {
            return false;
        }

        var hasDescription = !string.IsNullOrWhiteSpace(FirstNonEmpty(Value(fields, "damageDescription"), Value(fields, "lostItemDescription")));
        var hasEvidence = IsTrue(Value(fields, "damageEvidenceBound")) || (evidenceIds?.Count ?? 0) > 0;
        return !hasDescription || !hasEvidence;
    }

    private static bool HasValidFeeSource(IReadOnlyDictionary<string, string> fields)
    {
        if (IsFalse(Value(fields, "feeSourceValid")) || IsTrue(Value(fields, "feeSourceInvalid")))
        {
            return false;
        }

        return IsTrue(Value(fields, "feeSourceValid")) ||
            IsTrue(Value(fields, "priceSnapshotBound")) ||
            IsTrue(Value(fields, "financeSnapshotBound")) ||
            IsTrue(Value(fields, "damageEvidenceBound")) ||
            IsTrue(Value(fields, "authorizedAdjustmentBound"));
    }

    private static bool HasFinalLedgerTruthInput(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "finalLedgerTruthInput")) ||
        IsTrue(Value(fields, "manualLedgerTruth")) ||
        IsTrue(Value(fields, "ledgerEntryConfirmed"));

    private static bool HasDisputedSettlement(IReadOnlyDictionary<string, string> fields)
    {
        var confirmation = FirstNonEmpty(Value(fields, "customerConfirmationStatus"), Value(fields, "confirmationStatus"));
        return IsTrue(Value(fields, "hasDispute")) ||
            IsTrue(Value(fields, "customerRejected")) ||
            confirmation.Equals("客户拒绝", StringComparison.OrdinalIgnoreCase) ||
            confirmation.Equals("有争议", StringComparison.OrdinalIgnoreCase) ||
            confirmation.Equals("rejected", StringComparison.OrdinalIgnoreCase) ||
            confirmation.Equals("disputed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasCustomerConfirmedSettlement(IReadOnlyDictionary<string, string> fields)
    {
        var confirmation = FirstNonEmpty(Value(fields, "customerConfirmationStatus"), Value(fields, "confirmationStatus"));
        return IsTrue(Value(fields, "customerConfirmedSettlement")) ||
            IsTrue(Value(fields, "customerSettlementConfirmed")) ||
            confirmation.Equals("客户确认", StringComparison.OrdinalIgnoreCase) ||
            confirmation.Equals("confirmed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasFinanceGateBypass(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directRefund")) ||
        IsTrue(Value(fields, "directTopUpCollection")) ||
        IsTrue(Value(fields, "paymentConfirmed")) ||
        IsTrue(Value(fields, "refundConfirmed")) ||
        IsTrue(Value(fields, "ledgerEntryConfirmed"));

    private static bool HasDirectOperationalRestore(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "restoreOperationalDirectly")) ||
            IsTrue(Value(fields, "resourceOperationalConfirmed")) ||
            IsTrue(Value(fields, "markRoomOperational")))
        {
            return true;
        }

        var target = FirstNonEmpty(Value(fields, "resourceRecoveryTargetStatus"), Value(fields, "targetOperationStatus"));
        return new[] { "可运营", "available-for-operation", "operational" }.Contains(target, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasDirectPaymentRefundLedgerAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directPaymentWrite")) ||
        IsTrue(Value(fields, "directRefundWrite")) ||
        IsTrue(Value(fields, "directLedgerWrite")) ||
        IsTrue(Value(fields, "ledgerWriteAttempt")) ||
        IsTrue(Value(fields, "paymentFactWriteAttempt")) ||
        IsTrue(Value(fields, "refundFactWriteAttempt"));

    private static bool HasConfirmedCheckoutInlineEdit(IReadOnlyDictionary<string, string> fields) =>
        (IsTrue(Value(fields, "confirmedCheckout")) ||
         IsTrue(Value(fields, "checkoutConfirmed")) ||
         !new[] { "draft", "草稿" }.Contains(Value(fields, "factStatus"), StringComparer.OrdinalIgnoreCase)) &&
        (IsTrue(Value(fields, "inlineEditAttempt")) ||
         IsTrue(Value(fields, "editInPlace")) ||
         IsTrue(Value(fields, "overwriteConfirmedFact")));

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static bool IsFalse(string value) =>
        new[] { "false", "0", "no", "否" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario10CancelNoShowRefundRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario10CancelNoShowRefund.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (HasDuplicateSubmission(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_cancellation_submission", fields, StatusCodes.Status409Conflict);
        }

        if (HasConcurrentCancellationConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_cancellation_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasUnauthorizedAction(fields))
        {
            return Reject(workItem.WorkItemType, "unauthorized_cancellation_action", fields);
        }

        if (HasDirectPaymentRefundLedgerAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "direct_refund_payment_ledger_forbidden", fields);
        }

        if (HasFinanceGateBypass(fields))
        {
            return Reject(workItem.WorkItemType, "finance_gate_required", fields);
        }

        if (!HasEffectiveReservation(fields))
        {
            return Reject(workItem.WorkItemType, "no_effective_reservation", fields);
        }

        if (HasCheckedIn(fields) && !IsFollowUpOnlyCommand(workItem.WorkItemType))
        {
            return Reject(workItem.WorkItemType, "reservation_already_checked_in", fields);
        }

        if (HasCheckedOut(fields) && !IsCheckoutRefundFollowUp(fields))
        {
            return Reject(workItem.WorkItemType, "reservation_already_checked_out", fields);
        }

        if (HasAlreadyCancelled(fields))
        {
            return Reject(workItem.WorkItemType, "reservation_already_cancelled", fields);
        }

        if (RequiresPaymentDepositSnapshot(workItem.WorkItemType, fields) && !HasPaymentDepositSnapshot(fields))
        {
            return Reject(workItem.WorkItemType, "payment_deposit_snapshot_required", fields);
        }

        if (IsCheckoutRefundFollowUp(fields) && !HasSettlementIntent(fields))
        {
            return Reject(workItem.WorkItemType, "settlement_intent_required_for_checkout_refund", fields);
        }

        if (IsNoShowCommand(workItem.WorkItemType))
        {
            if (!HasNoShowHoldTimeElapsed(fields))
            {
                return Reject(workItem.WorkItemType, "noshow_hold_time_not_elapsed", fields);
            }

            if (HasEffectiveCheckIn(fields))
            {
                return Reject(workItem.WorkItemType, "noshow_effective_checkin_exists", fields);
            }
        }

        if (RequiresCustomerConfirmation(workItem.WorkItemType) && !HasCustomerConfirmation(fields, request.EvidenceIds))
        {
            return Reject(workItem.WorkItemType, "customer_confirmation_required", fields);
        }

        if (RequiresDisputeGate(workItem.WorkItemType) && HasDispute(fields))
        {
            return Reject(workItem.WorkItemType, "dispute_requires_review", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.CancelNoShowPolicyCalculationGenerate", StringComparison.OrdinalIgnoreCase))
        {
            if (!HasPolicyAmountSource(fields))
            {
                return Reject(workItem.WorkItemType, "policy_amount_source_missing", fields);
            }

            if (HasFinalFinanceTruthManualInput(fields))
            {
                return Reject(workItem.WorkItemType, "final_refund_manual_input_forbidden", fields);
            }
        }

        if (RequiresInventoryScope(workItem.WorkItemType) && !HasValidInventoryReleaseScope(fields))
        {
            return Reject(workItem.WorkItemType, "inventory_release_scope_invalid", fields);
        }

        if (HasConfirmedClosureInlineEdit(fields))
        {
            return Reject(workItem.WorkItemType, "confirmed_closure_inline_edit_forbidden", fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario10.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("duplicate_cancellation_submission", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("concurrent_cancellation_conflict", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前取消、未到店与退款处理规则未通过，未写入任何业务结果。";
            }
        }

        return "当前取消、未到店与退款处理规则未通过，未写入任何业务结果。";
    }

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicateSubmission(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicateSubmission")) ||
        IsTrue(Value(fields, "simulateDuplicateSubmission")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentCancellationConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(Value(fields, "expectedCancellationVersion"), Value(fields, "expectedReservationVersion"), Value(fields, "expectedVersion"));
        var current = FirstNonEmpty(Value(fields, "currentCancellationVersion"), Value(fields, "currentReservationVersion"), Value(fields, "currentVersion"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasUnauthorizedAction(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "unauthorizedAction")) || IsTrue(Value(fields, "rolePermissionDenied")))
        {
            return true;
        }

        var role = FirstNonEmpty(Value(fields, "actorRole"), Value(fields, "role"));
        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        return !new[] { "operator", "manager", "operations-manager", "frontdesk", "finance", "负责人", "店长", "主管", "前台", "财务" }
            .Contains(role, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasEffectiveReservation(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "reservationStatus"), Value(fields, "bookingStatus"));
        if (IsFalse(Value(fields, "effectiveReservation")) || IsFalse(Value(fields, "reservationConfirmed")))
        {
            return false;
        }

        return IsTrue(Value(fields, "effectiveReservation")) ||
            IsTrue(Value(fields, "reservationConfirmed")) ||
            status.Equals("已预订", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("已确认预订", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("confirmed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasPaymentDepositSnapshot(IReadOnlyDictionary<string, string> fields)
    {
        if (IsFalse(Value(fields, "paymentDepositSnapshotBound")) ||
            IsFalse(Value(fields, "paymentSummaryBound")) ||
            IsFalse(Value(fields, "depositSummaryBound")))
        {
            return false;
        }

        return IsTrue(Value(fields, "paymentDepositSnapshotBound")) ||
            IsTrue(Value(fields, "paymentSummaryBound")) ||
            IsTrue(Value(fields, "depositSummaryBound")) ||
            new[] { "已确认", "已财务确认", "confirmed" }.Contains(Value(fields, "financeStatus"), StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasSettlementIntent(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "settlementIntentBound")) ||
        IsTrue(Value(fields, "checkoutSettlementIntentBound")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "checkoutSettlementDirection"));

    private static bool HasCheckedIn(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "checkInStatus"), Value(fields, "stayStatus"));
        return IsTrue(Value(fields, "alreadyCheckedIn")) ||
            IsTrue(Value(fields, "effectiveCheckin")) ||
            status.Equals("已入住", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("在住", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("checked-in", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasEffectiveCheckIn(IReadOnlyDictionary<string, string> fields) =>
        HasCheckedIn(fields) || IsTrue(Value(fields, "checkInRecordExists"));

    private static bool HasCheckedOut(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "checkoutStatus"), Value(fields, "stayStatus"));
        return IsTrue(Value(fields, "alreadyCheckedOut")) ||
            IsTrue(Value(fields, "checkoutCompleted")) ||
            status.Equals("已退房", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("checked-out", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasAlreadyCancelled(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "cancellationStatus"), Value(fields, "reservationStatus"));
        return IsTrue(Value(fields, "alreadyCancelled")) ||
            IsTrue(Value(fields, "reservationCancelled")) ||
            status.Equals("已取消", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("未到店已关闭", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("cancelled", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasNoShowHoldTimeElapsed(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "noShowHoldTimeElapsed")) ||
        IsTrue(Value(fields, "latestHoldTimeElapsed"));

    private static bool HasCustomerConfirmation(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds)
    {
        var status = FirstNonEmpty(Value(fields, "customerConfirmationStatus"), Value(fields, "confirmationStatus"));
        return IsTrue(Value(fields, "customerConfirmed")) ||
            IsTrue(Value(fields, "customerConfirmationBound")) ||
            status.Equals("客户确认", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("confirmed", StringComparison.OrdinalIgnoreCase) ||
            (evidenceIds?.Count ?? 0) > 0 && IsTrue(Value(fields, "customerConfirmationEvidenceBound"));
    }

    private static bool HasDispute(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "customerConfirmationStatus"), Value(fields, "confirmationStatus"));
        return IsTrue(Value(fields, "hasDispute")) ||
            IsTrue(Value(fields, "customerRejected")) ||
            status.Equals("客户拒绝", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("有争议", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("rejected", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("disputed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasPolicyAmountSource(IReadOnlyDictionary<string, string> fields)
    {
        if (IsFalse(Value(fields, "policyAmountSourceValid")) || IsTrue(Value(fields, "policyAmountSourceMissing")))
        {
            return false;
        }

        return IsTrue(Value(fields, "policyAmountSourceValid")) ||
            IsTrue(Value(fields, "policySnapshotBound")) ||
            IsTrue(Value(fields, "priceSnapshotBound")) ||
            IsTrue(Value(fields, "financeSnapshotBound"));
    }

    private static bool HasFinalFinanceTruthManualInput(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "manualFinalRefundAmount")) ||
        IsTrue(Value(fields, "finalRefundManualInput")) ||
        IsTrue(Value(fields, "manualLedgerTruth")) ||
        IsTrue(Value(fields, "ledgerEntryConfirmed"));

    private static bool HasValidInventoryReleaseScope(IReadOnlyDictionary<string, string> fields)
    {
        if (IsFalse(Value(fields, "inventoryReleaseScopeValid")) || IsTrue(Value(fields, "releaseOtherReservationResource")))
        {
            return false;
        }

        return IsTrue(Value(fields, "inventoryReleaseScopeValid")) ||
            IsTrue(Value(fields, "reservationResourceBound")) ||
            IsTrue(Value(fields, "releasedDateRangeBound"));
    }

    private static bool HasFinanceGateBypass(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directRefund")) ||
        IsTrue(Value(fields, "directFeeCollection")) ||
        IsTrue(Value(fields, "paymentConfirmed")) ||
        IsTrue(Value(fields, "refundConfirmed")) ||
        IsTrue(Value(fields, "ledgerEntryConfirmed"));

    private static bool HasDirectPaymentRefundLedgerAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directPaymentWrite")) ||
        IsTrue(Value(fields, "directRefundWrite")) ||
        IsTrue(Value(fields, "directLedgerWrite")) ||
        IsTrue(Value(fields, "ledgerWriteAttempt")) ||
        IsTrue(Value(fields, "paymentFactWriteAttempt")) ||
        IsTrue(Value(fields, "refundFactWriteAttempt"));

    private static bool HasConfirmedClosureInlineEdit(IReadOnlyDictionary<string, string> fields) =>
        (IsTrue(Value(fields, "confirmedCancellation")) ||
         IsTrue(Value(fields, "closureConfirmed")) ||
         !new[] { "draft", "草稿" }.Contains(Value(fields, "factStatus"), StringComparer.OrdinalIgnoreCase)) &&
        (IsTrue(Value(fields, "inlineEditAttempt")) ||
         IsTrue(Value(fields, "editInPlace")) ||
         IsTrue(Value(fields, "overwriteConfirmedFact")));

    private static bool RequiresPaymentDepositSnapshot(string workItemType, IReadOnlyDictionary<string, string> fields) =>
        workItemType.Equals("Dorm.CancelNoShowPolicyCalculationGenerate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancelNoShowFinanceProcessingRequestCreate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancelNoShowConfirmClosure", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancellationConfirm", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.NoShowConfirm", StringComparison.OrdinalIgnoreCase) ||
        IsCheckoutRefundFollowUp(fields);

    private static bool RequiresCustomerConfirmation(string workItemType) =>
        workItemType.Equals("Dorm.CancelNoShowReasonCustomerConfirm", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancelNoShowFinanceProcessingRequestCreate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancelNoShowConfirmClosure", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancellationConfirm", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.NoShowConfirm", StringComparison.OrdinalIgnoreCase);

    private static bool RequiresDisputeGate(string workItemType) =>
        workItemType.Equals("Dorm.CancelNoShowConfirmClosure", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancellationConfirm", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.NoShowConfirm", StringComparison.OrdinalIgnoreCase);

    private static bool RequiresInventoryScope(string workItemType) =>
        workItemType.Equals("Dorm.CancelNoShowInventoryReleaseRequestConfirm", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancelNoShowConfirmClosure", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancellationConfirm", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.NoShowConfirm", StringComparison.OrdinalIgnoreCase);

    private static bool IsNoShowCommand(string workItemType) =>
        workItemType.Equals("Dorm.NoShowCaseDraftStart", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.NoShowConfirm", StringComparison.OrdinalIgnoreCase);

    private static bool IsFollowUpOnlyCommand(string workItemType) =>
        workItemType.Equals("Dorm.CancelNoShowFollowUpRecord", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancelNoShowFinanceEvidenceSupplement", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CancelNoShowCorrectionRequest", StringComparison.OrdinalIgnoreCase);

    private static bool IsCheckoutRefundFollowUp(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "checkoutRefundFollowUp")) ||
        IsTrue(Value(fields, "fromCheckoutSettlement")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "checkoutSettlementDirection"));

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static bool IsFalse(string value) =>
        new[] { "false", "0", "no", "否" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario11HousekeepingMaintenanceOutOfServiceRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (HasDuplicateSubmission(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_work_submission", fields, StatusCodes.Status409Conflict);
        }

        if (HasConcurrentWorkConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_work_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasUnauthorizedAction(fields))
        {
            return Reject(workItem.WorkItemType, "unauthorized_work_action", fields);
        }

        if (HasDirectOperationalRestoreAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "direct_operational_restore_forbidden", fields);
        }

        if (HasDirectExpenseLedgerAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "direct_expense_ledger_forbidden", fields);
        }

        if (!HasLegalWorkSource(fields))
        {
            return Reject(workItem.WorkItemType, "no_legal_work_source", fields);
        }

        if (RequiresSourceSummary(workItem.WorkItemType) && !HasSourceSummary(fields))
        {
            return Reject(workItem.WorkItemType, "missing_source_summary", fields);
        }

        if (RequiresWorkScope(workItem.WorkItemType) && !HasValidWorkScope(fields))
        {
            return Reject(workItem.WorkItemType, "missing_work_scope", fields);
        }

        if (HasInvalidResourceScope(fields))
        {
            return Reject(workItem.WorkItemType, "invalid_resource_scope", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.WorkAssignmentDispatch", StringComparison.OrdinalIgnoreCase) &&
            !HasAssignee(fields))
        {
            return Reject(workItem.WorkItemType, "missing_work_assignee", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.WorkCompletionSubmit", StringComparison.OrdinalIgnoreCase) &&
            !HasCompletionEvidence(fields, request.EvidenceIds))
        {
            return Reject(workItem.WorkItemType, "completion_evidence_required", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.WorkVerificationConfirm", StringComparison.OrdinalIgnoreCase))
        {
            if (!HasCompletionSubmitted(fields))
            {
                return Reject(workItem.WorkItemType, "completion_required_before_verification", fields);
            }

            if (IsVerificationFailed(fields) && !CreatesReworkOrException(fields))
            {
                return Reject(workItem.WorkItemType, "verification_failure_requires_rework", fields);
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.OutOfServiceOrRecoveryRecommendationCreate", StringComparison.OrdinalIgnoreCase))
        {
            if (IsOutOfServiceRecommendation(fields) && !HasOutOfServiceReason(fields))
            {
                return Reject(workItem.WorkItemType, "out_of_service_reason_required", fields);
            }

            if (IsRecoveryRecommendation(fields))
            {
                if (HasUnresolvedMaintenanceOrException(fields))
                {
                    return Reject(workItem.WorkItemType, "unresolved_maintenance_recovery_forbidden", fields);
                }

                if (!HasRecoveryResolution(fields))
                {
                    return Reject(workItem.WorkItemType, "recovery_recommendation_requires_resolution", fields);
                }
            }
        }

        if (workItem.WorkItemType.Equals("Dorm.ExpenseIntentSubmit", StringComparison.OrdinalIgnoreCase) &&
            !HasExpenseEvidence(fields, request.EvidenceIds))
        {
            return Reject(workItem.WorkItemType, "expense_evidence_required", fields);
        }

        if (HasConfirmedWorkInlineEdit(fields))
        {
            return Reject(workItem.WorkItemType, "confirmed_work_inline_edit_forbidden", fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario11.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("duplicate_work_submission", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("concurrent_work_conflict", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前房务、维修与停售协同规则未通过，未写入任何业务结果。";
            }
        }

        return "当前房务、维修与停售协同规则未通过，未写入任何业务结果。";
    }

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicateSubmission(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicateSubmission")) ||
        IsTrue(Value(fields, "simulateDuplicateSubmission")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentWorkConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(Value(fields, "expectedWorkVersion"), Value(fields, "expectedVerificationVersion"), Value(fields, "expectedVersion"));
        var current = FirstNonEmpty(Value(fields, "currentWorkVersion"), Value(fields, "currentVerificationVersion"), Value(fields, "currentVersion"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasUnauthorizedAction(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "unauthorizedAction")) || IsTrue(Value(fields, "rolePermissionDenied")))
        {
            return true;
        }

        var role = FirstNonEmpty(Value(fields, "actorRole"), Value(fields, "role"));
        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        return !new[] { "operator", "manager", "operations-manager", "housekeeping", "maintenance", "inspector", "finance", "负责人", "店长", "主管", "房务", "维修", "验收", "财务" }
            .Contains(role, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasLegalWorkSource(IReadOnlyDictionary<string, string> fields)
    {
        var source = FirstNonEmpty(Value(fields, "sourceScenario"), Value(fields, "sourceScenarioRef"), Value(fields, "sourceType"));
        if (IsFalse(Value(fields, "legalWorkSource")) || IsTrue(Value(fields, "noLegalSource")))
        {
            return false;
        }

        return IsTrue(Value(fields, "legalWorkSource")) ||
            IsTrue(Value(fields, "operationBlockSummaryBound")) ||
            IsTrue(Value(fields, "inStayServiceRequestBound")) ||
            IsTrue(Value(fields, "checkoutRecoveryRequestBound")) ||
            IsTrue(Value(fields, "releaseAfterCancellationBound")) ||
            IsTrue(Value(fields, "manualInspectionApproved")) ||
            IsTrue(Value(fields, "managerApproved")) ||
            new[] { "scenario2", "scenario8", "scenario9", "scenario10", "manual-inspection", "manager-approved", "运营阻断", "在住服务", "退房待恢复", "取消释放", "人工巡检", "负责人批准" }
                .Contains(source, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasSourceSummary(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "sourceSummaryBound")) ||
        IsTrue(Value(fields, "operationBlockSummaryBound")) ||
        IsTrue(Value(fields, "serviceRequestSummaryBound")) ||
        IsTrue(Value(fields, "checkoutRecoveryRequestBound")) ||
        IsTrue(Value(fields, "releaseResourceSummaryBound"));

    private static bool HasValidWorkScope(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "workScopeBound")) ||
        IsTrue(Value(fields, "resourceScopeBound")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "roomDisplayName")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "bedDisplayName")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "resourceDisplayName"));

    private static bool HasInvalidResourceScope(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "invalidResourceScope")) ||
        IsTrue(Value(fields, "roomBedScopeMismatch")) ||
        IsTrue(Value(fields, "crossResourceScopeAttempt"));

    private static bool HasAssignee(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "assigneeBound")) ||
        IsTrue(Value(fields, "responsiblePersonBound")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "assigneeName")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "responsiblePerson"));

    private static bool HasCompletionEvidence(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds) =>
        !string.IsNullOrWhiteSpace(Value(fields, "completionDescription")) &&
        (IsTrue(Value(fields, "completionEvidenceBound")) ||
         IsTrue(Value(fields, "completionPhotoBound")) ||
         IsTrue(Value(fields, "repairOrderBound")) ||
         IsTrue(Value(fields, "housekeepingRecordBound")) ||
         (evidenceIds?.Count ?? 0) > 0);

    private static bool HasCompletionSubmitted(IReadOnlyDictionary<string, string> fields)
    {
        var status = FirstNonEmpty(Value(fields, "workStatus"), Value(fields, "taskStatus"));
        return IsTrue(Value(fields, "completionSubmitted")) ||
            IsTrue(Value(fields, "workCompleted")) ||
            status.Equals("待验收", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("已完成", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsVerificationFailed(IReadOnlyDictionary<string, string> fields)
    {
        var result = FirstNonEmpty(Value(fields, "verificationResult"), Value(fields, "verificationConclusion"));
        return IsTrue(Value(fields, "verificationFailed")) ||
            result.Equals("验收不通过", StringComparison.OrdinalIgnoreCase) ||
            result.Equals("failed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool CreatesReworkOrException(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "reworkCreated")) ||
        IsTrue(Value(fields, "exceptionCreated")) ||
        IsTrue(Value(fields, "abnormalPendingCreated")) ||
        new[] { "返工", "异常待处理", "rework", "exception" }.Contains(Value(fields, "nextAction"), StringComparer.OrdinalIgnoreCase);

    private static bool IsOutOfServiceRecommendation(IReadOnlyDictionary<string, string> fields)
    {
        var action = FirstNonEmpty(Value(fields, "recommendationType"), Value(fields, "nextAction"));
        return IsTrue(Value(fields, "outOfServiceRecommendation")) ||
            action.Equals("建议停售", StringComparison.OrdinalIgnoreCase) ||
            action.Equals("建议暂停开放", StringComparison.OrdinalIgnoreCase) ||
            action.Equals("out-of-service", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasOutOfServiceReason(IReadOnlyDictionary<string, string> fields) =>
        !string.IsNullOrWhiteSpace(Value(fields, "outOfServiceReason")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "pauseReason")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "riskDescription"));

    private static bool IsRecoveryRecommendation(IReadOnlyDictionary<string, string> fields)
    {
        var action = FirstNonEmpty(Value(fields, "recommendationType"), Value(fields, "nextAction"));
        return IsTrue(Value(fields, "recoveryRecommendation")) ||
            action.Equals("建议恢复运营", StringComparison.OrdinalIgnoreCase) ||
            action.Equals("recovery", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasUnresolvedMaintenanceOrException(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "unresolvedMaintenance")) ||
        IsTrue(Value(fields, "outOfServiceUnclosed")) ||
        IsTrue(Value(fields, "exceptionUnclosed")) ||
        IsTrue(Value(fields, "blockReasonUnresolved"));

    private static bool HasRecoveryResolution(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "blockReasonResolved")) ||
        IsTrue(Value(fields, "verificationPassed")) ||
        IsTrue(Value(fields, "recoveryReasonProvided")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "recoverySuggestion"));

    private static bool HasExpenseEvidence(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds) =>
        IsTrue(Value(fields, "expenseEvidenceBound")) ||
        IsTrue(Value(fields, "supplierVoucherBound")) ||
        IsTrue(Value(fields, "invoiceBound")) ||
        IsTrue(Value(fields, "quoteBound")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "expenseBasis")) ||
        (evidenceIds?.Count ?? 0) > 0;

    private static bool HasDirectOperationalRestoreAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directOperationalRestore")) ||
        IsTrue(Value(fields, "operationStatusWriteAttempt")) ||
        IsTrue(Value(fields, "setRoomOperational")) ||
        IsTrue(Value(fields, "resourceOperationalConfirmed"));

    private static bool HasDirectExpenseLedgerAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directLedgerWrite")) ||
        IsTrue(Value(fields, "ledgerWriteAttempt")) ||
        IsTrue(Value(fields, "expenseLedgerConfirmed")) ||
        IsTrue(Value(fields, "paymentFactWriteAttempt")) ||
        IsTrue(Value(fields, "refundFactWriteAttempt"));

    private static bool HasConfirmedWorkInlineEdit(IReadOnlyDictionary<string, string> fields) =>
        (IsTrue(Value(fields, "workAssigned")) ||
         IsTrue(Value(fields, "workCompleted")) ||
         IsTrue(Value(fields, "workVerified")) ||
         !new[] { "draft", "草稿" }.Contains(Value(fields, "factStatus"), StringComparer.OrdinalIgnoreCase)) &&
        (IsTrue(Value(fields, "inlineEditAttempt")) ||
         IsTrue(Value(fields, "editInPlace")) ||
         IsTrue(Value(fields, "overwriteConfirmedFact")));

    private static bool RequiresSourceSummary(string workItemType) =>
        !workItemType.Equals("Dorm.TaskEvidenceSupplement", StringComparison.OrdinalIgnoreCase) &&
        !workItemType.Equals("Dorm.ServiceWorkCorrectionRequest", StringComparison.OrdinalIgnoreCase);

    private static bool RequiresWorkScope(string workItemType) =>
        workItemType.Equals("Dorm.WorkAssignmentDispatch", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.WorkProgressUpdate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.WorkCompletionSubmit", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.WorkVerificationConfirm", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.OutOfServiceOrRecoveryRecommendationCreate", StringComparison.OrdinalIgnoreCase);

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static bool IsFalse(string value) =>
        new[] { "false", "0", "no", "否" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario12ChannelCorporateCustomerRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario12ChannelCorporateCustomer.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_result_write_attempt", fields);
        }

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (HasDuplicateSubmission(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_channel_submission", fields, StatusCodes.Status409Conflict);
        }

        if (HasConcurrentChannelConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_channel_conflict", fields, StatusCodes.Status409Conflict);
        }

        if (HasUnauthorizedAction(fields))
        {
            return Reject(workItem.WorkItemType, "unauthorized_channel_action", fields);
        }

        if (HasDirectRatePlanTruthAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "direct_rateplan_truth_write_forbidden", fields);
        }

        if (HasDirectQuoteReservationAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "direct_quote_reservation_forbidden", fields);
        }

        if (HasDirectInventoryHoldAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "direct_inventory_hold_forbidden", fields);
        }

        if (HasDirectFinanceLedgerAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "direct_finance_ledger_forbidden", fields);
        }

        if (RequiresBusinessProfile(workItem.WorkItemType) && !HasBusinessProfile(fields))
        {
            return Reject(workItem.WorkItemType, "missing_required_business_profile", fields);
        }

        if (RequiresKeyEvidence(workItem.WorkItemType) && !HasKeyEvidence(fields, request.EvidenceIds))
        {
            return Reject(workItem.WorkItemType, "missing_key_evidence", fields);
        }

        if (TouchesAgreement(workItem.WorkItemType) && HasInvalidAgreementDateRange(fields))
        {
            return Reject(workItem.WorkItemType, "invalid_agreement_date_range", fields);
        }

        if (RequiresAgreementApproval(workItem.WorkItemType) && !HasAgreementApproval(fields))
        {
            return Reject(workItem.WorkItemType, "agreement_approval_required", fields);
        }

        if (UsesAgreementEligibility(workItem.WorkItemType) && HasExpiredAgreement(fields))
        {
            return Reject(workItem.WorkItemType, "expired_agreement_forbidden", fields);
        }

        if (UsesProductPriceEligibility(workItem.WorkItemType) && HasInactiveProductOrPrice(fields))
        {
            return Reject(workItem.WorkItemType, "inactive_product_price_forbidden", fields);
        }

        if (EnablesPublication(workItem.WorkItemType, fields) && !HasEffectivePrice(fields))
        {
            return Reject(workItem.WorkItemType, "missing_effective_price", fields);
        }

        if (EnablesPublication(workItem.WorkItemType, fields) && HasOperationBlock(fields))
        {
            return Reject(workItem.WorkItemType, "operation_blocked_publication_forbidden", fields);
        }

        if (EnablesPublication(workItem.WorkItemType, fields) && !HasValidEligibility(fields))
        {
            return Reject(workItem.WorkItemType, "channel_publish_requires_valid_eligibility", fields);
        }

        if (workItem.WorkItemType.Equals("Dorm.CommissionSettlementIntentSubmit", StringComparison.OrdinalIgnoreCase) &&
            !HasCommissionSettlementEvidence(fields, request.EvidenceIds))
        {
            return Reject(workItem.WorkItemType, "commission_settlement_evidence_required", fields);
        }

        if (HasConfirmedAgreementInlineEdit(fields))
        {
            return Reject(workItem.WorkItemType, "confirmed_agreement_inline_edit_forbidden", fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields")
            .GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario12.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("duplicate_channel_submission", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("concurrent_channel_conflict", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前渠道与企业客户规则未通过，未写入任何业务结果。";
            }
        }

        return "当前渠道与企业客户规则未通过，未写入任何业务结果。";
    }

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        new[] { "search", "report", "dashboard", "board", "list", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicateSubmission(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicateSubmission")) ||
        IsTrue(Value(fields, "simulateDuplicateSubmission")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentChannelConflict(IReadOnlyDictionary<string, string> fields)
    {
        if (VersionMismatch(fields, "expectedChannelVersion", "currentChannelVersion") ||
            VersionMismatch(fields, "expectedAgreementVersion", "currentAgreementVersion") ||
            VersionMismatch(fields, "expectedPublicationVersion", "currentPublicationVersion"))
        {
            return true;
        }

        var expected = Value(fields, "expectedVersion");
        var current = Value(fields, "currentVersion");
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool VersionMismatch(IReadOnlyDictionary<string, string> fields, string expectedKey, string currentKey)
    {
        var expected = Value(fields, expectedKey);
        var current = Value(fields, currentKey);
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasUnauthorizedAction(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "unauthorizedAction")) || IsTrue(Value(fields, "rolePermissionDenied")))
        {
            return true;
        }

        var role = FirstNonEmpty(Value(fields, "actorRole"), Value(fields, "role"));
        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        return !new[] { "operator", "manager", "operations-manager", "channel-manager", "corporate-manager", "finance", "负责人", "店长", "主管", "渠道经理", "企业客户经理", "财务" }
            .Contains(role, StringComparer.OrdinalIgnoreCase);
    }

    private static bool RequiresBusinessProfile(string workItemType) =>
        workItemType.Equals("Dorm.ChannelCorporateProfileDraftStart", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ChannelPartnerProfileCreate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CorporateCustomerProfileCreate", StringComparison.OrdinalIgnoreCase);

    private static bool HasBusinessProfile(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "businessProfileBound")) ||
        (!string.IsNullOrWhiteSpace(FirstNonEmpty(Value(fields, "channelName"), Value(fields, "corporateName"), Value(fields, "businessProfileName"))) &&
         !string.IsNullOrWhiteSpace(FirstNonEmpty(Value(fields, "contactName"), Value(fields, "contactPerson"))) &&
         !string.IsNullOrWhiteSpace(FirstNonEmpty(Value(fields, "contactPhone"), Value(fields, "phone"), Value(fields, "email"))));

    private static bool RequiresKeyEvidence(string workItemType) =>
        workItemType.Equals("Dorm.ChannelPublicationEnable", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ChannelCorporateAuditDecision", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CorporateAgreementApproveActivate", StringComparison.OrdinalIgnoreCase);

    private static bool HasKeyEvidence(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds) =>
        IsTrue(Value(fields, "keyEvidenceBound")) ||
        IsTrue(Value(fields, "licenseEvidenceBound")) ||
        IsTrue(Value(fields, "agreementEvidenceBound")) ||
        IsTrue(Value(fields, "authorizationEvidenceBound")) ||
        IsTrue(Value(fields, "contractEvidenceBound")) ||
        (evidenceIds?.Count ?? 0) > 0;

    private static bool TouchesAgreement(string workItemType) =>
        workItemType.Equals("Dorm.CorporateAgreementDraftSubmit", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CorporateAgreementApproveActivate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.CorporateAgreementRenew", StringComparison.OrdinalIgnoreCase);

    private static bool HasInvalidAgreementDateRange(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "invalidAgreementDates")) || IsTrue(Value(fields, "agreementDateRangeInvalid")))
        {
            return true;
        }

        var start = FirstNonEmpty(Value(fields, "agreementStartDate"), Value(fields, "effectiveFrom"));
        var end = FirstNonEmpty(Value(fields, "agreementEndDate"), Value(fields, "effectiveTo"));
        return DateTime.TryParse(start, out var startDate) &&
            DateTime.TryParse(end, out var endDate) &&
            startDate.Date > endDate.Date;
    }

    private static bool RequiresAgreementApproval(string workItemType) =>
        workItemType.Equals("Dorm.CorporateAgreementApproveActivate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ChannelProductEligibilityBind", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ChannelPublicationEnable", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ChannelCorporateAuditDecision", StringComparison.OrdinalIgnoreCase);

    private static bool HasAgreementApproval(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "agreementApproved")) ||
        IsTrue(Value(fields, "approvalRecordBound")) ||
        new[] { "协议已生效", "approved", "effective" }.Contains(Value(fields, "approvalState"), StringComparer.OrdinalIgnoreCase);

    private static bool UsesAgreementEligibility(string workItemType) =>
        workItemType.Equals("Dorm.ChannelProductEligibilityBind", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ChannelPublicationRuleConfigure", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ChannelPublicationEnable", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ChannelCorporateAuditDecision", StringComparison.OrdinalIgnoreCase);

    private static bool HasExpiredAgreement(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "agreementExpired")) ||
        Value(fields, "agreementStatus").Equals("协议已过期", StringComparison.OrdinalIgnoreCase);

    private static bool UsesProductPriceEligibility(string workItemType) =>
        workItemType.Equals("Dorm.ChannelProductEligibilityBind", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ChannelPublicationRuleConfigure", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ChannelPublicationEnable", StringComparison.OrdinalIgnoreCase);

    private static bool HasInactiveProductOrPrice(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "inactiveProduct")) ||
        IsTrue(Value(fields, "inactivePriceVersion")) ||
        IsFalse(Value(fields, "productEffective")) ||
        IsFalse(Value(fields, "priceVersionEffective"));

    private static bool EnablesPublication(string workItemType, IReadOnlyDictionary<string, string> fields) =>
        workItemType.Equals("Dorm.ChannelPublicationEnable", StringComparison.OrdinalIgnoreCase) ||
        (workItemType.Equals("Dorm.ChannelPublicationRuleConfigure", StringComparison.OrdinalIgnoreCase) &&
         new[] { "enable", "启用", "发布已启用" }.Contains(FirstNonEmpty(Value(fields, "publicationAction"), Value(fields, "publicationStatus")), StringComparer.OrdinalIgnoreCase));

    private static bool HasEffectivePrice(IReadOnlyDictionary<string, string> fields) =>
        !IsTrue(Value(fields, "missingEffectivePrice")) &&
        (IsTrue(Value(fields, "effectivePriceBound")) ||
         IsTrue(Value(fields, "effectivePriceVersionBound")) ||
         IsTrue(Value(fields, "priceVersionEffective")) ||
         !string.IsNullOrWhiteSpace(Value(fields, "priceVersionDisplay")));

    private static bool HasOperationBlock(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "operationBlocked")) ||
        IsTrue(Value(fields, "maintenanceBlocked")) ||
        IsTrue(Value(fields, "outOfService")) ||
        IsTrue(Value(fields, "stopSale")) ||
        new[] { "维修", "停售", "运营阻断", "不可运营", "blocked", "out-of-service" }.Contains(Value(fields, "operationStatus"), StringComparer.OrdinalIgnoreCase);

    private static bool HasValidEligibility(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "eligibilityValid")) ||
        (IsTrue(Value(fields, "agreementEffective")) &&
         IsTrue(Value(fields, "productPriceEligibilityBound")) &&
         IsTrue(Value(fields, "publicationCheckPassed")));

    private static bool HasCommissionSettlementEvidence(IReadOnlyDictionary<string, string> fields, IReadOnlyList<string>? evidenceIds) =>
        IsTrue(Value(fields, "commissionEvidenceBound")) ||
        IsTrue(Value(fields, "settlementEvidenceBound")) ||
        IsTrue(Value(fields, "contractEvidenceBound")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "commissionBasis")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "settlementDescription")) ||
        (evidenceIds?.Count ?? 0) > 0;

    private static bool HasDirectRatePlanTruthAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directRatePlanTruthWrite")) ||
        IsTrue(Value(fields, "ratePlanTruthWriteAttempt")) ||
        IsTrue(Value(fields, "priceTruthWriteAttempt")) ||
        !string.IsNullOrWhiteSpace(Value(fields, "ratePlanAmount"));

    private static bool HasDirectQuoteReservationAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directQuoteWrite")) ||
        IsTrue(Value(fields, "quoteWriteAttempt")) ||
        IsTrue(Value(fields, "directReservationWrite")) ||
        IsTrue(Value(fields, "reservationWriteAttempt")) ||
        IsTrue(Value(fields, "generateQuoteOrReservation"));

    private static bool HasDirectInventoryHoldAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directInventoryHold")) ||
        IsTrue(Value(fields, "inventoryHoldWriteAttempt")) ||
        IsTrue(Value(fields, "lockInventory")) ||
        IsTrue(Value(fields, "channelPublishLocksInventory"));

    private static bool HasDirectFinanceLedgerAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directLedgerWrite")) ||
        IsTrue(Value(fields, "ledgerWriteAttempt")) ||
        IsTrue(Value(fields, "commissionLedgerConfirmed")) ||
        IsTrue(Value(fields, "settlementLedgerConfirmed")) ||
        IsTrue(Value(fields, "paymentFactWriteAttempt")) ||
        IsTrue(Value(fields, "refundFactWriteAttempt"));

    private static bool HasConfirmedAgreementInlineEdit(IReadOnlyDictionary<string, string> fields) =>
        (IsTrue(Value(fields, "agreementEffective")) ||
         IsTrue(Value(fields, "channelEnabled")) ||
         IsTrue(Value(fields, "publicationEnabled")) ||
         new[] { "已启用", "协议已生效", "发布已启用" }.Contains(Value(fields, "factStatus"), StringComparer.OrdinalIgnoreCase)) &&
        (IsTrue(Value(fields, "inlineEditAttempt")) ||
         IsTrue(Value(fields, "editInPlace")) ||
         IsTrue(Value(fields, "overwriteConfirmedFact")));

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static bool IsFalse(string value) =>
        new[] { "false", "0", "no", "否" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class Scenario13ReportingAuditReviewRuntimeAdapter
{
    private const string RuntimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/DormitoryScenario13ReportingAuditReview.generated.json";
    private static readonly Lazy<JsonDocument> RuntimeMirror = new(() => ReadJson(RuntimeMirrorPath));

    private static IReadOnlyList<string> Commands =>
        RuntimeMirror.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Select(item => item.GetProperty("commandId").GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    private static IReadOnlyList<string> ForbiddenUserInputFields =>
        RuntimeMirror.Value.RootElement.GetProperty("fields").GetProperty("forbiddenUserInputFields")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    public static bool AppliesTo(WorkItem workItem) =>
        Commands.Contains(workItem.WorkItemType, StringComparer.OrdinalIgnoreCase);

    public static GeneratedCapabilityRuntimeValidationResult Validate(WorkItem workItem, ConfirmWorkItemRequest request)
    {
        var submitted = request.FieldValues ?? new Dictionary<string, string>();
        var fields = Merge(workItem.Payload, submitted);

        foreach (var key in ForbiddenUserInputFields)
        {
            if (submitted.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return Reject(workItem.WorkItemType, "forged_internal_reference", fields);
            }
        }

        if (HasReadonlyResultWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "readonly_search_write_attempt", fields);
        }

        if (HasDuplicatePublish(fields))
        {
            return Reject(workItem.WorkItemType, "duplicate_report_publish", fields);
        }

        if (HasConcurrentPublishConflict(fields))
        {
            return Reject(workItem.WorkItemType, "concurrent_report_publish_conflict", fields);
        }

        if (HasUnauthorizedAction(fields))
        {
            return Reject(workItem.WorkItemType, "unauthorized_report_action", fields, StatusCodes.Status403Forbidden);
        }

        if (RequiresScope(workItem.WorkItemType) && !HasReportScope(fields))
        {
            return Reject(workItem.WorkItemType, "missing_report_scope", fields);
        }

        if (RequiresPermission(workItem.WorkItemType) && !HasPermissionEnvelope(fields))
        {
            return Reject(workItem.WorkItemType, "missing_permission_envelope", fields);
        }

        if (RequiresLineage(workItem.WorkItemType) && !HasLineageEnvelope(fields))
        {
            return Reject(workItem.WorkItemType, "missing_lineage_envelope", fields);
        }

        if (RequiresFreshness(workItem.WorkItemType) && !HasFreshnessEnvelope(fields))
        {
            return Reject(workItem.WorkItemType, "stale_freshness_envelope", fields);
        }

        if (HasUiStateMetricCalculation(fields))
        {
            return Reject(workItem.WorkItemType, "ui_state_metric_forbidden", fields);
        }

        if (TouchesFinanceReview(workItem.WorkItemType) && HasNonFinanceGateTruth(fields))
        {
            return Reject(workItem.WorkItemType, "non_finance_gate_truth_forbidden", fields);
        }

        if (HasAuditDirectSourceFixAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "audit_direct_source_fix_forbidden", fields);
        }

        if (HasPublishedInlineEditAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "published_report_inline_edit_forbidden", fields);
        }

        if (HasDirectBusinessFactWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "direct_business_fact_write_forbidden", fields);
        }

        if (HasDirectLedgerFactWriteAttempt(fields))
        {
            return Reject(workItem.WorkItemType, "direct_ledger_fact_write_forbidden", fields);
        }

        return GeneratedCapabilityRuntimeValidationResult.Success(fields);
    }

    private static GeneratedCapabilityRuntimeValidationResult Reject(
        string workItemType,
        string code,
        IReadOnlyDictionary<string, string> fields,
        int? statusCode = null) =>
        GeneratedCapabilityRuntimeValidationResult.Reject(
            statusCode ?? DefaultStatus(code),
            code,
            FailureMessage(code),
            $"dormitory.scenario13.{workItemType}.{code}",
            fields);

    private static int DefaultStatus(string code) =>
        code.Equals("duplicate_report_publish", StringComparison.OrdinalIgnoreCase) ||
        code.Equals("concurrent_report_publish_conflict", StringComparison.OrdinalIgnoreCase)
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status422UnprocessableEntity;

    private static string FailureMessage(string code)
    {
        foreach (var item in RuntimeMirror.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if ((item.GetProperty("failureCode").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                return item.GetProperty("messageZh").GetString() ?? "当前经营报表、审计与复盘规则未通过，未写入任何业务结果。";
            }
        }

        return "当前经营报表、审计与复盘规则未通过，未写入任何业务结果。";
    }

    private static bool RequiresScope(string workItemType) =>
        workItemType.Equals("Dorm.ReportScopeSelect", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.BusinessReportSnapshotGenerate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.FinanceReviewSnapshotGenerate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ReportPublish", StringComparison.OrdinalIgnoreCase);

    private static bool RequiresPermission(string workItemType) =>
        !workItemType.Equals("Dorm.ReportScopeSelect", StringComparison.OrdinalIgnoreCase);

    private static bool RequiresLineage(string workItemType) =>
        workItemType.Equals("Dorm.BusinessReportSnapshotGenerate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.FinanceReviewSnapshotGenerate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ReportPublish", StringComparison.OrdinalIgnoreCase);

    private static bool RequiresFreshness(string workItemType) =>
        workItemType.Equals("Dorm.BusinessReportSnapshotGenerate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.FinanceReviewSnapshotGenerate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ReportPublish", StringComparison.OrdinalIgnoreCase);

    private static bool TouchesFinanceReview(string workItemType) =>
        workItemType.Equals("Dorm.FinanceReviewSnapshotGenerate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.BusinessReportSnapshotGenerate", StringComparison.OrdinalIgnoreCase) ||
        workItemType.Equals("Dorm.ReportPublish", StringComparison.OrdinalIgnoreCase);

    private static bool HasReportScope(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "reportScopeReady")) ||
        (!string.IsNullOrWhiteSpace(FirstNonEmpty(Value(fields, "reportName"), Value(fields, "reportScopeName"))) &&
         !string.IsNullOrWhiteSpace(FirstNonEmpty(Value(fields, "periodStart"), Value(fields, "startDate"))) &&
         !string.IsNullOrWhiteSpace(FirstNonEmpty(Value(fields, "periodEnd"), Value(fields, "endDate"))));

    private static bool HasPermissionEnvelope(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "permissionEnvelopeBound")) ||
        IsTrue(Value(fields, "permissionEnvelope"));

    private static bool HasLineageEnvelope(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "lineageEnvelopeBound")) ||
        IsTrue(Value(fields, "lineageEnvelope"));

    private static bool HasFreshnessEnvelope(IReadOnlyDictionary<string, string> fields) =>
        !IsTrue(Value(fields, "staleFreshnessEnvelope")) &&
        !IsTrue(Value(fields, "dataExpired")) &&
        (IsTrue(Value(fields, "freshnessEnvelopeBound")) ||
         IsTrue(Value(fields, "freshnessEnvelope")) ||
         new[] { "fresh", "current", "ok", "新鲜" }.Contains(Value(fields, "freshnessStatus"), StringComparer.OrdinalIgnoreCase));

    private static bool HasReadonlyResultWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "readonlyWriteAttempt")) ||
        IsTrue(Value(fields, "searchWriteAttempt")) ||
        new[] { "search", "dashboard", "report", "board", "export", "readonly-result" }
            .Contains(Value(fields, "surface"), StringComparer.OrdinalIgnoreCase);

    private static bool HasDuplicatePublish(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "duplicatePublish")) ||
        IsTrue(Value(fields, "simulateDuplicatePublish")) ||
        IsTrue(Value(fields, "idempotencyAlreadyProcessed"));

    private static bool HasConcurrentPublishConflict(IReadOnlyDictionary<string, string> fields)
    {
        var expected = FirstNonEmpty(Value(fields, "expectedReportVersion"), Value(fields, "expectedVersion"));
        var current = FirstNonEmpty(Value(fields, "currentReportVersion"), Value(fields, "currentVersion"));
        return !string.IsNullOrWhiteSpace(expected) &&
            !string.IsNullOrWhiteSpace(current) &&
            !expected.Equals(current, StringComparison.Ordinal);
    }

    private static bool HasUnauthorizedAction(IReadOnlyDictionary<string, string> fields)
    {
        if (IsTrue(Value(fields, "unauthorizedAction")) || IsTrue(Value(fields, "rolePermissionDenied")))
        {
            return true;
        }

        var role = FirstNonEmpty(Value(fields, "actorRole"), Value(fields, "role"));
        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        return !new[] { "operator", "manager", "auditor", "finance", "reviewer", "operations-manager", "店长", "主管", "审计", "财务", "运营" }
            .Contains(role, StringComparer.OrdinalIgnoreCase);
    }

    private static bool HasUiStateMetricCalculation(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "uiStateMetricCalculation")) ||
        IsTrue(Value(fields, "metricFromUiState")) ||
        IsTrue(Value(fields, "calculateFromVisiblePage"));

    private static bool HasNonFinanceGateTruth(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "nonFinanceGateTruth")) ||
        IsTrue(Value(fields, "financeTruthFromBusinessRuntime")) ||
        IsTrue(Value(fields, "paymentTruthFromReport")) ||
        IsTrue(Value(fields, "ledgerTruthFromReport")) ||
        new[] { "business-runtime", "ui", "report" }.Contains(Value(fields, "financeTruthSource"), StringComparer.OrdinalIgnoreCase);

    private static bool HasAuditDirectSourceFixAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "auditDirectSourceFix")) ||
        IsTrue(Value(fields, "directRoomFix")) ||
        IsTrue(Value(fields, "directReservationFix")) ||
        IsTrue(Value(fields, "directLedgerFix")) ||
        IsTrue(Value(fields, "fixOriginalFactInReport"));

    private static bool HasPublishedInlineEditAttempt(IReadOnlyDictionary<string, string> fields) =>
        (IsTrue(Value(fields, "reportPublished")) ||
         new[] { "报表已发布", "published" }.Contains(Value(fields, "reportStatus"), StringComparer.OrdinalIgnoreCase)) &&
        (IsTrue(Value(fields, "inlineEditAttempt")) ||
         IsTrue(Value(fields, "editInPlace")) ||
         IsTrue(Value(fields, "overwritePublishedReport")));

    private static bool HasDirectBusinessFactWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directBusinessFactWrite")) ||
        IsTrue(Value(fields, "writeRoomBedOperation")) ||
        IsTrue(Value(fields, "writePriceQuoteReservationStay")) ||
        IsTrue(Value(fields, "writeOriginalBusinessFact")) ||
        IsTrue(Value(fields, "modifySourceScenarioFact"));

    private static bool HasDirectLedgerFactWriteAttempt(IReadOnlyDictionary<string, string> fields) =>
        IsTrue(Value(fields, "directLedgerWrite")) ||
        IsTrue(Value(fields, "ledgerWriteAttempt")) ||
        IsTrue(Value(fields, "paymentDepositRefundWriteAttempt")) ||
        IsTrue(Value(fields, "writeFinanceFact"));

    private static bool IsTrue(string value) =>
        new[] { "true", "1", "yes", "是" }.Contains(value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, string> Merge(params IReadOnlyDictionary<string, string>?[] sources)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in sources)
        {
            if (source is null) continue;
            foreach (var (key, value) in source)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    values[key] = value;
                }
            }
        }

        return values;
    }

    private static string Value(IReadOnlyDictionary<string, string> fields, string key) =>
        fields.TryGetValue(key, out var value) ? value ?? string.Empty : string.Empty;

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}

internal static class GeneratedRuleSourceMapRuntimeAdapter
{
    private const string RuntimeProjectionPath = "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json";
    private const string BusinessInvariantsPath = "docs/contracts/generated/dormitory/business-invariants.generated.json";
    private const string CommandContractsPath = "docs/contracts/generated/dormitory/command-contracts.generated.json";
    private const string FailureSemanticsPath = "docs/contracts/generated/dormitory/failure-semantics.generated.json";
    private const string RuleSourceMapPath = "docs/contracts/generated/dormitory/rule-source-map.generated.json";

    private static readonly Lazy<JsonDocument> RuntimeProjection = new(() => ReadJson(RuntimeProjectionPath));
    private static readonly Lazy<JsonDocument> BusinessInvariants = new(() => ReadJson(BusinessInvariantsPath));
    private static readonly Lazy<JsonDocument> CommandContracts = new(() => ReadJson(CommandContractsPath));
    private static readonly Lazy<JsonDocument> FailureSemantics = new(() => ReadJson(FailureSemanticsPath));
    private static readonly Lazy<JsonDocument> RuleSourceMap = new(() => ReadJson(RuleSourceMapPath));

    public static IReadOnlyList<string> ReadonlyStableRefKeys { get; } = new[] { "roomId", "bedId", "roomStableRef", "bedStableRef", "buildingContextRef" };

    public static IReadOnlyList<string> ConfirmExecutionOrder =>
        RuntimeProjection.Value.RootElement.GetProperty("confirmExecutionOrder")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    public static IReadOnlyList<string> ClosedReadinessStates =>
        BusinessInvariants.Value.RootElement.GetProperty("closedOptionSets").GetProperty("readinessState")
            .EnumerateArray()
            .Select(item => item.GetString() ?? string.Empty)
            .Where(item => item.Length > 0)
            .ToArray();

    public static bool AppliesTo(WorkItem workItem, ConfirmWorkItemRequest request, WorkItemDefinitionResolution definition) =>
        (request.WorkspaceId ?? workItem.WorkspaceId).Equals(AcceptedCapabilityRuntimeProjection.WorkspaceId, StringComparison.OrdinalIgnoreCase) &&
        IsCurrentCommand(definition.Definition?.WorkItemType ?? workItem.WorkItemType);

    public static bool IsCurrentCommand(string workItemType) =>
        CommandContracts.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .Any(item => (item.GetProperty("command").GetString() ?? string.Empty).Equals(workItemType, StringComparison.OrdinalIgnoreCase));

    public static JsonElement CommandContract(string workItemType) =>
        CommandContracts.Value.RootElement.GetProperty("commands")
            .EnumerateArray()
            .FirstOrDefault(item => (item.GetProperty("command").GetString() ?? string.Empty).Equals(workItemType, StringComparison.OrdinalIgnoreCase));

    public static int HttpStatusForFailureCode(string code, string workItemType)
    {
        foreach (var item in FailureSemantics.Value.RootElement.GetProperty("failureSemantics").EnumerateArray())
        {
            if (!(item.GetProperty("code").GetString() ?? string.Empty).Equals(code, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var applies = item.GetProperty("appliesTo").EnumerateArray().Select(value => value.GetString() ?? string.Empty);
            if (applies.Contains(workItemType, StringComparer.OrdinalIgnoreCase))
            {
                return item.GetProperty("httpStatus").GetInt32();
            }
        }

        return StatusCodes.Status422UnprocessableEntity;
    }

    public static string RuleId(string ruleType, string sourceRuleId) =>
        RuleSourceMap.Value.RootElement.GetProperty("sourceMapEntries")
            .EnumerateArray()
            .FirstOrDefault(item =>
                (item.GetProperty("ruleType").GetString() ?? string.Empty).Equals(ruleType, StringComparison.OrdinalIgnoreCase) &&
                (item.GetProperty("sourceRuleId").GetString() ?? string.Empty).Equals(sourceRuleId, StringComparison.OrdinalIgnoreCase))
            .GetProperty("generatedRuleId")
            .GetString() ?? string.Empty;

    private static JsonDocument ReadJson(string file) =>
        JsonDocument.Parse(File.ReadAllText(Locate(file)));

    private static string Locate(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate {relativePath}.");
    }
}
