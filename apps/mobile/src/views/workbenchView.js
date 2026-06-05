import { queueFiltersFromState } from "../queueFilterState.js";
import { countEvidenceState, countTransferable, queueTasks } from "../selectors/queueSelectors.js";
import { selectCompletedWorkbenchQueue, selectWorkbenchQueue } from "../selectors/surfaceSelectors.js";
import { WorkItemCard } from "./experienceComponents.js";

export function workbenchView(ctx) {
  const list = queueTasks(ctx.state);
  const baseQueue = selectWorkbenchQueue(ctx.state);
  const completed = selectCompletedWorkbenchQueue(ctx.state);
  const filters = queueFiltersFromState(ctx.state);
  const showQueueControls = baseQueue.length || hasActiveFilters(filters);
  return ctx.shell(`
    ${showQueueControls ? `<section class="compact-section mobile-work-ia" data-mobile-work-ia>
      <div class="ia-chip-grid">
        ${workChip("all-work", "workAllItems", baseQueue.length, ctx, "ready")}
        ${workChip("can-do", "workMyCanDo", countMyCanDo(ctx.state), ctx, "ready")}
        ${workChip("blocked", "workBlocked", countStatus(ctx.state, "blocked"), ctx, "blocked")}
        ${workChip("need-evidence", "workMissingEvidence", countEvidenceState(ctx.state, "missing"), ctx, "blocked")}
        ${workChip("waiting-others", "workWaitingOthers", countWaitingOthers(ctx.state), ctx, "waiting")}
        ${workChip("waiting-finance", "waitingFinance", countWaitingFinance(ctx.state), ctx, "waiting")}
        ${workChip("due-risk", "workDueRisk", countDueRisk(ctx.state), ctx, "due-soon")}
        ${workChip("transferable", "workTransferable", countTransferable(ctx.state), ctx, "syncing")}
        ${workChip("just-submitted", "workSyncing", countSyncing(ctx.state), ctx, "syncing")}
      </div>
      <div class="ia-chip-grid work-scenario-grid" data-mobile-work-scenario-ia>
        ${workChip("scenario-resource", "workScenarioResource", countScenario(ctx.state, "resource"), ctx, "ready")}
        ${workChip("scenario-checkin", "workScenarioCheckin", countScenario(ctx.state, "checkin"), ctx, "ready")}
        ${workChip("scenario-deposit", "workScenarioDeposit", countScenario(ctx.state, "deposit"), ctx, "waiting")}
        ${workChip("scenario-payment", "workScenarioPayment", countScenario(ctx.state, "payment"), ctx, "waiting")}
        ${workChip("scenario-service", "workScenarioService", countScenario(ctx.state, "service"), ctx, "due-soon")}
        ${workChip("scenario-checkout", "workScenarioCheckout", countScenario(ctx.state, "checkout"), ctx, "due-soon")}
        ${workChip("scenario-expense", "workScenarioExpense", countScenario(ctx.state, "expense"), ctx, "waiting")}
        ${workChip("scenario-period", "workScenarioPeriod", countScenario(ctx.state, "period"), ctx, "ready")}
      </div>
    </section>
    <section class="queue-filter-state" data-queue-filter-state>
      <span>${ctx.tr("activeFilter")}</span>
      <strong>${filterSummary(filters, ctx)}</strong>
      <button id="clearQueueFilters">${ctx.tr("clearFilters")}</button>
    </section>
    <section class="queue-toolbar">
      <label>${ctx.tr("sort")}<select id="sort">${sortOption("smartSort", ctx)}${sortOption("dueSort", ctx)}${sortOption("riskSort", ctx)}${sortOption("recentSort", ctx)}</select></label>
    </section>` : ""}
    ${ctx.state.apiStatus === "offline" && !list.length ? `<section class="help-card"><p>${ctx.tr("apiOfflineHelp")}</p></section>` : ""}
    <section class="task-stack">${list.length ? list.map((item) => WorkItemCard(item, ctx)).join("") : `<article class="help-card"><p>${ctx.tr(showQueueControls ? "mobileEmptyFilteredWork" : "mobileEmptyWork")}</p><button data-view="search">${ctx.tr("search")}</button></article>`}</section>
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

function workChip(id, labelKey, count, ctx, state = "ready") {
  const label = ctx.tr(labelKey);
  return `<button class="ia-chip" data-work-filter="${ctx.escapeAttr(id)}" data-mobile-ia="filter" data-queue-state="${ctx.escapeAttr(state)}" aria-label="${ctx.escapeAttr(`${label} ${count}`)}"><span>${label}</span><strong>${count}</strong></button>`;
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
  return selectWorkbenchQueue(state).filter((item) => item.status === status || item.lifecycleState === status || item.card?.status === status).length;
}

function hasActiveFilters(filters = {}) {
  return filters.domain !== "all" ||
    filters.badge !== "all" ||
    filters.status !== "all" ||
    filters.ownerRole !== "all" ||
    filters.evidenceState !== "all" ||
    filters.transferable !== "all" ||
    filters.riskLevel !== "all" ||
    filters.due !== "all" ||
    filters.scenario !== "all";
}

function filterSummary(filters, ctx) {
  return [
    filters.domain !== "all" ? ctx.tr(filters.domain === "stay" ? "workAccommodation" : filters.domain) : "",
    filters.badge !== "all" ? ctx.tr(filters.badge) : "",
    filters.status !== "all" ? ctx.tr(filters.status) : "",
    filters.ownerRole !== "all" ? ctx.tr("role") : "",
    filters.evidenceState !== "all" ? ctx.tr("workMissingEvidence") : "",
    filters.transferable !== "all" ? ctx.tr("workTransferable") : "",
    filters.due !== "all" ? ctx.tr("workDueRisk") : "",
    filters.scenario !== "all" ? ctx.tr(`workScenario${capitalize(filters.scenario)}`) : ""
  ].filter(Boolean).join(" · ") || ctx.tr("all");
}

function countMyCanDo(state) {
  return selectWorkbenchQueue(state).filter((item) =>
    (item.badges?.includes("mine") || item.ownerRole === state.currentActor?.role) &&
    (item.status === "ready" || item.lifecycleState === "ready" || item.card?.status === "ready")).length;
}

function countWaitingOthers(state) {
  const role = String(state.currentActor?.role || "").toLowerCase();
  return selectWorkbenchQueue(state).filter((item) => {
    const owner = String(item.ownerRole || item.owner_role || "").toLowerCase();
    return item.badges?.includes("waiting") || Boolean(owner && role && owner !== role);
  }).length;
}

function countWaitingFinance(state) {
  return selectWorkbenchQueue(state).filter((item) =>
    String(item.ownerRole || item.owner_role || "").toLowerCase() === "finance" ||
    item.badges?.includes("finance") ||
    /finance|payment|deposit|ledger|押金|财务|收款|账本/i.test([item.workItemType, item.workspaceId, item.cardId, item.reason].join(" "))).length;
}

function countDueRisk(state) {
  return selectWorkbenchQueue(state).filter((item) => item.badges?.includes("soon") || item.badges?.includes("overdue") || dueWithinDay(item)).length;
}

function countSyncing(state) {
  return selectWorkbenchQueue(state).filter((item) => {
    const status = String(item.status || item.lifecycleState || item.card?.status || "").toLowerCase();
    return status === "committed_projection_pending" || status === "syncing" || item.badges?.includes("syncing");
  }).length;
}

function countScenario(state, scenario) {
  return selectWorkbenchQueue(state).filter((item) => scenarioForItem(item) === scenario).length;
}

function dueWithinDay(item = {}) {
  const due = Date.parse(item.dueAtUtc || item.due_at_utc || item.dueAt || item.due || "");
  return Number.isFinite(due) && due <= Date.now() + 24 * 60 * 60 * 1000;
}

function scenarioForItem(item = {}) {
  const text = [item.workspaceId, item.cardId, item.workItemType, item.reason, item.workspace?.title?.["zh-CN"], item.card?.title?.["zh-CN"]].join(" ");
  if (/RESOURCE|roomSetup|bedSetup|rateSetup|roomReadiness|roomBlock|roomRelease|住宿资源|房间|床位/i.test(text)) return "resource";
  if (/CHECKIN|lead|reservation|resident|bedAssign|tariff|入住|预订|住客/i.test(text)) return "checkin";
  if (/DEPOSIT|deposit|押金/i.test(text)) return "deposit";
  if (/PAYMENT|payment|receipt|收款|付款/i.test(text)) return "payment";
  if (/SERVICE|service|clean|repair|清洁|维修|服务任务/i.test(text)) return "service";
  if (/CHECKOUT|checkout|settlement|退住|退房|结算/i.test(text)) return "checkout";
  if (/EXPENSE|expense|支出|成本/i.test(text)) return "expense";
  if (/PERIOD|period|review|复盘|周期/i.test(text)) return "period";
  return "other";
}

function capitalize(value = "") {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
}
