import { apiBaseUrl } from "./apiClient.js";

export function shell(content, ctx) {
  const { state, tr } = ctx;
  return `
    <main class="app-shell view-${state.view}">
      <header class="topbar">
        <div><strong>${tr("app")}</strong><span>${state.currentActor ? `${state.currentActor.displayName} · ${state.currentActor.role}` : tr("subtitle")}</span></div>
        <select id="language" aria-label="${tr("language")}">
          <option value="zh-CN" ${state.lang === "zh-CN" ? "selected" : ""}>${tr("zh")}</option>
          <option value="ru-RU" ${state.lang === "ru-RU" ? "selected" : ""}>${tr("ru")}</option>
        </select>
      </header>
      ${apiBanner(ctx)}
      ${content}
      ${feedbackButton(ctx)}
      ${state.view !== "onboarding" && state.view !== "login" ? bottomNav(ctx) : ""}
    </main>
  `;
}

function apiBanner({ state, tr }) {
  const label = state.apiStatus === "online" ? tr("apiOnline") : state.apiStatus === "checking" ? tr("apiChecking") : tr("apiOffline");
  return `<section class="api-status ${state.apiStatus}"><span>${label}</span><small>${apiBaseUrl()}</small>${state.apiStatus === "offline" ? `<button id="retryApi">${tr("retryApi")}</button>` : ""}</section>`;
}

function bottomNav(ctx) {
  return `<nav class="bottom-nav">
    ${nav("home", "home", ctx)}
    ${nav("search", "search", ctx)}
    ${nav("workbench", "workbench", ctx)}
    ${nav("me", "me", ctx)}
  </nav>`;
}

function nav(view, key, { state, tr }) {
  return `<button data-view="${view}" class="${state.view === view ? "active" : ""}">${tr(key)}</button>`;
}

function feedbackButton({ state, tr }) {
  return ["onboarding", "login"].includes(state.view) ? "" : `<button class="feedback-fab" data-view="feedback">${tr("feedback")}</button>`;
}
