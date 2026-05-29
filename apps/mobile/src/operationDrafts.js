const draftPrefix = "workosnext.operationDraft.";

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

export function saveDraft(workspaceId, cardId, values, evidenceDrafts = []) {
  const draft = {
    workspaceId,
    cardId,
    values,
    evidenceDrafts,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(draftKey(workspaceId, cardId), JSON.stringify(draft));
  return draft;
}

export function clearDraft(workspaceId, cardId) {
  localStorage.removeItem(draftKey(workspaceId, cardId));
}
