import { resolveOperationPanelTarget } from "../operationRouteResolver.js";
import { evidenceStateFor, todayFocusCounts, todayFocusItems } from "../selectors/queueSelectors.js";
import { BusinessSummaryHeader, BusinessTaskBody, workItemModel } from "./experienceComponents.js";
import { buildBusinessAnchor } from "../businessAnchorKernel.js";

export function homeView(ctx) {
  const { tr, shell, state } = ctx;
  const counts = todayFocusCounts(state);
  const queue = todayFocusItems(state);
  const totalFocusCount = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return shell(`
    ${totalFocusCount ? `<section class="command-card today-focus-overview" data-surface="today-focus-overview">
      <div class="ia-chip-grid" data-mobile-today-ia>
        ${iaChip("must-do", "mustDoToday", counts.mustDo, ctx, { state: "ready" })}
        ${iaChip("due-soon", "dueSoon", counts.dueSoon, ctx, { state: "due-soon" })}
        ${iaChip("missing-evidence", "missingEvidenceGroup", counts.missingEvidence, ctx, { state: "blocked" })}
        ${iaChip("waiting-others", "todayWaitingOthers", counts.waitingOthers, ctx, { state: "waiting" })}
        ${iaChip("waiting-finance", "waitingFinance", counts.waitingFinance, ctx, { state: "waiting" })}
        ${iaChip("just-submitted", "justSubmitted", counts.syncing, ctx, { state: "syncing" })}
        ${iaChip("risk-reminder", "riskReminder", counts.risk, ctx, { state: "blocked" })}
      </div>
    </section>` : ""}
    <section class="mission-stack today-focus-items" data-surface="today-focus-items">
      ${queue.length ? queue.map((item) => todayFocusItemCard(item, ctx)).join("") : `<article class="help-card"><p>${tr("mobileEmptyToday")}</p><button data-view="search">${tr("search")}</button></article>`}
    </section>
  `);
}

function iaChip(id, labelKey, count, ctx, options = {}) {
  const active = (ctx.state.todayFilter || "must-do") === id;
  const state = options.state || "ready";
  return `<button type="button" class="ia-chip${active ? " active" : ""}" data-mobile-ia="${ctx.escapeAttr(id)}" data-today-filter="${ctx.escapeAttr(id)}" data-today-filter-active="${active ? "true" : "false"}" data-queue-state="${ctx.escapeAttr(state)}" aria-label="${ctx.escapeAttr(`${ctx.tr(labelKey)} ${count}`)}"><span>${ctx.tr(labelKey)}</span><strong>${count}</strong></button>`;
}

function todayFocusItemCard(item, ctx) {
  const model = workItemModel(item, ctx);
  const status = model.canHandleLabel;
  const state = item.lifecycleState === "blocked" || item.status === "blocked" || evidenceStateFor(item) === "missing" ? "blocked" : "ready";
  const title = model.displayTitle || model.businessObject || model.workItemType;
  const route = resolveOperationPanelTarget({
    workItemId: model.workItemId,
    workspaceId: model.workspaceId,
    cardId: model.cardId
  }, ctx.state);
  const taskBody = BusinessTaskBody(model, ctx, { item });
  const hasOverview = taskBody.includes('data-surface="business-task-overview"');
  const action = route.canOpen
    ? `<button data-work-item-id="${ctx.escapeAttr(route.workItem.workItemId)}" data-workspace-id="${ctx.escapeAttr(route.workItem.workspaceId)}" data-card-id="${ctx.escapeAttr(route.workItem.cardId)}">${ctx.tr("startHandling")}</button>`
    : `<button data-view="workbench">${ctx.tr("workbench")}</button>`;
  return `<article class="today-workitem-summary today-focus-item" data-surface="today-focus-item">
    ${BusinessSummaryHeader({
      stateLabel: status,
      state,
      stateClass: "today-focus-state",
      title,
      subtitle: model.workItemType,
      source: item
    }, ctx, { compact: true, hideAnchor: shouldHideHeaderAnchor(item, ctx, hasOverview) })}
    ${taskBody}
    <div class="business-summary-actions today-focus-actions">${action}</div>
  </article>`;
}

function shouldHideHeaderAnchor(source = {}, ctx = {}, hasOverview = false) {
  if (!hasOverview) return false;
  const importantKeys = new Set(["resident", "phone", "deposit", "payment", "task", "checkout", "period"]);
  const anchor = buildBusinessAnchor(source, ctx);
  return !anchor.fields.some((field) => importantKeys.has(field.key));
}
