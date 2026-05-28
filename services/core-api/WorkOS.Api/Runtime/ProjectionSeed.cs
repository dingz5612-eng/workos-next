namespace WorkOS.Api.Runtime;

public static class ProjectionSeed
{
    public static RuntimeState Create() => new(Workspaces(), new List<WorkspaceEvent>(), Users());

    private static List<RuntimeUser> Users() => new()
    {
        new RuntimeUser("u-operator", "operator", "住宿经办人", "operator", true),
        new RuntimeUser("u-finance", "finance", "财务确认人", "finance", true),
        new RuntimeUser("u-manager", "manager", "业务主管", "manager", true),
        new RuntimeUser("ai-agent", "ai", "AI 助手", "ai", true)
    };

    private static List<WorkspaceProjection> Workspaces() => new()
    {
        Workspace("W-STAY-RESOURCE", "stay", "T-ROOM-CREATE", "我要创建住宿资源", "Создать ресурсы проживания",
            "房间、床位和资源启用在同一资源建档办理面完成。",
            "Комнаты, койки и активация ресурсов вместе.",
            new[]
            {
                Card("room", "ready", "房间建档卡", "Комната", new[] { "roomId", "buildingId" }, new[] { "楼栋", "房间号", "房型", "容量" }, new[] { "duplicateRoomCount" }),
                Card("bed", "notStarted", "床位建档卡", "Койка", new[] { "bedId", "roomId" }, new[] { "床位号", "上/下铺", "价格规则", "检查状态" }, new[] { "capacityConflictCount" }),
                Card("activate", "notStarted", "资源启用卡", "Активация", new[] { "bedId", "operatorId" }, new[] { "启用范围", "可分配时间", "启用备注" }, new[] { "activationDuration" })
            },
            "先创建房间，再创建床位，最后启用可分配资源。",
            "Сначала комната, затем койка, затем активация ресурса."),
        Workspace("W-STAY-CHECKIN", "stay", "T-STAY-DEPOSIT", "我要安排入住", "Оформить заселение",
            "一件事内完成申请、住宿单、押金、财务和入住确认。",
            "Заявка, ордер, депозит, финансы и заселение в одной области.",
            new[]
            {
                Card("application", "ready", "申请卡", "Заявка", new[] { "applicationId", "residentId", "approverId" }, new[] { "入住人", "入住原因", "预计入住/退房", "审批意见" }, new[] { "approvalLeadTime", "approvalReturnCount" }),
                Card("stayOrder", "notStarted", "住宿单卡", "Ордер", new[] { "stayOrderId", "roomId", "bedId" }, new[] { "已审批申请", "房间床位", "入住周期", "押金/费用规则" }, new[] { "bedLockDuration", "assignmentDuration" }),
                Card("deposit", "notStarted", "押金卡", "Депозит", new[] { "depositEvidenceId", "stayOrderId" }, new[] { "押金金额", "币种", "付款方式", "凭证编号" }, new[] { "depositSubmitDuration", "depositReturnCount" }),
                Card("finance", "notStarted", "财务卡", "Финансы", new[] { "financeReviewId", "depositEvidenceId" }, new[] { "到账状态", "确认金额", "退回原因", "财务确认人" }, new[] { "financeReviewDuration", "financePassRate" }),
                Card("checkin", "notStarted", "入住确认卡", "Подтверждение", new[] { "auditTraceId", "bedId", "stayOrderId" }, new[] { "实际入住时间", "钥匙/物品交接", "人工确认摘要" }, new[] { "totalCheckinDuration", "manualConfirmCount" })
            },
            "资源启用后，从申请卡开始进入入住办理闭环。",
            "После активации ресурса начните заселение с заявки."),
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

    private static WorkspaceProjection Workspace(string id, string domain, string taskId, string zhTitle, string ruTitle, string zhSummary, string ruSummary, IReadOnlyList<CardSeed> seeds, string zhNext, string ruNext)
    {
        var cards = seeds.Select(CardProjection).ToArray();
        return new WorkspaceProjection("IntentWorkspaceProjection", id, domain, taskId, Text(zhTitle, ruTitle), Text(zhSummary, ruSummary), cards, Text(zhNext, ruNext), cards.SelectMany(card => card.BlockerRules).ToArray());
    }

    private static CardSeed Card(string id, string status, string zhTitle, string ruTitle, string[] system, string[] business, string[] analytics) =>
        new(id, status, zhTitle, ruTitle, system, business, analytics);

    private static CardProjection CardProjection(CardSeed seed) => new(
        "WorkspaceCardProjection",
        seed.Id,
        seed.Status,
        Text(seed.ZhTitle, seed.RuTitle),
        new FieldSet(seed.System.Select(label => Field(label, "system")).ToArray(), seed.Business.Select(label => Field(label, "business")).ToArray(), seed.Analytics.Select(label => Field(label, "analytics")).ToArray()),
        Evidence(seed.Id),
        Checks(seed.Id),
        Blockers(seed.Id, seed.Status),
        Events(seed.Id),
        new TransitionDefinition($"{seed.Id}.prepared", $"{seed.Id}.confirmed", $"{seed.Id}.blocked"),
        Confirmation(seed.Id, seed.Status));

    private static FieldProjection Field(string label, string layer) =>
        new(FieldId(label), Text(label, label), layer, FieldType(label, layer), layer != "analytics", FieldSource(label, layer), layer == "business", layer == "analytics" ? label : string.Empty);

    private static IReadOnlyList<EvidenceRequirement> Evidence(string cardId) =>
        EvidenceLabels(cardId).Select(label => new EvidenceRequirement(FieldId(label), Text(label, label), true, label.Contains("照片") || label.Contains("截图") || label.Contains("凭证") ? "upload" : "record", FieldId(label))).ToArray();

    private static IReadOnlyList<SystemCheck> Checks(string cardId) =>
        CheckLabels(cardId).Select(label => new SystemCheck(FieldId(label), Text(label, label), "blocking", "pending")).ToArray();

    private static IReadOnlyList<BlockerRule> Blockers(string cardId, string status)
    {
        if (status != "blocked")
        {
            return Array.Empty<BlockerRule>();
        }

        var labels = cardId switch
        {
            "deposit" => new[] { "押金金额不匹配", "付款人不一致", "凭证不清晰" },
            "finance" => new[] { "未到账", "确认金额不一致", "财务权限不足" },
            "checkin" => new[] { "押金未通过", "床位已释放", "入住确认缺失" },
            _ => new[] { "当前卡存在阻断" }
        };
        return labels.Select(label => new BlockerRule(FieldId(label), Text(label, label), OwnerRoleForCard(cardId), Text("补齐材料或人工确认后继续", "Дополните данные или подтвердите вручную"))).ToArray();
    }

    private static IReadOnlyList<EventDefinition> Events(string cardId) =>
        EventTypes(cardId).Select(eventType => new EventDefinition(eventType, true, ProjectionTargets())).ToArray();

    private static ConfirmationPolicy Confirmation(string cardId, string status)
    {
        var critical = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "finance", "checkin", "checkoutFinance", "checkoutClose", "review", "returnBusiness",
            "dispatch", "diagnosis", "inspection", "feeMaterial", "customerConfirm", "close"
        };
        return new ConfirmationPolicy(status != "done" && critical.Contains(cardId), true, RequiredRole(cardId), status == "done" ? Text("已确认", "Подтверждено") : Text("关键动作由人工确认", "Ключевое действие подтверждает человек"));
    }

