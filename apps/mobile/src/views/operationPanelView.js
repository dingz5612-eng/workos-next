import { loadDraft } from "../operationDrafts.js";
import { buildOperationActionState } from "../operationActionState.js";
import { syncUrlFromState } from "../navigationController.js";
import { resolveOperationPanelTarget } from "../operationRouteResolver.js";
import { activeWorkspaceCard, isTerminalCardStatus } from "../selectors/workspaceSelectors.js";
import { ActionResult, OperationStepRail, TechnicalAuditDetails, workItemModel } from "./experienceComponents.js";
import { completedWorkspaceRecord, primaryActionButton, workspaceCardPanel } from "./workspaceView.js";

export function operationPanelView(ctx) {
  const { state, shell } = ctx;
  const item = resolveOperationItem(state, ctx);
  if (!item?.workItemId && !item?.work_item_id) {
    const startResourceAction = shouldOfferResourceSetup(state)
      ? `<button data-start-operations-workspace="W-STAY-RESOURCE" data-first-card-id="roomSetup">${ctx.tr("operationUnavailableStartResource")}</button>`
      : `<button data-view="search">${ctx.tr("operationUnavailableSearchAction")}</button>`;
    state.lastActionResult = {
      confirmed: false,
      status: "business_blocked_422",
      commitStatus: "blocked",
      projectionStatus: "not_started",
      error: "operation_work_item_required",
      reason: "operation_work_item_required"
    };
    return shell(`
      <section class="operation-panel-empty" data-surface="operation-panel-runtime" data-blocker-code="operation_work_item_required" data-admission-decision="visible_blocked_missing_work_item" data-runtime-decision="blocked:operation_work_item_required">
        <span>${ctx.tr("operationPanel")}</span>
        <h1>${ctx.tr(state.operationRouteIssue?.titleKey || "operationUnavailableTitle")}</h1>
        <p>${ctx.tr(state.operationRouteIssue?.bodyKey || "operationUnavailableBody")}</p>
        <div class="empty-actions">
          ${startResourceAction}
          <button data-view="workbench">${ctx.tr(state.operationRouteIssue?.returnActionKey || "returnWorkbench")}</button>
          <button class="secondary" data-view="workbench">${ctx.tr(state.operationRouteIssue?.refreshActionKey || "refreshWorkItems")}</button>
        </div>
      </section>
    `);
  }

  const workspace = item.workspace;
  const activeCard = item?.card || activeWorkspaceCard(workspace, state.selectedCardIndex, state.selectedCardId);
  if (!workspace || !activeCard) {
    return shell(`
      <section class="operation-panel-empty" data-surface="operation-panel-runtime" data-admission-decision="visible_blocked_projection_missing" data-runtime-decision="blocked:workspace_projection_missing">
        <span>${ctx.tr("operationPanel")}</span>
        <h1>${ctx.tr("runtimeWorkItemSelected")}</h1>
        <p>${ctx.tr("workspaceProjectionMissing")}</p>
      </section>
    `);
  }
  if (isTerminalCardStatus(activeCard.status)) {
    return shell(`
      ${completedWorkspaceRecord(workspace, activeCard, ctx)}
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
  const admissionDecision = operationAdmissionDecision(model, activeCard, actionState);
  const runtimeDecision = operationRuntimeDecision(model, activeCard, actionState);

  return shell(`
    ${OperationStepRail(workspace, activeCard, ctx, {
      surface: "operation-panel-route",
      attrs: {
        "data-work-item-id": model.workItemId,
        "data-case-id": model.caseId,
        "data-lifecycle-state": model.lifecycleState,
        "data-action-state": actionState.status,
        "data-admission-decision": admissionDecision,
        "data-runtime-decision": runtimeDecision
      }
    })}
    ${state.debugSurface ? TechnicalAuditDetails({
      model,
      payloadHash: payloadFingerprint,
      commandSubmissionId: submissionRecord,
      traceCount,
      projectionStatus: state.lastActionResult?.status || "notSubmitted",
      policyRef: activeCard.policyRef || activeCard.confirmation?.policyRef || "operations-runtime-policy"
    }, ctx) : ""}
    ${operationBody}
    ${ActionResult(state.lastActionResult || {}, ctx)}
    <div class="sticky-action">${primaryActionButton(actionState, ctx)}</div>
  `);
}

function shouldOfferResourceSetup(state = {}) {
  return state.selectedWorkspace === "W-STAY-RESOURCE" &&
    (!state.selectedCardId || state.selectedCardId === "roomSetup");
}

function operationAdmissionDecision(model, card, actionState) {
  if (isTerminalCardStatus(card.status) || isTerminalCardStatus(model.lifecycleState)) return "visible_readonly_completed";
  if (actionState.status === "waitingPermission") return "visible_blocked_permission";
  if (actionState.status === "missingRequiredFields") return "visible_allowed_requires_required_fields";
  if (actionState.status === "missingEvidence") return "visible_allowed_requires_evidence";
  if (actionState.status === "blocked") return "visible_blocked_business_rule";
  if (actionState.status === "notStarted") return "visible_blocked_previous_step";
  return actionState.status === "ready" ? "visible_allowed_confirmable" : `visible_${actionState.status}`;
}

function operationRuntimeDecision(model, card, actionState) {
  if (isTerminalCardStatus(card.status) || isTerminalCardStatus(model.lifecycleState)) return `work_item_terminal:${model.lifecycleState || card.status}`;
  if (actionState.status === "ready") return "work_item_confirm_ready";
  if (actionState.status === "missingRequiredFields") return "blocked:required_field_missing";
  if (actionState.status === "missingEvidence") return "blocked:evidence_missing";
  if (actionState.status === "notStarted") return "blocked:previous_step_required";
  if (actionState.status === "blocked") return "blocked:business_rule";
  return `work_item_${actionState.status}`;
}

export function resolveOperationItem(state, ctx = null) {
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
  const canonicalWorkspaceId = selected.workspaceId || state.selectedWorkspace || "";
  const canonicalCardId = selected.cardId || state.selectedCardId || "";
  const routeChanged = (persistedWorkItemId && state.selectedWorkItemId !== persistedWorkItemId) ||
    (canonicalWorkspaceId && state.selectedWorkspace !== canonicalWorkspaceId) ||
    (canonicalCardId && state.selectedCardId !== canonicalCardId);
  if (persistedWorkItemId && state.selectedWorkItemId !== persistedWorkItemId) {
    state.selectedWorkItemId = persistedWorkItemId;
  }
  if (canonicalWorkspaceId) state.selectedWorkspace = canonicalWorkspaceId;
  if (canonicalCardId) state.selectedCardId = canonicalCardId;
  if (routeChanged) {
    state.selectedCardIndex = -1;
    clearStaleOperationRouteState(state, selected);
    if (ctx) syncUrlFromState(ctx);
  }
  return selected;
}

function clearStaleOperationRouteState(state, selected = {}) {
  const selectedWorkspaceId = selected.workspaceId || "";
  const selectedCardId = selected.cardId || "";
  if (state.fieldValidation?.workspaceId !== selectedWorkspaceId || state.fieldValidation?.cardId !== selectedCardId) {
    state.fieldValidation = null;
  }
  if (state.lastActionResult?.workspaceId && state.lastActionResult.workspaceId !== selectedWorkspaceId) {
    state.lastActionResult = null;
  }
  if (state.lastActionResult?.cardId && state.lastActionResult.cardId !== selectedCardId) {
    state.lastActionResult = null;
  }
  if (!state.fieldValidation && !state.lastActionResult) {
    state.operationMessage = "";
  }
  state.operationRouteIssue = null;
}

function payloadHashFor(values, evidenceDrafts) {
  const raw = JSON.stringify({ values: values || {}, evidenceDrafts: evidenceDrafts || [] });
  let hash = 0;
  for (const char of raw) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `payload:${hash.toString(16).padStart(8, "0")}`;
}
