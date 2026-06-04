import {
  feedbackContextFromState,
  feedbackRecipientLabelKey,
  feedbackRecipients,
  feedbackTopicLabelKey,
  feedbackTopics,
  loadFeedbackMessages
} from "../feedbackMessages.js";

export function feedbackView(ctx) {
  const context = feedbackContextFromState(ctx.state);
  const displayContext = feedbackDisplayContext(context, ctx);
  const messages = loadFeedbackMessages(ctx.state.currentActor);
  return ctx.shell(`
    <section class="profile-card personal-runtime-head">
      <span>${ctx.tr("feedbackChannel")}</span>
      <h1>${ctx.tr("feedbackTitle")}</h1>
      <p>${ctx.tr("feedbackMessageBody")}</p>
    </section>
    <section class="feedback-message-channel" data-surface="feedback-message-channel" data-boundary-rule="collaboration-message-does-not-write-business-facts">
      <form class="feedback-form">
        <label>
          <span>${ctx.tr("feedbackRecipient")}</span>
          <select data-feedback-recipient>
            ${feedbackRecipients.map((recipient) => `<option value="${ctx.escapeAttr(recipient.id)}">${ctx.tr(recipient.labelKey)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>${ctx.tr("feedbackTargetAccount")}</span>
          <input data-feedback-account placeholder="${ctx.tr("feedbackTargetAccountPlaceholder")}" />
        </label>
        <label>
          <span>${ctx.tr("feedbackTopic")}</span>
          <select data-feedback-topic>
            ${feedbackTopics.map((topic) => `<option value="${ctx.escapeAttr(topic.id)}">${ctx.tr(topic.labelKey)}</option>`).join("")}
          </select>
        </label>
        <label class="feedback-body-field">
          <span>${ctx.tr("feedbackMessage")}</span>
          <textarea data-feedback-body rows="5" placeholder="${ctx.tr("feedbackMessagePlaceholder")}"></textarea>
        </label>
        <section class="feedback-context-panel">
          <b>${ctx.tr("feedbackContext")}</b>
          <dl>
            ${contextRow(ctx.tr("feedbackContextPage"), displayContext.view, ctx)}
            ${contextRow(ctx.tr("currentRole"), roleLabel(context.actorRole, ctx), ctx)}
            ${contextRow(ctx.tr("feedbackContextWorkspace"), displayContext.workspace, ctx)}
            ${contextRow(ctx.tr("feedbackContextCard"), displayContext.card, ctx)}
            ${contextRow(ctx.tr("feedbackContextWorkItem"), displayContext.workItem, ctx)}
          </dl>
        </section>
        ${ctx.state.feedbackMessage?.message ? `<p class="feedback-send-state ${ctx.escapeAttr(ctx.state.feedbackMessage.status)}">${ctx.escapeHtml(ctx.state.feedbackMessage.message)}</p>` : ""}
        <div class="empty-actions">
          <button type="button" data-send-feedback>${ctx.tr("feedbackSend")}</button>
          <button type="button" class="secondary" data-view="workbench">${ctx.tr("openWorkbenchAction")}</button>
        </div>
      </form>
      <section class="feedback-thread" data-surface="feedback-message-thread">
        <h2>${ctx.tr("feedbackRecentMessages")}</h2>
        ${messages.length ? messages.map((message) => feedbackMessageCard(message, ctx)).join("") : `<p>${ctx.tr("feedbackNoMessages")}</p>`}
      </section>
    </section>
  `);
}

function feedbackDisplayContext(context, ctx) {
  const workspace = (ctx.state.runtimeStore?.workspaces || []).find((item) => item.id === context.workspaceId);
  const card = (workspace?.cards || []).find((item) => item.id === context.cardId);
  return {
    view: ctx.tr(context.view) === context.view ? ctx.tr("feedbackContextReady") : ctx.tr(context.view),
    workspace: workspace ? ctx.tx(workspace.title) : ctx.tr("feedbackContextReady"),
    card: card ? ctx.tx(card.title) : ctx.tr("feedbackContextReady"),
    workItem: context.workItemId ? ctx.tr("feedbackContextReady") : ctx.tr("noRuntimeItems")
  };
}

function feedbackMessageCard(message, ctx) {
  return `<article class="feedback-message-card ${ctx.escapeAttr(message.status)}">
    <span>${ctx.tr(feedbackTopicLabelKey(message.topic))} · ${ctx.tr(feedbackRecipientLabelKey(message.recipientId))}</span>
    <strong>${ctx.escapeHtml(message.recipientAccount || "-")}</strong>
    <p>${ctx.escapeHtml(message.body)}</p>
    <small>${ctx.tr(feedbackStatusKey(message.status))} · ${ctx.escapeHtml(message.sentAt || message.createdAt || "")}</small>
  </article>`;
}

function feedbackStatusKey(status = "") {
  if (status === "sent") return "feedbackStatusSent";
  if (status === "sending") return "feedbackStatusSending";
  if (status === "localPending") return "feedbackStatusLocalPending";
  return "feedbackStatusDraft";
}

function contextRow(label, value, ctx) {
  return `<dt>${ctx.escapeHtml(label)}</dt><dd>${ctx.escapeHtml(value || "-")}</dd>`;
}

function roleLabel(role, ctx) {
  const key = `${role || "operator"}Role`;
  const label = ctx.tr(key);
  return label === key ? role : label;
}
