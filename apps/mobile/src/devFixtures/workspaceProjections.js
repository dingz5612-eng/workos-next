import { fieldMetadata, localizedText } from "./projectionMetadata.js";

// Dev/test fixture only. Production runtime surfaces must consume runtimeStore
// projection, work queue, search, and Lens data; offline production states must
// show real cache or empty/error states, not this fixture.
export let intentWorkspaces = [
  workspaceModel("W-STAY-RESOURCE", "stay", "T-ROOM-CREATE",
    { "zh-CN": "我要创建住宿资源", "ru-RU": "Создать ресурсы проживания" },
    { "zh-CN": "房间、床位和资源启用在同一资源建档办理面完成。", "ru-RU": "Комнаты, койки и активация ресурсов вместе." },
    [
      cardModel("room", "ready", "房间建档卡", "Комната", ["roomId", "buildingId"], ["楼栋", "房间号", "房型", "容量"], ["duplicateRoomCount"]),
      cardModel("bed", "notStarted", "床位建档卡", "Койка", ["bedId", "roomId"], ["所属房间", "床位号", "上/下铺", "价格规则", "维护状态"], ["capacityConflictCount"]),
      cardModel("activate", "notStarted", "资源启用卡", "Активация", ["bedId", "operatorId"], ["启用对象", "启用范围", "可分配时间", "初始可用状态", "启用备注"], ["activationDuration"])
    ],
    { "zh-CN": "先创建房间，再创建床位，最后启用可分配资源。", "ru-RU": "Сначала комната, затем койка, затем активация ресурса." }),
  workspaceModel("W-STAY-CHECKIN", "stay", "T-STAY-DEPOSIT",
    { "zh-CN": "我要安排入住收款", "ru-RU": "Оформить заселение и оплату" },
    { "zh-CN": "从线索、预订、分床、计费、押金、收款、财务确认到经营驾驶舱形成完整宿舍闭环。", "ru-RU": "Лид, бронь, койка, тариф, депозит, оплата, финансы и операционная аналитика в одном цикле." },
    [
      cardModel("lead", "ready", "线索登记卡", "Лид", ["leadId", "operatorId"], ["联系日期", "姓名", "电话", "需要床位", "住宿时长", "线索来源", "线索状态", "备注"], ["leadCaptureDuration", "sourceChannel"]),
      cardModel("booking", "notStarted", "预订确认卡", "Бронь", ["bookingId", "leadId"], ["入住日期", "预订人数", "预留房间/床位", "线索状态", "备注"], ["leadBookingConversionRate", "bookingHoldDuration"]),
      cardModel("resident", "notStarted", "入住人建档卡", "Жилец", ["residentId", "bookingId"], ["姓名", "电话", "入住日期", "计划退住日期", "住客状态", "备注"], ["residentRegistrationDuration"]),
      cardModel("bedAssign", "notStarted", "分配床位卡", "Назначение койки", ["stayId", "roomId", "bedId"], ["入住人", "房间床位", "入住周期", "床位锁定备注"], ["bedAssignmentDuration", "occupancyImpact"]),
      cardModel("tariff", "notStarted", "计费确认卡", "Тариф", ["folioId", "stayId"], ["计费方式", "单价", "天数/周数/月数", "应收金额", "押金规则"], ["chargeAmount", "folioBalance"]),
      cardModel("depositRequirement", "notStarted", "押金要求卡", "Требование депозита", ["depositId", "folioId", "liabilityAccountId"], ["押金规则", "应收押金", "押金币种", "押金截止时间", "是否允许免押", "免押原因"], ["depositLiabilityAmount", "depositDueLeadTime"]),
      cardModel("payment", "notStarted", "收款登记卡", "Платеж", ["paymentId", "folioId", "depositId"], ["付款人", "付款时间", "付款金额", "币种", "付款方式", "收款用途", "凭证编号", "备注"], ["paymentRecordDuration", "unconfirmedPaymentAmount"]),
      cardModel("finance", "notStarted", "财务到账确认卡", "Фин. подтверждение", ["financeReviewId", "paymentId", "depositId"], ["支付记录", "银行/钱包渠道", "到账金额", "到账时间", "财务确认人", "匹配结果", "差异原因", "处理意见"], ["financeReviewDuration", "financeVarianceAmount"]),
      cardModel("checkin", "notStarted", "入住确认卡", "Подтверждение заселения", ["auditTraceId", "bedId", "stayId"], ["实际入住时间", "钥匙/物品交接", "人工确认摘要"], ["bookingCheckinConversionRate", "manualConfirmCount"]),
      cardModel("operatingDashboard", "notStarted", "经营驾驶舱卡", "Операционная панель", ["metricsProjectionId", "folioId", "depositId"], ["复盘结论", "后续行动", "负责人", "处理状态"], ["occupancyRate", "leadBookingConversionRate", "bookingCheckinConversionRate", "depositLiabilityBalance", "unconfirmedPaymentAmount", "financeVarianceAmount", "folioBalance"])
    ],
    { "zh-CN": "先把线索转预订，再分配床位、生成账本、完成押金和财务确认。", "ru-RU": "Сначала лид и бронь, затем койка, фолио, депозит и финансы." }),
  workspaceModel("W-STAY-CHECKOUT", "stay", "T-STAY-CHECKOUT",
    { "zh-CN": "我要办理退房", "ru-RU": "Оформить выселение" },
    { "zh-CN": "退房发起、房间检查、费用结算、财务确认和释放床位在一个办理面完成。", "ru-RU": "Выселение, проверка, расчет, финансы и освобождение койки вместе." },
    [
      cardModel("checkoutStart", "ready", "退房发起卡", "Начало", ["checkoutId", "stayOrderId"], ["退房人", "退房原因", "预计退房时间"], ["checkoutStartLeadTime"]),
      cardModel("roomInspection", "notStarted", "房间检查卡", "Проверка", ["inspectionId", "roomId", "bedId"], ["房间状态", "物品/损坏检查", "照片证据"], ["damageCount", "inspectionDuration"]),
      cardModel("feeSettlement", "notStarted", "费用结算卡", "Расчет", ["settlementId", "stayOrderId"], ["住宿费用", "额外费用", "押金抵扣", "应退/应补"], ["settlementDuration", "refundAmount"]),
      cardModel("checkoutFinance", "notStarted", "财务确认卡", "Финансы", ["financeReviewId", "settlementId"], ["退款/补款确认", "财务凭证", "确认人"], ["refundDuration"]),
      cardModel("checkoutClose", "notStarted", "退房关闭卡", "Закрытие", ["auditTraceId", "bedId"], ["释放床位", "关闭住宿单", "人工确认摘要"], ["checkoutTotalDuration"])
    ],
    { "zh-CN": "先发起退房并完成房间检查。", "ru-RU": "Начните выселение и проверьте комнату." }),
  workspaceModel("W-STAY-DEPOSIT-EXCEPTION", "finance", "T-FIN-DEPOSIT",
    { "zh-CN": "我要处理押金异常", "ru-RU": "Разобрать исключение депозита" },
    { "zh-CN": "围绕押金异常原因、补交材料、财务复核和回到业务闭环处理。", "ru-RU": "Причина, материалы, фин. проверка и возврат в процесс." },
    [
      cardModel("reason", "done", "异常原因卡", "Причина", ["exceptionId", "depositEvidenceId"], ["金额不一致", "凭证不清晰", "付款人不一致"], ["exceptionTypeCount"]),
      cardModel("resubmit", "ready", "补交材料卡", "Материалы", ["depositEvidenceId", "stayOrderId"], ["新凭证", "收据编号", "补充说明"], ["resubmitDuration"]),
      cardModel("review", "notStarted", "财务复核卡", "Проверка", ["financeReviewId", "reviewerId"], ["通过", "退回", "需人工沟通"], ["reviewDuration", "returnCount"]),
      cardModel("returnBusiness", "notStarted", "回到业务卡", "Возврат", ["stayOrderId", "currentStage"], ["回到入住", "回到退房", "保持阻断"], ["exceptionResolutionDuration"])
    ],
    { "zh-CN": "补交材料后等待财务复核。", "ru-RU": "После материалов ждите фин. проверку." }),
  workspaceModel("W-REPAIR-REQUEST", "repair", "T-AUTO-DIAGNOSE",
    { "zh-CN": "我要处理报修", "ru-RU": "Обработать заявку ремонта" },
    { "zh-CN": "客户车辆、报修信息、到场确认和派工入口形成报修闭环。", "ru-RU": "Клиент, авто, заявка, прибытие и готовность к назначению." },
    [
      cardModel("customerVehicle", "done", "客户车辆卡", "Клиент/авто", ["repairCustomerId", "vehicleId"], ["客户", "车牌", "车型", "VIN", "联系方式"], ["vehicleMatchRate"]),
      cardModel("request", "done", "报修信息卡", "Заявка", ["repairOrderId", "driverId"], ["故障描述", "车辆位置", "司机", "紧急程度"], ["requestCompleteness"]),
      cardModel("arrival", "ready", "到场确认卡", "Прибытие", ["arrivalId", "vehicleId"], ["到场时间", "车辆状态", "接车人", "初步风险"], ["arrivalLeadTime"]),
      cardModel("dispatchEntry", "notStarted", "派工入口卡", "Назначение", ["repairOrderId", "queueItemId"], ["是否可派工", "阻断原因", "下一步责任人"], ["dispatchReadyRate"])
    ],
    { "zh-CN": "确认车辆到场后进入派工。", "ru-RU": "После прибытия можно назначать диагностику." }),
  workspaceModel("W-REPAIR-DISPATCH", "repair", "T-AUTO-DIAGNOSE",
    { "zh-CN": "我要安排维修", "ru-RU": "Назначить ремонт" },
    { "zh-CN": "派工、诊断、维修执行和阻断恢复在一个维修办理面中处理。", "ru-RU": "Назначение, диагностика, ремонт и блокировки в одной области." },
    [
      cardModel("dispatch", "ready", "派工卡", "Назначение", ["technicianId", "workbayId"], ["技师", "工位", "预计开始时间", "优先级"], ["dispatchLeadTime"]),
      cardModel("diagnosis", "notStarted", "诊断卡", "Диагностика", ["diagnosisId", "repairOrderId"], ["故障分类", "诊断结论", "所需配件", "预计费用"], ["diagnosisDuration"]),
      cardModel("execution", "notStarted", "维修执行卡", "Ремонт", ["repairProgressId", "partsRequestId"], ["维修项目", "工时", "配件", "过程照片"], ["vehicleDowntime"]),
      cardModel("repairBlocker", "notStarted", "阻断卡", "Блокировка", ["blockerId", "repairOrderId"], ["无技师", "缺配件", "费用待确认", "客户不同意"], ["blockerDuration"])
    ],
    { "zh-CN": "先选择技师和工位，不会自动关闭维修单。", "ru-RU": "Выберите механика и пост; заявка не закроется автоматически." }),
  workspaceModel("W-REPAIR-CLOSE", "repair", "T-REPAIR-CLOSE",
    { "zh-CN": "我要验收关闭", "ru-RU": "Принять и закрыть ремонт" },
    { "zh-CN": "验收、费用材料、客户确认和关闭摘要形成关闭闭环。", "ru-RU": "Приемка, расходы, клиент и закрытие." },
    [
      cardModel("inspection", "ready", "验收卡", "Приемка", ["inspectionId", "repairOrderId"], ["维修结果", "试车结果", "验收照片", "验收人"], ["inspectionDuration"]),
      cardModel("feeMaterial", "notStarted", "费用材料卡", "Расходы", ["feeMaterialId", "repairOrderId"], ["工时费", "配件费", "其它费用", "财务材料"], ["feeMaterialDuration"]),
      cardModel("customerConfirm", "notStarted", "客户确认卡", "Клиент", ["customerConfirmId", "driverId"], ["客户签字", "司机确认", "异议说明"], ["disputeCount"]),
      cardModel("close", "notStarted", "关闭卡", "Закрытие", ["auditTraceId", "repairOrderId"], ["关闭摘要", "车辆恢复状态", "人工确认关闭"], ["closeDuration"])
    ],
    { "zh-CN": "先完成验收，费用材料齐全后才能关闭。", "ru-RU": "Сначала приемка; закрыть можно после расходов." }),
  workspaceModel("W-REPAIR-MASTER-DATA", "repair", "T-VEHICLE-CREATE",
    { "zh-CN": "我要创建维修资料", "ru-RU": "Создать ремонтные справочники" },
    { "zh-CN": "客户、车辆和服务规则在同一资料建档办理面完成。", "ru-RU": "Клиент, авто и правила сервиса вместе." },
    [
      cardModel("customer", "ready", "客户建档卡", "Клиент", ["repairCustomerId", "operatorId"], ["客户名称", "联系人", "电话", "类型"], ["customerCreationDuration"]),
      cardModel("vehicle", "ready", "车辆建档卡", "Авто", ["vehicleId", "repairCustomerId"], ["车牌", "品牌车型", "VIN", "发动机号", "里程"], ["duplicatePlateCount", "duplicateVinCount"]),
      cardModel("serviceRule", "notStarted", "服务规则卡", "Правила", ["serviceRuleId", "vehicleId"], ["结算方式", "常用司机", "维修优先级", "授权规则"], ["ruleCompletionRate"])
    ],
    { "zh-CN": "先建客户和车辆，再补服务规则。", "ru-RU": "Создайте клиента и авто, затем правила." })
];

