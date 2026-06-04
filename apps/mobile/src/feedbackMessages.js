export const feedbackRecipients = [
  { id: "productDesign", labelKey: "feedbackRecipientProductDesign", account: "product.design" },
  { id: "businessOwner", labelKey: "feedbackRecipientBusinessOwner", account: "business.owner" },
  { id: "systemSupport", labelKey: "feedbackRecipientSystemSupport", account: "system.support" },
  { id: "collaborationOwner", labelKey: "feedbackRecipientCollaborationOwner", account: "collaboration.owner" }
];

export const feedbackTopics = [
  { id: "experience", labelKey: "feedbackTopicExperience" },
  { id: "businessFlow", labelKey: "feedbackTopicBusinessFlow" },
  { id: "fieldValidation", labelKey: "feedbackTopicFieldValidation" },
  { id: "copyLanguage", labelKey: "feedbackTopicCopyLanguage" },
  { id: "performance", labelKey: "feedbackTopicPerformance" }
];

export function feedbackContextFromState(state = {}) {
  return {
    view: state.view || "",
    language: state.lang || "zh-CN",
    actorRole: state.currentActor?.role || "",
    actorName: state.currentActor?.displayName || state.currentActor?.actorId || "",
    workspaceId: state.selectedWorkspace || "",
    cardId: state.selectedCardId || "",
    workItemId: state.selectedWorkItemId || "",
    deviceSurface: state.currentDevice?.surface || "mobile"
  };
}

export function createFeedbackMessage(fields = {}, state = {}) {
  const context = feedbackContextFromState(state);
  const recipient = feedbackRecipients.find((item) => item.id === fields.recipientId) || feedbackRecipients[0];
  const targetAccount = String(fields.targetAccount || "").trim() || recipient.account;
  return {
    messageId: `fb-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    recipientId: recipient.id,
    recipientAccount: targetAccount,
    topic: fields.topic || feedbackTopics[0].id,
    body: String(fields.body || "").trim(),
    context,
    status: "draft",
    createdAt: new Date().toISOString(),
    sentAt: ""
  };
}

export function loadFeedbackMessages(actor = null) {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(feedbackStorageKey(actor)) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function saveFeedbackMessage(message = {}, actor = null) {
  if (typeof localStorage === "undefined" || !message.messageId) return message;
  const current = loadFeedbackMessages(actor);
  const next = [
    message,
    ...current.filter((item) => item.messageId !== message.messageId)
  ].slice(0, 20);
  localStorage.setItem(feedbackStorageKey(actor), JSON.stringify(next));
  return message;
}

export function updateFeedbackMessage(messageId, patch = {}, actor = null) {
  const current = loadFeedbackMessages(actor);
  const existing = current.find((item) => item.messageId === messageId);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  saveFeedbackMessage(updated, actor);
  return updated;
}

export function feedbackRecipientLabelKey(id = "") {
  return (feedbackRecipients.find((item) => item.id === id) || feedbackRecipients[0]).labelKey;
}

export function feedbackTopicLabelKey(id = "") {
  return (feedbackTopics.find((item) => item.id === id) || feedbackTopics[0]).labelKey;
}

export function feedbackStorageKey(actor = null) {
  const id = actor?.userId || actor?.actorId || actor?.role || "anonymous";
  return `workosnext.feedback.messages.${id}`;
}
