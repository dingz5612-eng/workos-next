const draftPrefix = "workosnext.operationDraft.";
const completedRecordSnapshotsKey = "workosnext.completedRecordSnapshots.v1";
const maxCompletedRecordSnapshots = 80;

export function draftKey(workspaceId, cardId) {
  return `${draftPrefix}${workspaceId}.${cardId}`;
}

export function loadDraft(workspaceId, cardId) {
  try {
    const raw = localStorage.getItem(draftKey(workspaceId, cardId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveDraft(workspaceId, cardId, values, evidenceDrafts = [], submissionProtocol = null) {
  const existing = loadDraft(workspaceId, cardId);
  const draft = {
    workspaceId,
    cardId,
    values,
    evidenceDrafts,
    submissionProtocol: submissionProtocol || existing.submissionProtocol || null,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(draftKey(workspaceId, cardId), JSON.stringify(draft));
  return draft;
}

export function clearDraft(workspaceId, cardId) {
  localStorage.removeItem(draftKey(workspaceId, cardId));
}

export function loadCompletedRecordSnapshots() {
  try {
    const raw = localStorage.getItem(completedRecordSnapshotsKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.workspaceId && item?.cardId) : [];
  } catch {
    return [];
  }
}

export function loadCompletedRecordSnapshot(workspaceId, cardId, options = {}) {
  const workItemId = options.workItemId || "";
  const submissionId = options.submissionId || "";
  return loadCompletedRecordSnapshots()
    .filter((item) => item.workspaceId === workspaceId && item.cardId === cardId)
    .filter((item) => !workItemId || !item.workItemId || item.workItemId === workItemId || item.sourceWorkItemId === workItemId)
    .find((item) => !submissionId || item.submissionId === submissionId) ||
    loadCompletedRecordSnapshots()
      .filter((item) => item.workspaceId === workspaceId && item.cardId === cardId)[0] ||
    null;
}

export function saveCompletedRecordSnapshot(input = {}) {
  if (!input.workspaceId || !input.cardId) return null;
  const snapshot = {
    workspaceId: input.workspaceId,
    cardId: input.cardId,
    workItemId: input.workItemId || "",
    sourceWorkItemId: input.sourceWorkItemId || "",
    submissionId: input.submissionId || input.result?.submissionId || input.result?.commandSubmissionId || "",
    cardInstanceId: input.cardInstanceId || "",
    aggregateRef: input.aggregateRef || "",
    values: primitiveMap(input.values || {}),
    evidenceDrafts: Array.isArray(input.evidenceDrafts) ? input.evidenceDrafts : [],
    evidenceIds: Array.isArray(input.evidenceIds) ? input.evidenceIds : [],
    traceRefs: Array.isArray(input.result?.traceRefs) ? input.result.traceRefs : Array.isArray(input.result?.resultEventIds) ? input.result.resultEventIds : [],
    savedAt: input.savedAt || new Date().toISOString(),
    source: "mobile_completed_record_read_cache"
  };
  const snapshots = loadCompletedRecordSnapshots();
  const deduped = snapshots.filter((item) => snapshotIdentity(item) !== snapshotIdentity(snapshot));
  localStorage.setItem(completedRecordSnapshotsKey, JSON.stringify([snapshot, ...deduped].slice(0, maxCompletedRecordSnapshots)));
  return snapshot;
}

function primitiveMap(values = {}) {
  return Object.entries(values || {}).reduce((current, [key, value]) => {
    if (value === undefined || value === null) return current;
    if (["string", "number", "boolean"].includes(typeof value)) {
      current[key] = String(value);
    }
    return current;
  }, {});
}

function snapshotIdentity(snapshot = {}) {
  return [
    snapshot.workspaceId || "",
    snapshot.cardId || "",
    snapshot.submissionId || snapshot.workItemId || snapshot.savedAt || ""
  ].join(":");
}
