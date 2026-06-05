import { loadCompletedRecordSnapshots, loadDraft } from "./operationDrafts.js";

export function operationCaseContextPayloads(state = {}, item = {}, card = {}) {
  const selected = selectedOperationWorkItem(state, item, card);
  const previousCardIds = previousCardIdsFor(item, card);
  const sameWorkspace = (workspaceId) => (workspaceId || "") === (item?.id || "");
  const runtimePayloads = runtimeWorkItems(state)
    .filter((workItem) => sameWorkspace(workItem.workspaceId || workItem.workspace_id || workItem.payload?.workspaceId || workItem.Payload?.workspaceId))
    .filter((workItem) => {
      const cardId = workItem.cardId || workItem.card_id || workItem.payload?.cardId || workItem.Payload?.cardId || "";
      return cardId === card?.id || previousCardIds.has(cardId);
    })
    .map((workItem) => workItem.payload || workItem.Payload || {});
  const snapshotPayloads = loadCompletedRecordSnapshots()
    .filter((snapshot) => sameWorkspace(snapshot.workspaceId) && previousCardIds.has(snapshot.cardId))
    .map((snapshot) => snapshot.values || {});
  const draftPayloads = [...previousCardIds]
    .map((cardId) => loadDraft(item.id, cardId).values || {});
  const eventPayloads = [
    ...(state.projectionEvents || []),
    ...(state.runtimeStore?.events || [])
  ]
    .map((event) => ({
      ...event,
      workspaceId: event.workspaceId || event.WorkspaceId,
      payload: event.payload || event.Payload || {}
    }))
    .filter((event) => sameWorkspace(event.workspaceId));
  return [
    selected?.payload || selected?.Payload || {},
    state?.lastActionResult?.workspaceId === item?.id ? state.lastActionResult.fieldValues || {} : {},
    ...eventPayloads,
    ...runtimePayloads,
    ...snapshotPayloads,
    ...draftPayloads
  ];
}

function previousCardIdsFor(item = {}, card = {}) {
  const cards = item.cards || [];
  const currentIndex = cards.findIndex((candidate) => candidate.id === card?.id);
  return new Set(cards
    .slice(0, currentIndex < 0 ? 0 : currentIndex)
    .map((candidate) => candidate.id)
    .filter(Boolean));
}

export function selectedOperationWorkItem(state = {}, workspace = {}, card = {}) {
  const selectedWorkItemId = state.selectedWorkItemId || "";
  const runtimeItems = runtimeWorkItems(state);
  return runtimeItems.find((item) => [item.workItemId, item.work_item_id].includes(selectedWorkItemId)) ||
    runtimeItems.find((item) =>
      (item.workspaceId || item.workspace_id) === workspace?.id &&
      (item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId) === card?.id) ||
    null;
}

export function runtimeWorkItems(state = {}) {
  return [
    ...arrayPayload(state.runtimeStore?.operationWorkItems),
    ...arrayPayload(state.runtimeStore?.workQueue)
  ];
}

export function normalizeOperationWorkItemsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.operationWorkItems)) return payload.operationWorkItems;
  if (Array.isArray(payload?.workItems)) return payload.workItems;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export function arrayPayload(value) {
  return Array.isArray(value) ? value : [];
}

export function workItemIdOf(item = {}) {
  return item.workItemId || item.work_item_id || "";
}

export function workItemWorkspaceId(item = {}) {
  return item.workspaceId || item.workspace_id || item.workspace?.id || "";
}

export function workItemCardId(item = {}) {
  return item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.card?.id || "";
}
