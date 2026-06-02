import { selectRuntimeWorkspaces, selectSearchSurfaceResults, selectWorkbenchQueue } from "../selectors/surfaceSelectors.js";
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
  const workspaceResults = query ? selectSearchSurfaceResults(state, query) : workspaces;
  return [
    section("searchWorkItems", workItems(queue, ctx)),
    section("searchOperationCases", operationCases(queue, workspaces, ctx)),
    section("searchRooms", objectResults(workspaceResults, "room", ctx)),
    section("searchBeds", objectResults(workspaceResults, "bed", ctx)),
    section("searchStays", objectResults(workspaceResults, "stay", ctx)),
    section("searchEvidence", evidenceResults(workspaceResults, ctx)),
    section("searchSubmissionTrace", traceResults(queue, ctx)),
    section("searchLearning", learningContentItems(ctx))
  ];
}

function searchSection(section, ctx) {
  const items = section.items.length ? section.items : [{
    resultType: "noAction",
    title: ctx.tr("searchNoResult"),
    subtitle: ctx.tr("searchNoActionReason"),
    status: "-",
    nextAction: ctx.tr("searchNoActionSuggestion")
  }];
  return `<section class="search-section" data-search-section="${ctx.escapeAttr(section.id)}">
    <h2>${ctx.tr(section.titleKey)}</h2>
    <div class="search-card-list">${items.map((item) => searchCard(item, ctx)).join("")}</div>
  </section>`;
}

function searchCard(item, ctx) {
  const normalized = buildSearchResultVM(normalizeSearchCard(item, ctx), ctx);
  const action = searchAction(normalized, ctx);
  return `<article class="search-result-card">
    <strong>${ctx.escapeHtml(normalized.title)}</strong>
    <span>${ctx.escapeHtml(normalized.subtitle)}</span>
    <small>${ctx.tr("status")}: ${ctx.escapeHtml(normalized.statusLabel)} · ${ctx.tr("nextAction")}: ${ctx.escapeHtml(normalized.nextActionLabel)}</small>
    ${action}
  </article>`;
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
      title: item.workspace?.title || ctx.tr("searchOperationCases"),
      subtitle: item.workItemType || item.domain || ctx.tr("operation"),
      status: item.lifecycleState || item.status || "ready",
      nextAction: item.reason || ctx.tr("openWorkspace")
    });
  }
  for (const workspace of workspaces) {
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

function objectResults(workspaces, kind, ctx) {
  const labelByKind = {
    room: "房间",
    bed: "床位",
    stay: "入住"
  };
  return workspaces
    .filter((workspace) => workspace.domain === "stay" || String(workspace.id).toLowerCase().includes(kind))
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
  return workspaces.flatMap((workspace) => (workspace.cards || []).flatMap((card) =>
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
  return queue
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
}

function section(titleKey, items) {
  return { id: titleKey, titleKey, items };
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
