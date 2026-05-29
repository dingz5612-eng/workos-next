import { confirmCard, prepareCard, waitForProjectionEvent } from "./apiClient.js";

export function operationIdempotencyKey(workspaceId, cardId, actor) {
  const uuid = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${workspaceId}:${cardId}:${actor.actorId}:${uuid}`;
}

export async function submitCardOperation({ workspace, card, actor, language, fieldValues, evidenceIds, onProjection }) {
  await prepareCard(workspace.id, card.id);
  const result = await confirmCard(workspace.id, card.id, actor.token, {
    language,
    idempotencyKey: operationIdempotencyKey(workspace.id, card.id, actor),
    fieldValues,
    evidenceIds
  });
  if (result.projection) onProjection(result.projection);
  try {
    await waitForProjectionEvent(result.event?.eventId, onProjection);
  } catch {
    // Confirm already succeeded. The outbox projector can lag briefly, so do not
    // turn a committed event into a user-visible submit failure.
  }
  return result;
}
