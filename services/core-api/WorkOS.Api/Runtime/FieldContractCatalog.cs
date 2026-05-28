namespace WorkOS.Api.Runtime;

internal static class FieldContractCatalog
{
    public static FieldProjection Field(string label, string layer)
    {
        var type = Type(label, layer);
        var source = Source(label, layer);
        return new FieldProjection(
            ContractText.FieldId(label),
            ContractText.Text(label, ContractText.TermRu(label)),
            layer,
            type,
            layer != "analytics",
            source,
            layer == "business",
            layer == "analytics" ? label : string.Empty,
            FieldUiContractCatalog.ForField(label, type, source),
            FieldUiContractCatalog.Help(label, type, source));
    }

    private static string Type(string label, string layer)
    {
        if (layer is "system" or "analytics") return "readonly";
        if (IsReadonly(label)) return "readonly";
        if (IsSelect(label)) return "select";
        if (IsSearchSelect(label)) return "searchSelect";
        if (IsDateTime(label)) return "dateTime";
        if (IsMoney(label)) return "money";
        if (ContractText.ContainsAny(label, "照片", "凭证", "材料", "签字")) return "evidenceUpload";
        if (ContractText.ContainsAny(label, "退回原因", "人工确认摘要")) return "text";
        if (ContractText.ContainsAny(label, "确认", "关闭", "通过", "退回")) return "confirmation";
        return "text";
    }

    private static string Source(string label, string layer)
    {
        if (layer == "system") return "system";
        if (layer == "analytics") return "projection";
        if (IsReadonly(label)) return "system";
        if (IsSearchSelect(label)) return "searchableProjection";
        if (IsSelect(label)) return "optionSet";
        return "userInput";
    }

    private static bool IsReadonly(string label) =>
        ContractText.ContainsAny(label, "容量", "财务确认人", "确认时间", "应收金额");

    private static bool IsSearchSelect(string label) =>
        ContractText.ContainsAny(label, "所属房间", "启用对象", "已审批申请", "房间床位", "预留房间/床位", "入住人", "支付记录", "客户", "车辆", "技师", "工位");

    private static bool IsSelect(string label) =>
        ContractText.ContainsAny(label,
            "房型",
            "上/下铺",
            "价格规则",
            "维护状态",
            "启用范围",
            "初始可用状态",
            "线索来源",
            "线索状态",
            "住客状态",
            "入住原因",
            "审批意见",
            "计费方式",
            "押金/费用规则",
            "押金规则",
            "是否允许免押",
            "币种",
            "押金币种",
            "付款方式",
            "收款用途",
            "到账状态",
            "银行/钱包渠道",
            "匹配结果",
            "处理状态",
            "钥匙/物品交接",
            "优先级",
            "紧急程度");

    private static bool IsDateTime(string label) =>
        ContractText.ContainsAny(label, "联系日期", "入住日期", "计划退住日期", "预计入住/退房", "入住周期", "可分配时间", "押金截止时间", "付款时间", "到账时间", "实际入住时间", "预计开始时间", "到场时间", "预计退房时间");

    private static bool IsMoney(string label) =>
        ContractText.ContainsAny(label, "金额", "费用", "应收押金", "付款金额", "到账金额", "押金", "应退", "应补", "单价") &&
        !ContractText.ContainsAny(label, "押金规则", "押金币种", "押金截止时间");
}