    private static string RequiredRole(string cardId)
    {
        if (ContainsAny(cardId, "finance", "review", "feeMaterial")) return "finance";
        if (ContainsAny(cardId, "checkin", "checkoutClose", "close")) return "operator";
        return "operator";
    }

    private static string[] EvidenceLabels(string cardId) => cardId switch
    {
        "application" => new[] { "已审批申请", "审批意见" },
        "stayOrder" => new[] { "已审批申请", "房间床位" },
        "deposit" => new[] { "付款截图", "收据编号", "付款人", "付款时间" },
        "finance" => new[] { "到账记录", "金额核对", "财务确认记录" },
        "checkin" => new[] { "钥匙/物品交接", "入住人现场确认" },
        "room" => new[] { "房间重复校验", "建档人记录" },
        "bed" => new[] { "容量校验", "床位编号校验" },
        "activate" => new[] { "检查状态", "资源启用确认" },
        _ => new[] { "操作证据", "人工处理记录" }
    };

    private static string[] CheckLabels(string cardId) => cardId switch
    {
        "application" => new[] { "申请已审批", "入住人未重复入住" },
        "stayOrder" => new[] { "床位可用", "入住周期无冲突", "押金/费用规则可用" },
        "deposit" => new[] { "金额匹配", "币种匹配", "付款人匹配", "凭证清晰" },
        "finance" => new[] { "到账状态有效", "确认金额一致", "财务角色可确认" },
        "checkin" => new[] { "押金已通过", "床位仍锁定", "人工确认完整" },
        "room" => new[] { "房间号未重复", "容量有效" },
        "bed" => new[] { "房间存在", "未超过容量", "床位号未重复" },
        "activate" => new[] { "检查已通过", "床位未锁定" },
        _ => new[] { "字段完整", "证据完整", "权限满足" }
    };

