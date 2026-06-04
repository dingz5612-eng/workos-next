import { selectCompletedWorkbenchQueue, selectRuntimeWorkspaces, selectSearchSurfaceResults, selectWorkbenchQueue } from "../selectors/surfaceSelectors.js";
import { buildSearchResultVM, rankSearchResults } from "../searchIntentHub.js";
import { isAccommodationResourceSetupQuery, searchIntentSuggestions, searchIntentTerms } from "../searchIntentRegistry.js";

export function searchView(ctx) {
  const results = workosSearchSections(ctx);
  return ctx.shell(`
    <section class="page-title" data-surface="workos-search">
      <span>${ctx.tr("activeSearch")}</span>
      <h1>${ctx.tr("workosSearch")}</h1>
      <p>${ctx.tr("workosSearchSubtitle")}</p>
    </section>
    <section class="search-box">
      <div class="search-line">
        <input id="query" value="${ctx.escapeAttr(ctx.state.query)}" placeholder="${ctx.tr("searchPlaceholder")}" />
        <button id="searchNow">${ctx.tr("search")}</button>
      </div>
      ${searchRecommendations(ctx)}
    </section>
    ${ctx.state.operationMessage ? `<p class="operation-message" role="status">${ctx.escapeHtml(ctx.state.operationMessage)}</p>` : ""}
    <section class="workos-search-results">
      ${results.map((section) => searchSection(section, ctx)).join("")}
    </section>
  `);
}

function searchRecommendations(ctx) {
  const frequent = searchIntentSuggestions(ctx.state.lang).slice(0, 4);
  const recent = (ctx.state.recentSearches || [])
    .filter(Boolean)
    .filter((query) => !frequent.some((item) => item.query === query || item.label === query))
    .slice(0, 4)
    .map((query) => ({ label: query, query }));
  const groups = [
    recommendationGroup("commonSearch", frequent, ctx),
    recommendationGroup("recentSearch", recent, ctx)
  ].filter(Boolean);
  return groups.length ? `<div class="search-recommendations">${groups.join("")}</div>` : "";
}

function recommendationGroup(titleKey, items, ctx) {
  if (!items.length) return "";
  return `<div class="search-recommendation-group">
    <span>${ctx.tr(titleKey)}</span>
    <div>${items.map((item) => `<button type="button" data-search-query="${ctx.escapeAttr(item.query)}">${ctx.escapeHtml(item.label)}</button>`).join("")}</div>
  </div>`;
}

export function learningContentItems(ctx) {
  return [
    learning("learnEvidenceFix", "learnEvidenceFixBody", "learnStatusEvidence", ctx),
    learning("learnRejectedReason", "learnRejectedReasonBody", "learnStatusBlocked", ctx),
    learning("learnDeviceUntrusted", "learnDeviceUntrustedBody", "learnStatusDevice", ctx),
    learning("learnPermissionDenied", "learnPermissionDeniedBody", "learnStatusPermission", ctx),
    learning("learnMoneyCaution", "learnMoneyCautionBody", "learnStatusFinance", ctx),
    learning("learnRoleScope", "learnRoleScopeBody", "learnStatusRole", ctx)
  ];
}

