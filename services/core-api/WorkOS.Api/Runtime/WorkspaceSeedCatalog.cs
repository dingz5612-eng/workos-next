namespace WorkOS.Api.Runtime;

internal static class WorkspaceSeedCatalog
{
    public static IReadOnlyList<WorkspaceSeed> All() => new[]
    {
        Workspace("W-STAY-RESOURCE", "stay", "T-ROOM-CREATE", "我要创建住宿资源", "Создать ресурсы проживания",
            "房间、床位和资源启用在同一资源建档办理面完成。",
            "Комнаты, койки и активация ресурсов вместе.",
            new[]
            {
                Card("room", "ready", "房间建档卡", "Комната", new[] { "roomId", "buildingId" }, new[] { "楼栋", "房间号", "房型", "容量" }, new[] { "duplicateRoomCount" }),
                Card("bed", "notStarted", "床位建档卡", "Койка", new[] { "bedId", "roomId" }, new[] { "所属房间", "床位号", "上/下铺", "价格规则", "维护状态" }, new[] { "capacityConflictCount" }),
                Card("activate", "notStarted", "资源启用卡", "Активация", new[] { "bedId", "operatorId" }, new[] { "启用对象", "启用范围", "可分配时间", "初始可用状态", "启用备注" }, new[] { "activationDuration" })
            },
            "先创建房间，再创建床位，最后启用可分配资源。",
            "Сначала комната, затем койка, затем активация ресурса."),
        Workspace("W-STAY-CHECKIN", "stay", "T-STAY-DEPOSIT", "我要安排入住收款", "Оформить заселение и оплату",
            "从线索、预订、分床、计费、押金、收款、财务确认到经营驾驶舱形成完整宿舍闭环。",
            "Лид, бронь, койка, тариф, депозит, оплата, финансы и операционная аналитика в одном цикле.",
            new[]
            {
                Card("lead", "ready", "线索登记卡", "Лид", new[] { "leadId", "operatorId" }, new[] { "联系日期", "姓名", "电话", "需要床位", "住宿时长", "线索来源", "线索状态", "备注" }, new[] { "leadCaptureDuration", "sourceChannel" }),
                Card("booking", "notStarted", "预订确认卡", "Бронь", new[] { "bookingId", "leadId" }, new[] { "入住日期", "预订人数", "预留房间/床位", "线索状态", "备注" }, new[] { "bookingConversionDuration", "bookingConversionRate" }),
                Card("resident", "notStarted", "入住人建档卡", "Жилец", new[] { "residentId", "bookingId" }, new[] { "姓名", "电话", "入住日期", "计划退住日期", "住客状态", "备注" }, new[] { "residentRegistrationDuration" }),
                Card("bedAssign", "notStarted", "分配床位卡", "Назначение койки", new[] { "stayId", "roomId", "bedId" }, new[] { "入住人", "房间床位", "入住周期", "床位锁定备注" }, new[] { "bedAssignmentDuration", "occupancyImpact" }),
                Card("tariff", "notStarted", "计费确认卡", "Тариф", new[] { "folioId", "stayId" }, new[] { "计费方式", "单价", "天数/周数/月数", "应收金额", "押金规则" }, new[] { "chargeAmount", "folioBalance" }),
                Card("depositRequirement", "notStarted", "押金要求卡", "Требование депозита", new[] { "depositId", "folioId", "liabilityAccountId" }, new[] { "押金规则", "应收押金", "押金币种", "押金截止时间", "是否允许免押", "免押原因" }, new[] { "depositLiabilityAmount", "depositDueLeadTime" }),
                Card("payment", "notStarted", "收款登记卡", "Платеж", new[] { "paymentId", "folioId", "depositId" }, new[] { "付款人", "付款时间", "付款金额", "币种", "付款方式", "收款用途", "凭证编号", "备注" }, new[] { "paymentRecordDuration", "unconfirmedPaymentAmount" }),
                Card("finance", "notStarted", "财务到账确认卡", "Фин. подтверждение", new[] { "financeReviewId", "paymentId", "depositId" }, new[] { "支付记录", "银行/钱包渠道", "到账金额", "到账时间", "财务确认人", "匹配结果", "差异原因", "处理意见" }, new[] { "financeReviewDuration", "financeVarianceAmount" }),
                Card("checkin", "notStarted", "入住确认卡", "Подтверждение заселения", new[] { "auditTraceId", "bedId", "stayId" }, new[] { "实际入住时间", "钥匙/物品交接", "人工确认摘要" }, new[] { "totalCheckinDuration", "manualConfirmCount" }),
                Card("operatingDashboard", "notStarted", "经营驾驶舱卡", "Операционная панель", new[] { "metricsProjectionId", "folioId", "depositId" }, new[] { "复盘结论", "后续行动", "负责人", "处理状态" }, new[] { "occupancyRate", "leadBookingConversionRate", "bookingCheckinConversionRate", "depositLiabilityBalance", "unconfirmedPaymentAmount", "financeVarianceAmount", "folioBalance" })
            },
            "先把线索转预订，再分配床位、生成账本、完成押金和财务确认。",
            "Сначала лид и бронь, затем койка, фолио, депозит и финансы."),
        Workspace("W-STAY-CHECKOUT", "stay", "T-STAY-CHECKOUT", "我要办理退房", "Оформить выселение",
            "退房发起、房间检查、费用结算、财务确认和释放床位在一个办理面完成。",
            "Выселение, проверка, расчет, финансы и освобождение койки вместе.",
            new[]
            {
                Card("checkoutStart", "ready", "退房发起卡", "Начало", new[] { "checkoutId", "stayOrderId" }, new[] { "退房人", "退房原因", "预计退房时间" }, new[] { "checkoutStartLeadTime" }),
                Card("roomInspection", "notStarted", "房间检查卡", "Проверка", new[] { "inspectionId", "roomId", "bedId" }, new[] { "房间状态", "物品/损坏检查", "照片证据" }, new[] { "damageCount", "inspectionDuration" }),
                Card("feeSettlement", "notStarted", "费用结算卡", "Расчет", new[] { "settlementId", "stayOrderId" }, new[] { "住宿费用", "额外费用", "押金抵扣", "应退/应补" }, new[] { "settlementDuration", "refundAmount" }),
                Card("checkoutFinance", "notStarted", "财务确认卡", "Финансы", new[] { "financeReviewId", "settlementId" }, new[] { "退款/补款确认", "财务凭证", "确认人" }, new[] { "refundDuration" }),
                Card("checkoutClose", "notStarted", "退房关闭卡", "Закрытие", new[] { "auditTraceId", "bedId" }, new[] { "释放床位", "关闭住宿单", "人工确认摘要" }, new[] { "checkoutTotalDuration" })
            },
            "先发起退房并完成房间检查。",
            "Начните выселение и проверьте комнату."),
        Workspace("W-STAY-DEPOSIT-EXCEPTION", "finance", "T-FIN-DEPOSIT", "我要处理押金异常", "Разобрать исключение депозита",
            "围绕押金异常原因、补交材料、财务复核和回到业务闭环处理。",
            "Причина, материалы, фин. проверка и возврат в процесс.",
            new[]
            {
                Card("reason", "done", "异常原因卡", "Причина", new[] { "exceptionId", "depositEvidenceId" }, new[] { "金额不一致", "凭证不清晰", "付款人不一致" }, new[] { "exceptionTypeCount" }),
                Card("resubmit", "ready", "补交材料卡", "Материалы", new[] { "depositEvidenceId", "stayOrderId" }, new[] { "新凭证", "收据编号", "补充说明" }, new[] { "resubmitDuration" }),
                Card("review", "notStarted", "财务复核卡", "Проверка", new[] { "financeReviewId", "reviewerId" }, new[] { "通过", "退回", "需人工沟通" }, new[] { "reviewDuration", "returnCount" }),
                Card("returnBusiness", "notStarted", "回到业务卡", "Возврат", new[] { "stayOrderId", "currentStage" }, new[] { "回到入住", "回到退房", "保持阻断" }, new[] { "exceptionResolutionDuration" })
            },
            "补交材料后等待财务复核。",
            "После материалов ждите фин. проверку."),
        Workspace("W-REPAIR-REQUEST", "repair", "T-AUTO-DIAGNOSE", "我要处理报修", "Обработать заявку ремонта",
            "客户车辆、报修信息、到场确认和派工入口形成报修闭环。",
            "Клиент, авто, заявка, прибытие и готовность к назначению.",
            new[]
            {
                Card("customerVehicle", "done", "客户车辆卡", "Клиент/авто", new[] { "repairCustomerId", "vehicleId" }, new[] { "客户", "车牌", "车型", "VIN", "联系方式" }, new[] { "vehicleMatchRate" }),
                Card("request", "done", "报修信息卡", "Заявка", new[] { "repairOrderId", "driverId" }, new[] { "故障描述", "车辆位置", "司机", "紧急程度" }, new[] { "requestCompleteness" }),
                Card("arrival", "ready", "到场确认卡", "Прибытие", new[] { "arrivalId", "vehicleId" }, new[] { "到场时间", "车辆状态", "接车人", "初步风险" }, new[] { "arrivalLeadTime" }),
                Card("dispatchEntry", "notStarted", "派工入口卡", "Назначение", new[] { "repairOrderId", "queueItemId" }, new[] { "是否可派工", "阻断原因", "下一步责任人" }, new[] { "dispatchReadyRate" })
            },
            "确认车辆到场后进入派工。",
            "После прибытия можно назначать диагностику."),
        Workspace("W-REPAIR-DISPATCH", "repair", "T-AUTO-DIAGNOSE", "我要安排维修", "Назначить ремонт",
            "派工、诊断、维修执行和阻断恢复在一个维修办理面中处理。",
            "Назначение, диагностика, ремонт и блокировки в одной области.",
            new[]
            {
                Card("dispatch", "ready", "派工卡", "Назначение", new[] { "technicianId", "workbayId" }, new[] { "技师", "工位", "预计开始时间", "优先级" }, new[] { "dispatchLeadTime" }),
                Card("diagnosis", "notStarted", "诊断卡", "Диагностика", new[] { "diagnosisId", "repairOrderId" }, new[] { "故障分类", "诊断结论", "所需配件", "预计费用" }, new[] { "diagnosisDuration" }),
                Card("execution", "notStarted", "维修执行卡", "Ремонт", new[] { "repairProgressId", "partsRequestId" }, new[] { "维修项目", "工时", "配件", "过程照片" }, new[] { "vehicleDowntime" }),
                Card("repairBlocker", "notStarted", "阻断卡", "Блокировка", new[] { "blockerId", "repairOrderId" }, new[] { "无技师", "缺配件", "费用待确认", "客户不同意" }, new[] { "blockerDuration" })
            },
            "先选择技师和工位，不会自动关闭维修单。",
            "Выберите механика и пост; заявка не закроется автоматически."),
        Workspace("W-REPAIR-CLOSE", "repair", "T-REPAIR-CLOSE", "我要验收关闭", "Принять и закрыть ремонт",
            "验收、费用材料、客户确认和关闭摘要形成关闭闭环。",
            "Приемка, расходы, клиент и закрытие.",
            new[]
            {
                Card("inspection", "ready", "验收卡", "Приемка", new[] { "inspectionId", "repairOrderId" }, new[] { "维修结果", "试车结果", "验收照片", "验收人" }, new[] { "inspectionDuration" }),
                Card("feeMaterial", "notStarted", "费用材料卡", "Расходы", new[] { "feeMaterialId", "repairOrderId" }, new[] { "工时费", "配件费", "其它费用", "财务材料" }, new[] { "feeMaterialDuration" }),
                Card("customerConfirm", "notStarted", "客户确认卡", "Клиент", new[] { "customerConfirmId", "driverId" }, new[] { "客户签字", "司机确认", "异议说明" }, new[] { "disputeCount" }),
                Card("close", "notStarted", "关闭卡", "Закрытие", new[] { "auditTraceId", "repairOrderId" }, new[] { "关闭摘要", "车辆恢复状态", "人工确认关闭" }, new[] { "closeDuration" })
            },
            "先完成验收，费用材料齐全后才能关闭。",
            "Сначала приемка; закрыть можно после расходов."),
        Workspace("W-REPAIR-MASTER-DATA", "repair", "T-VEHICLE-CREATE", "我要创建维修资料", "Создать ремонтные справочники",
            "客户、车辆和服务规则在同一资料建档办理面完成。",
            "Клиент, авто и правила сервиса вместе.",
            new[]
            {
                Card("customer", "ready", "客户建档卡", "Клиент", new[] { "repairCustomerId", "operatorId" }, new[] { "客户名称", "联系人", "电话", "类型" }, new[] { "customerCreationDuration" }),
                Card("vehicle", "ready", "车辆建档卡", "Авто", new[] { "vehicleId", "repairCustomerId" }, new[] { "车牌", "品牌车型", "VIN", "发动机号", "里程" }, new[] { "duplicatePlateCount", "duplicateVinCount" }),
                Card("serviceRule", "notStarted", "服务规则卡", "Правила", new[] { "serviceRuleId", "vehicleId" }, new[] { "结算方式", "常用司机", "维修优先级", "授权规则" }, new[] { "ruleCompletionRate" })
            },
            "先建客户和车辆，再补服务规则。",
            "Создайте клиента и авто, затем правила.")
    };

    private static WorkspaceSeed Workspace(string id, string domain, string taskId, string zhTitle, string ruTitle, string zhSummary, string ruSummary, IReadOnlyList<CardSeed> cards, string zhNext, string ruNext) =>
        new(id, domain, taskId, zhTitle, ruTitle, zhSummary, ruSummary, cards, zhNext, ruNext);

    private static CardSeed Card(string id, string status, string zhTitle, string ruTitle, string[] system, string[] business, string[] analytics) =>
        new(id, status, zhTitle, ruTitle, system, business, analytics);
}

internal sealed record WorkspaceSeed(
    string Id,
    string Domain,
    string TaskId,
    string ZhTitle,
    string RuTitle,
    string ZhSummary,
    string RuSummary,
    IReadOnlyList<CardSeed> Cards,
    string ZhNext,
    string RuNext);
