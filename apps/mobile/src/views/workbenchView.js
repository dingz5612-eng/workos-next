import { countBadge, countDomain, queueTasks } from "../selectors/queueSelectors.js";
import { WorkItemCard } from "./experienceComponents.js";

export function workbenchView(ctx) {
  const list = queueTasks(ctx.state);
  return ctx.shell(`
    <section class="queue-head">
      <span>${ctx.tr("queueTitle")}</span>
      <h1>${ctx.tr("workbench")}</h1>
      <strong>${list.length}</strong>
    </section>
    <section class="compact-section mobile-work-ia" data-mobile-work-ia>
      <h2>${ctx.tr("work")}</h2>
      <div class="ia-chip-grid">
        ${workChip("can-do", "workCanDo", list.filter((item) => item.card?.status === "ready" || item.status === "ready").length, ctx)}
        ${workChip("blocked", "workBlocked", list.filter((item) => item.card?.status === "blocked" || item.status === "blocked").length, ctx)}
        ${workChip("waiting-others", "workWaitingOthers", list.filter((item) => item.badges?.includes("waiting")).length, ctx)}
        ${workChip("need-evidence", "workNeedEvidence", list.filter((item) => (item.card?.evidence || []).length).length, ctx)}
        ${workChip("transferable", "workTransferable", list.filter((item) => item.transferable).length, ctx)}
      </div>
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
    ${ctx.state.apiStatus === "offline" && !list.length ? `<section class="help-card"><p>${ctx.tr("apiOfflineHelp")}</p></section>` : ""}
    <section class="task-stack">${list.length ? list.map((item) => WorkItemCard(item, ctx)).join("") : `<article class="help-card"><p>${ctx.tr("mobileEmptyWork")}</p><button data-view="search">${ctx.tr("search")}</button></article>`}</section>
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
    <div class="sheet-head"><h2>${ctx.tr("advancedFilter")}</h2><button id="closeAdvanced" aria-label="${ctx.tr("filterLess")}">×</button></div>
    <div class="sheet-grid">
      <button data-filter-field="ownerRole" data-filter-value="mine">${ctx.tr("role")}</button>
      <button data-filter-field="domain" data-filter-value="stay">${ctx.tr("stay")}</button>
      <button data-filter-field="domain" data-filter-value="repair">${ctx.tr("repair")}</button>
      <button data-filter-field="status" data-filter-value="blocked">${ctx.tr("blocked")}</button>
      <button data-filter-field="badge" data-filter-value="confirm">${ctx.tr("confirm")}</button>
      <button data-filter-field="badge" data-filter-value="soon">${ctx.tr("soon")}</button>
    </div>
  </section>`;
}

function workChip(id, labelKey, count, ctx) {
  return `<article class="ia-chip" data-work-filter="${ctx.escapeAttr(id)}"><span>${ctx.tr(labelKey)}</span><strong>${count}</strong></article>`;
}