function workosSearchSections(ctx) {
  const { state } = ctx;
  const query = String(state.query || "").trim();
  const workspaces = selectRuntimeWorkspaces(state);
  const queue = selectWorkbenchQueue(state);
  const completedQueue = selectCompletedWorkbenchQueue(state);
  const workspaceResults = query ? selectSearchSurfaceResults(state, query).filter((workspace) => workspaceMatchesQuery(workspace, query, ctx)) : workspaces;
  const completedKeys = new Set(completedQueue.map((item) => `${item.workspaceId}:${item.cardId || ""}`));
  const activeWorkspaceResults = workspaceResults.filter((workspace) => !workspaceCompletedByQueue(workspace, completedKeys));
  const commands = activeCommands(workspaces, completedQueue, ctx);
  const commandKeys = new Set(commands.map((item) => `${item.workspaceId}:${item.cardId || ""}`));
  const recoveryItems = unfinishedRecoveryItems(queue, ctx);
  const recoveryKeys = new Set(recoveryItems.map(queueEntryKey));
  const queueWithoutRecovery = queue.filter((item) => !recoveryKeys.has(queueEntryKey(item)));
  const sections = [
    section("activeCommands", commands),
    section("unfinishedRecovery", recoveryItems),
    section("searchWorkItems", workItems(queueWithoutRecovery, ctx)),
    section("searchOperationCases", operationCases(queueWithoutRecovery, activeWorkspaceResults, ctx)),
    section("completedWorkItems", completedCases(completedQueue, workspaceResults, ctx).filter((item) => !commandKeys.has(`${item.workspaceId}:${item.cardId || ""}`))),
    section("searchRooms", objectResults(activeWorkspaceResults, "room", ctx)),
    section("searchBeds", objectResults(activeWorkspaceResults, "bed", ctx)),
    section("searchStays", objectResults(activeWorkspaceResults, "stay", ctx)),
    section("searchEvidence", evidenceResults(activeWorkspaceResults, ctx)),
    section("searchSubmissionTrace", traceResults([...queue, ...completedQueue], ctx)),
    section("searchLearning", learningResults(ctx))
  ].filter((candidate) => candidate.items.length);
  return sections.length ? sections : [section("searchNoResult", [{
    resultType: "noAction",
    title: ctx.tr("searchNoResult"),
    subtitle: ctx.tr("searchNoActionReason"),
    status: "-",
    nextAction: ctx.tr("searchNoActionSuggestion")
  }])];
}

function searchSection(section, ctx) {
  return `<section class="search-section" data-search-section="${ctx.escapeAttr(section.id)}">
    <h2>${sectionTitleOverride(section.titleKey, ctx)}</h2>
    <div class="search-card-list">${section.items.map((item) => searchCard(item, ctx)).join("")}</div>
  </section>`;
}

function searchCard(item, ctx) {
  const normalized = buildSearchResultVM(normalizeSearchCard(item, ctx), ctx);
  const action = searchAction(normalized, ctx);
  return `<article class="search-result-card">
    <div class="search-result-main">
      <strong>${ctx.escapeHtml(normalized.title)}</strong>
      <span>${ctx.escapeHtml(normalized.subtitle)}</span>
      <small>${ctx.tr("status")}: ${ctx.escapeHtml(normalized.statusLabel)}</small>
      <p>${ctx.tr("nextAction")}: ${ctx.escapeHtml(normalized.nextActionLabel)}</p>
    </div>
    <div class="search-result-action">${action}</div>
  </article>`;
}

function activeCommands(workspaces, completedQueue, ctx) {
  const query = String(ctx.state.query || "").trim();
  return dormitoryCommandCatalog(ctx)
    .filter((command) => !query || command.keywords.some((keyword) => query.toLocaleLowerCase().includes(keyword.toLocaleLowerCase())))
    .map((command) => ({
      resultType: "command",
      commandId: "startOperationsWorkspace",
      templateWorkspaceId: command.templateWorkspaceId,
      firstCardId: command.firstCardId,
      title: command.title,
      subtitle: command.subtitle,
      status: "ready",
      nextAction: command.nextAction
    }));
}

