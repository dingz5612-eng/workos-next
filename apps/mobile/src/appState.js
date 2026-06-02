import { createRuntimeStore } from "./runtime/runtimeStore.js";
import { actorSessionForStorage, shouldPersistApiOverride } from "./apiClient.js";
import { resolveDefaultHome } from "./surfaceResolver.js";

const allowedLanguages = new Set(["zh-CN", "ru-RU", "ky-KG"]);

export function savedActor() {
  try {
    const raw = localStorage.getItem("workosnext.actorSession");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function createInitialState() {
  const actor = savedActor();
  const state = {
    lang: allowedLanguages.has(localStorage.getItem("workosnext.lang")) ? localStorage.getItem("workosnext.lang") : "zh-CN",
    view: actor ? "home" : "login",
    selectedTask: "T-STAY-DEPOSIT",
    selectedWorkspace: "W-STAY-CHECKIN",
    selectedCardIndex: -1,
    selectedCardId: "",
    query: "",
    recentSearches: [],
    filterOpen: false,
    advancedOpen: false,
    queueDomain: "all",
    queueBadge: "mine",
    queueFilters: {
      domain: "all",
      badge: "mine",
      status: "all",
      ownerRole: "mine",
      evidenceState: "all",
      transferable: "all"
    },
    learningQuery: "",
    learningDomain: "all",
    learningType: "coachAll",
    coachFlow: "",
    coachStage: 0,
    sort: "smartSort",
    operationMessage: "",
    apiStatus: "checking",
    currentActor: actor,
    currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "unknown", surface: "mobile" },
    loginMessage: "",
    projectionEvents: [],
    releaseControl: { releases: [], selectedRelease: null },
    pcGovernance: {
      roleCapabilities: [],
      featureFlags: [],
      sliceCutoverStates: [],
      definitionVersions: [],
      deviceSessions: [],
      evidenceAccessAudits: [],
      domainEvents: [],
      commandSubmissions: [],
      releaseControlAudits: [],
      exportAudits: [],
      exports: [],
      capabilities: [],
      productionObservability: null,
      currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" }
    },
    bankStatementImport: {
      preview: null,
      result: null,
      request: null,
      importHistory: [],
      bankTransactions: [],
      candidates: null,
      mismatchCases: null,
      correctionRequests: [],
      selectedCorrectionRequestId: "",
      correctionDecision: null,
      operationAudit: [],
      decision: null,
      error: ""
    },
    accommodationLenses: {},
    runtimeStore: createRuntimeStore()
  };

  applyUrlParams(state);
  if (actor && !new URLSearchParams(window.location.search).has("view")) {
    state.view = localStorage.getItem("workosnext.onboarded") ? resolveDefaultHome(state) : "onboarding";
  }
  if (state.view === "task" || state.view === "object") state.view = "workspace";
  if (!state.currentActor && state.view !== "login") state.view = "login";
  return state;
}

function applyUrlParams(state) {
  const params = new URLSearchParams(window.location.search);
  if (params.has("api")) {
    const apiOverride = params.get("api");
    if (shouldPersistApiOverride(apiOverride)) {
      localStorage.setItem("workosnext.apiBaseUrl", apiOverride);
    } else {
      localStorage.removeItem("workosnext.apiBaseUrl");
    }
  }
  if (params.has("lang")) {
    const requestedLang = params.get("lang");
    state.lang = allowedLanguages.has(requestedLang) ? requestedLang : "zh-CN";
  }
  if (params.has("view")) state.view = params.get("view");
  if (params.has("task")) {
    state.selectedTask = params.get("task");
  }
  if (params.has("workspace")) state.selectedWorkspace = params.get("workspace");
  if (params.has("card")) state.selectedCardId = params.get("card");
  if (params.has("q")) {
    state.query = params.get("q");
    state.learningQuery = params.get("q");
  }
}

export function persistActorSession(session) {
  localStorage.setItem("workosnext.actorSession", JSON.stringify(actorSessionForStorage(session)));
}

export function shouldHydrateProtectedSurfaces(state) {
  return !!state.currentActor;
}
