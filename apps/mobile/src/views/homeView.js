import { selectHomeSurface, selectSurfaceStats } from "../selectors/surfaceSelectors.js";
import { modeCard } from "./loginView.js";
import { workspaceCard } from "./workspaceView.js";

export function homeView(ctx) {
  const { tr, shell, state } = ctx;
  const surface = selectHomeSurface(state);
  const stats = selectSurfaceStats(state);
  return shell(`
    <section class="command-card">
      <span>${tr("globalCommand")}</span>
      <h1>${tr("globalCommandTitle")}</h1>
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
