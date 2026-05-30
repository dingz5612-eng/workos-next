import { createRuntimeStore } from "./runtime/runtimeStore.js";

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
    lang: localStorage.getItem("workosnext.lang") || "zh-CN",
    view: actor ? (localStorage.getItem("workosnext.onboarded") ? "home" : "onboarding") : "login",
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
    learningQuery: "",
    learningDomain: "all",
    learningType: "coachAll",
    coachFlow: "",
    coachStage: 0,
    sort: "smartSort",
    operationMessage: "",
    apiStatus: "checking",
    currentActor: actor,
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
  if (state.view === "task" || state.view === "object") state.view = "workspace";
  if (!state.currentActor && state.view !== "login") state.view = "login";
  return state;
}

function applyUrlParams(state) {
  const params = new URLSearchParams(window.location.search);
  if (params.has("api")) localStorage.setItem("workosnext.apiBaseUrl", params.get("api"));
  if (params.has("lang")) state.lang = params.get("lang");
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
