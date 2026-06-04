import { selectSurfaceStats } from "../selectors/surfaceSelectors.js";
import { DeviceTrustPanel, SubmitQueue, UploadQueue } from "./experienceComponents.js";

export function meView(ctx) {
  const { state, tr, shell } = ctx;
  const actorDisplayName = state.currentActor?.displayName ? ctx.escapeHtml(state.currentActor.displayName) : tr("personalModeTitle");
  const actorRole = state.currentActor?.role ? roleLabel(state.currentActor.role, tr) : "-";
  const stats = selectSurfaceStats(state);
  const hasStats = stats.queueCount || stats.blockedCount || stats.confirmCount;
  const searches = (state.recentSearches || []).map((item) => ctx.escapeHtml(item)).join(" · ");
  return shell(`
    <section class="profile-card" data-surface="personal-ops-center">
      <span>${tr("role")}</span>
      <h1>${tr("personalOpsCenter")}</h1>
      <strong>${actorDisplayName}</strong>
      <p>${tr("permission")}: ${ctx.escapeHtml(actorRole)} · ${tr("stay")} · ${tr("myPermissions")}</p>
      <button id="logout" class="secondary">${tr("logout")}</button>
    </section>
    ${hasStats ? `<section class="metric-grid">${ctx.metric(stats.queueCount, tr("work"))}${ctx.metric(stats.blockedCount, tr("workBlocked"))}${ctx.metric(stats.confirmCount, tr("cardConfirm"))}</section>` : ""}
    <section class="personal-grid">
      ${personal("learning", "learningCenter", "learningCenterBody", tr)}
      ${personal("permissions", "myPermissions", "myPermissionsBody", tr)}
      ${personalCopy("uploadQueue", ctx.tr("evidenceUpload"), tr("uploadQueueBody"))}
      ${personalCopy("submitQueue", ctx.tr("submissionQueue"), tr("submitQueueBody"))}
      ${personal("recentSubmissions", "recentSubmissions", "recentSubmissionsBody", tr)}
      ${personal("recentTraces", "recentTraces", "recentTracesBody", tr)}
      ${personalCopy("deviceTrust", `${ctx.tr("currentDevice")} · ${tr("deviceTrustStatus")}`, tr("deviceTrustStatusBody"))}
      ${personal("feedback", "feedbackTitle", "feedbackBody", tr)}
    </section>
    <section class="compact-section">
      <h2>${tr("stats")}</h2>
      <p>${tr("commonSearch")}: ${searches || (state.apiStatus === "online" ? tr("coachNoMatch") : tr("apiOffline"))}</p>
      <p>${tr("savedFilter")}: ${tr(state.queueDomain)} + ${tr(state.queueBadge)}</p>
    </section>
    <section class="personal-ops-grid">
      ${UploadQueue(state, ctx)}
      ${SubmitQueue(state, ctx)}
      ${DeviceTrustPanel(state, ctx)}
    </section>
  `);
}

function personal(view, title, body, tr) {
  return `<button class="personal-card" data-view="${view}"><strong>${tr(title)}</strong><span>${tr(body)}</span></button>`;
}

function personalCopy(view, title, body) {
  return `<button class="personal-card" data-view="${view}"><strong>${title}</strong><span>${body}</span></button>`;
}

function roleLabel(role, tr) {
  const labels = {
    frontdesk: tr("frontdeskRole"),
    operator: tr("operatorRole"),
    housekeeping: tr("housekeepingRole"),
    finance: tr("financeRole"),
    manager: tr("managerRole"),
    admin: tr("adminRole"),
    releaseOwner: tr("releaseOwnerRole")
  };
  return labels[role] || tr("operatorRole");
}
