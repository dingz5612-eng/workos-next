import { selectCompletedWorkbenchQueue, selectRuntimeWorkspaces, selectSearchSurfaceResults, selectWorkbenchQueue } from "../selectors/surfaceSelectors.js";
import { buildSearchResultVM, rankSearchResults } from "../searchIntentHub.js";

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
    </section>
    <section class="workos-search-results">
      ${results.map((section) => searchSection(section, ctx)).join("")}
    </section>
  `);
}

export function learningContentItems(ctx) {
  return [
    learning("learnEvidenceFix", "learnEvidenceFixBody", "evidence", ctx),
    learning("learnRejectedReason", "learnRejectedReasonBody", "rejection", ctx),
    learning("learnDeviceUntrusted", "learnDeviceUntrustedBody", "device", ctx),
    learning("learnPermissionDenied", "learnPermissionDeniedBody", "permission", ctx),
    learning("learnMoneyCaution", "learnMoneyCautionBody", "finance", ctx),
    learning("learnRoleScope", "learnRoleScopeBody", "role", ctx)
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
  const sections = [
    section("activeCommands", commands),
    section("searchWorkItems", workItems(queue, ctx)),
    section("searchOperationCases", operationCases(queue, activeWorkspaceResults, ctx)),
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
      commandId: command.templateWorkspaceId === "W-STAY-RESOURCE" ? "startResourceSetup" : "startWorkspace",
      templateWorkspaceId: command.templateWorkspaceId,
      firstCardId: command.firstCardId,
      title: command.title,
      subtitle: command.subtitle,
      status: "ready",
      nextAction: command.nextAction
    }));
}

function dormitoryCommandCatalog(ctx) {
  const zh = ctx.state.lang === "zh-CN";
  return [
    command("W-STAY-RESOURCE", "roomSetup", zh ? "新建房间" : "Create room", zh ? "发起住宿资源建档，配置房间、床位、价格、准备度、阻断和释放。" : "Start resource setup.", zh ? "从房间配置开始" : "Start from room setup", ["创建房间", "新增房间", "配置房间", "住宿资源", "资源建档"]),
    command("W-STAY-LEAD-RESERVATION", "leadCapture", zh ? "管理线索预订" : "Manage lead reservation", zh ? "从线索捕获到预订、取消或转入住。" : "Lead to reservation flow.", zh ? "先登记线索" : "Capture lead first", ["线索", "预订", "咨询", "预约"]),
    command("W-STAY-CHECKIN", "lead", zh ? "安排入住收款" : "Arrange check-in payment", zh ? "从线索、预订、分床、计费、押金、收款到财务确认。" : "Check-in and payment loop.", zh ? "先处理入住线索" : "Start intake", ["入住收款", "入住", "收款", "押金入住", "安排入住"]),
    command("W-STAY-LIFECYCLE", "residentProfile", zh ? "管理在住生命周期" : "Manage stay lifecycle", zh ? "住客资料、正式入住、分床、应收和续住。" : "Resident lifecycle.", zh ? "先建立住客资料" : "Start resident profile", ["在住", "住客", "续住", "生命周期"]),
    command("W-STAY-DEPOSIT-LEDGER", "depositAssessment", zh ? "管理押金账本" : "Manage deposit ledger", zh ? "押金评估、收取、财务确认、扣除、退款和关闭。" : "Deposit ledger flow.", zh ? "先评估押金" : "Assess deposit first", ["押金", "押金账本", "退款", "扣除"]),
    command("W-STAY-PAYMENT-LEDGER", "paymentReceipt", zh ? "管理普通收款账本" : "Manage payment ledger", zh ? "普通收款、财务确认、分配、调整和欠款跟进。" : "Payment ledger flow.", zh ? "先登记收款" : "Record payment first", ["普通收款", "收款账本", "欠款", "付款"]),
    command("W-STAY-SERVICE-TASK", "serviceTaskCreate", zh ? "管理清洁维修任务" : "Manage service task", zh ? "清洁、维修和配置任务影响房间床位可售状态。" : "Service task flow.", zh ? "先创建服务任务" : "Create task first", ["清洁", "维修", "服务任务", "保洁"]),
    command("W-STAY-CHECKOUT", "checkoutStart", zh ? "办理退房" : "Handle checkout", zh ? "退房开始、查房、费用结算、财务确认和关闭。" : "Checkout flow.", zh ? "先发起退房" : "Start checkout", ["退房", "离店", "checkout"]),
    command("W-STAY-CHECKOUT-SETTLEMENT", "checkoutStart", zh ? "办理退住结算" : "Handle checkout settlement", zh ? "退住、查房、押金处理、最终结算、床位释放和清洁任务。" : "Checkout settlement flow.", zh ? "先开始退住" : "Start settlement", ["退住", "结算", "退住结算", "查房"]),
    command("W-STAY-PERIOD-ANALYTICS", "periodScope", zh ? "做周期经营复盘" : "Run period review", zh ? "周期范围、指标、财务、运营诊断、行动计划和关闭。" : "Period analytics flow.", zh ? "先确认周期范围" : "Confirm period scope", ["复盘", "周期", "经营", "指标"])
  ];
}

function command(templateWorkspaceId, firstCardId, title, subtitle, nextAction, keywords) {
  return { templateWorkspaceId, firstCardId, title, subtitle, nextAction, keywords };
}

function completedRoomCommand(workspaces, completedQueue, ctx) {
  const query = String(ctx.state.query || "").trim();
  if (!/创建房间|新增房间|配置房间/i.test(query)) return [];
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
  if (id === "activeCommands") return ctx.state.lang === "zh-CN" ? "主动命令" : "Commands";
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
  if (result.actionType === "startResourceSetup") {
    return `<button data-start-resource-setup="true">${ctx.escapeHtml(result.actionLabel)}</button>`;
  }
  if (result.actionType === "startWorkspace") {
    return `<button data-start-workspace="${ctx.escapeAttr(result.templateWorkspaceId)}" data-first-card-id="${ctx.escapeAttr(result.firstCardId)}">${ctx.escapeHtml(result.actionLabel)}</button>`;
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
    subtitle: item.workItemType || item.domain || ctx.tr("workbench"),
    status: item.lifecycleState || item.status || item.card?.status || "ready",
    nextAction: item.reason || tx(item.workspace?.next, ctx) || ctx.tr("searchActionProcess")
  })), ctx.state.query).slice(0, 8);
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
      subtitle: item.workItemType || item.domain || ctx.tr("operation"),
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
        title: caseId,
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

function completedCases(completedQueue, workspaceResults, ctx) {
  const records = new Map();
  for (const item of completedQueue) {
    const id = item.workItemId || item.caseId || `${item.workspaceId}:${item.cardId}`;
    if (!id) continue;
    records.set(id, {
      ...item,
      resultType: "operationCase",
      title: [item.businessObject, tx(item.workspace?.title, ctx), tx(item.card?.title, ctx)].filter(Boolean).join(" · ") || ctx.tr("completedWorkItems"),
      subtitle: item.workItemType || item.workspaceId || ctx.tr("completedWorkItems"),
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
      subtitle: localized(workspace.localizedSubtitle, ctx) || workspace.id,
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
      subtitle: `${workspace.id} · ${tx(card.title, ctx)}`,
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
      subtitle: item.workItemType || ctx.tr("recentTraces"),
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
  if (/创建房间|新增房间|配置房间/.test(normalized)) {
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
