export function loginView(ctx) {
  const { tr, shell, state } = ctx;
  const disabled = state.loginSubmitting ? " disabled" : "";
  return shell(`
    <section class="login-panel">
      <span>${tr("loginTitle")}</span>
      <h1>${tr("app")}</h1>
      <p>${tr("loginBody")}</p>
      <label>
        <span>${tr("loginAccount")}</span>
        <input id="loginAccount" autocomplete="username" value="${ctx.escapeAttr(state.loginAccount || "")}" placeholder="${tr("loginAccountPlaceholder")}"${disabled} />
      </label>
      <label>
        <span>${tr("loginPassword")}</span>
        <input id="loginPassword" type="password" autocomplete="current-password"${disabled} />
      </label>
      <p class="login-hint">${tr("loginAuthorityHint")}</p>
      <button id="loginSubmit"${disabled} ${state.loginSubmitting ? 'aria-busy="true"' : ""}>${tr(state.loginSubmitting ? "loginSubmitting" : "loginSubmit")}</button>
      ${state.loginMessage ? `<p class="login-message">${ctx.escapeHtml(state.loginMessage)}</p>` : ""}
    </section>
  `);
}

export function onboardingView(ctx) {
  const { tr, shell } = ctx;
  return shell(`
    <section class="onboarding">
      <div class="onboarding-copy">
        <span>${tr("guideTitle")}</span>
        <h1>${tr("guideHeadline")}</h1>
        <p>${tr("guideBody")}</p>
      </div>
      <div class="mode-list">
        ${guideCard("01", "todayModeTitle", "todayModeBody", tr)}
        ${guideCard("02", "intentModeTitle", "intentModeBody", tr)}
        ${guideCard("03", "queueModeTitle", "queueModeBody", tr)}
        ${guideCard("04", "personalModeTitle", "personalModeBody", tr)}
      </div>
      <div class="onboarding-actions">
        <button id="start">${tr("start")}</button>
        <button class="ghost" id="skip">${tr("skip")}</button>
      </div>
    </section>
  `);
}

function guideCard(index, titleKey, bodyKey, tr) {
  return `
    <article class="mode-card">
      <span class="mode-card-index">${index}</span>
      <div>
        <b>${tr(titleKey)}</b>
        <small>${tr(bodyKey)}</small>
      </div>
    </article>
  `;
}

export function modeCard(view, titleKey, bodyKey, tr) {
  return `
    <button class="mode-card mode-card-link" data-view="${view}">
      <span class="mode-card-index">${viewIndex(view)}</span>
      <div>
        <b>${tr(titleKey)}</b>
        <small>${tr(bodyKey)}</small>
      </div>
    </button>
  `;
}

function viewIndex(view) {
  return { home: "01", search: "02", workbench: "03", me: "04" }[view] || "•";
}
