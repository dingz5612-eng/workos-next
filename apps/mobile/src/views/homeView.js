import { selectHomeSurface, selectSurfaceStats, selectWorkbenchQueue } from "../selectors/surfaceSelectors.js";
import { modeCard } from "./loginView.js";
import { WorkItemCard } from "./experienceComponents.js";
import { learningContentItems } from "./searchView.js";
import { workspaceCard } from "./workspaceView.js";

export function homeView(ctx) {
  const { tr, shell, state } = ctx;
  const surface = selectHomeSurface(state);
  const stats = selectSurfaceStats(state);
  const missions = selectWorkbenchQueue(state).slice(0, 3);
  const mission = missionControlVM(selectWorkbenchQueue(state), state, tr);
  return shell(`
    <section class="command-card" data-surface="today-mission-control">
      <span>${tr("todayMissionControlEyebrow")}</span>
      <h1>${tr("todayMissionControl")}</h1>
      <dl>
        <dt>${tr("reason")}</dt><dd>${mission.reason}</dd>
        <dt>${tr("impact")}</dt><dd>${mission.impact}</dd>
        <dt>${tr("nextAction")}</dt><dd>${mission.action}</dd>
      </dl>
      <button data-view="workbench">${tr("workbench")}</button>
    </section>
    <section class="home-search">
      <span>${tr("homeSearch")}</span>
      <div class="search-line">
        <input id="query" value="${ctx.escapeAttr(state.query)}" placeholder="${tr("searchPlaceholder")}" />
        <button id="searchNow">${tr("search")}</button>
      </div>
    </section>
    <section class="metric-grid">
      ${ctx.metric(stats.myQueueCount, "mine")}
      ${ctx.metric(stats.blockedCount, "blocked")}
      ${ctx.metric(stats.confirmCount, "confirm")}
    </section>
    <section class="mission-stack">
      <h2>${tr("assignedWorkItems")}</h2>
      ${missions.length ? missions.map((item) => WorkItemCard(item, ctx)).join("") : `<article class="help-card"><p>${tr("mobileEmptyToday")}</p><button data-view="search">${tr("search")}</button></article>`}
    </section>
    <section class="compact-section mobile-work-ia" data-mobile-today-ia>
      <h2>${tr("mustDoToday")}</h2>
      <div class="ia-chip-grid">
        ${iaChip("must-do", "mustDoToday", stats.myQueueCount, ctx)}
        ${iaChip("due-soon", "dueSoon", mission.dueSoonCount, ctx)}
        ${iaChip("missing-evidence", "missingEvidenceGroup", mission.missingEvidenceCount, ctx)}
        ${iaChip("waiting-finance", "waitingFinance", mission.waitingFinanceCount, ctx)}
        ${iaChip("just-submitted", "justSubmitted", mission.syncingCount, ctx)}
        ${iaChip("risk-reminder", "riskReminder", stats.blockedCount, ctx)}
      </div>
    </section>
    <section class="compact-section" data-surface="today-learning">
      <h2>${tr("todayLearning")}</h2>
      ${learningContentItems(ctx).slice(0, 2).map((item) => `<article class="search-result-card learning"><strong>${item.title}</strong><span>${item.subtitle}</span><small>${tr("nextAction")}: ${item.nextAction}</small></article>`).join("")}
      <button data-view="learning">${tr("learningCenter")}</button>
    </section>
    <section class="business-focus">
      <h2>${tr("scenarioFocus")}</h2>
      ${homeSurfaceSections(surface, ctx)}
    </section>
  `);
}

function missionControlVM(queue, state, tr) {
  if (!queue.length) {
    return {
      reason: tr("missionEmptyReason"),
      impact: tr("missionEmptyImpact"),
      action: tr("missionEmptyAction"),
      dueSoonCount: 0,
      missingEvidenceCount: 0,
      waitingFinanceCount: 0,
      syncingCount: 0
    };
  }
  const blocked = queue.find((item) => item.badges?.includes("blocked") || item.card?.status === "blocked");
  const missingEvidence = queue.filter((item) => (item.card?.evidence || item.evidenceRequirements || []).length && !item.evidenceState?.includes("verified"));
  const waitingFinance = queue.filter((item) => item.ownerRole === "finance" || item.badges?.includes("finance"));
  const syncing = (state.submitQueue || []).filter((item) => item.status === "committed_projection_pending").length;
  const focus = blocked || missingEvidence[0] || queue[0];
  return {
    reason: blocked ? tr("missionBlockedReason") : missingEvidence.length ? tr("missionEvidenceReason") : tr("missionReadyReason"),
    impact: focus?.workspace?.title?.["zh-CN"] || focus?.businessObject || focus?.workspaceId || tr("missionRuntimeImpact"),
    action: blocked ? tr("primaryViewBlocker") : missingEvidence.length ? tr("primaryCompleteEvidence") : tr("primarySubmit"),
    dueSoonCount: queue.filter((item) => item.badges?.includes("soon")).length,
    missingEvidenceCount: missingEvidence.length,
    waitingFinanceCount: waitingFinance.length,
    syncingCount: syncing
  };
}

function iaChip(id, labelKey, count, ctx) {
  return `<article class="ia-chip" data-mobile-ia="${ctx.escapeAttr(id)}"><span>${ctx.tr(labelKey)}</span><strong>${count}</strong></article>`;
}

function homeSurfaceSections(surface, ctx) {
  const groups = new Map();
  for (const item of surface) {
    const group = item.domainGroup || item.workspace?.domain || "Operations";
    groups.set(group, [...(groups.get(group) || []), item]);
  }
  return Array.from(groups.entries()).map(([group, items]) => `
    <section class="surface-group">
      <h3>${ctx.escapeHtml(group)}</h3>
      ${items.map((item) => workspaceCard(item.workspace, ctx, item.cardId)).join("")}
    </section>
  `).join("");
}

export function simpleModeList(ctx) {
  return `${modeCard("home", "todayMode", ctx.tr)}${modeCard("search", "intentMode", ctx.tr)}${modeCard("workbench", "queueMode", ctx.tr)}${modeCard("me", "personalMode", ctx.tr)}`;
}