function dormitoryCommandCatalog(ctx) {
  return [
    command("W-STAY-RESOURCE", "roomSetup", {
      title: { "zh-CN": "新增住宿房源", "ru-RU": "Добавить комнату", "ky-KG": "Бөлмө кошуу" },
      subtitle: { "zh-CN": "先录房号和床位数，价格和可租状态后面再补。", "ru-RU": "Сначала внесите номер комнаты и число коек. Тарифы и готовность заполните дальше.", "ky-KG": "Алгач бөлмө номерин жана койка санын жазыңыз. Баа жана даярдык кийин толтурулат." },
      nextAction: { "zh-CN": "先填房号", "ru-RU": "Начать с номера комнаты", "ky-KG": "Бөлмө номеринен баштоо" }
    }, searchIntentTerms("accommodationResourceSetup")),
    command("W-STAY-LEAD-RESERVATION", "leadCapture", {
      title: { "zh-CN": "登记咨询和预订", "ru-RU": "Записать заявку и бронь", "ky-KG": "Суроо жана бронь каттоо" },
      subtitle: { "zh-CN": "先把来访咨询记清楚，再决定预订、取消或转入住。", "ru-RU": "Сначала зафиксируйте обращение, затем бронь, отмена или заселение.", "ky-KG": "Адегенде кайрылууну так жазыңыз, анан бронь, жокко чыгаруу же кирүү." },
      nextAction: { "zh-CN": "先登记咨询人", "ru-RU": "Начните с заявки", "ky-KG": "Суроо ээсинен баштаңыз" }
    }, ["线索", "预订", "咨询", "预约", "lead", "reservation", "бронь", "заявка", "суроо", "бронь"]),
    command("W-STAY-CHECKIN", "lead", {
      title: { "zh-CN": "安排入住和收款", "ru-RU": "Оформить заезд и оплату", "ky-KG": "Кирүү жана төлөм уюштуруу" },
      subtitle: { "zh-CN": "从入住人开始，完成分床、计费、押金和收款确认。", "ru-RU": "От жильца к койке, начислению, депозиту и подтверждению оплаты.", "ky-KG": "Жашоочудан баштап койка, эсеп, депозит жана төлөмдү тастыктоо." },
      nextAction: { "zh-CN": "先确认入住人", "ru-RU": "Начните с жильца", "ky-KG": "Жашоочудан баштаңыз" }
    }, ["入住收款", "入住", "收款", "押金入住", "安排入住", "checkin", "payment", "заезд", "оплата", "кирүү", "төлөм"]),
    command("W-STAY-LIFECYCLE", "residentProfile", {
      title: { "zh-CN": "维护在住信息", "ru-RU": "Обновить данные проживания", "ky-KG": "Жашоо маалыматтарын жаңыртуу" },
      subtitle: { "zh-CN": "处理住客资料、分床、应收、续住和在住变更。", "ru-RU": "Данные жильца, койка, начисления, продление и изменения проживания.", "ky-KG": "Жашоочу, койка, эсеп, узартуу жана жашоо өзгөрүүлөрү." },
      nextAction: { "zh-CN": "先打开住客资料", "ru-RU": "Откройте профиль жильца", "ky-KG": "Жашоочу профилин ачыңыз" }
    }, ["在住", "住客", "续住", "生命周期", "resident", "stay", "жилец", "проживание", "жашоочу", "жашоо"]),
    command("W-STAY-DEPOSIT-LEDGER", "depositAssessment", {
      title: { "zh-CN": "处理押金", "ru-RU": "Обработать депозит", "ky-KG": "Депозитти иштетүү" },
      subtitle: { "zh-CN": "押金评估、收取、财务确认、扣除、退款和关闭。", "ru-RU": "Оценка, прием, фин. подтверждение, удержание, возврат и закрытие.", "ky-KG": "Баалоо, алуу, финансы тастыктоо, кармоо, кайтаруу жана жабуу." },
      nextAction: { "zh-CN": "先评估押金", "ru-RU": "Начните с оценки", "ky-KG": "Баалоодон баштаңыз" }
    }, ["押金", "押金账本", "退款", "扣除", "deposit", "refund", "депозит", "возврат"]),
    command("W-STAY-PAYMENT-LEDGER", "paymentReceipt", {
      title: { "zh-CN": "登记普通收款", "ru-RU": "Записать обычный платеж", "ky-KG": "Кадимки төлөмдү каттоо" },
      subtitle: { "zh-CN": "登记收款、财务确认、分配到应收，后续处理欠款。", "ru-RU": "Запись платежа, фин. подтверждение, распределение и долги.", "ky-KG": "Төлөмдү каттоо, финансы тастыктоо, бөлүштүрүү жана карыз." },
      nextAction: { "zh-CN": "先登记收款", "ru-RU": "Начните с платежа", "ky-KG": "Төлөмдөн баштаңыз" }
    }, ["普通收款", "收款账本", "欠款", "付款", "payment", "receipt", "платеж", "оплата", "төлөм"]),
    command("W-STAY-SERVICE-TASK", "serviceTaskCreate", {
      title: { "zh-CN": "安排清洁或维修", "ru-RU": "Назначить уборку или ремонт", "ky-KG": "Тазалоо же оңдоону дайындоо" },
      subtitle: { "zh-CN": "创建影响房间、床位可售状态的清洁、维修或配置任务。", "ru-RU": "Создайте задачу, которая влияет на доступность комнаты или койки.", "ky-KG": "Бөлмө же койканын сатылуу абалына таасир берген тапшырма түзүңүз." },
      nextAction: { "zh-CN": "先创建服务任务", "ru-RU": "Создайте задачу", "ky-KG": "Тапшырма түзүңүз" }
    }, ["清洁", "维修", "服务任务", "保洁", "cleaning", "repair", "уборка", "ремонт", "тазалоо", "оңдоо"]),
    command("W-STAY-CHECKOUT", "checkoutStart", {
      title: { "zh-CN": "办理退房", "ru-RU": "Оформить выезд", "ky-KG": "Чыгып кетүүнү жүргүзүү" },
      subtitle: { "zh-CN": "发起退房、查房、结算费用、财务确认并关闭。", "ru-RU": "Начало выезда, проверка комнаты, расчет, фин. подтверждение и закрытие.", "ky-KG": "Чыгуу, бөлмө текшерүү, эсептешүү, финансы тастыктоо жана жабуу." },
      nextAction: { "zh-CN": "先发起退房", "ru-RU": "Начните выезд", "ky-KG": "Чыгууну баштаңыз" }
    }, ["退房", "离店", "checkout", "выезд", "чыгуу"]),
    command("W-STAY-CHECKOUT-SETTLEMENT", "checkoutStart", {
      title: { "zh-CN": "办理退住结算", "ru-RU": "Рассчитать выезд", "ky-KG": "Чыгуу эсептешүүсү" },
      subtitle: { "zh-CN": "处理退住、查房、押金、最终结算、床位释放和清洁任务。", "ru-RU": "Выезд, проверка, депозит, финальный расчет, освобождение койки и уборка.", "ky-KG": "Чыгуу, текшерүү, депозит, акыркы эсеп, койка бошотуу жана тазалоо." },
      nextAction: { "zh-CN": "先开始退住", "ru-RU": "Начните расчет", "ky-KG": "Эсептешүүнү баштаңыз" }
    }, ["退住", "结算", "退住结算", "查房", "settlement", "расчет", "эсептешүү"]),
    command("W-STAY-PERIOD-ANALYTICS", "periodScope", {
      title: { "zh-CN": "做周期复盘", "ru-RU": "Провести обзор периода", "ky-KG": "Мезгилдик талдоо жүргүзүү" },
      subtitle: { "zh-CN": "确认周期范围，查看指标、财务、运营诊断和行动计划。", "ru-RU": "Период, метрики, финансы, операционная диагностика и план действий.", "ky-KG": "Мезгил, көрсөткүч, финансы, операциялык диагноз жана аракет планы." },
      nextAction: { "zh-CN": "先确认周期范围", "ru-RU": "Уточните период", "ky-KG": "Мезгилди тактаңыз" }
    }, ["复盘", "周期", "经营", "指标", "period", "review", "обзор", "период", "талдоо", "мезгил"])
  ];
}