    private static string[] EventTypes(string cardId) => cardId switch
    {
        "room" => new[] { "RoomCreated" },
        "bed" => new[] { "BedCreated" },
        "activate" => new[] { "BedActivated" },
        "application" => new[] { "ApplicationApproved" },
        "stayOrder" => new[] { "StayOrderPrepared", "BedSelected" },
        "deposit" => new[] { "DepositEvidenceSubmitted", "DepositBlocked" },
        "finance" => new[] { "FinanceDepositConfirmed" },
        "checkin" => new[] { "CheckInConfirmed" },
        _ => new[] { $"{char.ToUpperInvariant(cardId[0])}{cardId[1..]}Confirmed" }
    };

    private static IReadOnlyList<string> ProjectionTargets() => new[]
    {
        "IntentWorkspaceProjection",
        "WorkspaceCardProjection",
        "WorkQueueProjection",
        "SearchProjection",
        "ScenarioCoachProjection",
        "AiContextProjection",
        "AuditEvidenceProjection"
    };

    private static IReadOnlyDictionary<string, string> Text(string zhCn, string ruRu) =>
        new Dictionary<string, string> { ["zh-CN"] = zhCn, ["ru-RU"] = ruRu };

    private static string FieldId(string label)
    {
        var chars = label.Where(char.IsLetterOrDigit).ToArray();
        return chars.Length == 0 ? "field" : new string(chars);
    }

    private static string FieldType(string label, string layer)
    {
        if (layer is "system" or "analytics") return "readonly";
        if (ContainsAny(label, "房型", "上/下铺", "启用范围", "可用状态", "维护状态")) return "select";
        if (ContainsAny(label, "房间", "床位", "客户", "车辆", "技师", "工位")) return "searchSelect";
        if (ContainsAny(label, "预计", "周期", "时间")) return "dateTime";
        if (ContainsAny(label, "金额", "费用", "押金", "应退", "应补")) return "money";
        if (ContainsAny(label, "照片", "凭证", "材料", "签字")) return "evidenceUpload";
        if (ContainsAny(label, "确认", "关闭", "通过", "退回")) return "confirmation";
        return "text";
    }

    private static string FieldSource(string label, string layer)
    {
        if (layer == "system") return "system";
        if (layer == "analytics") return "projection";
        if (ContainsAny(label, "房间床位", "已审批申请", "客户", "车辆", "技师", "工位")) return "searchableProjection";
        if (ContainsAny(label, "币种", "付款方式", "优先级", "紧急程度", "房型", "上/下铺", "可用状态", "维护状态", "启用范围")) return "optionSet";
        return "userInput";
    }

    private static string OwnerRoleForCard(string cardId)
    {
        if (ContainsAny(cardId, "finance", "review", "feeMaterial")) return "finance";
        if (ContainsAny(cardId, "dispatch", "diagnosis", "execution", "repairBlocker", "inspection", "close")) return "repair";
        return "operator";
    }

    private static bool ContainsAny(string value, params string[] needles) =>
        needles.Any(needle => value.Contains(needle, StringComparison.OrdinalIgnoreCase));
}