export function replaceIntentWorkspaces(nextWorkspaces) {
  if (Array.isArray(nextWorkspaces) && nextWorkspaces.length) {
    intentWorkspaces = nextWorkspaces;
  }
}

function workspaceModel(id, domain, taskId, title, summary, cards, next) {
  return {
    projectionType: "IntentWorkspaceProjection",
    id,
    domain,
    taskId,
    title,
    summary,
    cards,
    next,
    blockers: cards.flatMap((card) => card.blockerRules.map((rule) => ({ ...rule, cardTitle: card.title })))
  };
}

function cardModel(id, status, zhTitle, ruTitle, system, business, analytics) {
  const businessFields = business.map((label) => fieldProjection(label, "business"));
  const systemFields = system.map((label) => fieldProjection(label, "system"));
  const analyticsFields = analytics.map((label) => fieldProjection(label, "analytics"));
  return {
    projectionType: "WorkspaceCardProjection",
    id,
    status,
    title: { "zh-CN": zhTitle, "ru-RU": ruTitle },
    fields: { system: systemFields, business: businessFields, analytics: analyticsFields },
    evidence: evidenceRequirements(id),
    checks: systemChecks(id),
    blockerRules: blockerRules(id, status),
    events: eventDefinitions(id),
    transitions: transitionDefinitions(id),
    confirmation: confirmationPolicy(id, status)
  };
}

