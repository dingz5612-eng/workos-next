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
        if (IsNumber(label)) return "number";
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
        if (IsSelect(label)) return "optionSet";
        if (IsSearchSelect(label)) return "searchableProjection";
        return "userInput";
    }

    private static bool IsReadonly(string label) =>
        ContractText.ContainsAny(label, "容量", "财务确认人", "确认时间", "应收金额", "应退金额", "差异金额", "未结欠款", "周期名称", "指标已复核", "财务已复核", "运营已诊断");

    private static bool IsSearchSelect(string label) =>
        label is "所属房间" or "启用对象" or "已审批申请" or "房间床位" or "预留房间/床位" or "入住人" or "住客" or "线索" or "预订单" or "入住单" or "押金单" or "押金收款记录" or "收款记录" or "支付记录" or "覆盖应收项" or "任务" or "支出记录" or "经营周期" or "客户" or "车辆" or "技师" or "工位" or "关联房间" or "关联床位" or "关联任务" ||
        label is "房间" or "床位";

    private static bool IsSelect(string label) =>
        ContractText.ContainsAny(label,
            "房型",
            "性别策略",
            "家具状态",
            "技术状态",
            "上/下铺",
            "床位类型",
            "初始床位状态",
            "价格规则",
            "维护状态",
            "可售状态",
            "阻断范围",
            "释放范围",
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
            "紧急程度",
            "通讯方式",
            "来源渠道",
            "证件类型",
            "性别",
            "押金类型",
            "支付方式",
            "确认结果",
            "退款方式",
            "分配方式",
            "结算结果",
            "关闭结果",
            "房间状态",
            "床位状态",
            "是否",
            "退住原因",
            "任务类型",
            "完成结果",
            "验收结果",
            "支出类别",
            "审批结果",
            "财务复核结果",
            "主要问题分类",
            "诊断置信度",
            "行动类型",
            "目标指标",
            "行动状态");

    private static bool IsDateTime(string label) =>
        ContractText.ContainsAny(label, "日期", "时间", "入住周期", "周期开始", "周期结束", "覆盖周期开始", "覆盖周期结束", "截止");

    private static bool IsMoney(string label) =>
        ContractText.ContainsAny(label, "金额", "费用", "押金", "应退", "应补", "单价", "日价", "周价", "月价", "成本", "余额", "收入", "支出", "现金流", "欠款") &&
        !ContractText.ContainsAny(label, "押金规则", "押金币种", "押金截止", "押金单", "押金类型", "押金凭证", "押金收款记录");

    private static bool IsNumber(string label) =>
        ContractText.ContainsAny(label, "数量", "床位数", "人数", "次数", "天数", "周数", "月数", "年份", "周期编号", "入住率", "转化率", "置信度", "目标值");
}
