import { createOperationWorkItem } from "./apiClient.js";
import { openOperationPanel, setView } from "./navigationController.js";
import { applyRuntimeSurfacePayloads } from "./runtime/runtimeStore.js";

export async function retryApi(ctx) {
  await ctx.hydrateProjectionFromApi();
  ctx.render();
}

export async function handleOperationRecovery(actionState, ctx) {
  if (actionState === "projectionPending" || actionState === "failed") {
    await ctx.hydrateProjectionFromApi();
    ctx.render();
    return;
  }
  if (actionState === "submitted") {
    setView("recentTraces", ctx);
    return;
  }
  if (actionState === "blocked" || actionState === "missingEvidence") {
    setView("learning", ctx);
    return;
  }
  if (actionState === "waitingPermission") {
    setView("permissions", ctx);
  }
}

export async function startCompletedStepCorrection(ctx, input = {}) {
  if (ctx.state.correctionStarting) return;
  if (!ctx.state.currentActor) {
    ctx.state.loginMessage = ctx.tr("loginRequired");
    setView("login", ctx);
    return;
  }
  const target = correctionTarget(ctx, input);
  if (!target.workspaceId || !target.cardId) {
    ctx.state.operationMessage = ctx.tr("completedCorrectionUnavailable");
    ctx.render();
    return;
  }
  const existing = existingOpenCorrectionWorkItem(ctx.state, target);
  if (existing) {
    openOperationPanel(workItemIdOf(existing), ctx, target);
    return;
  }
  ctx.state.correctionStarting = true;
  ctx.state.operationMessage = ctx.tr("completedCorrectionStart");
  ctx.render();
  try {
    const workItem = await createOperationWorkItem(correctionWorkItemRequest(ctx, target));
    const operationWorkItems = upsertOperationWorkItem(ctx.state.runtimeStore?.operationWorkItems || [], workItem);
    applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems });
    ctx.state.operationMessage = ctx.tr("completedCorrectionStarted");
    openOperationPanel(workItemIdOf(workItem), ctx, target);
  } catch (error) {
    ctx.state.operationMessage = correctionErrorMessage(error, ctx);
    ctx.render();
  } finally {
    ctx.state.correctionStarting = false;
  }
}

function correctionTarget(ctx, input = {}) {
  const workspaceId = input.workspaceId || ctx.state.selectedWorkspace || "";
  const cardId = input.cardId || ctx.state.selectedCardId || "";
  const selected = findWorkItem(ctx.state, input.workItemId || ctx.state.selectedWorkItemId, workspaceId, cardId);
  const workspace = (ctx.state.runtimeStore?.workspaces || []).find((item) => item.id === workspaceId) || selected?.workspace || null;
  const card = (workspace?.cards || []).find((item) => item.id === cardId) || selected?.card || null;
  return {
    workspaceId,
    cardId,
    sourceWorkItemId: input.sourceWorkItemId || input.workItemId || workItemIdOf(selected) || ctx.state.selectedWorkItemId || "",
    caseId: selected?.caseId || selected?.case_id || workspace?.caseId || workspaceId,
    workItemType: selected?.workItemType || selected?.work_item_type || cardId,
    ownerRole: selected?.ownerRole || selected?.owner_role || card?.confirmation?.requiredRole || card?.Confirmation?.requiredRole || ctx.state.currentActor?.role || "operator",
    templateWorkspaceId: selected?.payload?.templateWorkspaceId || templateWorkspaceIdFor(workspaceId),
    definitionId: selected?.payload?.definitionId || "",
    sourceSubmissionId: selected?.commandSubmissionId || selected?.command_submission_id || "",
    cardStatus: card?.status || selected?.status || ""
  };
}

function correctionWorkItemRequest(ctx, target) {
  const source = target.sourceWorkItemId || "completed-step";
  const createdAt = Date.now().toString(36);
  const workItemId = `wi-correction-${shortHash(target.workspaceId, target.cardId, source, createdAt)}`;
  return {
    workItemId,
    workItemType: target.workItemType,
    workspaceId: target.workspaceId,
    cardId: target.cardId,
    ownerRole: target.ownerRole,
    payload: {
      caseId: target.caseId,
      cardId: target.cardId,
      templateWorkspaceId: target.templateWorkspaceId,
      definitionId: target.definitionId,
      operationMode: "correction",
      correctionMode: "append_only",
      sourceWorkItemId: source,
      sourceSubmissionId: target.sourceSubmissionId,
      sourceCardStatus: target.cardStatus,
      operationAxis: "Correction -> OperationCase -> WorkItem",
      startedByActorId: ctx.state.currentActor?.userId || ctx.state.currentActor?.actorId || ctx.state.currentActor?.role || "operator"
    }
  };
}

function existingOpenCorrectionWorkItem(state = {}, target = {}) {
  return runtimeItems(state).find((item) =>
    workspaceIdOf(item) === target.workspaceId &&
    cardIdOf(item) === target.cardId &&
    payloadValue(item, "correctionMode") === "append_only" &&
    !isTerminalStatus(item.lifecycleState || item.lifecycle_state || item.status));
}

function findWorkItem(state = {}, workItemId = "", workspaceId = "", cardId = "") {
  const items = runtimeItems(state);
  return items.find((item) => workItemId && workItemIdOf(item) === workItemId) ||
    items.find((item) => workspaceIdOf(item) === workspaceId && cardIdOf(item) === cardId) ||
    null;
}

function upsertOperationWorkItem(items = [], next = {}) {
  const nextId = workItemIdOf(next);
  return [next, ...items.filter((item) => workItemIdOf(item) !== nextId)];
}

function runtimeItems(state = {}) {
  return [
    ...(state.runtimeStore?.operationWorkItems || []),
    ...(state.runtimeStore?.workQueue || [])
  ];
}

function templateWorkspaceIdFor(workspaceId = "") {
  if (workspaceId.startsWith("W-STAY-RESOURCE-")) return "W-STAY-RESOURCE";
  return workspaceId;
}

function correctionErrorMessage(error, ctx) {
  if (error?.status === 401) return ctx.tr("sessionExpired");
  if (error?.status === 403) return ctx.tr("confirmForbidden");
  return ctx.tr("completedCorrectionBlocked");
}

function payloadValue(item = {}, key = "") {
  return item.payload?.[key] || item.Payload?.[key] || "";
}

function workItemIdOf(item = {}) {
  return item.workItemId || item.work_item_id || "";
}

function workspaceIdOf(item = {}) {
  return item.workspaceId || item.workspace_id || item.workspace?.id || "";
}

function cardIdOf(item = {}) {
  return item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.card?.id || "";
}

function isTerminalStatus(status = "") {
  return ["done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped"].includes(String(status || ""));
}

function shortHash(...parts) {
  const text = parts.join("|");
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
