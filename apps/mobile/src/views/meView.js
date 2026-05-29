export function meView(ctx) {
  const { state, tr, shell } = ctx;
  const actorDisplayName = state.currentActor?.displayName ? ctx.escapeHtml(state.currentActor.displayName) : tr("personalMode");
  const actorRole = state.currentActor?.role ? ctx.escapeHtml(state.currentActor.role) : "-";
  return shell(`
    <section class="profile-card">
      <span>${tr("role")}</span>
      <h1>${actorDisplayName}</h1>
      <p>${tr("permission")}: ${actorRole} · ${tr("stay")} · ${tr("repair")} · ${tr("finance")}</p>
      <button id="logout" class="secondary">${tr("logout")}</button>
    </section>
    <section class="metric-grid">${ctx.metric("11", "stats")}${ctx.metric("2", "blocked")}${ctx.metric("18m", "smartSort")}</section>
    <section class="personal-grid">
      ${personal("notes", "noteTitle", "noteBody", tr)}
      ${personal("reminders", "reminderTitle", "reminderBody", tr)}
      ${personal("learning", "learningCenter", "learningCenterBody", tr)}
      ${personal("feedback", "feedbackTitle", "feedbackBody", tr)}
    </section>
    <section class="compact-section">
      <h2>${tr("stats")}</h2>
      <p>${tr("commonSearch")}: ${tr("depositBlocked")} · Toyota Camry · A301</p>
      <p>${tr("savedFilter")}: ${tr("repair")} + ${tr("mine")} + ${tr("soon")}</p>
    </section>
  `);
}

function personal(view, title, body, tr) {
  return `<button class="personal-card" data-view="${view}"><strong>${tr(title)}</strong><span>${tr(body)}</span></button>`;
}
