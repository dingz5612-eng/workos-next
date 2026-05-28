export function simpleView(titleKey, bodyKey, ctx) {
  return ctx.shell(`
    <section class="profile-card">
      <span>${ctx.tr("me")}</span>
      <h1>${ctx.tr(titleKey)}</h1>
      <p>${ctx.tr(bodyKey)}</p>
    </section>
    <section class="compact-section">
      <label><span>${ctx.tr(titleKey)}</span><input value="${ctx.tr(ctx.task().object)}" /></label>
      <label><span>${ctx.tr("reminders")}</span><input value="2026-05-28 18:00" /></label>
    </section>
  `);
}

export function confirmPageView(ctx) {
  const item = ctx.task();
  return ctx.shell(`
    <section class="confirm-panel">
      <span>${ctx.tr("confirmAction")}</span>
      <h1>${ctx.tr(item.title)}</h1>
      <p>${ctx.tr("actionBoundary")}</p>
      <button id="finish">${ctx.tr("finish")}</button>
    </section>
  `);
}

export function resultView(ctx) {
  return ctx.shell(`<section class="confirm-panel"><span>Audit</span><h1>${ctx.tr("evidenceDone")}</h1><p>${ctx.tr("actionBoundary")}</p><button data-view="workbench">${ctx.tr("workbench")}</button></section>`);
}
