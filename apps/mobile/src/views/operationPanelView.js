import { loadDraft } from "../operationDrafts.js";
import { activeWorkspaceCard } from "../selectors/workspaceSelectors.js";
import { ActionResult, EvidenceSheet, OperationPanelView, TrustedConfirmSheet, WorkItemCard, workItemModel } from "./experienceComponents.js";
import { workspaceCardPanel } from "./workspaceView.js";

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
        <h1>${ctx.tr("persistedWorkItemRequired")}</h1>
        <p>${ctx.tr("persistedWorkItemRequiredBody")}</p>
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
  const canHandle = model.canHandleLabel;
  const missing = model.requiredEvidence.length ? model.requiredEvidence.join(" · ") : ctx.tr("noRequiredEvidence");
  const resultStatus = state.lastActionResult?.status ? ctx.tr(state.lastActionResult.status) : ctx.tr("notSubmitted");
  const detailsOpen = state.debugSurface || ["manager", "admin", "releaseOwner"].includes(state.currentActor?.role);

  return shell(`
    <section class="operation-panel-page" data-surface="operation-panel-route">
      <span>${ctx.tr("operationPanel")}</span>
      <h1>${ctx.escapeHtml(model.workItemType)}</h1>
      <p>${ctx.escapeHtml(model.businessObject)} · ${ctx.escapeHtml(model.nextAction)}</p>
    </section>
    ${WorkItemCard(operationContext, ctx)}
    <section class="operation-business-summary" data-surface="operation-business-summary">
      <article><span>${ctx.tr("currentState")}</span><strong>${ctx.escapeHtml(model.statusLabel)}</strong><p>${ctx.escapeHtml(canHandle)}</p></article>
      <article><span>${ctx.tr("decisionBlocker")}</span><strong>${ctx.escapeHtml(model.blocker)}</strong><p>${ctx.escapeHtml(model.nextAction)}</p></article>
      <article><span>${ctx.tr("decisionMissingEvidence")}</span><strong>${ctx.escapeHtml(missing)}</strong><p>${model.requiredEvidence.length ? "缺少证据，提交会被阻断。" : ctx.tr("noRequiredEvidence")}</p></article>
      <article><span>${ctx.tr("requiredPermission")}</span><strong>${ctx.escapeHtml(model.ownerRoleLabel)}</strong><p>${ctx.tr("trustedConfirmImpact")}</p></article>
      <article><span>${ctx.tr("actionResult")}</span><strong>${ctx.escapeHtml(resultStatus)}</strong><p>${ctx.escapeHtml(model.traceSummary)}</p></article>
      <article><span>${ctx.tr("nextAction")}</span><strong>${ctx.escapeHtml(model.nextAction)}</strong><p>${ctx.tr("learningCenter")}</p></article>
    </section>
    ${OperationPanelView(operationBody, operationContext, activeCard, ctx)}
    ${TrustedConfirmSheet(operationContext, activeCard, ctx)}
    ${EvidenceSheet(activeCard, draft, ctx)}
    <details class="operation-panel-runtime" data-surface="operation-runtime-proof" ${detailsOpen ? "open" : ""}>
      <summary>${ctx.tr("auditSummary")}</summary>
      <article><span>${ctx.tr("prepareContract")}</span><strong>${ctx.tr("prepareContractReady")}</strong><p>${ctx.tr("prepareContractHelp")}</p></article>
      <article><span>${ctx.tr("confirmCommit")}</span><strong>${ctx.tr("confirmCommitReady")}</strong><p>${ctx.tr("confirmCommitHelp")}</p></article>
      <article><span>${ctx.tr("trace")}</span><strong>${traceCount ? ctx.tr("traceAvailable") : ctx.tr("traceWillBind")}</strong><p>${ctx.tr("traceHelp")}</p></article>
      <article><span>${ctx.tr("projection")}</span><strong>${ctx.escapeHtml(resultStatus)}</strong><p>${ctx.tr("projectionPendingBody")}</p></article>
      <article><span>${ctx.tr("submissionRecord")}</span><strong>${commandSubmissionId ? ctx.tr("traceAvailable") : ctx.tr("traceWillBind")}</strong><p>${ctx.tr("submissionRecordHelp")}</p></article>
      <article><span>${ctx.tr("payloadFingerprint")}</span><strong>${ctx.escapeHtml(payloadHash)}</strong><p>${ctx.tr("payloadFingerprintHelp")}</p></article>
    </details>
    ${ActionResult(state.lastActionResult || { status: "not_submitted", message: "Ready to prepare / confirm" }, ctx)}
  `);
}

export function resolveOperationItem(state) {
  const workItemId = state.selectedWorkItemId;
  const runtimeItems = [
    ...(state.runtimeStore?.operationWorkItems || []),
    ...(state.runtimeStore?.workQueue || [])
  ];
  const selected = runtimeItems.find((item) => item.workItemId === workItemId || item.work_item_id === workItemId) ||
    runtimeItems.find((item) =>
      (item.workspaceId || item.workspace_id) === state.selectedWorkspace &&
      (!(item.cardId || item.card_id) || (item.cardId || item.card_id) === state.selectedCardId) &&
      (item.workItemId || item.work_item_id)) ||
    null;
  if (!selected) return null;
  const persistedWorkItemId = selected.workItemId || selected.work_item_id;
  if (persistedWorkItemId && state.selectedWorkItemId !== persistedWorkItemId) {
    state.selectedWorkItemId = persistedWorkItemId;
  }
  const workspaceId = selected.workspaceId || selected.workspace_id || state.selectedWorkspace;
  const cardId = selected.cardId || selected.card_id || state.selectedCardId;
  const workspace = (state.runtimeStore?.workspaces || []).find((item) => item.id === workspaceId);
  const card = workspace?.cards?.find((item) => item.id === cardId);
  return { ...selected, workspace, card };
}

function payloadHashFor(values, evidenceDrafts) {
  const raw = JSON.stringify({ values: values || {}, evidenceDrafts: evidenceDrafts || [] });
  let hash = 0;
  for (const char of raw) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `payload:${hash.toString(16).padStart(8, "0")}`;
}