function command(templateWorkspaceId, firstCardId, { title, subtitle, nextAction }, keywords) {
  return { templateWorkspaceId, firstCardId, title, subtitle, nextAction, keywords };
}

function completedRoomCommand(workspaces, completedQueue, ctx) {
  const query = String(ctx.state.query || "").trim();
  if (!isAccommodationResourceSetupQuery(query)) return [];
  const completed = completedQueue.find((item) => /roomsetup|room|房间/i.test(`${item.workItemId || ""} ${item.cardId || ""} ${tx(item.card?.title, ctx)} ${tx(item.workspace?.title, ctx)}`));
  if (!completed) {
    const terminalWorkspace = workspaces.find((workspace) => workspaceMatchesQuery(workspace, query, ctx) && isTerminalWorkspace(workspace));
    if (!terminalWorkspace) return [];
    const card = activeDisplayCard(terminalWorkspace);
    return [{
      resultType: "operationCase",
      title: ctx.state.lang === "zh-CN" ? "创建房间已完成" : "Room creation completed",
      subtitle: [tx(terminalWorkspace.title, ctx), tx(card?.title, ctx)].filter(Boolean).join(" · "),
      workspaceId: terminalWorkspace.id,
      cardId: card?.id || "",
      caseId: terminalWorkspace.caseId || `case:${terminalWorkspace.id}`,
      status: card?.status || "done",
      nextAction: ctx.tr("viewOnly")
    }];
  }
  return [{
    ...completed,
    resultType: "operationCase",
    title: ctx.state.lang === "zh-CN" ? "创建房间已完成" : "Room creation completed",
    subtitle: [tx(completed.workspace?.title, ctx), tx(completed.card?.title, ctx)].filter(Boolean).join(" · "),
    status: completed.lifecycleState || completed.status || completed.card?.status || "done",
    nextAction: ctx.tr("viewOnly")
  }];
}

