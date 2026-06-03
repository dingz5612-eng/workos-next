import { apiBaseUrl } from "./apiClient.js";
import { mobileBottomNavigation } from "./experienceContract.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";
import { translateTerm } from "./termDictionary.js";

export function shell(content, ctx) {
  const { state, tr } = ctx;
  const pcSurface = isPcSurfaceView(state.view);
  return `
    <main class="app-shell view-${state.view} ${pcSurface ? "surface-pc" : "surface-mobile"}">
      <header class="topbar">
        <div><strong>${tr("app")}</strong><span>${state.currentActor ? actorLabel(state, tr) : tr("subtitle")}</span></div>
        <select id="language" aria-label="${tr("language")}">
          <option value="zh-CN" ${state.lang === "zh-CN" ? "selected" : ""}>${tr("zh")}</option>
          <option value="ru-RU" ${state.lang === "ru-RU" ? "selected" : ""}>${tr("ru")}</option>
          <option value="ky-KG" ${state.lang === "ky-KG" ? "selected" : ""}>${tr("ky")}</option>
        </select>
      </header>
      ${apiBanner(ctx)}
      ${content}
      ${feedbackButton(ctx)}
      ${state.view !== "onboarding" && state.view !== "login" && !pcSurface ? bottomNav(ctx) : ""}
    </main>
  `;
}

function apiBanner({ state, tr }) {
  const label = state.apiStatus === "online" ? tr("apiOnline") : state.apiStatus === "checking" ? tr("apiChecking") : tr("apiOffline");
  const diagnostic = state.debugSurface ? `<small>${apiBaseUrl()}</small>` : `<small>${state.apiStatus === "online" ? tr("apiReadyForPilot") : tr("apiOfflineHelp")}</small>`;
  return `<section class="api-status ${state.apiStatus}"><span>${label}</span>${diagnostic}${state.apiStatus === "offline" ? `<button id="retryApi">${tr("retryApi")}</button>` : ""}</section>`;
}

function bottomNav(ctx) {
  return `<nav class="bottom-nav" aria-label="${ctx.tr("mobileBottomNav")}">
    ${mobileBottomNavigation.map((view) => nav(view, view === "home" ? "today" : view === "workbench" ? "work" : view, ctx)).join("")}
  </nav>`;
}

function nav(view, key, { state, tr }) {
  const active = state.view === view || (view === "workbench" && ["workspace", "operationPanel"].includes(state.view));
  return `<button data-view="${view}" class="${active ? "active" : ""}" aria-label="${tr(key)}" ${active ? 'aria-current="page"' : ""}>${tr(key)}</button>`;
}

function feedbackButton({ state, tr }) {
  return ["onboarding", "login"].includes(state.view) ? "" : `<button class="feedback-fab" data-view="feedback">${tr("feedback")}</button>`;
}

function actorLabel(state, tr) {
  const displayName = translateTerm(state.currentActor.displayName, state.lang);
  const role = roleLabel(state.currentActor.role, tr);
  return displayName === role ? role : `${displayName} · ${role}`;
}

function roleLabel(role, tr) {
  const labels = {
    frontdesk: tr("operatorRole"),
    operator: tr("operatorRole"),
    housekeeping: tr("housekeepingRole"),
    finance: tr("financeRole"),
    manager: tr("managerRole"),
    admin: tr("adminRole"),
    releaseOwner: tr("releaseOwnerRole")
  };
  return labels[role] || tr("operatorRole");
}
