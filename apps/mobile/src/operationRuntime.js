import {
  attachEvidence,
  confirmOperationWorkItem,
  createEvidenceDraft,
  fetchAccommodationLens,
  fetchOperationWorkItems,
  prepareOperationWorkItem,
  waitForProjectionEvents
} from "./apiClient.js";
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

export async function submitWorkItemOperation({
  workspace,
  card,
  workItemId: explicitWorkItemId,
  actor,
  language,
  fieldValues,
  evidenceIds,
  submissionProtocol,
  onProjection,
  onLens,
  onOperationWorkItems,
  onReadSideSynced
}) {
  const workItemId = explicitWorkItemId || workItemIdFor(workspace, card);
  if (!workItemId) {
    return {
      confirmed: false,
      status: "business_blocked_422",
      commitStatus: "blocked",
      projectionStatus: "not_started",
      error: "persisted_work_item_required",
      reason: "persisted_work_item_required",
      message: "需要先生成可办理任务，再提交处理。",
      source: "operations_runtime_pure"
    };
  }

  const protocol = submissionProtocol || createSubmissionProtocol(workspace, card, fieldValues);
  const aggregateRef = protocol.aggregateRef || aggregateRefFor(fieldValues);
  await prepareOperationWorkItem(workItemId, {
    language,
    submissionId: protocol.submissionId,
    aggregateRef,
    fieldValues,
    evidenceIds
  }, actor.token);
  const result = await confirmOperationWorkItem(workItemId, actor.token, {
    language,
    idempotencyKey: protocol.idempotencyKey,
    submissionId: protocol.submissionId,
    aggregateRef,
    fieldValues,
    evidenceIds
  });
  if (!isCommittedConfirm(result)) {
    return result;
  }
  if (result.projection && onProjection) onProjection(result.projection);
  scheduleCommittedReadSideSync({
    result,
    workspace,
    onProjection,
    onLens,
    onOperationWorkItems,
    onReadSideSynced
  });
  return {
    ...result,
    readSideSyncStatus: "scheduled"
  };
}

function workItemIdFor(workspace, card) {
  if (workspace?.runtimeWorkItemId) return workspace.runtimeWorkItemId;
  if (card?.runtimeWorkItemId) return card.runtimeWorkItemId;
  if (workspace?.workItemId && isPersistedWorkItemId(workspace.workItemId)) return workspace.workItemId;
  if (card?.workItemId && isPersistedWorkItemId(card.workItemId)) return card.workItemId;
  return "";
}

function isPersistedWorkItemId(value) {
  return String(value || "").includes(":") || /^wi-/i.test(String(value || ""));
}

export async function materializeEvidenceObjects({ workspace, card, actor, submissionProtocol, evidenceDrafts }) {
  const drafts = Array.isArray(evidenceDrafts) ? evidenceDrafts.filter((item) => item?.requirementId) : [];
  if (!drafts.length) return [];
  const actorToken = actor?.token || "";
  return Promise.all(drafts.map(async (draft) => {
    const evidence = await createEvidenceDraft({
      workspaceId: workspace.id,
      cardId: card.id,
      cardInstanceId: submissionProtocol.cardInstanceId,
      submissionId: submissionProtocol.submissionId,
      requirementId: draft.requirementId,
      evidenceId: draft.evidenceId?.startsWith("evd-") ? draft.evidenceId : null
    }, actorToken);
    const attached = await attachEvidence(evidence.evidenceId, {
      fileName: `${draft.requirementId}.runtime-evidence.txt`,
      contentType: "text/plain",
      contentSha256: draft.contentSha256 || stableHash(`${workspace.id}:${card.id}:${draft.requirementId}:${submissionProtocol.submissionId}`),
      sizeBytes: draft.sizeBytes || 1
    }, actorToken);
    draft.evidenceId = attached.evidenceId;
    return attached.evidenceId;
  }));
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

function scheduleCommittedReadSideSync({ result, workspace, onProjection, onLens, onOperationWorkItems, onReadSideSynced }) {
  const run = () => {
    void syncCommittedReadSide({
      result,
      workspace,
      onProjection,
      onLens,
      onOperationWorkItems
    }).then((syncResult) => {
      if (onReadSideSynced) onReadSideSynced(syncResult);
    }).catch(() => {
      if (onReadSideSynced) onReadSideSynced({
        commandSubmissionId: result?.commandSubmissionId || result?.submissionId || "",
        projectionStatus: "pending",
        lensStatus: "failed",
        workItemsStatus: "failed"
      });
    });
  };
  if (typeof globalThis.setTimeout === "function") {
    globalThis.setTimeout(run, 0);
    return;
  }
  if (typeof globalThis.queueMicrotask === "function") {
    globalThis.queueMicrotask(run);
  } else {
    run();
  }
}

async function syncCommittedReadSide({ result, workspace, onProjection, onLens, onOperationWorkItems }) {
  const syncResult = {
    commandSubmissionId: result?.commandSubmissionId || result?.submissionId || "",
    projectionStatus: result?.projectionStatus === "projected" ? "projected" : "pending",
    lensStatus: "not_started",
    workItemsStatus: "not_started"
  };

  try {
    const projected = await waitForProjectionEvents(eventIdsFromConfirmResult(result), onProjection);
    if (projected || result?.projectionStatus === "projected") {
      syncResult.projectionStatus = "projected";
    }
  } catch {
    syncResult.projectionStatus = "pending";
  }

  try {
    await refreshAccommodationLenses(lensIdsForWorkspace(workspace.id), onLens);
    syncResult.lensStatus = "refreshed";
  } catch {
    syncResult.lensStatus = "failed";
  }

  try {
    const operationWorkItems = await fetchOperationWorkItems();
    if (onOperationWorkItems) onOperationWorkItems(operationWorkItems);
    syncResult.workItemsStatus = "refreshed";
  } catch {
    syncResult.workItemsStatus = "failed";
  }

  return syncResult;
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