function sectionTitleOverride(id, ctx) {
  if (id === "activeCommands") return ctx.tr("activeCommands");
  return ctx.tr(id);
}

function searchAction(result, ctx) {
  if (result.actionType === "openWorkItem") {
    return `<button data-work-item-id="${ctx.escapeAttr(result.workItemId)}" data-workspace-id="${ctx.escapeAttr(result.workspaceId)}" data-card-id="${ctx.escapeAttr(result.cardId)}">${ctx.escapeHtml(result.actionLabel)}</button>`;
  }
  if (result.actionType === "openEvidence") {
    return `<button data-workspace="${ctx.escapeAttr(result.workspaceId)}" data-card-id="${ctx.escapeAttr(result.cardId)}" data-evidence-id="${ctx.escapeAttr(result.evidenceId)}">${ctx.escapeHtml(result.actionLabel)}</button>`;
  }
  if (result.actionType === "openTrace") {
    return `<button data-view="${ctx.escapeAttr(result.view)}" data-trace-id="${ctx.escapeAttr(result.traceId)}">${ctx.escapeHtml(result.actionLabel)}</button>`;
  }
  if (result.actionType === "openLearning") {
    return `<button data-view="${ctx.escapeAttr(result.view)}" data-learning-id="${ctx.escapeAttr(result.learningId)}">${ctx.escapeHtml(result.actionLabel)}</button>`;
  }
  if (result.actionType === "startOperationsWorkspace") {
    return `<button data-start-operations-workspace="${ctx.escapeAttr(result.templateWorkspaceId)}" data-first-card-id="${ctx.escapeAttr(result.firstCardId)}">${ctx.escapeHtml(result.actionLabel)}</button>`;
  }
  if (["openObject", "openWorkspace"].includes(result.actionType)) {
    return `<button data-workspace="${ctx.escapeAttr(result.workspaceId)}" data-card-id="${ctx.escapeAttr(result.cardId)}" data-case-id="${ctx.escapeAttr(result.caseId)}">${ctx.escapeHtml(result.actionLabel)}</button>`;
  }
  return `<p class="surface-guidance">${ctx.escapeHtml(result.reasonIfNoAction)}</p>`;
}

function normalizeSearchCard(item, ctx) {
  return {
    ...item,
    resultType: item.resultType || item.type || "object",
    title: localized(item.localizedTitle ?? item.title, ctx) || ctx.tr("searchNoResult"),
    subtitle: localized(item.localizedSubtitle ?? item.subtitle, ctx) || ctx.tr("workosSearchSubtitle"),
    status: localized(item.localizedStatus ?? item.status, ctx) || "-",
    nextAction: localized(item.localizedNextAction ?? item.nextAction, ctx) || ctx.tr("search")
  };
}

function workItems(queue, ctx) {
  return rankSearchResults(queue.map((item) => ({
    ...item,
    resultType: "workItem",
    title: item.businessObject || item.card?.title || item.workspace?.title || ctx.tr("searchWorkItems"),
    subtitle: businessContextLabel(item, ctx, ctx.tr("workbench")),
    status: item.lifecycleState || item.status || item.card?.status || "ready",
    nextAction: item.reason || tx(item.workspace?.next, ctx) || ctx.tr("searchActionProcess")
  })), ctx.state.query).slice(0, 8);
}

function unfinishedRecoveryItems(queue, ctx) {
  const query = String(ctx.state.query || "").trim();
  if (!shouldShowUnfinishedRecovery(query)) return [];
  return rankSearchResults(queue.map((item) => unfinishedRecoveryItem(item, ctx)), query).slice(0, 4);
}

