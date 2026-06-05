import { apiBaseUrl } from "./apiClient.js";
import { mobileBottomNavigation } from "./experienceContract.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";

export function shell(content, ctx) {
  const { state, tr } = ctx;
  const pcSurface = isPcSurfaceView(state.view);
  const title = shellPageTitle(ctx);
  return `
    <main class="app-shell view-${state.view} ${pcSurface ? "surface-pc" : "surface-mobile"}">
      <header class="topbar" data-shell="page-title">
        <div class="topbar-title" data-shell-page="${escapeAttr(state.view)}"><strong>${title}</strong></div>
        ${runtimeStatusChip(ctx)}
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

function runtimeStatusChip({ state, tr }) {
  const label = state.apiStatus === "online" ? tr("apiOnline") : state.apiStatus === "checking" ? tr("apiChecking") : tr("apiOffline");
  const title = state.debugSurface ? apiBaseUrl() : label;
  return `<span class="runtime-status ${state.apiStatus}" title="${escapeAttr(title)}">${label}</span>`;
}

function apiBanner({ state, tr }) {
  if (state.apiStatus === "online") return "";
  const label = state.apiStatus === "online" ? tr("apiOnline") : state.apiStatus === "checking" ? tr("apiChecking") : tr("apiOffline");
  const diagnostic = state.debugSurface ? `<small>${apiBaseUrl()}</small>` : `<small>${tr("apiOfflineHelp")}</small>`;
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
  return ["onboarding", "login", "feedback"].includes(state.view) ? "" : `<button class="feedback-fab" data-view="feedback">${tr("feedback")}</button>`;
}

function shellPageTitle({ state, tr }) {
  if (state.permissionDiagnostic && state.permissionDiagnostic.allowed === false) {
    return tr("permissionDiagnostic");
  }
  const titleKeys = {
    login: "app",
    onboarding: "app",
    home: "todayFocusOverview",
    workbench: "work",
    search: "search",
    me: "me",
    workspace: "operationPanel",
    operationPanel: "operationPanel",
    learning: "learningCenter",
    notes: "noteTitle",
    reminders: "reminderTitle",
    permissions: "myPermissions",
    businessRecords: "searchOperationCases",
    completedRecords: "completedWorkItems",
    evidenceLibrary: "searchEvidence",
    uploadQueue: "uploadQueue",
    submitQueue: "submitQueue",
    drafts: "drafts",
    failedSync: "failedSyncItems",
    recentSubmissions: "recentSubmissions",
    recentTraces: "recentTraces",
    deviceTrust: "deviceTrustStatus",
    feedback: "feedbackTitle",
    result: "actionResult",
    confirmPage: "confirmFallbackTitle",
    permissionDiagnostic: "permissionDiagnostic",
    releaseControl: "releaseControl",
    releaseFlightDeck: "releaseFlightDeck",
    pcGovernance: "governanceCenter",
    governanceCenter: "governanceCenter",
    managerControlTower: "managerControlTower",
    pcManager: "managerControlTower",
    financeReconciliation: "financeReconciliation",
    financeControl: "financeControl"
  };
  return tr(titleKeys[state.view] || "app");
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
