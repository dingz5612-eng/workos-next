import { recordMobileClientEvent } from "./apiClient.js";
import { createFeedbackMessage, saveFeedbackMessage, updateFeedbackMessage } from "./feedbackMessages.js";

export async function sendFeedbackMessage(ctx) {
  const fields = feedbackFormFields();
  const message = createFeedbackMessage(fields, ctx.state);
  if (!message.body) {
    ctx.state.feedbackMessage = {
      status: "missingBody",
      message: ctx.tr("feedbackMessageRequired")
    };
    ctx.render();
    return;
  }

  saveFeedbackMessage({ ...message, status: "sending" }, ctx.state.currentActor);
  ctx.state.feedbackMessage = {
    status: "sending",
    message: ctx.tr("feedbackSending")
  };
  ctx.render();

  try {
    const result = await recordMobileClientEvent({
      eventType: "feedback.message.sent",
      objectType: "feedbackMessage",
      objectId: message.messageId,
      language: ctx.state.lang,
      source: "mobile.feedback"
    });
    updateFeedbackMessage(message.messageId, {
      status: "sent",
      sentAt: new Date().toISOString(),
      eventId: result.eventId || result.EventId || ""
    }, ctx.state.currentActor);
    ctx.state.feedbackMessage = {
      status: "sent",
      message: ctx.tr("feedbackSent")
    };
  } catch {
    updateFeedbackMessage(message.messageId, {
      status: "localPending",
      sentAt: ""
    }, ctx.state.currentActor);
    ctx.state.feedbackMessage = {
      status: "localPending",
      message: ctx.tr("feedbackLocalPending")
    };
  }
  ctx.render();
}

function feedbackFormFields() {
  const recipientId = document.querySelector("[data-feedback-recipient]")?.value || "";
  const topic = document.querySelector("[data-feedback-topic]")?.value || "";
  const targetAccount = document.querySelector("[data-feedback-account]")?.value || "";
  const body = document.querySelector("[data-feedback-body]")?.value || "";
  return { recipientId, topic, targetAccount, body };
}