function fieldProjection(label, layer) {
  const type = fieldType(label, layer);
  const source = fieldSource(label, layer);
  const metadata = fieldMetadata(label, type, source);
  return {
    id: fieldId(label),
    label: metadata.label,
    layer,
    type,
    required: layer !== "analytics",
    source,
    visibleToUser: layer === "business",
    analyticsKey: layer === "analytics" ? label : "",
    ui: metadata.ui,
    help: metadata.help
  };
}

function fieldId(label) {
  return String(label).replace(/[^\p{Letter}\p{Number}]+/gu, "_").replace(/^_|_$/g, "") || "field";
}

function fieldType(label, layer) {
  if (layer === "system" || layer === "analytics") return "readonly";
  if (["房型", "上/下铺", "启用范围", "初始可用状态", "维护状态", "线索来源", "线索状态", "住客状态", "计费方式", "押金规则", "押金币种", "是否允许免押", "币种", "付款方式", "收款用途", "银行/钱包渠道", "匹配结果", "处理状态", "钥匙/物品交接"].some((item) => label === item)) return "select";
  if (["所属房间", "启用对象", "预留房间/床位", "入住人", "房间床位", "支付记录", "客户", "车辆", "技师", "工位"].some((item) => label === item || label.includes(item))) return "searchSelect";
  if (["联系日期", "入住日期", "计划退住日期", "押金截止时间", "付款时间", "到账时间", "实际入住时间"].some((item) => label === item) || label.includes("预计") || label.includes("周期") || label.includes("时间")) return "dateTime";
  if (["预订人数", "需要床位", "单价", "天数/周数/月数", "应收金额", "应收押金", "付款金额", "到账金额"].some((item) => label === item) || label.includes("金额") || label.includes("费用") || label.includes("应退") || label.includes("应补")) return "money";
  if (label.includes("照片") || label.includes("凭证") || label.includes("材料") || label.includes("签字")) return "evidenceUpload";
  if (label.includes("确认") || label.includes("关闭") || label.includes("通过") || label.includes("退回")) return "confirmation";
  return "text";
}

