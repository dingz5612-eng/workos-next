export function loginView(ctx) {
  const { tr, shell, state } = ctx;
  return shell(`
    <section class="login-panel">
      <span>${tr("loginTitle")}</span>
      <h1>${tr("app")}</h1>
      <p>${tr("loginBody")}</p>
      <label>
        <span>${tr("loginAccount")}</span>
        <select id="loginAccount" autocomplete="username">
          ${accountOption("dormFrontdesk", "frontdeskAccount", state, tr)}
          ${accountOption("dormOperator", "operatorAccount", state, tr)}
          ${accountOption("dormHousekeeping", "housekeepingAccount", state, tr)}
          ${accountOption("dormFinance", "financeAccount", state, tr)}
          ${accountOption("dormManager", "managerAccount", state, tr)}
          ${isDevLoginEnabled() ? `${accountOption("admin", "adminAccount", state, tr)}${accountOption("dormReleaseOwner", "releaseOwnerAccount", state, tr)}` : ""}
        </select>
      </label>
      <label>
        <span>${tr("loginDepartment")}</span>
        <select id="loginDepartment">
          ${departmentOption("stay", "stayDepartment", state, tr)}
          ${departmentOption("finance", "financeDepartment", state, tr)}
          ${departmentOption("operations", "operationsDepartment", state, tr)}
        </select>
      </label>
      <label>
        <span>${tr("loginPassword")}</span>
        <input id="loginPassword" type="password" value="dev" autocomplete="current-password" />
      </label>
      <p class="login-hint">${tr("loginAuthorityHint")}</p>
      <p class="login-hint subtle">${tr("loginDepartmentHelp")}</p>
      <button id="loginSubmit">${tr("loginSubmit")}</button>
      ${state.loginMessage ? `<p class="login-message">${ctx.escapeHtml(state.loginMessage)}</p>` : ""}
    </section>
  `);
}

function accountOption(value, labelKey, state, tr) {
  const selected = (state.loginAccount || "dormFrontdesk") === value ? " selected" : "";
  return `<option value="${value}"${selected}>${tr(labelKey)}</option>`;
}

function departmentOption(value, labelKey, state, tr) {
  const selected = (state.selectedDepartment || "stay") === value ? " selected" : "";
  return `<option value="${value}"${selected}>${tr(labelKey)}</option>`;
}

function isDevLoginEnabled() {
  const host = globalThis.window?.location?.hostname || "";
  return ["localhost", "127.0.0.1", "::1", ""].includes(host);
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
