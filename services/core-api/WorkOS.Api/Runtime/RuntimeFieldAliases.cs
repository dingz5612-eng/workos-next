using System.Globalization;

namespace WorkOS.Api.Runtime;

internal static class RuntimeFieldAliases
{
    private static readonly IReadOnlyDictionary<string, string> FieldAliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["房间号"] = "roomNo",
        ["楼栋"] = "buildingName",
        ["楼栋/地点"] = "buildingName",
        ["楼层"] = "floor",
        ["房型"] = "roomType",
        ["房间类型"] = "roomType",
        ["容量"] = "capacity",
        ["床位数"] = "bedCount",
        ["性别策略"] = "genderPolicy",
        ["家具状态"] = "furnitureStatus",
        ["技术状态"] = "technicalState",
        ["房间备注"] = "roomNote",
        ["所属房间"] = "roomId",
        ["房间"] = "roomId",
        ["关联房间"] = "roomId",
        ["床位"] = "bedId",
        ["关联床位"] = "bedId",
        ["床位号"] = "bedNo",
        ["床位标签"] = "bedLabel",
        ["上/下铺"] = "bedType",
        ["床位类型"] = "bedType",
        ["初始床位状态"] = "bedStatus",
        ["床位状态"] = "bedStatus",
        ["维护状态"] = "maintenanceStatus",
        ["阻断原因"] = "blockedReason",
        ["价格规则"] = "ratePlanId",
        ["每床日价"] = "dailyRatePerBed",
        ["每床周价"] = "weeklyRatePerBed",
        ["每床月价"] = "monthlyRatePerBed",
        ["生效日期"] = "effectiveFrom",
        ["价格备注"] = "rateNote",
        ["可售状态"] = "availabilityStatus",
        ["阻断范围"] = "resourceScope",
        ["释放范围"] = "resourceScope",
        ["阻断开始时间"] = "blockStartAt",
        ["预计恢复时间"] = "expectedReleaseAt",
        ["恢复可售时间"] = "releaseAvailableAt",
        ["联系日期"] = "contactDate",
        ["姓名"] = "guestName",
        ["线索姓名"] = "leadName",
        ["电话"] = "phone",
        ["需要床位"] = "requestedBedCount",
        ["需要床位数"] = "requestedBedCount",
        ["住宿时长"] = "stayDurationText",
        ["线索来源"] = "leadSource",
        ["来源渠道"] = "leadSource",
        ["线索状态"] = "leadStatus",
        ["线索"] = "leadId",
        ["预订单"] = "reservationId",
        ["预订人数"] = "reservedBedCount",
        ["预订床位数"] = "reservedBedCount",
        ["预留房间"] = "reservedRoomId",
        ["预留床位"] = "reservedBedIds",
        ["预留房间/床位"] = "reservedBedIds",
        ["入住日期"] = "checkInDate",
        ["计划入住日期"] = "plannedCheckInDate",
        ["计划退住日期"] = "plannedCheckOutDate",
        ["新的计划退住日期"] = "plannedCheckOutDate",
        ["保留截止时间"] = "reservationHoldUntil",
        ["住客"] = "residentId",
        ["入住人"] = "residentId",
        ["住客姓名"] = "residentName",
        ["证件类型"] = "identityType",
        ["证件号码"] = "identityNo",
        ["性别"] = "gender",
        ["国籍"] = "nationality",
        ["入住单"] = "stayId",
        ["房间床位"] = "roomBed",
        ["计费方式"] = "tariffType",
        ["单价"] = "unitRate",
        ["计费数量"] = "tariffQuantity",
        ["天数/周数/月数"] = "tariffQuantity",
        ["优惠金额"] = "discountAmount",
        ["应收金额"] = "amount",
        ["总应收"] = "totalCharges",
        ["应收类型"] = "chargeType",
        ["计费开始日期"] = "periodStart",
        ["计费结束日期"] = "periodEnd",
        ["应收原因"] = "chargeReason",
        ["应收记录"] = "chargeId",
        ["押金单"] = "depositId",
        ["押金类型"] = "depositType",
        ["应收押金"] = "requiredDepositAmount",
        ["应收押金金额"] = "requiredDepositAmount",
        ["押金金额"] = "depositAmount",
        ["当前持有押金"] = "heldAmount",
        ["持有押金"] = "heldAmount",
        ["实收押金金额"] = "receivedAmount",
        ["收取日期"] = "receivedDate",
        ["押金凭证"] = "depositEvidenceId",
        ["押金收款记录"] = "depositReceiptId",
        ["押金规则"] = "depositPolicyName",
        ["押金规则说明"] = "depositPolicyNote",
        ["扣除金额"] = "deductionAmount",
        ["扣除原因"] = "deductionReason",
        ["抵扣欠款金额"] = "applyToBalanceAmount",
        ["押金抵欠金额"] = "applyToBalanceAmount",
        ["应退金额"] = "refundAmount",
        ["退款金额"] = "refundAmount",
        ["退款方式"] = "refundMethod",
        ["退款接收人"] = "refundReceiver",
        ["退款凭证"] = "refundEvidenceId",
        ["付款人"] = "payerName",
        ["收款人"] = "receivedBy",
        ["付款时间"] = "paymentTime",
        ["付款金额"] = "paymentAmount",
        ["收款日期"] = "receivedDate",
        ["收款金额"] = "paymentAmount",
        ["收款记录"] = "paymentId",
        ["支付记录"] = "paymentId",
        ["付款方式"] = "paymentMethod",
        ["支付方式"] = "paymentMethod",
        ["收款用途"] = "paymentPurpose",
        ["收款凭证"] = "paymentEvidenceId",
        ["凭证编号"] = "evidenceNo",
        ["币种"] = "currency",
        ["押金币种"] = "currency",
        ["银行/钱包渠道"] = "paymentChannel",
        ["确认金额"] = "confirmedAmount",
        ["到账金额"] = "confirmedAmount",
        ["确认结果"] = "confirmationResult",
        ["匹配结果"] = "matchResult",
        ["差异金额"] = "differenceAmount",
        ["差异原因"] = "differenceReason",
        ["分配金额"] = "allocatedAmount",
        ["分配方式"] = "allocationMode",
        ["当前余额"] = "currentBalance",
        ["未结欠款"] = "endingDebtAmount",
        ["押金结算已请求"] = "depositSettlementRequested",
        ["退住已开始"] = "checkoutStarted",
        ["结算结果"] = "settlementResult",
        ["关闭结果"] = "closeResult",
        ["房间状态"] = "roomCondition",
        ["是否需要清洁"] = "cleaningRequired",
        ["损坏扣款金额"] = "damageChargeAmount",
        ["任务"] = "taskId",
        ["关联任务"] = "taskId",
        ["任务类型"] = "taskType",
        ["紧急程度"] = "urgency",
        ["是否阻断可售"] = "blocksAvailability",
        ["服务任务已验收"] = "serviceTaskVerified",
        ["实际成本"] = "actualCostAmount",
        ["支出记录"] = "expenseId",
        ["支出类别"] = "expenseCategory",
        ["支出金额"] = "expenseAmount",
        ["年份"] = "periodYear",
        ["周期编号"] = "periodNo",
        ["周期开始时间"] = "periodStartAt",
        ["周期结束时间"] = "periodEndAt",
        ["经营周期"] = "periodId",
        ["指标已复核"] = "metricsReviewed",
        ["财务已复核"] = "financeReviewed",
        ["运营已诊断"] = "operationsDiagnosed",
        ["阻断问题数量"] = "blockingIssueCount",
        ["行动计划数量"] = "actionPlanCount"
    };

    private static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> OptionAliases =
        new Dictionary<string, IReadOnlyDictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["roomType"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["单人间"] = "single", ["双人间"] = "double", ["四人间"] = "four_bed", ["六人间"] = "six_bed" },
            ["genderPolicy"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["男生房"] = "male", ["女生房"] = "female", ["混住"] = "mixed", ["未限制"] = "unrestricted" },
            ["furnitureStatus"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["家具齐全"] = "complete", ["部分缺失"] = "partial", ["缺失"] = "missing", ["待配置"] = "pending" },
            ["technicalState"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["可入住"] = "ready", ["未准备"] = "not_ready", ["需维修"] = "repair" },
            ["bedType"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["下铺"] = "lower", ["上铺"] = "upper", ["整床"] = "whole" },
            ["bedStatus"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["可分配"] = "available", ["已预留"] = "reserved", ["已入住"] = "occupied", ["待清洁"] = "cleaning_required", ["维修阻断"] = "maintenance_blocked", ["未启用"] = "inactive" },
            ["availabilityStatus"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["可分配"] = "available", ["暂不开放"] = "inactive", ["仅内部预留"] = "internal_reserve" },
            ["resourceScope"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["房间"] = "room", ["床位"] = "bed", ["房间全部床位"] = "room_beds" },
            ["paymentMethod"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["现金"] = "cash", ["银行转账"] = "bank_transfer", ["POS"] = "pos" },
            ["currency"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["KGS"] = "KGS", ["RUB"] = "RUB", ["USD"] = "USD" },
            ["confirmationResult"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["确认"] = "confirmed", ["拒绝"] = "rejected", ["需要复核"] = "needs_review", ["金额不一致"] = "amount_mismatch", ["渠道不一致"] = "channel_mismatch", ["凭证不清晰"] = "evidence_unclear" },
            ["yesNo"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["是"] = "true", ["否"] = "false" },
            ["checkoutStarted"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["是"] = "true", ["否"] = "false" },
            ["depositSettlementRequested"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["是"] = "true", ["否"] = "false" },
            ["serviceTaskVerified"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["是"] = "true", ["否"] = "false" }
        };

    public static string CanonicalKey(string key) =>
        FieldAliases.TryGetValue(key, out var canonical) ? canonical : key;

    public static string NormalizeValue(string canonicalKey, string value)
    {
        var optionKey = OptionKeyForField(canonicalKey);
        return optionKey is not null && OptionAliases.TryGetValue(optionKey, out var aliases) && aliases.TryGetValue(value, out var normalized)
            ? normalized
            : value;
    }

    public static string? OptionKeyForField(string canonicalKey) => canonicalKey switch
    {
        "roomType" => "roomType",
        "genderPolicy" => "genderPolicy",
        "furnitureStatus" => "furnitureStatus",
        "technicalState" => "technicalState",
        "bedType" => "bedType",
        "bedStatus" => "bedStatus",
        "availabilityStatus" => "availabilityStatus",
        "resourceScope" => "resourceScope",
        "paymentMethod" or "refundMethod" => "paymentMethod",
        "currency" => "currency",
        "confirmationResult" or "matchResult" => "confirmationResult",
        "cleaningRequired" or "blocksAvailability" => "yesNo",
        "checkoutStarted" => "checkoutStarted",
        "depositSettlementRequested" => "depositSettlementRequested",
        "serviceTaskVerified" => "serviceTaskVerified",
        _ => null
    };

    public static string Value(IReadOnlyDictionary<string, string> values, string canonicalKey, string defaultValue)
    {
        if (values.TryGetValue(canonicalKey, out var value) && !string.IsNullOrWhiteSpace(value))
        {
            return NormalizeValue(canonicalKey, value);
        }

        return defaultValue;
    }

    public static decimal DecimalValue(IReadOnlyDictionary<string, string> values, string canonicalKey, decimal defaultValue) =>
        decimal.TryParse(Value(values, canonicalKey, string.Empty), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : defaultValue;

    public static int IntValue(IReadOnlyDictionary<string, string> values, string canonicalKey, int defaultValue) =>
        int.TryParse(Value(values, canonicalKey, string.Empty), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : defaultValue;

    public static bool BoolValue(IReadOnlyDictionary<string, string> values, string canonicalKey, bool defaultValue)
    {
        var value = Value(values, canonicalKey, string.Empty);
        if (string.IsNullOrWhiteSpace(value)) return defaultValue;
        return value.Equals("true", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("1", StringComparison.OrdinalIgnoreCase);
    }
}
