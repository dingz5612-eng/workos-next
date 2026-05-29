import { countBadge, countDomain, queueTasks } from "../selectors/queueSelectors.js";

export function workbenchView(ctx) {
  const list = queueTasks(ctx.state);
  return ctx.shell(`
    <section class="queue-head">
      <span>${ctx.tr("queueTitle")}</span>
      <h1>${ctx.tr("workbench")}</h1>
      <strong>${list.length}</strong>
    </section>
    <section class="queue-filter">
      <div class="filter-row">${domainFilters(ctx)}</div>
      <div class="filter-row ${ctx.state.filterOpen ? "expanded" : "collapsed"}">${badgeFilters(ctx)}</div>
      <button class="link-button" id="toggleFilters">${ctx.tr(ctx.state.filterOpen ? "filterLess" : "filterMore")}</button>
    </section>
    <section class="queue-toolbar">
      <label>${ctx.tr("sort")}<select id="sort"><option value="smartSort">${ctx.tr("smartSort")}</option><option value="dueSort">${ctx.tr("dueSort")}</option></select></label>
      <button id="advanced">${ctx.tr("filter")}</button>
    </section>
    ${list.some((item) => item.source === "offline-demo-fallback") ? `<section class="help-card"><p>${ctx.tr("apiOffline")}</p></section>` : ""}
    <section class="task-stack">${list.map((item) => taskCard(item, ctx)).join("")}</section>
    ${ctx.state.advancedOpen ? advancedSheet(ctx) : ""}
  `);
}

function domainFilters(ctx) {
  return ["all", "stay", "repair", "finance"].map((key) => filterPill("queueDomain", key, countDomain(ctx.state, key), ctx)).join("");
}

function badgeFilters(ctx) {
  return ["mine", "confirm", "blocked", "soon", "waiting"].map((key) => filterPill("queueBadge", key, countBadge(ctx.state, key), ctx)).join("");
}

function filterPill(field, key, count, ctx) {
  const active = ctx.state[field] === key;
  return `<button class="pill ${active ? "active" : ""}" data-filter-field="${field}" data-filter-value="${key}">${ctx.tr(key)}<b>${count}</b></button>`;
}

function advancedSheet(ctx) {
  return `<section class="sheet">
    <div class="sheet-head"><h2>${ctx.tr("advancedFilter")}</h2><button id="closeAdvanced">×</button></div>
    <div class="sheet-grid">
      <button>${ctx.tr("role")}</button>
      <button>${ctx.tr("stay")}</button>
      <button>${ctx.tr("repair")}</button>
      <button>${ctx.tr("blocked")}</button>
      <button>${ctx.tr("confirm")}</button>
      <button>${ctx.tr("soon")}</button>
    </div>
  </section>`;
}

function taskCard(item, ctx) {
  if (!item.workspace || !item.card) {
    return `<article class="task-card">
      <div><span>${ctx.tr(item.domain)} · ${(item.badges || []).map((badge) => ctx.tr(badge)).join(" · ")} · ${item.due || ""}</span><strong>${ctx.tr(item.title)}</strong><p>${ctx.tr("apiOffline")}</p></div>
    </article>`;
  }
  const itemWorkspace = item.workspace;
  const activeCard = item.card;
  return `<article class="task-card">
    <div><span>${ctx.tr(item.domain)} · ${(item.badges || []).map((badge) => ctx.tr(badge)).join(" · ")}</span><strong>${ctx.tx(itemWorkspace.title)}</strong><p>${ctx.tx(activeCard.title)} · ${ctx.tr(activeCard.status)}</p><p>${ctx.tr("whyMe")}: ${ctx.tx(item.reason || itemWorkspace.next)}</p></div>
    <button data-workspace="${item.workspaceId}" data-card-id="${item.cardId}">${ctx.tr("openWorkspace")}</button>
  </article>`;
}
