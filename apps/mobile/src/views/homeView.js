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
  return shell(`
    <section class="command-card" data-surface="today-mission-control">
      <span>${tr("todayMissionControlEyebrow")}</span>
      <h1>${tr("todayMissionControl")}</h1>
      <dl>
        <dt>${tr("reason")}</dt><dd>${tr("globalReason")}</dd>
        <dt>${tr("impact")}</dt><dd>${tr("globalImpact")}</dd>
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
      ${missions.length ? missions.map((item) => WorkItemCard(item, ctx)).join("") : `<article class="help-card"><p>${tr("coachNoMatch")}</p></article>`}
    </section>
    <section class="compact-section" data-surface="today-learning">
      <h2>${tr("todayLearning")}</h2>
      ${learningContentItems(ctx).slice(0, 2).map((item) => `<article class="search-result-card learning"><strong>${item.title}</strong><span>${item.subtitle}</span><small>${tr("nextAction")}: ${item.nextAction}</small></article>`).join("")}
    </section>
    <section class="business-focus">
      <h2>${tr("scenarioFocus")}</h2>
      ${homeSurfaceSections(surface, ctx)}
    </section>
  `);
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
