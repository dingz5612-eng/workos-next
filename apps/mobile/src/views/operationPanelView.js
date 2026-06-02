import { loadDraft } from "../operationDrafts.js";
import { buildOperationActionState } from "../operationActionState.js";
import { resolveOperationPanelTarget } from "../operationRouteResolver.js";
import { activeWorkspaceCard } from "../selectors/workspaceSelectors.js";
import { ActionResult, EvidenceSheet, OperationPanelView, TrustedConfirmSheet, WorkItemCard, workItemModel } from "./experienceComponents.js";
import { primaryActionButton, workspaceCardPanel } from "./workspaceView.js";

export function operationPanelView(ctx) {
  const { state, shell } = ctx;
  const item = resolveOperationItem(state);
  if (!item?.workItemId && !item?.work_item_id) {
    state.lastActionResult = {
      confirmed: false,
      status: "business_blocked_422",
      commitStatus: "blocked",
      projectionStatus: "not_started",
      error: "operation_work_item_required",
      reason: "operation_work_item_required"
    };
    return shell(`
      <section class="operation-panel-empty" data-surface="operation-panel-runtime" data-blocker-code="operation_work_item_required">
        <span>${ctx.tr("operationPanel")}</span>
        <h1>${ctx.tr(state.operationRouteIssue?.titleKey || "operationUnavailableTitle")}</h1>
        <p>${ctx.tr(state.operationRouteIssue?.bodyKey || "operationUnavailableBody")}</p>
        <div class="empty-actions">
          <button data-view="workbench">${ctx.tr(state.operationRouteIssue?.returnActionKey || "returnWorkbench")}</button>
          <button data-view="workbench">${ctx.tr(state.operationRouteIssue?.refreshActionKey || "refreshWorkItems")}</button>
        </div>
      </section>
    `);
  }

  const workspace = item.workspace;
  const activeCard = item?.card || activeWorkspaceCard(workspace, state.selectedCardIndex, state.selectedCardId);
  if (!workspace || !activeCard) {
    return shell(`
      <section class="operation-panel-empty" data-surface="operation-panel-runtime">
        <span>${ctx.tr("operationPanel")}</span>
        <h1>${ctx.tr("runtimeWorkItemSelected")}</h1>
        <p>${ctx.tr("workspaceProjectionMissing")}</p>
      </section>
    `);
  }
  const operationContext = { ...item, workspace, card: activeCard, workspaceId: item?.workspaceId || workspace.id, cardId: item?.cardId || activeCard?.id };
  const model = workItemModel(operationContext, ctx);
  const draft = loadDraft(workspace.id, activeCard.id);
  const payloadHash = state.lastActionResult?.payloadHash || payloadHashFor(draft.values || {}, draft.evidenceDrafts || []);
  const commandSubmissionId = state.lastActionResult?.commandSubmissionId || draft.submissionProtocol?.submissionId || model.traceRefs[0] || "";
  const operationBody = workspaceCardPanel(activeCard, workspace, true, ctx);
  const traceCount = [commandSubmissionId, model.caseId, model.workItemId, ...(model.traceRefs || [])].filter(Boolean).length;
  const actionState = buildOperationActionState(operationContext, activeCard, state.lastActionResult, state);

  return shell(`
    <section class="operation-panel-page" data-surface="operation-panel-route">
      <span>${ctx.tr("operationPanel")}</span>
      <h1>${ctx.escapeHtml(model.workItemType)}</h1>
      <p>${ctx.escapeHtml(model.businessObject)} · ${ctx.escapeHtml(model.nextAction)}</p>
    </section>
    ${WorkItemCard(operationContext, ctx)}
    <section class="operation-panel-runtime" data-surface="operation-runtime-proof">
      <article><span>${ctx.tr("prepareContract")}</span><strong>${ctx.tr("prepareContractReady")}</strong><p>${ctx.tr("prepareContractHelp")}</p></article>
      <article><span>${ctx.tr("confirmCommit")}</span><strong>${ctx.tr("confirmCommitReady")}</strong><p>${ctx.tr("confirmCommitHelp")}</p></article>
      <article><span>${ctx.tr("trace")}</span><strong>${traceCount ? ctx.tr("traceAvailable") : ctx.tr("traceWillBind")}</strong><p>${ctx.tr("traceHelp")}</p></article>
      <article><span>${ctx.tr("projection")}</span><strong>${ctx.escapeHtml(state.lastActionResult?.status ? ctx.tr(state.lastActionResult.status) : ctx.tr("notSubmitted"))}</strong><p>${ctx.tr("projectionPendingBody")}</p></article>
      <article><span>${ctx.tr("submissionRecord")}</span><strong>${commandSubmissionId ? ctx.tr("traceAvailable") : ctx.tr("traceWillBind")}</strong><p>${ctx.tr("submissionRecordHelp")}</p></article>
      <article><span>${ctx.tr("payloadFingerprint")}</span><strong>${ctx.tr("localDraftFingerprint")}</strong><p>${ctx.tr("payloadFingerprintHelp")}</p></article>
    </section>
    ${OperationPanelView(operationBody, operationContext, activeCard, ctx)}
    ${EvidenceSheet(activeCard, draft, ctx)}
    ${TrustedConfirmSheet(operationContext, activeCard, ctx)}
    ${ActionResult(state.lastActionResult || { status: "not_submitted", message: "Ready to prepare / confirm" }, ctx)}
    <div class="sticky-action">${primaryActionButton(actionState, ctx)}</div>
  `);
}

export function resolveOperationItem(state) {
  const target = resolveOperationPanelTarget({
    workItemId: state.selectedWorkItemId,
    workspaceId: state.selectedWorkspace,
    cardId: state.selectedCardId
  }, state);
  if (!target.canOpen) {
    state.operationRouteIssue = state.operationRouteIssue || target;
    return null;
  }
  const selected = target.workItem;
  const persistedWorkItemId = selected.workItemId;
  if (persistedWorkItemId && state.selectedWorkItemId !== persistedWorkItemId) {
    state.selectedWorkItemId = persistedWorkItemId;
  }
  return selected;
}

function payloadHashFor(values, evidenceDrafts) {
  const raw = JSON.stringify({ values: values || {}, evidenceDrafts: evidenceDrafts || [] });
  let hash = 0;
  for (const char of raw) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `payload:${hash.toString(16).padStart(8, "0")}`;
}
