import { queueFiltersFromState } from "../queueFilterState.js";
import { countBadge, countDomain, countEvidenceState, countTransferable, queueTasks } from "../selectors/queueSelectors.js";
import { selectCompletedWorkbenchQueue } from "../selectors/surfaceSelectors.js";
import { WorkItemCard } from "./experienceComponents.js";

export function workbenchView(ctx) {
  const list = queueTasks(ctx.state);
  const completed = selectCompletedWorkbenchQueue(ctx.state);
  const filters = queueFiltersFromState(ctx.state);
  return ctx.shell(`
    <section class="queue-head">
      <span>${ctx.tr("queueTitle")}</span>
      <h1>${ctx.tr("workbench")}</h1>
      <strong>${list.length}</strong>
    </section>
    ${list.length ? `<section class="compact-section mobile-work-ia" data-mobile-work-ia>
      <h2>${ctx.tr("work")}</h2>
      <div class="ia-chip-grid">
        ${workChip("accommodation", "workAccommodation", countDomain(ctx.state, "stay"), ctx)}
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
    <section class="queue-toolbar">
      <label>${ctx.tr("sort")}<select id="sort">${sortOption("smartSort", ctx)}${sortOption("dueSort", ctx)}</select></label>
    </section>` : ""}
    ${ctx.state.apiStatus === "offline" && !list.length ? `<section class="help-card"><p>${ctx.tr("apiOfflineHelp")}</p></section>` : ""}
    <section class="task-stack">${list.length ? list.map((item) => WorkItemCard(item, ctx)).join("") : `<article class="help-card"><p>${ctx.tr("mobileEmptyWork")}</p><button data-view="search">${ctx.tr("search")}</button></article>`}</section>
    ${completed.length ? `<section class="completed-work-section">
      <h2>${ctx.tr("completedWorkItems")}</h2>
      <div class="completed-work-list">${completed.slice(0, 4).map((item) => completedWorkCard(item, ctx)).join("")}</div>
    </section>` : ""}
  `);
}

function sortOption(value, ctx) {
  const selected = (ctx.state.sort || "smartSort") === value ? " selected" : "";
  return `<option value="${value}"${selected}>${ctx.tr(value)}</option>`;
}

function workChip(id, labelKey, count, ctx) {
  const label = ctx.tr(labelKey);
  return `<button class="ia-chip" data-work-filter="${ctx.escapeAttr(id)}" data-mobile-ia="filter" aria-label="${ctx.escapeAttr(`${label} ${count}`)}"><span>${label}</span><strong>${count}</strong></button>`;
}

function completedWorkCard(item, ctx) {
  const title = item.businessObject || item.workspace?.title || item.card?.title || item.workItemType || ctx.tr("completedWorkItems");
  const subtitle = item.workItemType || item.card?.id || "";
  const status = item.lifecycleState || item.status || item.card?.status || "done";
  return `<article class="completed-work-card">
    <div>
      <strong>${ctx.escapeHtml(ctx.tx ? ctx.tx(title) : title)}</strong>
      <span>${ctx.escapeHtml(subtitle)} · ${ctx.tr(status) || ctx.escapeHtml(status)}</span>
    </div>
    <button data-workspace="${ctx.escapeAttr(item.workspaceId)}" data-card-id="${ctx.escapeAttr(item.cardId)}">${ctx.tr("viewOnly")}</button>
  </article>`;
}

function countStatus(state, status) {
  return queueTasks({ ...state, queueFilters: { ...queueFiltersFromState(state), status, domain: "all", badge: "all" } }).length;
}

function filterSummary(filters, ctx) {
  return [
    filters.domain !== "all" ? ctx.tr(filters.domain === "stay" ? "workAccommodation" : filters.domain) : "",
    filters.badge !== "all" ? ctx.tr(filters.badge) : "",
    filters.status !== "all" ? ctx.tr(filters.status) : "",
    filters.ownerRole !== "all" ? ctx.tr("role") : "",
    filters.evidenceState !== "all" ? ctx.tr("workNeedEvidence") : "",
    filters.transferable !== "all" ? ctx.tr("workTransferable") : ""
  ].filter(Boolean).join(" · ") || ctx.tr("all");
}