function unfinishedRecoveryItem(item, ctx) {
  const objectLabel = queueObjectLabel(item, ctx);
  const workspaceTitle = tx(item.workspace?.title, ctx);
  const cardTitle = tx(item.card?.title, ctx);
  return {
    ...item,
    resultType: "workItem",
    title: objectLabel ? `${ctx.tr("unfinishedRecovery")} · ${objectLabel}` : ctx.tr("unfinishedRecovery"),
    subtitle: [workspaceTitle, cardTitle].filter(Boolean).join(" · ") || item.workItemType || ctx.tr("workbench"),
    status: item.lifecycleState || item.status || item.card?.status || "ready",
    nextAction: cardTitle ? `${ctx.tr("continueHandling")}：${cardTitle}` : (item.reason || ctx.tr("continueHandling")),
    actionLabel: ctx.tr("continueHandling")
  };
}

function queueObjectLabel(item, ctx) {
  const candidates = [
    item.businessObject,
    item.business_object,
    item.objectLabel,
    item.object_label,
    item.objectName,
    item.object_name,
    roomLabel(item.roomNo || item.room_no, ctx),
    item.objectId,
    item.object_id,
    item.roomId,
    item.room_id,
    item.aggregateRef,
    item.aggregate_ref
  ];
  return candidates.map((value) => localized(value, ctx)).find(Boolean) || "";
}

function roomLabel(roomNo, ctx) {
  const value = localized(roomNo, ctx);
  if (!value) return "";
  return ctx.state.lang === "zh-CN" && /^\d+$/.test(value) ? `${value} 号房间` : value;
}

function queueEntryKey(item = {}) {
  return item.workItemId || `${item.workspaceId || ""}:${item.cardId || ""}:${item.queueItemId || ""}`;
}

function shouldShowUnfinishedRecovery(query = "") {
  const normalized = String(query || "").trim().toLocaleLowerCase();
  if (!normalized) return false;
  if (isAccommodationResourceSetupQuery(normalized) && !/\d/.test(normalized)) return false;
  return /\d/.test(normalized) || /未办完|继续|找回|房号|号房间|room[-_\s]?\w+|bed[-_\s]?\w+|stay[-_\s]?\w+/i.test(normalized);
}

function operationCases(queue, workspaces, ctx) {
  const cases = new Map();
  for (const item of queue) {
    const caseId = item.caseId || item.workspace?.caseId || item.workspaceId;
    if (!caseId) continue;
    cases.set(caseId, {
      ...item,
      resultType: "operationCase",
      title: [tx(item.workspace?.title, ctx), tx(item.card?.title, ctx)].filter(Boolean).join(" · ") || ctx.tr("searchOperationCases"),
      subtitle: businessContextLabel(item, ctx, ctx.tr("operation")),
      status: item.lifecycleState || item.status || "ready",
      nextAction: item.reason || ctx.tr("openWorkspace")
    });
  }
  for (const workspace of workspaces) {
    if (isTerminalWorkspace(workspace)) continue;
    if (!workspace.caseId && cases.has(workspace.id)) continue;
    const caseId = workspace.caseId || `case:${workspace.id}`;
    if (!cases.has(caseId)) {
      cases.set(caseId, {
        title: operationCaseTitle(workspace, ctx),
        resultType: "operationCase",
        workspaceId: workspace.id,
        cardId: workspace.cards?.[0]?.id || "",
        caseId,
        subtitle: tx(workspace.title, ctx),
        status: workspace.cards?.[0]?.status || "ready",
        nextAction: tx(workspace.next, ctx) || ctx.tr("openWorkspace")
      });
    }
  }
  return rankSearchResults(Array.from(cases.values()), ctx.state.query).slice(0, 6);
}

function operationCaseTitle(workspace = {}, ctx = {}) {
  return tx(workspace.title, ctx) || localized(workspace.localizedTitle, ctx) || ctx.tr?.("searchOperationCases") || "";
}

