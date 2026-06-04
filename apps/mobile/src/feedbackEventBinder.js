import { sendFeedbackMessage } from "./feedbackController.js";

export function bindFeedbackEvents(ctx) {
  document.querySelector("[data-send-feedback]")?.addEventListener("click", () => sendFeedbackMessage(ctx));
}
