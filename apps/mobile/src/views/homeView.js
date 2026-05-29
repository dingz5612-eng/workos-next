import { intentWorkspaces } from "../workspaceProjections.js";
import { modeCard } from "./loginView.js";
import { workspaceCard } from "./workspaceView.js";

export function homeView(ctx) {
  const { tr, shell, state } = ctx;
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
      ${ctx.metric("7", "mine")}
      ${ctx.metric("2", "blocked")}
      ${ctx.metric("3", "confirm")}
    </section>
    <section class="business-focus">
      <h2>${tr("scenarioFocus")}</h2>
      ${workspaceCard(intentWorkspaces.find((item) => item.id === "W-STAY-CHECKIN"), ctx)}
      ${workspaceCard(intentWorkspaces.find((item) => item.id === "W-REPAIR-REQUEST"), ctx)}
      ${workspaceCard(intentWorkspaces.find((item) => item.id === "W-STAY-CHECKOUT"), ctx)}
      ${workspaceCard(intentWorkspaces.find((item) => item.id === "W-REPAIR-DISPATCH"), ctx)}
    </section>
  `);
}

export function simpleModeList(ctx) {
  return `${modeCard("home", "todayMode", ctx.tr)}${modeCard("search", "intentMode", ctx.tr)}${modeCard("workbench", "queueMode", ctx.tr)}${modeCard("me", "personalMode", ctx.tr)}`;
}
