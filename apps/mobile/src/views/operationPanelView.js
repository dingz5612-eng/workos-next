import { loadDraft } from "../operationDrafts.js";
import { activeWorkspaceCard } from "../selectors/workspaceSelectors.js";
import { ActionResult, EvidenceSheet, OperationPanelView, TrustedConfirmSheet, WorkItemCard, workItemModel } from "./experienceComponents.js";
import { workspaceCardPanel } from "./workspaceView.js";

export function operationPanelView(ctx) {
  const { state, shell } = ctx;
  const item = resolveOperationItem(state);
  if (!item?.workItemId && !item?.work_item_id) {
    return shell(`
      <section class="operation-panel-empty" data-component="OperationPanelView">
        <span>Operation Panel</span>
        <h1>Persisted WorkItem required</h1>
        <p>operation_work_item_required</p>
      </section>
    `);
  }

  const workspace = item.workspace;
  const activeCard = item?.card || activeWorkspaceCard(workspace, state.selectedCardIndex, state.selectedCardId);
  if (!workspace || !activeCard) {
    return shell(`
      <section class="operation-panel-empty" data-component="OperationPanelView">
        <span>Operation Panel</span>
        <h1>Runtime WorkItem selected</h1>
        <p>${ctx.escapeHtml(item.workItemId || item.work_item_id)} · workspace_or_card_projection_missing</p>
      </section>
    `);
  }
  const operationContext = { ...item, workspace, card: activeCard, workspaceId: item?.workspaceId || workspace.id, cardId: item?.cardId || activeCard?.id };
  const model = workItemModel(operationContext, ctx);
  const draft = loadDraft(workspace.id, activeCard.id);
  const payloadHash = state.lastActionResult?.payloadHash || payloadHashFor(draft.values || {}, draft.evidenceDrafts || []);
  const commandSubmissionId = state.lastActionResult?.commandSubmissionId || draft.submissionProtocol?.submissionId || model.traceRefs[0] || "";
  const operationBody = workspaceCardPanel(activeCard, workspace, true, ctx);
  const traceRefs = [
    commandSubmissionId ? `commandSubmissionId:${commandSubmissionId}` : "",
    model.caseId ? `caseId:${model.caseId}` : "",
    model.workItemId ? `workItemId:${model.workItemId}` : "",
    ...(model.traceRefs || [])
  ].filter(Boolean);

  return shell(`
    <section class="operation-panel-page" data-component="operationPanelRoute">
      <span>Operation Panel</span>
      <h1>${ctx.escapeHtml(model.workItemType)}</h1>
      <p>${ctx.escapeHtml(model.workItemId)} · ${ctx.escapeHtml(model.caseId)}</p>
    </section>
    ${WorkItemCard(operationContext, ctx)}
    <section class="operation-panel-runtime" data-component="OperationPanelRuntime">
      <article><span>prepare</span><strong>operationsPrepare</strong><p>Transport path is owned by apiClient.js.</p></article>
      <article><span>confirm</span><strong>operationsConfirm</strong><p>Transport path is owned by operationRuntime.js.</p></article>
      <article><span>trace</span><strong>${ctx.escapeHtml(traceRefs.join(" · ") || "-")}</strong><p>submission / workItem / case trace APIs</p></article>
      <article><span>projection</span><strong>${ctx.escapeHtml(state.lastActionResult?.status || "not_submitted")}</strong><p>Projection pending is not failed.</p></article>
      <article><span>commandSubmissionId</span><strong>${ctx.escapeHtml(commandSubmissionId || "-")}</strong><p>Stable audit ref after prepare / confirm.</p></article>
      <article><span>payloadHash</span><strong>${ctx.escapeHtml(payloadHash)}</strong><p>Draft values + evidence fingerprint.</p></article>
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
