namespace WorkOS.Api.Runtime;

internal static class OptionSetRegistry
{
    public static string ForLabel(string label)
    {
        if (label.Contains("房型")) return "roomType";
        if (label.Contains("上/下铺")) return "bunkType";
        if (label.Contains("价格规则")) return "bedPriceRule";
        if (label.Contains("启用范围")) return "activationScope";
        if (ContractText.ContainsAny(label, "可用状态", "初始可用状态")) return "availability";
        if (label.Contains("维护状态")) return "maintenance";
        if (label.Contains("线索来源")) return "leadSource";
        if (label.Contains("线索状态")) return "leadStatus";
        if (label.Contains("住客状态")) return "residentStatus";
        if (label.Contains("入住原因")) return "stayReason";
        if (label.Contains("计费方式")) return "tariffType";
        if (label.Contains("到账状态")) return "paymentStatus";
        if (label.Contains("审批意见")) return "approvalDecision";
        if (ContractText.ContainsAny(label, "押金/费用规则", "押金规则")) return "depositFeeRule";
        if (ContractText.ContainsAny(label, "币种", "押金币种")) return "currency";
        if (label.Contains("付款方式")) return "paymentMethod";
        if (label.Contains("收款用途")) return "paymentPurpose";
        if (label.Contains("银行/钱包渠道")) return "paymentChannel";
        if (label.Contains("匹配结果")) return "matchResult";
        if (label.Contains("处理状态")) return "taskStatus";
        if (label.Contains("是否允许免押")) return "yesNo";
        if (label.Contains("钥匙/物品交接")) return "handoverStatus";
        if (ContractText.ContainsAny(label, "优先级", "紧急程度")) return "priority";
        if (label.Contains("已审批申请")) return "approvedApplicationCandidates";
        if (label.Contains("所属房间")) return "roomCandidates";
        if (ContractText.ContainsAny(label, "房间床位", "预留房间/床位", "启用对象")) return "roomBedCandidates";
        if (label.Contains("入住人")) return "residentCandidates";
        if (label.Contains("支付记录")) return "paymentCandidates";
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
        "联系日期" => "2026-05-29T09:00",
        "姓名" => "张三",
        "电话" => "+996 555 010101",
        "需要床位" => "1",
        "住宿时长" => "1个月",
        "线索来源" => "WhatsApp",
        "线索状态" => "已预订",
        "入住日期" => "2026-05-29T12:00",
        "计划退住日期" => "2026-08-29T12:00",
        "预订人数" => "1",
        "预留房间/床位" => "A301 / A301-02",
        "住客状态" => "在住",
        "房型" => "四人间",
        "容量" => "4",
        "所属房间" => "A301",
        "上/下铺" => "下铺",
        "价格规则" => "月租标准",
        "维护状态" => "检查通过",
        "启用对象" => "A301 / A301-02",
        "启用范围" => "当前床位",
        "初始可用状态" => "可分配",
        "可分配时间" => "2026-05-29T10:00",
        "启用备注" => "检查通过，可进入分配池",
        "入住原因" => "新员工住宿",
        "预计入住/退房" => "2026-05-29T12:00 至 2026-08-29T12:00",
        "入住周期" => "2026-05-29T12:00 至 2026-08-29T12:00",
        "床位锁定备注" => "已为预订住客锁定",
        "计费方式" => "按月",
        "单价" => "9300",
        "天数/周数/月数" => "1",
        "应收金额" => "9300",
        "押金/费用规则" => "标准押金 + 月租",
        "押金规则" => "标准押金",
        "应收押金" => "3000",
        "押金币种" => "KGS",
        "押金截止时间" => "2026-05-29T18:00",
        "是否允许免押" => "否",
        "免押原因" => "",
        "房间床位" => "A301 / A301-02",
        "押金金额" => "3000",
        "币种" => "KGS",
        "付款方式" => "现金",
        "付款金额" => "3000",
        "收款用途" => "押金",
        "付款人" => "张三",
        "付款时间" => "2026-05-29T12:20",
        "凭证编号" => "DEP-009",
        "支付记录" => "PAY-2026-009 / 3000 KGS",
        "银行/钱包渠道" => "现金",
        "到账金额" => "3000",
        "到账时间" => "2026-05-29T12:30",
        "匹配结果" => "匹配",
        "差异原因" => "",
        "处理意见" => "确认到账",
        "确认金额" => "3000",
        "财务确认人" => "当前财务账号",
        "确认时间" => "提交时系统生成",
        "实际入住时间" => "2026-05-29T14:00",
        "钥匙/物品交接" => "钥匙已交接",
        "人工确认摘要" => "本人已核对床位、押金和入住信息",
        "复盘结论" => "链路已完成，押金责任与入住率已更新",
        "后续行动" => "继续跟进未确认付款和空床转化",
        "负责人" => "运营经办人",
        "处理状态" => "已完成",
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
        "bedPriceRule" => new[] { "月租标准", "短住日租", "内部免费", "合同价" },
        "activationScope" => new[] { "当前床位", "当前房间全部床位" },
        "availability" => new[] { "可分配", "暂不开放", "仅内部预留" },
        "maintenance" => new[] { "检查通过", "待保洁", "待维修" },
        "leadSource" => new[] { "WhatsApp", "电话", "Instagram", "广告", "熟人推荐", "雇主", "其他" },
        "leadStatus" => new[] { "新线索", "回访", "洽谈中", "已预订", "已入住", "拒绝" },
        "residentStatus" => new[] { "在住", "已退住", "预订" },
        "stayReason" => new[] { "新员工住宿", "客户临住", "换房调整", "项目驻场" },
        "tariffType" => new[] { "按天", "按周", "按月" },
        "paymentStatus" => new[] { "已到账", "未到账", "金额不一致" },
        "approvalDecision" => new[] { "通过", "退回补充", "需主管复核" },
        "depositFeeRule" => new[] { "标准押金", "标准押金 + 月租", "免押金", "合同押金", "主管指定" },
        "currency" => new[] { "KGS", "RUB", "USD" },
        "paymentMethod" => new[] { "现金", "银行转账", "POS" },
        "paymentPurpose" => new[] { "押金", "房费", "押金 + 房费", "其它" },
        "paymentChannel" => new[] { "现金", "MBank", "ЭЛСОМ", "银行转账", "POS", "其他" },
        "matchResult" => new[] { "匹配", "金额不一致", "渠道不一致", "凭证不清晰" },
        "taskStatus" => new[] { "待处理", "处理中", "已完成" },
        "yesNo" => new[] { "否", "是" },
        "handoverStatus" => new[] { "钥匙已交接", "钥匙待领取", "物品缺失需备注" },
        "priority" => new[] { "高", "中", "低" },
        "approvedApplicationCandidates" => new[] { "APP-2026-009 / 张三", "APP-2026-010 / Fleet Partner 01", "新审批申请" },
        "roomCandidates" => new[] { "A301", "A302", "B201" },
        "roomBedCandidates" => new[] { "A301 / A301-02", "A302 / A302-01", "B201 / B201-03" },
        "residentCandidates" => new[] { "张三 / EMP-009", "李四 / EMP-010", "新入住人" },
        "paymentCandidates" => new[] { "PAY-2026-009 / 3000 KGS", "PAY-2026-010 / 9300 KGS", "待匹配支付" },
        "customerCandidates" => new[] { "张三汽修客户", "Fleet Partner 01", "新客户" },
        "vehicleCandidates" => new[] { "Toyota Camry · 01KG123ABC", "Mercedes Sprinter · 01KG777", "新车辆" },
        "technicianCandidates" => new[] { "Алексей Смирнов", "Иван Орлов", "维修主管分配" },
        "workbayCandidates" => new[] { "2 号位", "1 号位", "等待空位" },
        "genericConfirm" => new[] { "已确认", "待补充", "需要人工确认" },
        _ => Array.Empty<string>()
    };
}
