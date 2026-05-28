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
        if (ContractText.ContainsAny(label, "房型", "上/下铺", "启用范围", "可用状态", "维护状态")) return "select";
        if (ContractText.ContainsAny(label, "房间", "床位", "客户", "车辆", "技师", "工位")) return "searchSelect";
        if (ContractText.ContainsAny(label, "预计", "周期", "时间")) return "dateTime";
        if (ContractText.ContainsAny(label, "金额", "费用", "押金", "应退", "应补")) return "money";
        if (ContractText.ContainsAny(label, "照片", "凭证", "材料", "签字")) return "evidenceUpload";
        if (ContractText.ContainsAny(label, "确认", "关闭", "通过", "退回")) return "confirmation";
        return "text";
    }

    private static string Source(string label, string layer)
    {
        if (layer == "system") return "system";
        if (layer == "analytics") return "projection";
        if (ContractText.ContainsAny(label, "房间床位", "已审批申请", "客户", "车辆", "技师", "工位")) return "searchableProjection";
        if (ContractText.ContainsAny(label, "币种", "付款方式", "优先级", "紧急程度", "房型", "上/下铺", "可用状态", "维护状态", "启用范围")) return "optionSet";
        return "userInput";
    }
}
