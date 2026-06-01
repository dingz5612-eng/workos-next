import { selectRuntimeWorkspaces, selectSearchSurfaceResults, selectWorkbenchQueue } from "../selectors/surfaceSelectors.js";

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
  return `<article class="search-result-card">
    <strong>${ctx.escapeHtml(item.title)}</strong>
    <span>${ctx.escapeHtml(item.subtitle)}</span>
    <small>${ctx.tr("status")}: ${ctx.escapeHtml(item.status)} · ${ctx.tr("nextAction")}: ${ctx.escapeHtml(item.nextAction)}</small>
  </article>`;
}

function workItems(queue, ctx) {
  return queue.map((item) => ({
    title: item.workItemId || item.queueItemId || ctx.tr("searchWorkItems"),
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
      title: caseId,
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
      title: `${labelByKind[kind]} · ${tx(workspace.title, ctx) || workspace.id}`,
      subtitle: workspace.id,
      status: workspace.cards?.[0]?.status || "ready",
      nextAction: tx(workspace.next, ctx) || ctx.tr("openWorkspace")
    }));
}

function evidenceResults(workspaces, ctx) {
  return workspaces.flatMap((workspace) => (workspace.cards || []).flatMap((card) =>
    (card.evidence || []).map((evidence) => ({
      title: ctx.localTerm(evidence),
      subtitle: `${workspace.id} · ${tx(card.title, ctx)}`,
      status: card.status || "ready",
      nextAction: ctx.tr("evidence")
    })))).slice(0, 6);
}

function traceResults(queue, ctx) {
  return queue
    .filter((item) => item.traceRefs?.length || item.commandSubmissionId || item.command_submission_id)
    .map((item) => ({
      title: item.commandSubmissionId || item.command_submission_id || item.traceRefs[0],
      subtitle: item.workItemId || item.queueItemId,
      status: item.lifecycleState || item.status || "ready",
      nextAction: ctx.tr("recentTraces")
    }));
}

function section(titleKey, items) {
  return { id: titleKey, titleKey, items };
}

function learning(titleKey, bodyKey, status, ctx) {
  return {
    title: ctx.tr(titleKey),
    subtitle: ctx.tr(bodyKey),
    status,
    nextAction: ctx.tr("learningCenter")
  };
}

function tx(value, ctx) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return ctx.tx ? ctx.tx(value) : value["zh-CN"] || value["ru-RU"] || "";
}
