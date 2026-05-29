import { confirmCard, fetchAccommodationLens, prepareCard, waitForProjectionEvents } from "./apiClient.js";
import { defaultAccommodationLensIds, lensIdsForWorkspace } from "./runtimeLensCatalog.js";

export function operationIdempotencyKey() {
  return randomUuid();
}

export function operationSubmissionId() {
  return randomUuid();
}

export function cardInstanceIdFor(workspace, card) {
  return `${workspace.id}:${card.id}:${card.status || "unknown"}`;
}

export function aggregateRefFor(fieldValues) {
  const keys = ["roomId", "bedId", "stayId", "depositId", "paymentId", "leadId", "reservationId", "serviceTaskId", "expenseId", "periodId"];
  const key = keys.find((item) => fieldValues?.[item]);
  return key ? `${key}:${fieldValues[key]}` : null;
}

export function createSubmissionProtocol(workspace, card) {
  return {
    idempotencyKey: operationIdempotencyKey(),
    submissionId: operationSubmissionId(),
    cardInstanceId: cardInstanceIdFor(workspace, card)
  };
}

export async function submitCardOperation({ workspace, card, actor, language, fieldValues, evidenceIds, submissionProtocol, onProjection, onLens }) {
  await prepareCard(workspace.id, card.id);
  const protocol = submissionProtocol || createSubmissionProtocol(workspace, card);
  const result = await confirmCard(workspace.id, card.id, actor.token, {
    language,
    idempotencyKey: protocol.idempotencyKey,
    submissionId: protocol.submissionId,
    cardInstanceId: protocol.cardInstanceId,
    aggregateRef: aggregateRefFor(fieldValues),
    fieldValues,
    evidenceIds
  });
  if (result.projection) onProjection(result.projection);
  try {
    await waitForProjectionEvents(eventIdsFromConfirmResult(result), onProjection);
  } catch {
    // Confirm already succeeded. The outbox projector can lag briefly, so do not
    // turn a committed event into a user-visible submit failure.
  }
  await refreshAccommodationLenses(lensIdsForWorkspace(workspace.id), onLens);
  return result;
}

export async function refreshDefaultAccommodationLenses(onLens) {
  return refreshAccommodationLenses(defaultAccommodationLensIds, onLens);
}

export async function refreshAccommodationLenses(lensIds, onLens) {
  const uniqueIds = Array.from(new Set(lensIds || [])).filter(Boolean);
  if (!uniqueIds.length) return {};
  const entries = await Promise.all(uniqueIds.map(async (lensId) => [lensId, await fetchAccommodationLens(lensId)]));
  const payload = Object.fromEntries(entries);
  if (onLens) onLens(payload);
  return payload;
}

function eventIdsFromConfirmResult(result) {
  const events = Array.isArray(result?.events) ? result.events : [result?.event];
  return events.map((item) => item?.eventId).filter(Boolean);
}

function randomUuid() {
  return globalThis.crypto?.randomUUID?.() || `sub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
