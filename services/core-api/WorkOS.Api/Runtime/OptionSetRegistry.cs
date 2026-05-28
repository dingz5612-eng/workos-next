namespace WorkOS.Api.Runtime;

internal static class OptionSetRegistry
{
    public static string ForLabel(string label)
    {
        if (label.Contains("房型")) return "roomType";
        if (label.Contains("上/下铺")) return "bunkType";
        if (label.Contains("启用范围")) return "activationScope";
        if (label.Contains("可用状态")) return "availability";
        if (label.Contains("维护状态")) return "maintenance";
        if (label.Contains("到账状态")) return "paymentStatus";
        if (label.Contains("审批意见")) return "approvalDecision";
        if (label.Contains("币种")) return "currency";
        if (label.Contains("付款方式")) return "paymentMethod";
        if (ContractText.ContainsAny(label, "优先级", "紧急程度")) return "priority";
        if (label.Contains("已审批申请")) return "approvedApplicationCandidates";
        if (ContractText.ContainsAny(label, "房间", "床位")) return "roomBedCandidates";
        if (label.Contains("客户")) return "customerCandidates";
        if (label.Contains("车辆")) return "vehicleCandidates";
        if (label.Contains("技师")) return "technicianCandidates";
        if (label.Contains("工位")) return "workbayCandidates";
        if (ContractText.ContainsAny(label, "确认", "关闭", "通过", "退回", "需人工沟通", "是否可派工")) return "genericConfirm";
        return string.Empty;
    }

    public static IReadOnlyList<FieldOption> Options(string optionSet) =>
        Values(optionSet).Select(value => new FieldOption(value, ContractText.Text(value, ContractText.TermRu(value)))).ToArray();

    public static string DefaultValue(string label) => label switch
    {
        "入住人" => "张三",
        "房型" => "四人间",
        "容量" => "4",
        "上/下铺" => "下铺",
        "启用范围" => "当前床位",
        "可分配时间" => "2026-05-29T10:00",
        "启用备注" => "检查通过，可进入分配池",
        "房间床位" => "A301 / A301-02",
        "押金金额" => "3000",
        "币种" => "KGS",
        "付款方式" => "现金",
        "凭证编号" => "DEP-009",
        "技师" => "Алексей Смирнов",
        "工位" => "2 号位",
        "预计开始时间" => "2026-05-29T16:30",
        "到场时间" => "2026-05-29T15:40",
        "车辆状态" => "已到场，待诊断",
        "接车人" => "维修主管",
        _ => string.Empty
    };

    private static IReadOnlyList<string> Values(string optionSet) => optionSet switch
    {
        "roomType" => new[] { "单人间", "双人间", "四人间", "六人间" },
        "bunkType" => new[] { "下铺", "上铺", "整床" },
        "activationScope" => new[] { "当前床位", "当前房间全部床位" },
        "availability" => new[] { "可分配", "暂不开放", "仅内部预留" },
        "maintenance" => new[] { "检查通过", "待保洁", "待维修" },
        "paymentStatus" => new[] { "已到账", "未到账", "金额不一致" },
        "approvalDecision" => new[] { "通过", "退回补充", "需主管复核" },
        "currency" => new[] { "KGS", "RUB", "USD" },
        "paymentMethod" => new[] { "现金", "银行转账", "POS" },
        "priority" => new[] { "高", "中", "低" },
        "approvedApplicationCandidates" => new[] { "APP-2026-009 / 张三", "APP-2026-010 / Fleet Partner 01", "新审批申请" },
        "roomBedCandidates" => new[] { "A301 / A301-02", "A302 / A302-01", "B201 / B201-03" },
        "customerCandidates" => new[] { "张三汽修客户", "Fleet Partner 01", "新客户" },
        "vehicleCandidates" => new[] { "Toyota Camry · 01KG123ABC", "Mercedes Sprinter · 01KG777", "新车辆" },
        "technicianCandidates" => new[] { "Алексей Смирнов", "Иван Орлов", "维修主管分配" },
        "workbayCandidates" => new[] { "2 号位", "1 号位", "等待空位" },
        "genericConfirm" => new[] { "已确认", "待补充", "需要人工确认" },
        _ => Array.Empty<string>()
    };
}
