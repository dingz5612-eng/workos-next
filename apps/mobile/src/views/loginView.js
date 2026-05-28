export function loginView(ctx) {
  const { tr, shell, state } = ctx;
  return shell(`
    <section class="login-panel">
      <span>${tr("loginTitle")}</span>
      <h1>${tr("app")}</h1>
      <p>${tr("loginBody")}</p>
      <label>
        <span>${tr("loginRole")}</span>
        <select id="loginRole">
          <option value="operator">${tr("operatorRole")}</option>
          <option value="finance">${tr("financeRole")}</option>
          <option value="manager">${tr("managerRole")}</option>
        </select>
      </label>
      <label>
        <span>${tr("loginPassword")}</span>
        <input id="loginPassword" type="password" value="dev" autocomplete="current-password" />
      </label>
      <button id="loginSubmit">${tr("loginSubmit")}</button>
      ${state.loginMessage ? `<p class="login-message">${state.loginMessage}</p>` : ""}
    </section>
  `);
}

export function onboardingView(ctx) {
  const { tr, shell } = ctx;
  return shell(`
    <section class="onboarding">
      <span>${tr("guideTitle")}</span>
      <h1>${tr("app")}</h1>
      <p>${tr("guideBody")}</p>
      <div class="mode-list">
        ${modeCard("home", "todayMode", tr)}
        ${modeCard("search", "intentMode", tr)}
        ${modeCard("workbench", "queueMode", tr)}
        ${modeCard("me", "personalMode", tr)}
      </div>
      <button id="start">${tr("start")}</button>
      <button class="ghost" id="skip">${tr("skip")}</button>
    </section>
  `);
}

export function modeCard(view, key, tr) {
  return `<button class="mode-card" data-view="${view}"><b>${tr(key)}</b></button>`;
}
