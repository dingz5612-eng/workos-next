import { loadDraft } from "../operationDrafts.js";
import { activeWorkspaceCard } from "../selectors/workspaceSelectors.js";
import { ActionResult, EvidenceSheet, OperationPanelView, TrustedConfirmSheet, WorkItemCard, workItemModel } from "./experienceComponents.js";
import { workspaceCardPanel } from "./workspaceView.js";

export function operationPanelView(ctx) {
  const { state, shell } = ctx;
  const item = resolveOperationItem(state);
  if (!item?.workItemId && !item?.work_item_id) {
    return shell(`
      <section class="operation-panel-empty" data-surface="operation-panel-runtime">
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
      <section class="operation-panel-empty" data-surface="operation-panel-runtime" data-work-item-id="${ctx.escapeAttr(item.workItemId || item.work_item_id)}">
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

  return shell(`
    <section class="operation-panel-page" data-surface="operation-panel-route" data-work-item-id="${ctx.escapeAttr(model.workItemId)}" data-case-id="${ctx.escapeAttr(model.caseId)}" data-submission-id="${ctx.escapeAttr(commandSubmissionId)}" data-payload-fingerprint="${ctx.escapeAttr(payloadHash)}">
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