function fieldSource(label, layer) {
  if (layer === "system") return "system";
  if (layer === "analytics") return "projection";
  if (["所属房间", "启用对象", "预留房间/床位", "入住人", "房间床位", "支付记录", "已审批申请", "客户", "车辆", "技师", "工位"].some((item) => label === item || label.includes(item))) return "searchableProjection";
  if (["币种", "付款方式", "优先级", "紧急程度", "房型", "上/下铺", "可用状态", "初始可用状态", "维护状态", "启用范围", "线索来源", "线索状态", "住客状态", "计费方式", "押金规则", "押金币种", "是否允许免押", "收款用途", "银行/钱包渠道", "匹配结果", "处理状态", "钥匙/物品交接"].some((item) => label === item || label.includes(item))) return "optionSet";
  return "userInput";
}

function evidenceRequirements(cardId) {
  const map = {
    lead: ["联系方式记录", "来源渠道记录"],
    booking: ["预订确认记录", "床位预留记录"],
    resident: ["入住人身份记录", "联系电话记录"],
    bedAssign: ["床位可用校验", "床位锁定记录"],
    tariff: ["计费规则记录", "应收生成记录"],
    depositRequirement: ["押金规则记录", "押金责任账本记录"],
    payment: ["付款截图", "收据编号", "收款人记录"],
    operatingDashboard: ["经营指标快照", "后续行动记录"],
    application: ["已审批申请", "审批意见"],
    stayOrder: ["已审批申请", "房间床位"],
    deposit: ["付款截图", "收据编号", "付款人", "付款时间"],
    finance: ["到账记录", "金额核对", "财务确认记录"],
    checkin: ["钥匙/物品交接", "入住人现场确认"],
    checkoutStart: ["退房申请", "退房人确认"],
    roomInspection: ["房间检查照片", "物品损坏记录"],
    feeSettlement: ["费用明细", "押金抵扣明细"],
    checkoutFinance: ["退款/补款凭证", "财务确认记录"],
    checkoutClose: ["床位释放记录", "退房关闭确认"],
    reason: ["原押金凭证", "异常原因记录"],
    resubmit: ["新付款凭证", "补充说明"],
    review: ["财务复核意见", "复核人确认"],
    returnBusiness: ["回到业务节点记录", "阻断解除记录"],
    room: ["房间重复校验", "建档人记录"],
    bed: ["容量校验", "床位编号校验"],
    activate: ["检查状态", "资源启用确认"],
    customerVehicle: ["客户授权", "车辆资料"],
    request: ["故障描述", "车辆位置"],
    arrival: ["车辆到场照片", "接车确认"],
    dispatchEntry: ["到场确认", "派工可行性判断"],
    dispatch: ["技师排班", "工位可用记录"],
    diagnosis: ["诊断记录", "预计费用确认"],
    execution: ["维修过程照片", "配件使用记录"],
    repairBlocker: ["阻断原因", "责任人处理记录"],
    inspection: ["验收照片", "试车结果"],
    feeMaterial: ["工时材料明细", "配件费用凭证"],
    customerConfirm: ["客户签字", "异议说明"],
    close: ["关闭摘要", "人工关闭确认"],
    customer: ["客户联系方式", "客户授权"],
    vehicle: ["车辆证件", "车牌/VIN 校验"],
    serviceRule: ["结算方式确认", "授权规则确认"]
  };
  return (map[cardId] || ["操作证据"]).map((label) => evidenceProjection(label));
}

