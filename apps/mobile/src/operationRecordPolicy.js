import { isTerminalCardStatus } from "./selectors/workspaceSelectors.js";

export const businessOperationActionOrder = Object.freeze([
  "create_active_work_item",
  "view_readonly_completed_record",
  "correct_append_only_from_record"
]);

export function completedRecordActionPolicy({ workspace = {}, card = {}, state = {}, surface = "" } = {}) {
  const completed = isTerminalCardStatus(card?.status);
  return {
    completed,
    actionOrder: businessOperationActionOrder,
    canCreate: !completed,
    canView: completed,
    canCorrect: completed && surface === "readonlyRecord",
    correctionRequiresReadonlyRecord: true,
    nextWorkItem: completed ? nextAvailableWorkItemForRecord(workspace, card?.id || "", state) : null
  };
}

export function nextAvailableWorkItemForRecord(workspace = {}, currentCardId = "", state = {}) {
  const currentIndex = (workspace?.cards || []).findIndex((card) => card.id === currentCardId);
  if (currentIndex < 0) return null;
  const nextCard = (workspace.cards || []).slice(currentIndex + 1).find((card) => !isTerminalCardStatus(card.status));
  if (!nextCard) return null;
  const runtimeItems = [
    ...(state.runtimeStore?.operationWorkItems || []),
    ...(state.runtimeStore?.workQueue || [])
  ];
  return runtimeItems
    .map((item) => ({
      workItemId: item.workItemId || item.work_item_id || "",
      workspaceId: item.workspaceId || item.workspace_id || item.workspace?.id || "",
      cardId: item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.card?.id || "",
      lifecycleState: item.lifecycleState || item.lifecycle_state || item.status || ""
    }))
    .find((item) =>
      item.workItemId &&
      item.workspaceId === workspace.id &&
      item.cardId === nextCard.id &&
      !isTerminalCardStatus(item.lifecycleState)) || null;
}