function completedCases(completedQueue, workspaceResults, ctx) {
  const records = new Map();
  for (const item of completedQueue) {
    const id = item.workItemId || item.caseId || `${item.workspaceId}:${item.cardId}`;
    if (!id) continue;
    records.set(id, {
      ...item,
      resultType: "operationCase",
      title: [item.businessObject, tx(item.workspace?.title, ctx), tx(item.card?.title, ctx)].filter(Boolean).join(" · ") || ctx.tr("completedWorkItems"),
      subtitle: businessContextLabel(item, ctx, ctx.tr("completedWorkItems")),
      status: item.lifecycleState || item.status || item.card?.status || "done",
      nextAction: ctx.tr("viewOnly")
    });
  }
  for (const workspace of workspaceResults.filter(isTerminalWorkspace)) {
    const card = activeDisplayCard(workspace);
    records.set(workspace.id, {
      resultType: "operationCase",
      workspaceId: workspace.id,
      cardId: card?.id || "",
      caseId: workspace.caseId || `case:${workspace.id}`,
      title: workspace.title,
      subtitle: card?.title || workspace.summary,
      status: card?.status || "done",
      nextAction: ctx.tr("viewOnly")
    });
  }
  return rankSearchResults(Array.from(records.values()), ctx.state.query).slice(0, 4);
}

function objectResults(workspaces, kind, ctx) {
  const labelByKind = {
    room: ctx.tr("searchRooms"),
    bed: ctx.tr("searchBeds"),
    stay: ctx.tr("searchStays")
  };
  return workspaces
    .filter((workspace) => workspace.domain === "stay" || String(workspace.id).toLowerCase().includes(kind))
    .filter((workspace) => !isTerminalWorkspace(workspace))
    .filter(() => objectKindMatchesQuery(kind, ctx.state.query))
    .slice(0, 5)
    .map((workspace) => ({
      title: localized(workspace.localizedTitle, ctx) || `${labelByKind[kind]} · ${tx(workspace.title, ctx) || workspace.id}`,
      resultType: kind,
      workspaceId: workspace.id,
      cardId: workspace._surfaceCardId || workspace.cards?.[0]?.id || "",
      subtitle: localized(workspace.localizedSubtitle, ctx) || tx(workspace.summary, ctx) || tx(activeDisplayCard(workspace)?.title, ctx) || accommodationBusinessLabel(ctx),
      status: localized(workspace.localizedStatus, ctx) || workspace.cards?.[0]?.status || "ready",
      nextAction: localized(workspace.localizedNextAction, ctx) || tx(workspace.next, ctx) || ctx.tr("openWorkspace")
    }));
}

function evidenceResults(workspaces, ctx) {
  return workspaces.filter((workspace) => !isTerminalWorkspace(workspace)).flatMap((workspace) => (workspace.cards || []).flatMap((card) =>
    !["ready", "blocked", "inProgress"].includes(String(card.status || "")) ? [] :
    (card.evidence || []).map((evidence) => ({
      title: ctx.localTerm(evidence),
      resultType: "evidence",
      workspaceId: workspace.id,
      cardId: card.id,
      evidenceId: evidence.id,
      subtitle: [tx(workspace.title, ctx), tx(card.title, ctx)].filter(Boolean).join(" · ") || accommodationBusinessLabel(ctx),
      status: card.status || "ready",
      nextAction: ctx.tr("searchActionEvidence")
    })))).filter((item) => rankSearchResults([item], ctx.state.query).length || !ctx.state.query).slice(0, 6);
}

function traceResults(queue, ctx) {
  const results = queue
    .filter((item) => item.traceRefs?.length || item.commandSubmissionId || item.command_submission_id)
    .map((item) => ({
      ...item,
      resultType: "trace",
      traceId: item.traceRefs?.[0] || item.commandSubmissionId || item.command_submission_id,
      title: ctx.tr("searchSubmissionTrace"),
      subtitle: businessContextLabel(item, ctx, ctx.tr("recentTraces")),
      status: item.lifecycleState || item.status || "ready",
      nextAction: ctx.tr("recentTraces")
    }));
  return rankSearchResults(results, ctx.state.query).slice(0, 4);
}

function learningResults(ctx) {
  return rankSearchResults(learningContentItems(ctx), ctx.state.query).slice(0, 4);
}

function section(titleKey, items) {
  return { id: titleKey, titleKey, items };
}

const terminalStatuses = new Set(["done", "confirmed", "completed", "committed", "closed", "cancelled"]);