function evidenceProjection(label) {
  return {
    id: fieldId(label),
    label: localizedText(label),
    required: true,
    source: label.includes("照片") || label.includes("截图") || label.includes("凭证") ? "upload" : "record",
    auditEventField: fieldId(label),
    help: localizedText("提交前需要核对这项证据，确认后会进入审计事件。")
  };
}

function systemChecks(cardId) {
  const map = {
    lead: ["联系方式完整", "线索未重复"],
    booking: ["床位可预留", "入住日期有效"],
    resident: ["住客未重复在住", "计划退住日期有效"],
    bedAssign: ["床位可用", "入住周期无冲突", "房间未维修阻断"],
    tariff: ["计费方式有效", "应收金额可计算", "Folio 可生成"],
    depositRequirement: ["押金规则有效", "责任账本可入账", "免押原因已记录"],
    payment: ["收款用途有效", "凭证编号未重复", "支付待财务确认"],
    operatingDashboard: ["入住率已更新", "押金责任已更新", "未确认金额已更新", "转化率已更新"],
    application: ["申请已审批", "入住人未重复入住"],
    stayOrder: ["床位可用", "入住周期无冲突", "押金/费用规则可用"],
    deposit: ["金额匹配", "币种匹配", "付款人匹配", "凭证清晰"],
    finance: ["到账状态有效", "确认金额一致", "财务角色可确认"],
    checkin: ["押金已通过", "床位仍锁定", "人工确认完整"],
    checkoutStart: ["住宿单在住", "退房人身份匹配"],
    roomInspection: ["房间检查完成", "损坏记录已处理"],
    feeSettlement: ["费用规则完整", "应退应补计算完成"],
    checkoutFinance: ["退款/补款凭证有效", "财务确认完整"],
    checkoutClose: ["费用已确认", "床位释放成功", "关闭权限满足"],
    reason: ["异常类型已识别", "原凭证存在"],
    resubmit: ["新凭证可读", "收据编号未重复"],
    review: ["复核人有权限", "金额和付款人一致"],
    returnBusiness: ["阻断已解除", "回到节点有效"],
    room: ["房间号未重复", "容量有效"],
    bed: ["房间存在", "未超过容量", "床位号未重复"],
    activate: ["检查已通过", "床位未锁定"],
    customerVehicle: ["客户存在", "车牌/VIN 未重复"],
    request: ["故障描述完整", "车辆位置明确"],
    arrival: ["车辆已到场", "接车人有权限"],
    dispatchEntry: ["车辆状态允许派工", "无关键阻断"],
    dispatch: ["技师可用", "工位可用", "时间不冲突"],
    diagnosis: ["诊断结论完整", "费用已告知"],
    execution: ["维修项目明确", "配件可用", "过程证据完整"],
    repairBlocker: ["阻断原因明确", "责任人已指定"],
    inspection: ["维修结果可验收", "试车结果完整"],
    feeMaterial: ["工时费完整", "配件费完整", "财务材料齐全"],
    customerConfirm: ["客户已确认", "异议已记录"],
    close: ["验收通过", "费用材料通过", "关闭权限满足"],
    customer: ["客户联系方式有效", "客户未重复"],
    vehicle: ["车牌未重复", "VIN 未重复", "客户已绑定"],
    serviceRule: ["结算方式有效", "授权规则完整"]
  };
  return (map[cardId] || ["字段完整", "权限满足"]).map((label) => checkProjection(label));
}

