import { attachEvidence, confirmCard, createEvidenceDraft, fetchAccommodationLens, prepareCard, waitForProjectionEvents } from "./apiClient.js";
import { defaultAccommodationLensIds, lensIdsForWorkspace } from "./runtimeLensCatalog.js";

export function operationIdempotencyKey() {
  return randomUuid();
}

export function operationSubmissionId() {
  return randomUuid();
}

export function cardInstanceIdFor(workspace, card, aggregateRef = null) {
  const scope = aggregateRef ? stableHash(aggregateRef) : "no-aggregate";
  return `ci-${workspace.id}-${card.id}-${scope}-${randomUuid()}`;
}

export function aggregateRefFor(fieldValues) {
  const keys = ["roomId", "bedId", "stayId", "depositId", "depositReceiptId", "paymentId", "paymentReceiptId", "leadId", "reservationId", "serviceTaskId", "expenseId", "periodId", "settlementId"];
  const key = keys.find((item) => fieldValues?.[item]);
  return key ? `${key}:${fieldValues[key]}` : null;
}

export function createSubmissionProtocol(workspace, card, fieldValues = {}) {
  const aggregateRef = aggregateRefFor(fieldValues);
  return {
    idempotencyKey: operationIdempotencyKey(),
    submissionId: operationSubmissionId(),
    cardInstanceId: cardInstanceIdFor(workspace, card, aggregateRef),
    aggregateRef
  };
}

export async function submitCardOperation({ workspace, card, actor, language, fieldValues, evidenceIds, submissionProtocol, onProjection, onLens }) {
  const protocol = submissionProtocol || createSubmissionProtocol(workspace, card, fieldValues);
  const aggregateRef = protocol.aggregateRef || aggregateRefFor(fieldValues);
  await prepareCard(workspace.id, card.id, {
    submissionId: protocol.submissionId,
    cardInstanceId: protocol.cardInstanceId,
    aggregateRef
  });
  const result = await confirmCard(workspace.id, card.id, actor.token, {
    language,
    idempotencyKey: protocol.idempotencyKey,
    submissionId: protocol.submissionId,
    cardInstanceId: protocol.cardInstanceId,
    aggregateRef,
    fieldValues,
    evidenceIds
  });
  if (!isCommittedConfirm(result)) {
    return result;
  }
  if (result.projection) onProjection(result.projection);
  try {
    await waitForProjectionEvents(eventIdsFromConfirmResult(result), onProjection);
  } catch {
    // Confirm already succeeded. The outbox projector can lag briefly, so do not
    // turn a committed event into a user-visible submit failure.
  }
  try {
    await refreshAccommodationLenses(lensIdsForWorkspace(workspace.id), onLens);
  } catch {
    // Lens refresh is read-side sync. The committed confirm response is still the
    // source of truth for success semantics.
  }
  return result;
}

export async function materializeEvidenceObjects({ workspace, card, actor, submissionProtocol, evidenceDrafts }) {
  const drafts = Array.isArray(evidenceDrafts) ? evidenceDrafts.filter((item) => item?.requirementId) : [];
  if (!drafts.length) return [];
  const actorId = actor?.actorId || actor?.displayName || "runtime";
  const evidenceIds = [];
  for (const draft of drafts) {
    const evidence = await createEvidenceDraft({
      workspaceId: workspace.id,
      cardId: card.id,
      cardInstanceId: submissionProtocol.cardInstanceId,
      submissionId: submissionProtocol.submissionId,
      requirementId: draft.requirementId,
      evidenceId: draft.evidenceId?.startsWith("evd-") ? draft.evidenceId : null
    }, actorId);
    const attached = await attachEvidence(evidence.evidenceId, {
      fileName: `${draft.requirementId}.runtime-evidence`,
      contentType: "application/octet-stream",
      contentSha256: draft.contentSha256 || stableHash(`${workspace.id}:${card.id}:${draft.requirementId}:${submissionProtocol.submissionId}`),
      sizeBytes: draft.sizeBytes || 1
    }, actorId);
    evidenceIds.push(attached.evidenceId);
    draft.evidenceId = attached.evidenceId;
  }

  return evidenceIds;
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
  if (Array.isArray(result?.resultEventIds)) return result.resultEventIds.filter(Boolean);
  const events = Array.isArray(result?.events) ? result.events : [result?.event];
  return events.map((item) => item?.eventId).filter(Boolean);
}

function isCommittedConfirm(result) {
  return result?.confirmed === true && result?.commitStatus === "committed";
}

function randomUuid() {
  return globalThis.crypto?.randomUUID?.() || `sub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stableHash(value) {
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16);
}
