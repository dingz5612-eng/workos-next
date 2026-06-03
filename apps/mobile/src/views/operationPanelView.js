import { loadDraft } from "../operationDrafts.js";
import { buildOperationActionState } from "../operationActionState.js";
import { resolveOperationPanelTarget } from "../operationRouteResolver.js";
import { activeWorkspaceCard } from "../selectors/workspaceSelectors.js";
import { ActionResult, EvidenceSheet, OperationPanelView, TechnicalAuditDetails, TrustedConfirmSheet, WorkItemCard, workItemModel } from "./experienceComponents.js";
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
  const payloadFingerprint = payloadHash;
  const commandSubmissionId = state.lastActionResult?.commandSubmissionId || draft.submissionProtocol?.submissionId || model.traceRefs[0] || "";
  const submissionRecord = commandSubmissionId;
  const operationBody = workspaceCardPanel(activeCard, workspace, true, ctx);
  const traceCount = [commandSubmissionId, model.caseId, model.workItemId, ...(model.traceRefs || [])].filter(Boolean).length;
  const actionState = buildOperationActionState(operationContext, activeCard, state.lastActionResult, state);
  const isCompleted = activeCard.status === "done";

  return shell(`
    <section class="operation-panel-page" data-surface="operation-panel-route">
      <span>${ctx.tr("operationPanel")}</span>
      <h1>${ctx.escapeHtml(model.workItemType)}</h1>
      <p>${ctx.escapeHtml(model.businessObject)} · ${ctx.escapeHtml(model.nextAction)}</p>
      <dl class="operation-business-summary">
        <dt>${ctx.tr("currentState")}</dt><dd>${ctx.tr(model.lifecycleState)}</dd>
        <dt>${ctx.tr("decisionCanHandle")}</dt><dd>${ctx.escapeHtml(model.canHandleLabel)}</dd>
        <dt>${ctx.tr("decisionBlocker")}</dt><dd>${ctx.escapeHtml(model.blocker)}</dd>
        <dt>${ctx.tr("decisionMissingEvidence")}</dt><dd>${ctx.escapeHtml(model.requiredEvidence.join(" · ") || ctx.tr("noRequiredEvidence"))}</dd>
        <dt>${ctx.tr("requiredPermission")}</dt><dd>${ctx.tr(model.ownerRole)}</dd>
        <dt>${ctx.tr("decisionRisk")}</dt><dd>${ctx.escapeHtml(model.riskLevel)}</dd>
        <dt>${ctx.tr("decisionDueAt")}</dt><dd>${ctx.escapeHtml(model.dueAt)}</dd>
        <dt>${ctx.tr("decisionOwner")}</dt><dd>${ctx.escapeHtml(model.ownerRoleLabel)}</dd>
      </dl>
    </section>
    ${isCompleted ? completedRecordPanel(model, activeCard, ctx) : WorkItemCard(operationContext, ctx)}
    ${TechnicalAuditDetails({
      model,
      payloadHash: payloadFingerprint,
      commandSubmissionId: submissionRecord,
      traceCount,
      projectionStatus: state.lastActionResult?.status || "notSubmitted",
      policyRef: activeCard.policyRef || activeCard.confirmation?.policyRef || "operations-runtime-policy"
    }, ctx)}
    ${isCompleted ? "" : OperationPanelView(operationBody, operationContext, activeCard, ctx)}
    ${isCompleted ? "" : EvidenceSheet(activeCard, draft, ctx)}
    ${isCompleted ? "" : TrustedConfirmSheet(operationContext, activeCard, ctx)}
    ${isCompleted ? "" : ActionResult(state.lastActionResult || { status: "not_submitted", message: "Ready to prepare / confirm" }, ctx)}
    ${isCompleted ? "" : `<div class="sticky-action">${primaryActionButton(actionState, ctx)}</div>`}
  `);
}

function completedRecordPanel(model, card, ctx) {
  return `<section class="completed-record-panel" data-surface="completed-operation-record">
    <div>
      <span>${ctx.tr("completedRecordTitle")}</span>
      <h2>${ctx.escapeHtml(model.displayTitle || model.businessObject)}</h2>
      <p>${ctx.tr("completedRecordBody")}</p>
    </div>
    <dl>
      <dt>${ctx.tr("currentState")}</dt><dd>${ctx.tr(card.status)}</dd>
      <dt>${ctx.tr("decisionBusinessObject")}</dt><dd>${ctx.escapeHtml(model.businessObject)}</dd>
      <dt>${ctx.tr("decisionOwner")}</dt><dd>${ctx.escapeHtml(model.ownerRoleLabel)}</dd>
      <dt>${ctx.tr("decisionMissingEvidence")}</dt><dd>${ctx.escapeHtml(model.requiredEvidence.join(" · ") || ctx.tr("noRequiredEvidence"))}</dd>
      <dt>${ctx.tr("auditSummary")}</dt><dd>${model.traceRefs.length ? ctx.tr("traceBound") : ctx.tr("traceWillBind")}</dd>
      <dt>${ctx.tr("cardNext")}</dt><dd>${ctx.escapeHtml(model.nextAction)}</dd>
    </dl>
  </section>`;
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