function checkProjection(label) {
  return {
    id: fieldId(label),
    label: { "zh-CN": label, "ru-RU": label },
    severity: "blocking",
    result: "pending"
  };
}

function blockerRules(cardId, status) {
  const map = {
    booking: ["无可用床位", "入住日期无效"],
    bedAssign: ["床位不可用", "入住周期冲突", "房间维修阻断"],
    tariff: ["计费规则缺失", "应收金额不可计算"],
    depositRequirement: ["押金规则缺失", "免押原因缺失"],
    payment: ["凭证编号重复", "付款用途不匹配"],
    deposit: ["押金金额不匹配", "付款人不一致", "凭证不清晰"],
    finance: ["未到账", "确认金额不一致", "财务权限不足"],
    checkin: ["押金未通过", "床位已释放", "入住确认缺失"],
    operatingDashboard: ["经营指标未更新", "后续行动责任人缺失"],
    stayOrder: ["无可用床位", "入住周期冲突", "申请未审批"],
    roomInspection: ["房间损坏未处理", "检查照片缺失"],
    checkoutFinance: ["退款未确认", "补款未到账"],
    checkoutClose: ["费用未结清", "床位释放失败"],
    dispatchEntry: ["车辆未到场", "资料不完整"],
    dispatch: ["无可用技师", "无可用工位", "时间冲突"],
    diagnosis: ["诊断未完成", "费用待客户确认"],
    execution: ["缺配件", "客户不同意费用"],
    repairBlocker: ["无技师", "缺配件", "费用待确认", "客户不同意"],
    inspection: ["验收不通过", "试车失败"],
    feeMaterial: ["费用材料缺失", "配件费用不完整"],
    customerConfirm: ["客户未确认", "存在异议"],
    close: ["验收未通过", "费用材料未通过", "关闭权限不足"],
    vehicle: ["车牌重复", "VIN 重复", "客户缺失"]
  };
  const labels = status === "blocked" ? (map[cardId] || ["当前卡存在阻断"]) : [];
  return labels.map((label) => ({
    id: fieldId(label),
    title: { "zh-CN": label, "ru-RU": label },
    ownerRole: ownerRoleForCard(cardId),
    unblockAction: { "zh-CN": "补齐材料或人工确认后继续", "ru-RU": "Дополните данные или подтвердите вручную" }
  }));
}

