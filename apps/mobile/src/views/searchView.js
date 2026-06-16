import { selectRuntimeWorkspaces, selectSearchSurfaceResults, selectWorkbenchQueue } from "../selectors/surfaceSelectors.js";
import { buildSearchResultVM, rankSearchResults } from "../searchIntentHub.js";
import { isAccommodationResourceSetupQuery, searchIntentSuggestions } from "../searchIntentRegistry.js";
import { capabilityCommandCatalog, mainlineScenarioCatalog } from "../capabilityProjection.js";
import { normalizeOperationLifecycleState } from "../operationStatus.js";
import { buildBusinessAnchor } from "../businessAnchorKernel.js";
import { BusinessSummaryHeader, BusinessTaskOverview } from "./experienceComponents.js";

export function searchView(ctx) {
  const results = workosSearchSections(ctx);
  return ctx.shell(`
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
  if (String(ctx.state.query || "").trim()) return "";
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

function workosSearchSections(ctx) {
  const { state } = ctx;
  const query = String(state.query || "").trim();
  const workspaces = selectRuntimeWorkspaces(state);
  const queue = selectWorkbenchQueue(state);
  const backendOperationResults = query ? backendOperationSearchResults(state, query) : [];
  const workspaceResults = query ? selectSearchSurfaceResults(state, query).filter((workspace) => workspaceMatchesQuery(workspace, query, ctx)) : workspaces;
  const activeWorkspaceResults = workspaceResults.filter((workspace) => !isTerminalWorkspace(workspace));
  const commands = activeCommands(workspaces, ctx);
  if (query && isAccommodationResourceSetupQuery(query)) {
    return [section("activeCommands", commands)];
  }
  const recoveryItems = unfinishedRecoveryItems(queue, ctx);
  const recoveryKeys = new Set(recoveryItems.map(queueEntryKey));
  const queueWithoutRecovery = queue.filter((item) => !recoveryKeys.has(queueEntryKey(item)));
  const sections = [
    section("activeCommands", commands),
    section("unfinishedRecovery", recoveryItems),
    section("searchWorkItems", workItems(dedupeSearchItems([...backendOperationResults, ...queueWithoutRecovery]), ctx)),
    section("searchRooms", objectResults(activeWorkspaceResults, "room", ctx)),
    section("searchBeds", objectResults(activeWorkspaceResults, "bed", ctx)),
    section("searchStays", objectResults(activeWorkspaceResults, "stay", ctx))
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
  const taskBody = searchBusinessTaskBody(normalized, ctx, item);
  const hasOverview = taskBody.includes('data-surface="business-task-overview"');
  return `<article class="search-result-card" data-admission-decision="${ctx.escapeAttr(normalized.admissionDecision)}">
    <div class="search-result-main">
      ${BusinessSummaryHeader({
        stateLabel: normalized.statusLabel,
        state: searchResultState(normalized),
        title: normalized.title,
        subtitle: normalized.nextActionLabel,
        source: item
      }, ctx, { compact: true, hideAnchor: shouldHideHeaderAnchor(item, ctx, hasOverview) })}
      ${taskBody}
    </div>
    <div class="search-result-action business-summary-actions">${action}</div>
  </article>`;
}

function shouldHideHeaderAnchor(source = {}, ctx = {}, hasOverview = false) {
  if (!hasOverview) return false;
  const importantKeys = new Set(["resident", "phone", "deposit", "payment", "task", "checkout", "period"]);
  const anchor = buildBusinessAnchor(source, ctx);
  return !anchor.fields.some((field) => importantKeys.has(field.key));
}

function searchBusinessTaskBody(normalized, ctx, item = {}) {
  const issue = searchAdmissionRequiresExplanation(normalized.admissionDecision);
  const overview = BusinessTaskOverview({
    workItemType: normalized.title,
    nextAction: normalized.nextActionLabel,
    canHandle: !issue,
    blocker: normalized.admissionReasonLabel
  }, ctx, { item });
  const note = !overview && normalized.nextActionLabel
    ? `<p class="business-task-note">${ctx.escapeHtml(normalized.nextActionLabel)}</p>`
    : "";
  return `<div class="business-task-body search-business-task-body" data-surface="business-task-body">
    ${overview}
    ${note}
    ${issue ? `<div class="business-task-row business-task-alert">
      <span>${ctx.tr("businessTaskIssue")}</span>
      <p><span class="admission-chip" data-search-admission-state="${ctx.escapeAttr(normalized.admissionDecision)}">${ctx.escapeHtml(normalized.admissionLabel)}</span>${ctx.escapeHtml(normalized.admissionReasonLabel)}</p>
    </div>` : `<span class="business-task-state" data-search-admission-state="${ctx.escapeAttr(normalized.admissionDecision)}">${ctx.escapeHtml(normalized.admissionLabel)}</span>`}
  </div>`;
}

function searchResultState(normalized) {
  return searchAdmissionRequiresExplanation(normalized.admissionDecision) ? "blocked" : "ready";
}

function searchAdmissionRequiresExplanation(decision = "") {
  return [
    "visible_blocked",
    "visible_only",
    "prepare_only_confirm_denied",
    "confirm_allowed_production_blocked"
  ].includes(decision);
}

function activeCommands(workspaces, ctx) {
  const query = String(ctx.state.query || "").trim();
  return generatedMainlineEntries(ctx)
    .filter((command) => !query || command.keywords.some((keyword) => query.toLocaleLowerCase().includes(keyword.toLocaleLowerCase())))
    .map((command) => {
      if (command.resultType === "mainlineScenario") return command;
      const admission = commandAdmission(ctx, command);
      return {
        resultType: "command",
        commandId: "startOperationsWorkspace",
        templateWorkspaceId: command.templateWorkspaceId,
        firstCardId: command.firstCardId,
        title: command.title,
        subtitle: command.subtitle,
        status: "ready",
        nextAction: command.nextAction,
        ...(admission ? { admission } : {})
      };
    });
}

function commandAdmission(ctx = {}, command = {}) {
  return searchKernelAdmissionForCommand(ctx, command);
}

function searchKernelAdmissionForCommand(ctx = {}, command = {}) {
  const results = ctx.state.runtimeStore?.searchResultsByQuery?.[normalizeQuery(ctx.state.query)] || [];
  const match = results.find((item) => {
    const workspaceId = item.workspaceId || item.workspace_id || item.target?.workspaceId || "";
    const cardId = item.cardId || item.card_id || item.target?.cardId || "";
    const source = item.sourceRefs?.source || item.gateResult?.source || "";
    const admissionDecisionRef =
      item.admission?.admissionDecisionRef ||
      item.sourceRefs?.admissionDecisionRef ||
      item.gateResult?.admissionDecisionRef ||
      "";
    return workspaceId === command.templateWorkspaceId &&
      cardId === command.firstCardId &&
      source === "SearchKernelService" &&
      Boolean(admissionDecisionRef) &&
      item.admission;
  });
  return match?.admission || null;
}

function generatedMainlineEntries(ctx) {
  const scenarioOneCommand = capabilityCommandCatalog().map((item) =>
    command(item.templateWorkspaceId, item.firstCardId, item, item.keywords));
  const scenarioDirectory = mainlineScenarioCatalog()
    .filter((scenario) => scenario.scenarioNo !== 1)
    .map((scenario) => ({
      resultType: "mainlineScenario",
      scenarioNo: scenario.scenarioNo,
      scenarioId: scenario.scenarioId,
      title: scenario.title,
      subtitle: scenario.subtitle,
      status: scenario.status,
      nextAction: scenario.nextAction,
      keywords: scenario.keywords,
      query: scenario.nameZh,
      sourceRefs: {
        source: "dormitory-13-scenario-control.generated",
        sourceType: "generated-page-entry-policy"
      }
    }));
  return [...scenarioOneCommand, ...scenarioDirectory];
}

function command(templateWorkspaceId, firstCardId, { title, subtitle, nextAction }, keywords) {
  return { templateWorkspaceId, firstCardId, title, subtitle, nextAction, keywords };
}

function backendOperationSearchResults(state = {}, query = "") {
  const results = state.runtimeStore?.searchResultsByQuery?.[normalizeQuery(query)] || [];
  return results
    .filter((item) => (item.resultType || item.result_type) === "workItem")
    .filter((item) => item.workItemId || item.work_item_id || item.target?.workItemId)
    .map((item) => ({
      ...item,
      resultType: "workItem",
      workItemId: item.workItemId || item.work_item_id || item.target?.workItemId || "",
      workspaceId: item.workspaceId || item.workspace_id || item.target?.workspaceId || "",
      cardId: item.cardId || item.card_id || item.target?.cardId || "",
      caseId: item.caseId || item.case_id || item.target?.caseId || "",
      workItemType: item.workItemType || item.work_item_type || item.cardId || "",
      lifecycleState: item.lifecycleState || item.lifecycle_state || item.status || "ready",
      title: item.title,
      subtitle: item.subtitle || item.summary || item.localizedSubtitle,
      status: item.status || item.lifecycleState || "ready",
      nextAction: item.nextAction || item.next_action,
      businessAnchor: item.businessAnchor || item.business_anchor || item.payload?.fieldValues || {}
    }));
}

function dedupeSearchItems(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.workItemId || item.work_item_id || `${item.workspaceId || item.workspace_id || ""}:${item.cardId || item.card_id || ""}:${item.resultId || ""}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sectionTitleOverride(id, ctx) {
  if (id === "activeCommands") return ctx.tr("activeCommands");
  return ctx.tr(id);
}

function searchAction(result, ctx) {
  if (result.actionType === "openWorkItem") {
    const label = result.confirmAllowed ? result.actionLabel : ctx.tr("viewOnly");
    return `<button data-work-item-id="${ctx.escapeAttr(result.workItemId)}" data-workspace-id="${ctx.escapeAttr(result.workspaceId)}" data-card-id="${ctx.escapeAttr(result.cardId)}">${ctx.escapeHtml(label)}</button>`;
  }
  if (result.actionType === "startOperationsWorkspace") {
    if (!result.prepareAllowed) {
      return `<button data-view="learning">${ctx.tr("searchActionLearning")}</button>`;
    }
    return `<button data-start-operations-workspace="${ctx.escapeAttr(result.templateWorkspaceId)}" data-first-card-id="${ctx.escapeAttr(result.firstCardId)}" data-anchor-query="${ctx.escapeAttr(ctx.state.query || "")}">${ctx.escapeHtml(result.actionLabel)}</button>`;
  }
  if (["openObject", "openWorkspace"].includes(result.actionType)) {
    return `<button data-workspace="${ctx.escapeAttr(result.workspaceId)}" data-card-id="${ctx.escapeAttr(result.cardId)}" data-case-id="${ctx.escapeAttr(result.caseId)}">${ctx.escapeHtml(result.actionLabel)}</button>`;
  }
  if (result.actionType === "queryOnly") {
    return `<button data-search-query="${ctx.escapeAttr(result.query || result.title)}">${ctx.escapeHtml(result.actionLabel)}</button>`;
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
    title: item.businessObject || item.title || item.localizedTitle || item.card?.title || item.workspace?.title || ctx.tr("searchWorkItems"),
    subtitle: item.subtitle || item.summary || item.localizedSubtitle || businessContextLabel(item, ctx, ctx.tr("workbench")),
    status: item.lifecycleState || item.status || item.card?.status || "ready",
    nextAction: item.nextAction || item.localizedNextAction || item.reason || tx(item.workspace?.next, ctx) || ctx.tr("searchActionProcess"),
    businessAnchor: item.businessAnchor || item.business_anchor || buildBusinessAnchor(item, ctx)
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
    actionLabel: ctx.tr("continueHandling"),
    businessAnchor: buildBusinessAnchor(item, ctx)
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
      nextAction: localized(workspace.localizedNextAction, ctx) || tx(workspace.next, ctx) || ctx.tr("openWorkspace"),
      businessAnchor: buildBusinessAnchor(workspace, ctx)
    }));
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
  return workspace.cards?.find((card) => ["ready", "blocked", "inProgress"].includes(normalizeOperationLifecycleState(card.status, ""))) || workspace.cards?.[0];
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
  if (isAccommodationResourceSetupQuery(normalized)) return /房源建档|基础就绪|房间建档|床位组确认|住宿经营/i.test(text);
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

function normalizeQuery(value = "") {
  return String(value || "").trim().toLocaleLowerCase();
}
