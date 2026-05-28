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

    private static FieldProjection Field(string label, string layer)
    {
        var type = FieldType(label, layer);
        var source = FieldSource(label, layer);
        return new FieldProjection(
            FieldId(label),
            Text(label, TermRu(label)),
            layer,
            type,
            layer != "analytics",
            source,
            layer == "business",
            layer == "analytics" ? label : string.Empty,
            FieldUi(label, type, source),
            FieldHelp(label, type, source));
    }

    private static IReadOnlyList<EvidenceRequirement> Evidence(string cardId) =>
        EvidenceLabels(cardId).Select(label => new EvidenceRequirement(
            FieldId(label),
            Text(label, TermRu(label)),
            true,
            label.Contains("照片") || label.Contains("截图") || label.Contains("凭证") ? "upload" : "record",
            FieldId(label),
            Text("提交前需要核对这项证据，确认后会进入审计事件。", "Проверьте это доказательство перед отправкой; после подтверждения оно попадет в аудит."))).ToArray();

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

    private static FieldUi FieldUi(string label, string type, string source)
    {
        var optionSet = OptionSet(label);
        return new FieldUi(
            Control(label, type, source),
            optionSet,
            Options(optionSet),
            DefaultValue(label),
            label == "容量" ? "房型" : string.Empty,
            label == "容量" || type == "readonly");
    }

    private static IReadOnlyList<FieldOption> Options(string optionSet) =>
        OptionValues(optionSet).Select(value => new FieldOption(value, Text(value, TermRu(value)))).ToArray();

    private static IReadOnlyDictionary<string, string> FieldHelp(string label, string type, string source)
    {
        if (label == "容量") return Text("容量由房型自动带出，不需要手填。", "Вместимость заполняется по типу комнаты автоматически.");
        if (Control(label, type, source) == "select") return Text("从合同给出的业务选项中选择。", "Выберите из вариантов, заданных контрактом.");
        if (Control(label, type, source) == "searchSelect") return Text("从投影候选对象中搜索选择，不手写对象。", "Выберите объект из кандидатов проекции, не вводите вручную.");
        if (Control(label, type, source) is "dateTime" or "dateTimeRange") return Text("使用日期时间控件，便于后端校验周期冲突。", "Используйте дату и время, чтобы backend мог проверить конфликты периода.");
        if (Control(label, type, source) == "number") return Text("填写数值，提交后由系统检查规则。", "Введите число; система проверит правила после отправки.");
        return Text("填写当前卡需要的业务信息。", "Заполните бизнес-данные для текущей карточки.");
    }

    private static string Control(string label, string type, string source)
    {
        if (label is "预计入住/退房" or "入住周期") return "dateTimeRange";
        if (label == "容量") return "number";
        if (type == "searchSelect" || source == "searchableProjection") return "searchSelect";
        if (type == "select" || source == "optionSet") return "select";
        if (type == "money") return "number";
        if (type == "evidenceUpload") return "evidence";
        if (type == "confirmation") return "select";
        if (type == "readonly") return "readonly";
        if (type == "dateTime") return "dateTime";
        return "text";
    }

    private static string OptionSet(string label)
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
        if (ContainsAny(label, "优先级", "紧急程度")) return "priority";
        if (label.Contains("已审批申请")) return "approvedApplicationCandidates";
        if (ContainsAny(label, "房间", "床位")) return "roomBedCandidates";
        if (label.Contains("客户")) return "customerCandidates";
        if (label.Contains("车辆")) return "vehicleCandidates";
        if (label.Contains("技师")) return "technicianCandidates";
        if (label.Contains("工位")) return "workbayCandidates";
        if (ContainsAny(label, "确认", "关闭", "通过", "退回", "需人工沟通", "是否可派工")) return "genericConfirm";
        return string.Empty;
    }

    private static IReadOnlyList<string> OptionValues(string optionSet) => optionSet switch
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

    private static string DefaultValue(string label) => label switch
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

    private static string TermRu(string zhCn) => zhCn switch
    {
        "楼栋" => "Корпус",
        "房间号" => "Номер комнаты",
        "房型" => "Тип комнаты",
        "容量" => "Вместимость",
        "床位号" => "Номер койки",
        "上/下铺" => "Верх/низ",
        "价格规则" => "Тариф",
        "检查状态" => "Проверка",
        "启用范围" => "Объем активации",
        "可分配时间" => "Время доступности",
        "启用备注" => "Комментарий активации",
        "入住人" => "Гость",
        "入住原因" => "Причина",
        "预计入住/退房" => "План въезда/выезда",
        "审批意见" => "Решение",
        "已审批申请" => "Одобренная заявка",
        "房间床位" => "Комната/койка",
        "入住周期" => "Период",
        "押金/费用规则" => "Депозит/тариф",
        "押金金额" => "Сумма депозита",
        "币种" => "Валюта",
        "付款方式" => "Способ оплаты",
        "凭证编号" => "Номер документа",
        "到账状态" => "Статус оплаты",
        "确认金额" => "Подтвержденная сумма",
        "退回原因" => "Причина возврата",
        "财务确认人" => "Фин. проверяющий",
        "实际入住时间" => "Фактическое заселение",
        "钥匙/物品交接" => "Ключи/имущество",
        "人工确认摘要" => "Ручное подтверждение",
        "单人间" => "Одноместная",
        "双人间" => "Двухместная",
        "四人间" => "Четырехместная",
        "六人间" => "Шестиместная",
        "下铺" => "Нижняя",
        "上铺" => "Верхняя",
        "整床" => "Целая кровать",
        "当前床位" => "Текущая койка",
        "当前房间全部床位" => "Все койки комнаты",
        "可分配" => "Доступно",
        "暂不开放" => "Недоступно",
        "仅内部预留" => "Внутренний резерв",
        "检查通过" => "Проверка пройдена",
        "待保洁" => "Ждет уборки",
        "待维修" => "Ждет ремонта",
        "已到账" => "Получено",
        "未到账" => "Не получено",
        "金额不一致" => "Сумма не совпадает",
        "通过" => "Принять",
        "退回补充" => "Вернуть на дополнение",
        "需主管复核" => "Нужна проверка руководителя",
        "现金" => "Наличные",
        "银行转账" => "Банковский перевод",
        "高" => "Высокий",
        "中" => "Средний",
        "低" => "Низкий",
        "已确认" => "Подтверждено",
        "待补充" => "Нужно дополнить",
        "需要人工确认" => "Нужно ручное подтверждение",
        _ => zhCn
    };

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
