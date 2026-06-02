import { selectRuntimeWorkspaces, selectSearchSurfaceResults, selectWorkbenchQueue } from "../selectors/surfaceSelectors.js";
import { LearningRecommendationVM, SearchResultVM } from "../viewModels/index.js";

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
    title: ctx.tr("searchNoResult"),
    subtitle: ctx.tr("workosSearchSubtitle"),
    status: "-",
    nextAction: ctx.tr("search")
  }];
  return `<section class="search-section" data-search-section="${ctx.escapeAttr(section.id)}">
    <h2>${ctx.tr(section.titleKey)}</h2>
    <div class="search-card-list">${items.map((item) => searchCard(item, ctx)).join("")}</div>
  </section>`;
}

function searchCard(item, ctx) {
  const normalized = SearchResultVM(normalizeSearchCard(item, ctx), ctx);
  return `<article class="search-result-card">
    <strong>${ctx.escapeHtml(normalized.localizedTitle)}</strong>
    <span>${ctx.escapeHtml(normalized.localizedSubtitle)}</span>
    <small>${ctx.tr("status")}: ${ctx.escapeHtml(normalized.localizedStatus)} · ${ctx.tr("nextAction")}: ${ctx.escapeHtml(normalized.localizedNextAction)}</small>
  </article>`;
}

function normalizeSearchCard(item, ctx) {
  return {
    ...item,
    title: localized(item.localizedTitle ?? item.title, ctx) || ctx.tr("searchNoResult"),
    subtitle: localized(item.localizedSubtitle ?? item.subtitle, ctx) || ctx.tr("workosSearchSubtitle"),
    status: localized(item.localizedStatus ?? item.status, ctx) || "-",
    nextAction: localized(item.localizedNextAction ?? item.nextAction, ctx) || ctx.tr("search")
  };
}

function workItems(queue, ctx) {
  return queue.map((item) => ({
    ...item,
    type: "workItem",
    title: item.businessObject || item.workspace?.title || item.card?.title || ctx.tr("searchWorkItems"),
    subtitle: item.workItemType || item.domain || ctx.tr("workbench"),
    status: item.lifecycleState || item.status || item.card?.status || "ready",
    nextAction: item.reason || tx(item.workspace?.next, ctx) || ctx.tr("openWorkspace")
  }));
}

function operationCases(queue, workspaces, ctx) {
  const cases = new Map();
  for (const item of queue) {
    const caseId = item.caseId || item.workspace?.caseId || item.workspaceId;
    if (!caseId) continue;
    cases.set(caseId, {
      ...item,
      type: "operationCase",
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
        type: "operationCase",
        subtitle: tx(workspace.title, ctx),
        status: workspace.cards?.[0]?.status || "ready",
        nextAction: tx(workspace.next, ctx) || ctx.tr("openWorkspace")
      });
    }
  }
  return Array.from(cases.values()).slice(0, 6);
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
      type: kind,
      subtitle: localized(workspace.localizedSubtitle, ctx) || workspace.id,
      status: localized(workspace.localizedStatus, ctx) || workspace.cards?.[0]?.status || "ready",
      nextAction: localized(workspace.localizedNextAction, ctx) || tx(workspace.next, ctx) || ctx.tr("openWorkspace")
    }));
}

function evidenceResults(workspaces, ctx) {
  return workspaces.flatMap((workspace) => (workspace.cards || []).flatMap((card) =>
    (card.evidence || []).map((evidence) => ({
      title: ctx.localTerm(evidence),
      type: "evidence",
      subtitle: `${workspace.id} · ${tx(card.title, ctx)}`,
      status: card.status || "ready",
      nextAction: ctx.tr("evidence")
    })))).slice(0, 6);
}

function traceResults(queue, ctx) {
  return queue
    .filter((item) => item.traceRefs?.length || item.commandSubmissionId || item.command_submission_id)
    .map((item) => ({
      ...item,
      type: "trace",
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
  return LearningRecommendationVM({
    type: "learning",
    title: ctx.tr(titleKey),
    subtitle: ctx.tr(bodyKey),
    status,
    nextAction: ctx.tr("learningCenter")
  }, ctx);
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
