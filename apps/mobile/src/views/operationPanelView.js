import { loadDraft } from "../operationDrafts.js";
import { buildOperationActionState } from "../operationActionState.js";
import { completedRecordActionPolicy } from "../operationRecordPolicy.js";
import { resolveOperationPanelTarget } from "../operationRouteResolver.js";
import { activeWorkspaceCard, isTerminalCardStatus } from "../selectors/workspaceSelectors.js";
import { ActionResult, OperationStepRail, TechnicalAuditDetails, workItemModel } from "./experienceComponents.js";
import { primaryActionButton, workspaceCardPanel } from "./workspaceView.js";

export function operationPanelView(ctx) {
  const { state, shell } = ctx;
  const item = resolveOperationItem(state);
  if (!item?.workItemId && !item?.work_item_id) {
    const startResourceAction = shouldOfferResourceSetup(state)
      ? `<button data-start-operations-resource-setup="true">${ctx.tr("operationUnavailableStartResource")}</button>`
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
  const isCompleted = isTerminalCardStatus(activeCard.status);
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
    ${isCompleted ? completedRecordPanel(model, activeCard, operationContext, ctx) : ""}
    ${state.debugSurface ? TechnicalAuditDetails({
      model,
      payloadHash: payloadFingerprint,
      commandSubmissionId: submissionRecord,
      traceCount,
      projectionStatus: state.lastActionResult?.status || "notSubmitted",
      policyRef: activeCard.policyRef || activeCard.confirmation?.policyRef || "operations-runtime-policy"
    }, ctx) : ""}
    ${isCompleted ? "" : operationBody}
    ${isCompleted ? "" : ActionResult(state.lastActionResult || {}, ctx)}
    ${isCompleted ? "" : `<div class="sticky-action">${primaryActionButton(actionState, ctx)}</div>`}
  `);
}

function shouldOfferResourceSetup(state = {}) {
  return state.selectedWorkspace === "W-STAY-RESOURCE" &&
    (!state.selectedCardId || state.selectedCardId === "roomSetup");
}

function completedRecordPanel(model, card, operationContext, ctx) {
  const policy = completedRecordActionPolicy({ workspace: operationContext.workspace, card, state: ctx.state, surface: "operationPanel" });
  const nextWorkItem = policy.nextWorkItem;
  const auditDetails = completedAuditDetails(model, ctx);
  const nextAction = nextWorkItem
    ? `<button data-work-item-id="${ctx.escapeAttr(nextWorkItem.workItemId)}" data-workspace-id="${ctx.escapeAttr(nextWorkItem.workspaceId)}" data-card-id="${ctx.escapeAttr(nextWorkItem.cardId)}">${ctx.tr("continueNextStage")}</button>`
    : "";
  const viewAction = `<button class="secondary" data-view-completed-record="true" data-workspace-id="${ctx.escapeAttr(operationContext.workspaceId)}" data-card-id="${ctx.escapeAttr(operationContext.cardId)}">${ctx.tr("viewOnly")}</button>`;
  return `<section class="completed-record-panel compact" data-surface="completed-operation-record">
    <div>
      <span>${ctx.tr("completedRecordTitle")}</span>
      <h2>${ctx.escapeHtml(model.displayTitle || model.businessObject)}</h2>
      <p>${ctx.tr("completedRecordPanelBody")}</p>
      <p class="completed-correction-help">${ctx.tr("completedCorrectionHelp")}</p>
      ${ctx.state.operationMessage ? `<p class="operation-message">${ctx.escapeHtml(ctx.state.operationMessage)}</p>` : ""}
    </div>
    <strong class="status-chip status-${ctx.escapeAttr(card.status)}">${ctx.tr(card.status)}</strong>
    <div class="operation-actions">${nextAction}${viewAction}</div>
    ${auditDetails}
  </section>`;
}

function completedAuditDetails(model, ctx) {
  if (!auditDetailsVisible(ctx)) return "";
  return `<details class="completed-operation-audit-details" data-surface="completed-operation-audit-details" ${ctx.state?.debugSurface ? "open" : ""}>
    <summary>${ctx.tr("auditDetails")}</summary>
    <dl>
      <dt>${ctx.tr("decisionOwner")}</dt><dd>${ctx.escapeHtml(model.ownerRoleLabel)}</dd>
      <dt>${ctx.tr("decisionMissingEvidence")}</dt><dd>${ctx.escapeHtml(model.requiredEvidence.join(" · ") || ctx.tr("noRequiredEvidence"))}</dd>
      <dt>${ctx.tr("auditSummary")}</dt><dd>${model.traceRefs.length ? ctx.tr("traceBound") : ctx.tr("traceWillBind")}</dd>
    </dl>
  </details>`;
}

function auditDetailsVisible(ctx) {
  const role = ctx.state?.currentActor?.role || "";
  return Boolean(ctx.state?.debugSurface || ["admin", "support", "audit", "releaseOwner"].includes(role));
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