function isTerminalWorkspace(workspace = {}) {
  const card = activeDisplayCard(workspace);
  return terminalStatuses.has(String(card?.status || "").trim());
}

function activeDisplayCard(workspace = {}) {
  return workspace.cards?.find((card) => ["ready", "blocked", "inProgress"].includes(card.status)) || workspace.cards?.[0];
}

function workspaceCompletedByQueue(workspace = {}, completedKeys = new Set()) {
  if (!workspace.id) return false;
  if (completedKeys.has(`${workspace.id}:`)) return true;
  return (workspace.cards || []).some((card) => completedKeys.has(`${workspace.id}:${card.id}`));
}

function workspaceMatchesQuery(workspace = {}, query = "", ctx = {}) {
  const normalized = String(query || "").trim().toLocaleLowerCase();
  if (!normalized) return true;
  const text = [
    workspace.id,
    workspace.domain,
    tx(workspace.title, ctx),
    tx(workspace.summary, ctx),
    tx(workspace.next, ctx),
    workspace.cards?.map((card) => `${card.id} ${tx(card.title, ctx)} ${card.status || ""}`).join(" ")
  ].join(" ").toLocaleLowerCase();
  if (isAccommodationResourceSetupQuery(normalized)) {
    return /(roomsetup|房间配置|房间床位配置|创建住宿资源|住宿资源建档)/i.test(text);
  }
  if ((workspace._score || workspace.score || 0) > 0) return true;
  return text.includes(normalized)
    || normalized.split(/\s+/).filter(Boolean).some((part) => text.includes(part))
    || (/房间/.test(normalized) && text.includes("房间"));
}

function objectKindMatchesQuery(kind, query = "") {
  const normalized = String(query || "").trim();
  if (!normalized) return false;
  const kindTokens = {
    room: /房间|房号|楼栋|room/i,
    bed: /床位|床|bed/i,
    stay: /入住|住宿人|住户|入住人|stay/i
  };
  const specific = Object.entries(kindTokens).filter(([, pattern]) => pattern.test(normalized)).map(([candidate]) => candidate);
  return specific.length ? specific.includes(kind) : true;
}

function learning(titleKey, bodyKey, status, ctx) {
  return {
    resultType: "learning",
    learningId: titleKey,
    title: ctx.tr(titleKey),
    subtitle: ctx.tr(bodyKey),
    status,
    nextAction: ctx.tr("searchActionLearning")
  };
}

function businessContextLabel(item = {}, ctx = {}, fallback = "") {
  const raw = localized(item.localizedSubtitle ?? item.subtitle ?? item.workItemType ?? item.work_item_type, ctx);
  if (raw && !isRawRuntimeLabel(raw)) return raw;
  const text = [
    item.domain,
    item.workspaceId,
    item.workspace_id,
    item.workItemType,
    item.work_item_type,
    item.cardId,
    item.card_id,
    item.workspace?.id,
    item.card?.id
  ].filter(Boolean).join(" ");
  if (/stay|dorm|W-STAY/i.test(text)) return accommodationBusinessLabel(ctx);
  return fallback || ctx.tr?.("workbench") || "";
}

function accommodationBusinessLabel(ctx = {}) {
  const labels = {
    "zh-CN": "住宿业务",
    "ru-RU": "Проживание",
    "ky-KG": "Жатакана иши"
  };
  return labels[ctx.state?.lang] || labels["zh-CN"];
}

function isRawRuntimeLabel(value = "") {
  return /^(stay|dorm|finance|lead|repair|parts|hr)$/i.test(String(value).trim())
    || /^[A-Z][A-Za-z0-9]*\.[A-Za-z0-9.]+$/.test(String(value).trim())
    || /W-[A-Z0-9-]+(?::[A-Za-z0-9-]+)?/.test(String(value).trim());
}

function tx(value, ctx) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return ctx.tx ? ctx.tx(value) : value["zh-CN"] || value["ru-RU"] || "";
}

function localized(value, ctx) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((entry) => localized(entry, ctx)).filter(Boolean).join(" · ");
  if (ctx.tx) return ctx.tx(value);
  return value["zh-CN"] || value["ru-RU"] || value.title || value.label || "";
}
