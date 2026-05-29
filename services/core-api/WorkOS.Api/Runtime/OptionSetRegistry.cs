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
        if (label.Contains("可售状态")) return "availability";
        if (label.Contains("阻断范围")) return "resourceScope";
        if (label.Contains("释放范围")) return "resourceScope";
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
        if (ContractText.ContainsAny(label, "是否允许免押", "是否需要预订押金", "释放床位", "是否发现损坏", "是否需要清洁", "是否阻断可售")) return "yesNo";
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
        StableOptions(optionSet).Select(item => new FieldOption(item.Value, ContractText.Text(item.ZhLabel, ContractText.TermRu(item.ZhLabel)))).ToArray();

    public static string DefaultValue(string label) => string.Empty;

    private static IReadOnlyList<(string Value, string ZhLabel)> StableOptions(string optionSet) => optionSet switch
    {
        "roomType" => new[] { ("single", "单人间"), ("double", "双人间"), ("four_bed", "四人间"), ("six_bed", "六人间") },
        "genderPolicy" => new[] { ("male", "男生房"), ("female", "女生房"), ("mixed", "混住"), ("unrestricted", "未限制") },
        "furnitureStatus" => new[] { ("complete", "家具齐全"), ("partial", "部分缺失"), ("missing", "缺失"), ("pending", "待配置") },
        "technicalState" => new[] { ("ready", "可入住"), ("not_ready", "未准备"), ("repair", "需维修") },
        "bunkType" => new[] { ("lower", "下铺"), ("upper", "上铺"), ("whole", "整床") },
        "bedStatus" => new[] { ("available", "可分配"), ("reserved", "已预留"), ("occupied", "已入住"), ("cleaning_required", "待清洁"), ("maintenance_blocked", "维修阻断"), ("inactive", "未启用") },
        "bedPriceRule" => new[] { ("monthly_standard", "月租标准"), ("daily_short_stay", "短住日租"), ("internal_free", "内部免费"), ("contract_rate", "合同价") },
        "activationScope" => new[] { ("current_bed", "当前床位"), ("current_room_beds", "当前房间全部床位") },
        "resourceScope" => new[] { ("room", "房间"), ("bed", "床位"), ("room_beds", "房间全部床位") },
        "availability" => new[] { ("available", "可分配"), ("inactive", "暂不开放"), ("internal_reserve", "仅内部预留") },
        "maintenance" => new[] { ("passed", "检查通过"), ("cleaning_required", "待保洁"), ("repair_required", "待维修") },
        "messenger" => new[] { ("whatsapp", "WhatsApp"), ("phone", "电话"), ("instagram", "Instagram"), ("facebook", "Facebook"), ("other", "其他") },
        "leadSource" => new[] { ("whatsapp", "WhatsApp"), ("phone", "电话"), ("instagram", "Instagram"), ("listing_ad", "广告"), ("referral", "熟人推荐"), ("employer", "雇主"), ("other", "其他") },
        "leadStatus" => new[] { ("new", "新线索"), ("callback", "回访"), ("negotiating", "洽谈中"), ("reserved", "已预订"), ("checked_in", "已入住"), ("rejected", "拒绝") },
        "residentStatus" => new[] { ("active", "在住"), ("checked_out", "已退住"), ("reserved", "预订") },
        "identityType" => new[] { ("passport", "护照"), ("national_id", "身份证"), ("other", "其他证件") },
        "gender" => new[] { ("male", "男"), ("female", "女"), ("unspecified", "未说明") },
        "stayReason" => new[] { ("new_employee", "新员工住宿"), ("short_stay_customer", "客户临住"), ("room_change", "换房调整"), ("project_site", "项目驻场") },
        "chargeType" => new[] { ("rent", "房租"), ("utility", "水电"), ("damage_compensation", "赔偿"), ("late_fee", "滞纳金"), ("other", "其他") },
        "tariffType" => new[] { ("daily", "按天"), ("weekly", "按周"), ("monthly", "按月") },
        "paymentStatus" => new[] { ("received", "已到账"), ("not_received", "未到账"), ("amount_mismatch", "金额不一致") },
        "approvalDecision" => new[] { ("approved", "通过"), ("return_for_more", "退回补充"), ("manager_review", "需主管复核") },
        "depositFeeRule" => new[] { ("standard_deposit", "标准押金"), ("standard_deposit_monthly_rent", "标准押金 + 月租"), ("no_deposit", "免押金"), ("contract_deposit", "合同押金"), ("manager_assigned", "主管指定") },
        "depositType" => new[] { ("security", "安全押金"), ("key", "钥匙押金"), ("damage", "损坏押金"), ("reservation", "预订押金") },
        "currency" => new[] { ("KGS", "KGS"), ("RUB", "RUB"), ("USD", "USD") },
        "paymentMethod" => new[] { ("cash", "现金"), ("bank_transfer", "银行转账"), ("pos", "POS") },
        "paymentPurpose" => new[] { ("deposit", "押金"), ("rent", "房费"), ("deposit_rent", "押金 + 房费"), ("other", "其它") },
        "paymentChannel" => new[] { ("cash", "现金"), ("mbank", "MBank"), ("elsom", "ЭЛСОМ"), ("bank_transfer", "银行转账"), ("pos", "POS"), ("other", "其他") },
        "confirmationResult" => new[] { ("confirmed", "确认"), ("rejected", "拒绝"), ("needs_review", "需要复核"), ("amount_mismatch", "金额不一致"), ("channel_mismatch", "渠道不一致"), ("evidence_unclear", "凭证不清晰") },
        "taskStatus" => new[] { ("pending", "待处理"), ("in_progress", "处理中"), ("done", "已完成"), ("verified", "已验收"), ("cancelled", "已取消") },
        "approvalResult" => new[] { ("approved", "通过"), ("rejected", "拒绝"), ("needs_review", "需要复核") },
        "yesNo" => new[] { ("false", "否"), ("true", "是") },
        "handoverStatus" => new[] { ("keys_handed_over", "钥匙已交接"), ("keys_pending", "钥匙待领取"), ("items_missing", "物品缺失需备注") },
        "priority" => new[] { ("high", "高"), ("medium", "中"), ("low", "低") },
        "allocationMode" => new[] { ("auto_oldest_debt", "自动抵最早欠款"), ("manual_charge_selection", "手动选择应收"), ("period_based", "按周期分配") },
        "checkoutResult" => new[] { ("closed", "已关闭"), ("refund_pending", "待退款"), ("debt_pending", "待补款"), ("closed_with_risk", "有风险关闭"), ("blocked", "阻断") },
        "roomCondition" => new[] { ("normal", "正常"), ("cleaning_required", "需清洁"), ("damaged", "损坏"), ("repair_required", "需维修") },
        "checkoutReason" => new[] { ("normal", "正常退住"), ("early", "提前退住"), ("debt", "欠费退住"), ("room_change", "换房退住"), ("other", "其他") },
        "taskType" => new[] { ("cleaning", "清洁"), ("repair", "维修"), ("furniture_setup", "家具配置"), ("bedding_setup", "床品补充"), ("inspection", "检查"), ("other", "其他") },
        "completionResult" => new[] { ("done", "已完成"), ("partial", "部分完成"), ("failed", "失败") },
        "expenseCategory" => new[] { ("furniture", "家具"), ("bedding", "床品"), ("cleaning", "清洁"), ("household", "日用品"), ("repair", "维修"), ("utilities", "水电"), ("advertising", "广告"), ("other", "其他") },
        "financeReviewResult" => new[] { ("passed", "通过"), ("needs_fix", "需要修正"), ("blocked", "阻断") },
        "problemCategory" => new[] { ("occupancy", "入住率"), ("debt", "欠款"), ("cleaning", "清洁"), ("repair", "维修"), ("lead", "线索"), ("cost", "成本"), ("other", "其他") },
        "confidence" => new[] { ("high", "高"), ("medium", "中"), ("low", "低") },
        "periodActionType" => new[] { ("occupancy", "提升入住率"), ("revenue", "增加收入"), ("debt_collection", "催收欠款"), ("cleaning", "改善清洁"), ("maintenance", "改善维修"), ("cost_control", "降低成本"), ("marketing", "营销") },
        "targetMetric" => new[] { ("occupancy_rate", "入住率"), ("debt_balance", "欠款余额"), ("task_completion_rate", "任务完成率"), ("revenue", "收入"), ("cost", "成本") },
        "approvedApplicationCandidates" => new[] { ("APP-2026-009", "APP-2026-009 / 张三"), ("APP-2026-010", "APP-2026-010 / Fleet Partner 01"), ("new", "新审批申请") },
        "leadCandidates" => new[] { ("LEAD-2026-009", "LEAD-2026-009 / 张三"), ("LEAD-2026-010", "LEAD-2026-010 / Ivan"), ("new", "新线索") },
        "reservationCandidates" => new[] { ("RES-2026-009", "RES-2026-009 / 张三"), ("RES-2026-010", "RES-2026-010 / Ivan"), ("pending", "待转换预订") },
        "stayCandidates" => new[] { ("STAY-2026-009", "STAY-2026-009 / 张三"), ("STAY-2026-010", "STAY-2026-010 / Ivan"), ("current", "当前在住") },
        "depositCandidates" => new[] { ("DEP-2026-009", "DEP-2026-009 / 3000 KGS"), ("DEP-2026-010", "DEP-2026-010 / 5000 KGS"), ("pending", "待处理押金") },
        "depositReceiptCandidates" => new[] { ("DREC-2026-009", "DREC-2026-009 / 3000 KGS"), ("DREC-2026-010", "DREC-2026-010 / 5000 KGS"), ("pending", "待确认押金收款") },
        "chargeCandidates" => new[] { ("CHG-2026-009", "CHG-2026-009 / 月租"), ("CHG-2026-010", "CHG-2026-010 / 水电"), ("oldest_debt", "最早欠款") },
        "serviceTaskCandidates" => new[] { ("TASK-2026-009", "TASK-2026-009 / 清洁"), ("TASK-2026-010", "TASK-2026-010 / 维修"), ("pending", "待完成任务") },
        "expenseCandidates" => new[] { ("EXP-2026-009", "EXP-2026-009 / 床品"), ("EXP-2026-010", "EXP-2026-010 / 维修"), ("pending", "待审批支出") },
        "periodCandidates" => new[] { ("PER-2026-03", "PER-2026-03 / 10日复盘"), ("PER-2026-04", "PER-2026-04 / 10日复盘"), ("current", "当前周期") },
        "roomCandidates" => new[] { ("A301", "A301"), ("A302", "A302"), ("B201", "B201") },
        "bedCandidates" => new[] { ("A301-02", "A301-02"), ("A302-01", "A302-01"), ("B201-03", "B201-03") },
        "roomBedCandidates" => new[] { ("A301/A301-02", "A301 / A301-02"), ("A302/A302-01", "A302 / A302-01"), ("B201/B201-03", "B201 / B201-03") },
        "residentCandidates" => new[] { ("EMP-009", "张三 / EMP-009"), ("EMP-010", "李四 / EMP-010"), ("new", "新入住人") },
        "paymentCandidates" => new[] { ("PAY-2026-009", "PAY-2026-009 / 3000 KGS"), ("PAY-2026-010", "PAY-2026-010 / 9300 KGS"), ("pending", "待匹配支付") },
        "customerCandidates" => new[] { ("customer-zhang", "张三汽修客户"), ("fleet-partner-01", "Fleet Partner 01"), ("new", "新客户") },
        "vehicleCandidates" => new[] { ("veh-camry-01", "Toyota Camry · 01KG123ABC"), ("veh-sprinter-01", "Mercedes Sprinter · 01KG777"), ("new", "新车辆") },
        "technicianCandidates" => new[] { ("tech-alexey", "Алексей Смирнов"), ("tech-ivan", "Иван Орлов"), ("supervisor", "维修主管分配") },
        "workbayCandidates" => new[] { ("bay-2", "2 号位"), ("bay-1", "1 号位"), ("waiting", "等待空位") },
        "genericConfirm" => new[] { ("confirmed", "已确认"), ("needs_input", "待补充"), ("manual_required", "需要人工确认") },
        _ => Array.Empty<(string Value, string ZhLabel)>()
    };
}
