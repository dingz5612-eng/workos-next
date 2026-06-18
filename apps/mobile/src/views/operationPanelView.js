import { loadDraft } from "../operationDrafts.js";
import { admissionCopy } from "../admissionSurface.js";
import { buildOperationActionState } from "../operationActionState.js";
import { resolveReadonlyCompletedRecordFromRoute } from "../completedRecordReadModel.js";
import { syncUrlFromState } from "../navigationController.js";
import { resolveOperationPanelTarget } from "../operationRouteResolver.js";
import { activeWorkspaceCard, isTerminalCardStatus } from "../selectors/workspaceSelectors.js";
import { DORMITORY_MAINLINE_WORKSPACE_ID, DORMITORY_SCENARIO1_STEPS } from "../capabilityProjection.js";
import { ActionResult, EvidenceSheet, OperationStepRail, TechnicalAuditDetails, TrustedConfirmSheet, workItemModel } from "./experienceComponents.js";
import { completedWorkspaceRecord, currentActionResultForOperationCard, primaryActionButton, workspaceCardPanel } from "./workspaceView.js";

export function operationPanelView(ctx) {
  const { state, shell } = ctx;
  const item = resolveOperationItem(state, ctx);
  if (!item?.workItemId && !item?.work_item_id) {
    const readonlyRecord = resolveReadonlyCompletedRecordFromRoute(state);
    if (readonlyRecord) {
      return shell(`
        ${completedWorkspaceRecord(readonlyRecord.workspace, readonlyRecord.card, ctx)}
      `);
    }
    const startResourceAction = shouldOfferResourceSetup(state)
      ? `<button data-start-operations-workspace="${ctx.escapeAttr(DORMITORY_MAINLINE_WORKSPACE_ID)}" data-first-card-id="${ctx.escapeAttr(DORMITORY_SCENARIO1_STEPS[0]?.cardId || "")}">${ctx.tr("operationUnavailableStartResource")}</button>`
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
  const activeCard = workspace ? (item?.card || activeWorkspaceCard(workspace, state.selectedCardIndex, state.selectedCardId)) : null;
  if (!workspace || !activeCard) {
    return shell(`
      <section class="operation-panel-empty" data-surface="operation-panel-runtime" data-admission-decision="visible_blocked_projection_missing" data-runtime-decision="blocked:workspace_projection_missing">
        <span>${ctx.tr("operationPanel")}</span>
        <h1>${ctx.tr("runtimeWorkItemSelected")}</h1>
        <p>${ctx.tr("workspaceProjectionMissing")}</p>
      </section>
    `);
  }
  return renderOperationPanelForItem(item, workspace, activeCard, ctx);
}

function renderOperationPanelForItem(item, workspace, activeCard, ctx) {
  const { state, shell } = ctx;
  if (isTerminalCardStatus(activeCard.status)) {
    return shell(`
      ${completedWorkspaceRecord(workspace, activeCard, ctx)}
    `);
  }
  const operationContext = { ...item, workspace, card: activeCard, workspaceId: item?.workspaceId || workspace.id, cardId: item?.cardId || activeCard?.id };
  const model = workItemModel(operationContext, ctx);
  const draft = loadDraft(workspace.id, activeCard.id);
  const currentActionResult = currentActionResultForOperationCard(
    actionResultForActiveCard(state.lastActionResult, workspace, activeCard),
    workspace,
    activeCard,
    ctx
  );
  const payloadHash = currentActionResult?.payloadHash || payloadHashFor(draft.values || {}, draft.evidenceDrafts || []);
  const payloadFingerprint = payloadHash;
  const commandSubmissionId = currentActionResult?.commandSubmissionId || draft.submissionProtocol?.submissionId || model.traceRefs[0] || "";
  const submissionRecord = commandSubmissionId;
  const operationBody = workspaceCardPanel(activeCard, workspace, true, ctx);
  const traceCount = [commandSubmissionId, model.caseId, model.workItemId, ...(model.traceRefs || [])].filter(Boolean).length;
  const actionState = buildOperationActionState(operationContext, activeCard, currentActionResult, { ...state, lastActionResult: currentActionResult });
  const admissionDecision = operationAdmissionDecision(model, activeCard, actionState);
  const runtimeDecision = operationRuntimeDecision(model, activeCard, actionState);

  return shell(`
    ${OperationStepRail(workspace, activeCard, ctx, {
      surface: "operation-panel-route",
      attrs: {
        "data-work-item-id": model.workItemId,
        "data-lifecycle-state": model.lifecycleState,
        "data-action-state": actionState.status,
        "data-admission-decision": admissionDecision,
        "data-runtime-decision": runtimeDecision
      }
    })}
    ${TechnicalAuditDetails({
      model,
      payloadHash: payloadFingerprint,
      commandSubmissionId: submissionRecord,
      traceCount,
      projectionStatus: currentActionResult?.status || "notSubmitted",
      policyRef: activeCard.policyRef || activeCard.confirmation?.policyRef || "operations-runtime-policy"
    }, ctx)}
    ${admissionStatusPanel(actionState, ctx)}
    ${operationBody}
    ${preSubmitDetails(operationContext, activeCard, draft, ctx)}
    ${ActionResult(currentActionResult || {}, ctx)}
    <div class="sticky-action">${primaryActionButton(actionState, ctx)}</div>
  `);
}

function preSubmitDetails(operationContext, activeCard, draft, ctx) {
  return `<details class="operation-pre-submit-details" data-surface="operation-pre-submit-details">
    <summary>${ctx.tr("systemCheckDetails")}</summary>
    ${TrustedConfirmSheet(operationContext, activeCard, ctx)}
    ${EvidenceSheet(activeCard, draft, ctx)}
  </details>`;
}

function actionResultForActiveCard(result = null, workspace = {}, activeCard = {}) {
  if (!result) return null;
  if (result.autoAdvanced && result.autoAdvancedToCardId === activeCard.id) return null;
  if (result.workspaceId && result.workspaceId !== workspace.id) return null;
  if (result.cardId && result.cardId !== activeCard.id) return null;
  return result;
}

function shouldOfferResourceSetup(state = {}) {
  return state.selectedWorkspace === DORMITORY_MAINLINE_WORKSPACE_ID &&
    (!state.selectedCardId || state.selectedCardId === DORMITORY_SCENARIO1_STEPS[0]?.cardId);
}

function operationAdmissionDecision(model, card, actionState) {
  if (isTerminalCardStatus(card.status) || isTerminalCardStatus(model.lifecycleState)) return "visible_readonly_completed";
  if (actionState.admission) return admissionCopy(actionState.admission, { tr: (key) => key }, "operations").decision;
  if (actionState.status === "waitingPermission") return "visible_blocked_permission";
  if (actionState.status === "missingRequiredFields") return "visible_allowed_requires_required_fields";
  if (actionState.status === "missingEvidence") return "visible_allowed_requires_evidence";
  if (actionState.status === "blocked") return "visible_blocked_business_rule";
  if (actionState.status === "notStarted") return "visible_blocked_previous_step";
  if (actionState.status === "readyObservation") return "confirm_allowed_production_blocked";
  if (actionState.status === "ready") return "confirm_allowed_production_allowed";
  return `visible_${actionState.status}`;
}

function operationRuntimeDecision(model, card, actionState) {
  if (isTerminalCardStatus(card.status) || isTerminalCardStatus(model.lifecycleState)) return `work_item_terminal:${model.lifecycleState || card.status}`;
  if (["ready", "readyObservation"].includes(actionState.status)) return actionState.status === "readyObservation" ? "work_item_confirm_ready:production_blocked" : "work_item_confirm_ready";
  if (actionState.status === "confirmDenied") return "blocked:confirm_denied";
  if (actionState.status === "missingRequiredFields") return "blocked:required_field_missing";
  if (actionState.status === "missingEvidence") return "blocked:evidence_missing";
  if (actionState.status === "notStarted") return "blocked:previous_step_required";
  if (actionState.status === "blocked") return "blocked:business_rule";
  return `work_item_${actionState.status}`;
}

function admissionStatusPanel(actionState, ctx) {
  if (!actionState.admission) return "";
  const copy = admissionCopy(actionState.admission, ctx, "operations");
  return `<section class="operation-admission-panel compact" data-surface="operation-admission" data-admission-decision="${ctx.escapeAttr(copy.decision)}">
    <b>${ctx.tr("operationStatusHint")}</b>
    <p>${ctx.escapeHtml(admissionUserMessage(actionState.admission, ctx))}</p>
  </section>`;
}

function admissionUserMessage(admission = {}, ctx) {
  if (admission.visibleAllowed === false) return ctx.tr("operationStatusHiddenHint");
  if (!admission.prepareAllowed) return ctx.tr("operationStatusReadOnlyHint");
  if (!admission.confirmAllowed) return ctx.tr("operationStatusCannotSubmitHint");
  if (!admission.productionAllowed) return ctx.tr("operationStatusReadyHint");
  return ctx.tr("operationStatusProductionReadyHint");
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
