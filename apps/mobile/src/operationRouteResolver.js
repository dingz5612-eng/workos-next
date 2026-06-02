export function resolveSurfaceTarget(input = {}, state = {}) {
  return SurfaceRouteVM(resolveOperationPanelTarget(input, state));
}

export function resolveOperationPanelTarget(input = {}, state = {}) {
  const workItem = resolvePersistedWorkItem(input, state);
  if (!workItem) {
    return {
      canOpen: false,
      reason: "missing_persisted_work_item",
      titleKey: "operationUnavailableTitle",
      bodyKey: "operationUnavailableBody",
      nextActionKey: "operationUnavailableNextAction",
      refreshActionKey: "refreshWorkItems",
      returnActionKey: "returnWorkbench",
      input
    };
  }
  return {
    canOpen: true,
    workItem: WorkItemIdentityVM(workItem, state),
    reason: ""
  };
}

export function resolvePersistedWorkItem(input = {}, state = {}) {
  const normalized = normalizeInput(input);
  const items = runtimeItems(state);
  const exact = normalized.workItemId
    ? items.find((item) => workItemIdOf(item) === normalized.workItemId)
    : null;
  const byWorkspaceCard = normalized.workspaceId
    ? items.find((item) =>
      workspaceIdOf(item) === normalized.workspaceId &&
      (!cardIdOf(item) || !normalized.cardId || cardIdOf(item) === normalized.cardId) &&
      workItemIdOf(item))
    : null;
  return materializeWorkItem(exact || byWorkspaceCard || null, state);
}

export function WorkItemIdentityVM(item = {}, state = {}) {
  const workspaceId = workspaceIdOf(item);
  const cardId = cardIdOf(item);
  const workspace = item.workspace || workspaceById(state, workspaceId);
  const card = item.card || workspace?.cards?.find((entry) => entry.id === cardId) || null;
  return {
    ...item,
    workItemId: workItemIdOf(item),
    caseId: item.caseId || item.case_id || workspace?.caseId || "",
    workItemType: item.workItemType || item.work_item_type || card?.id || "",
    lifecycleState: item.lifecycleState || item.lifecycle_state || item.status || card?.status || "ready",
    ownerRole: item.ownerRole || item.owner_role || card?.confirmation?.requiredRole || card?.Confirmation?.requiredRole || "operator",
    workspaceId,
    cardId,
    workspace,
    card
  };
}

export function SurfaceRouteVM(target = {}) {
  return {
    canOpen: Boolean(target.canOpen),
    workItemId: target.workItem?.workItemId || "",
    workspaceId: target.workItem?.workspaceId || "",
    cardId: target.workItem?.cardId || "",
    reason: target.reason || "",
    titleKey: target.titleKey || "",
    bodyKey: target.bodyKey || "",
    nextActionKey: target.nextActionKey || "",
    refreshActionKey: target.refreshActionKey || "",
    returnActionKey: target.returnActionKey || ""
  };
}

function runtimeItems(state = {}) {
  return [
    ...(state.runtimeStore?.operationWorkItems || []),
    ...(state.runtimeStore?.workQueue || [])
  ].filter((item) => workItemIdOf(item));
}

function normalizeInput(input = {}) {
  if (typeof input === "string") return { workItemId: input };
  return {
    workItemId: input.workItemId || input.work_item_id || "",
    workspaceId: input.workspaceId || input.workspace_id || "",
    cardId: input.cardId || input.card_id || ""
  };
}

function materializeWorkItem(item, state) {
  if (!item) return null;
  return WorkItemIdentityVM(item, state);
}

function workspaceById(state, workspaceId) {
  return (state.runtimeStore?.workspaces || []).find((workspace) => workspace.id === workspaceId) || null;
}

function workItemIdOf(item = {}) {
  return item.workItemId || item.work_item_id || "";
}

function workspaceIdOf(item = {}) {
  return item.workspaceId || item.workspace_id || item.workspace?.id || "";
}

function cardIdOf(item = {}) {
  return item.cardId || item.card_id || item.card?.id || "";
}
