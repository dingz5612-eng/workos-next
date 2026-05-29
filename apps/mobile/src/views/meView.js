import { selectSurfaceStats } from "../selectors/surfaceSelectors.js";

export function meView(ctx) {
  const { state, tr, shell } = ctx;
  const actorDisplayName = state.currentActor?.displayName ? ctx.escapeHtml(state.currentActor.displayName) : tr("personalMode");
  const actorRole = state.currentActor?.role ? ctx.escapeHtml(state.currentActor.role) : "-";
  const stats = selectSurfaceStats(state);
  const searches = (state.recentSearches || []).map((item) => ctx.escapeHtml(item)).join(" · ");
  return shell(`
    <section class="profile-card">
      <span>${tr("role")}</span>
      <h1>${actorDisplayName}</h1>
      <p>${tr("permission")}: ${actorRole} · ${tr("stay")} · ${tr("repair")} · ${tr("finance")}</p>
      <button id="logout" class="secondary">${tr("logout")}</button>
    </section>
    <section class="metric-grid">${ctx.metric(stats.queueCount, "stats")}${ctx.metric(stats.blockedCount, "blocked")}${ctx.metric(stats.confirmCount, "confirm")}</section>
    <section class="personal-grid">
      ${personal("notes", "noteTitle", "noteBody", tr)}
      ${personal("reminders", "reminderTitle", "reminderBody", tr)}
      ${personal("learning", "learningCenter", "learningCenterBody", tr)}
      ${personal("feedback", "feedbackTitle", "feedbackBody", tr)}
    </section>
    <section class="compact-section">
      <h2>${tr("stats")}</h2>
      <p>${tr("commonSearch")}: ${searches || (state.apiStatus === "online" ? tr("coachNoMatch") : tr("apiOffline"))}</p>
      <p>${tr("savedFilter")}: ${tr(state.queueDomain)} + ${tr(state.queueBadge)}</p>
    </section>
  `);
}

function personal(view, title, body, tr) {
  return `<button class="personal-card" data-view="${view}"><strong>${tr(title)}</strong><span>${tr(body)}</span></button>`;
}
