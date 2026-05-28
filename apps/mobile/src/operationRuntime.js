import { confirmCard, prepareCard, waitForProjectionEvent } from "./apiClient.js";

export function operationIdempotencyKey(workspaceId, cardId, actor) {
  return `${workspaceId}:${cardId}:${actor.actorId}`;
}

export async function submitCardOperation({ workspace, card, actor, language, fieldValues, onProjection }) {
  await prepareCard(workspace.id, card.id);
  const result = await confirmCard(workspace.id, card.id, actor.token, {
    language,
    idempotencyKey: operationIdempotencyKey(workspace.id, card.id, actor),
    fieldValues,
    evidenceIds: []
  });
  await waitForProjectionEvent(result.event.eventId, onProjection);
  return result;
}
