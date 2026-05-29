namespace WorkOS.Api.Runtime;

internal static class OptionSetRegistry
{
    public static string ForLabel(string label)
    {
        if (label.Contains("房型")) return "roomType";
        if (label.Contains("性别策略")) return "genderPolicy";
        if (label.Contains("家具状态")) return "furnitureStatus";
        if (label.Contains("技术状态")) return "technicalState";
        if (label.Contains("上/下铺")) return "bunkType";
        if (label.Contains("床位类型")) return "bunkType";
        if (ContractText.ContainsAny(label, "床位状态", "初始床位状态")) return "bedStatus";
        if (label.Contains("价格规则")) return "bedPriceRule";
        if (label.Contains("启用范围")) return "activationScope";
        if (ContractText.ContainsAny(label, "可用状态", "初始可用状态")) return "availability";
        if (label.Contains("维护状态")) return "maintenance";
        if (label.Contains("通讯方式")) return "messenger";
        if (label.Contains("线索来源")) return "leadSource";
        if (label.Contains("来源渠道")) return "leadSource";
        if (label.Contains("线索状态")) return "leadStatus";
        if (label.Contains("跟进结果")) return "leadStatus";
        if (label.Contains("住客状态")) return "residentStatus";
        if (label.Contains("证件类型")) return "identityType";
        if (label == "性别") return "gender";
        if (label.Contains("入住原因")) return "stayReason";
        if (label.Contains("应收类型")) return "chargeType";
        if (label.Contains("计费方式")) return "tariffType";
        if (label.Contains("到账状态")) return "paymentStatus";
        if (label.Contains("审批意见")) return "approvalDecision";
        if (ContractText.ContainsAny(label, "押金/费用规则", "押金规则")) return "depositFeeRule";
        if (label.Contains("押金类型")) return "depositType";
        if (ContractText.ContainsAny(label, "币种", "押金币种")) return "currency";
        if (ContractText.ContainsAny(label, "付款方式", "支付方式", "退款方式")) return "paymentMethod";
        if (label.Contains("收款用途")) return "paymentPurpose";
        if (label.Contains("银行/钱包渠道")) return "paymentChannel";
        if (ContractText.ContainsAny(label, "匹配结果", "确认结果")) return "confirmationResult";
        if (ContractText.ContainsAny(label, "处理状态", "行动状态")) return "taskStatus";
        if (label.Contains("审批结果")) return "approvalResult";
        if (ContractText.ContainsAny(label, "是否允许免押", "是否需要预订押金", "释放床位", "是否发现损坏", "是否需要清洁", "是否阻断可售", "完成后释放房间")) return "yesNo";
        if (label.Contains("钥匙/物品交接")) return "handoverStatus";
        if (ContractText.ContainsAny(label, "优先级", "紧急程度")) return "priority";
        if (label.Contains("分配方式")) return "allocationMode";
        if (ContractText.ContainsAny(label, "结算结果", "关闭结果")) return "checkoutResult";
        if (label.Contains("房间状态")) return "roomCondition";
        if (label.Contains("退住原因")) return "checkoutReason";
        if (label.Contains("任务类型")) return "taskType";
        if (label.Contains("完成结果")) return "completionResult";
        if (label.Contains("验收结果")) return "approvalResult";
        if (label.Contains("支出类别")) return "expenseCategory";
        if (label.Contains("财务复核结果")) return "financeReviewResult";
        if (label.Contains("主要问题分类")) return "problemCategory";
        if (label.Contains("诊断置信度")) return "confidence";
        if (label.Contains("行动类型")) return "periodActionType";
        if (label.Contains("目标指标")) return "targetMetric";
        if (label.Contains("已审批申请")) return "approvedApplicationCandidates";
        if (label == "线索") return "leadCandidates";
        if (label == "预订单") return "reservationCandidates";
        if (label == "入住单") return "stayCandidates";
        if (label == "押金单") return "depositCandidates";
        if (label == "押金收款记录") return "depositReceiptCandidates";
        if (label == "收款记录") return "paymentCandidates";
        if (label.Contains("应收项")) return "chargeCandidates";
        if (label == "任务" || label == "关联任务") return "serviceTaskCandidates";
        if (label == "支出记录") return "expenseCandidates";
        if (label == "经营周期") return "periodCandidates";
        if (label.Contains("所属房间")) return "roomCandidates";
        if (ContractText.ContainsAny(label, "关联房间", "房间")) return "roomCandidates";
        if (ContractText.ContainsAny(label, "关联床位", "床位")) return "bedCandidates";
        if (ContractText.ContainsAny(label, "房间床位", "预留房间/床位", "启用对象")) return "roomBedCandidates";
        if (label.Contains("入住人")) return "residentCandidates";
        if (label == "住客") return "residentCandidates";
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
        "genderPolicy" => new[] { "男生房", "女生房", "混住", "未限制" },
        "furnitureStatus" => new[] { "家具齐全", "部分缺失", "缺失", "待配置" },
        "technicalState" => new[] { "可入住", "未准备", "需维修" },
        "bunkType" => new[] { "下铺", "上铺", "整床" },
        "bedStatus" => new[] { "可分配", "已预留", "已入住", "待清洁", "维修阻断", "未启用" },
        "bedPriceRule" => new[] { "月租标准", "短住日租", "内部免费", "合同价" },
        "activationScope" => new[] { "当前床位", "当前房间全部床位" },
        "availability" => new[] { "可分配", "暂不开放", "仅内部预留" },
        "maintenance" => new[] { "检查通过", "待保洁", "待维修" },
        "messenger" => new[] { "WhatsApp", "电话", "Instagram", "Facebook", "其他" },
        "leadSource" => new[] { "WhatsApp", "电话", "Instagram", "广告", "熟人推荐", "雇主", "其他" },
        "leadStatus" => new[] { "新线索", "回访", "洽谈中", "已预订", "已入住", "拒绝" },
        "residentStatus" => new[] { "在住", "已退住", "预订" },
        "identityType" => new[] { "护照", "身份证", "其他证件" },
        "gender" => new[] { "男", "女", "未说明" },
        "stayReason" => new[] { "新员工住宿", "客户临住", "换房调整", "项目驻场" },
        "chargeType" => new[] { "房租", "水电", "赔偿", "滞纳金", "其他" },
        "tariffType" => new[] { "按天", "按周", "按月" },
        "paymentStatus" => new[] { "已到账", "未到账", "金额不一致" },
        "approvalDecision" => new[] { "通过", "退回补充", "需主管复核" },
        "depositFeeRule" => new[] { "标准押金", "标准押金 + 月租", "免押金", "合同押金", "主管指定" },
        "depositType" => new[] { "安全押金", "钥匙押金", "损坏押金", "预订押金" },
        "currency" => new[] { "KGS", "RUB", "USD" },
        "paymentMethod" => new[] { "现金", "银行转账", "POS" },
        "paymentPurpose" => new[] { "押金", "房费", "押金 + 房费", "其它" },
        "paymentChannel" => new[] { "现金", "MBank", "ЭЛСОМ", "银行转账", "POS", "其他" },
        "confirmationResult" => new[] { "确认", "拒绝", "需要复核", "金额不一致", "渠道不一致", "凭证不清晰" },
        "taskStatus" => new[] { "待处理", "处理中", "已完成", "已验收", "已取消" },
        "approvalResult" => new[] { "通过", "拒绝", "需要复核" },
        "yesNo" => new[] { "否", "是" },
        "handoverStatus" => new[] { "钥匙已交接", "钥匙待领取", "物品缺失需备注" },
        "priority" => new[] { "高", "中", "低" },
        "allocationMode" => new[] { "自动抵最早欠款", "手动选择应收", "按周期分配" },
        "checkoutResult" => new[] { "已关闭", "待退款", "待补款", "有风险关闭", "阻断" },
        "roomCondition" => new[] { "正常", "需清洁", "损坏", "需维修" },
        "checkoutReason" => new[] { "正常退住", "提前退住", "欠费退住", "换房退住", "其他" },
        "taskType" => new[] { "清洁", "维修", "家具配置", "床品补充", "检查", "其他" },
        "completionResult" => new[] { "已完成", "部分完成", "失败" },
        "expenseCategory" => new[] { "家具", "床品", "清洁", "日用品", "维修", "水电", "广告", "其他" },
        "financeReviewResult" => new[] { "通过", "需要修正", "阻断" },
        "problemCategory" => new[] { "入住率", "欠款", "清洁", "维修", "线索", "成本", "其他" },
        "confidence" => new[] { "高", "中", "低" },
        "periodActionType" => new[] { "提升入住率", "增加收入", "催收欠款", "改善清洁", "改善维修", "降低成本", "营销" },
        "targetMetric" => new[] { "入住率", "欠款余额", "任务完成率", "收入", "成本" },
        "approvedApplicationCandidates" => new[] { "APP-2026-009 / 张三", "APP-2026-010 / Fleet Partner 01", "新审批申请" },
        "leadCandidates" => new[] { "LEAD-2026-009 / 张三", "LEAD-2026-010 / Ivan", "新线索" },
        "reservationCandidates" => new[] { "RES-2026-009 / 张三", "RES-2026-010 / Ivan", "待转换预订" },
        "stayCandidates" => new[] { "STAY-2026-009 / 张三", "STAY-2026-010 / Ivan", "当前在住" },
        "depositCandidates" => new[] { "DEP-2026-009 / 3000 KGS", "DEP-2026-010 / 5000 KGS", "待处理押金" },
        "depositReceiptCandidates" => new[] { "DREC-2026-009 / 3000 KGS", "DREC-2026-010 / 5000 KGS", "待确认押金收款" },
        "chargeCandidates" => new[] { "CHG-2026-009 / 月租", "CHG-2026-010 / 水电", "最早欠款" },
        "serviceTaskCandidates" => new[] { "TASK-2026-009 / 清洁", "TASK-2026-010 / 维修", "待完成任务" },
        "expenseCandidates" => new[] { "EXP-2026-009 / 床品", "EXP-2026-010 / 维修", "待审批支出" },
        "periodCandidates" => new[] { "PER-2026-03 / 10日复盘", "PER-2026-04 / 10日复盘", "当前周期" },
        "roomCandidates" => new[] { "A301", "A302", "B201" },
        "bedCandidates" => new[] { "A301-02", "A302-01", "B201-03" },
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
