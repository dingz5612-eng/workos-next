import { queueFiltersFromState } from "../queueFilterState.js";
import { countBadge, countDomain, countEvidenceState, countTransferable, queueTasks } from "../selectors/queueSelectors.js";
import { WorkItemCard } from "./experienceComponents.js";

export function workbenchView(ctx) {
  const list = queueTasks(ctx.state);
  const filters = queueFiltersFromState(ctx.state);
  return ctx.shell(`
    <section class="queue-head">
      <span>${ctx.tr("queueTitle")}</span>
      <h1>${ctx.tr("workbench")}</h1>
      <strong>${list.length}</strong>
    </section>
    <section class="compact-section mobile-work-ia" data-mobile-work-ia>
      <h2>${ctx.tr("work")}</h2>
      <div class="ia-chip-grid">
        ${workChip("accommodation", "stay", countDomain(ctx.state, "stay"), ctx)}
        ${workChip("can-do", "workCanDo", countStatus(ctx.state, "ready"), ctx)}
        ${workChip("blocked", "workBlocked", countStatus(ctx.state, "blocked"), ctx)}
        ${workChip("waiting-others", "workWaitingOthers", countBadge(ctx.state, "waiting"), ctx)}
        ${workChip("need-evidence", "workNeedEvidence", countEvidenceState(ctx.state, "missing"), ctx)}
        ${workChip("transferable", "workTransferable", countTransferable(ctx.state), ctx)}
      </div>
    </section>
    <section class="queue-filter-state" data-queue-filter-state>
      <span>${ctx.tr("activeFilter")}</span>
      <strong>${filterSummary(filters, ctx)}</strong>
      <button id="clearQueueFilters">${ctx.tr("clearFilters")}</button>
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
  return ["all", "stay", "repair", "finance"].map((key) => filterPill("domain", key, countDomain(ctx.state, key), ctx)).join("");
}

function badgeFilters(ctx) {
  return ["mine", "confirm", "blocked", "soon", "waiting"].map((key) => filterPill("badge", key, countBadge(ctx.state, key), ctx)).join("");
}

function filterPill(field, key, count, ctx) {
  const filters = queueFiltersFromState(ctx.state);
  const active = filters[field] === key;
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
      <button data-filter-field="evidenceState" data-filter-value="missing">${ctx.tr("workNeedEvidence")}</button>
      <button data-filter-field="transferable" data-filter-value="true">${ctx.tr("workTransferable")}</button>
    </div>
  </section>`;
}

function workChip(id, labelKey, count, ctx) {
  return `<button class="ia-chip" data-work-filter="${ctx.escapeAttr(id)}" data-mobile-ia="filter"><span>${ctx.tr(labelKey)}</span><strong>${count}</strong></button>`;
}

function countStatus(state, status) {
  return queueTasks({ ...state, queueFilters: { ...queueFiltersFromState(state), status, domain: "all", badge: "all" } }).length;
}

function filterSummary(filters, ctx) {
  return [
    filters.domain !== "all" ? ctx.tr(filters.domain) : "",
    filters.badge !== "all" ? ctx.tr(filters.badge) : "",
    filters.status !== "all" ? ctx.tr(filters.status) : "",
    filters.ownerRole !== "all" ? ctx.tr("role") : "",
    filters.evidenceState !== "all" ? ctx.tr("workNeedEvidence") : "",
    filters.transferable !== "all" ? ctx.tr("workTransferable") : ""
  ].filter(Boolean).join(" · ") || ctx.tr("all");
}