function eventDefinitions(cardId) {
  const map = {
    lead: ["LeadCaptured"],
    booking: ["BookingConfirmed"],
    resident: ["ResidentRegistered"],
    bedAssign: ["BedAssigned"],
    tariff: ["TariffAssigned"],
    depositRequirement: ["DepositRequired"],
    payment: ["PaymentRecordedByFrontDesk"],
    operatingDashboard: ["OperatingMetricsReviewed"],
    application: ["ApplicationApproved"],
    stayOrder: ["StayOrderPrepared", "BedSelected"],
    deposit: ["DepositEvidenceSubmitted", "DepositBlocked"],
    finance: ["FinanceDepositConfirmed"],
    checkin: ["CheckInConfirmed"],
    checkoutStart: ["CheckoutStarted"],
    roomInspection: ["RoomInspectionSubmitted"],
    feeSettlement: ["CheckoutSettlementPrepared"],
    checkoutFinance: ["CheckoutFinanceConfirmed"],
    checkoutClose: ["CheckoutCompleted"],
    reason: ["DepositExceptionDetected"],
    resubmit: ["DepositEvidenceResubmitted"],
    review: ["DepositEvidenceReviewed"],
    returnBusiness: ["DepositExceptionReturnedToBusiness"],
    room: ["RoomCreated"],
    bed: ["BedCreated"],
    activate: ["BedActivated"],
    customerVehicle: ["RepairCustomerVehicleLinked"],
    request: ["RepairRequestCreated"],
    arrival: ["VehicleArrived"],
    dispatchEntry: ["RepairDispatchPrepared"],
    dispatch: ["RepairDispatched"],
    diagnosis: ["RepairDiagnosisSubmitted"],
    execution: ["RepairExecutionUpdated"],
    repairBlocker: ["RepairBlocked"],
    inspection: ["RepairInspectionSubmitted"],
    feeMaterial: ["RepairFeeMaterialSubmitted"],
    customerConfirm: ["RepairCustomerConfirmed"],
    close: ["RepairClosed"],
    customer: ["RepairCustomerCreated"],
    vehicle: ["VehicleProfileCreated"],
    serviceRule: ["RepairServiceRuleConfigured"]
  };
  return (map[cardId] || [`${cardId}Completed`]).map((eventType) => ({
    eventType,
    auditRequired: true,
    projectionTargets: ["IntentWorkspaceProjection", "WorkspaceCardProjection", "WorkQueueProjection", "SearchProjection"]
  }));
}

function transitionDefinitions(cardId) {
  return {
    onPrepare: `${cardId}.prepared`,
    onConfirm: `${cardId}.confirmed`,
    onBlock: `${cardId}.blocked`
  };
}

function confirmationPolicy(cardId, status) {
  const criticalCards = ["depositRequirement", "payment", "finance", "checkin", "operatingDashboard", "checkoutFinance", "checkoutClose", "review", "returnBusiness", "dispatch", "diagnosis", "inspection", "feeMaterial", "customerConfirm", "close"];
  return {
    required: status !== "done" && criticalCards.includes(cardId),
    forbiddenForAi: true,
    label: status === "done" ? { "zh-CN": "已确认", "ru-RU": "Подтверждено" } : { "zh-CN": "关键动作由人工确认", "ru-RU": "Ключевое действие подтверждает человек" }
  };
}

function ownerRoleForCard(cardId) {
  if (["finance", "checkoutFinance", "review", "feeMaterial"].includes(cardId)) return "finance";
  if (["dispatch", "diagnosis", "execution", "repairBlocker", "inspection", "close"].includes(cardId)) return "repair";
  return "operator";
}
