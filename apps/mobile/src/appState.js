import { createRuntimeStore } from "./runtime/runtimeStore.js";
import { actorSessionForStorage, shouldPersistApiOverride } from "./apiClient.js";
import { defaultHomeForSession } from "./surfaceResolver.js";

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
    view: actor ? "onboarding" : "login",
    selectedTask: "T-STAY-DEPOSIT",
    selectedWorkspace: "W-STAY-CHECKIN",
    selectedCardIndex: -1,
    selectedCardId: "",
    query: "",
    recentSearches: loadRecentSearchesForActor(actor),
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
    runtimeHydrating: Boolean(actor),
    currentActor: actor,
    currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "unknown", surface: "mobile" },
    loginMessage: "",
    projectionEvents: [],
    releaseControl: { releases: [], selectedRelease: null },
    pcGovernanceAccountDraft: {
      username: "",
      displayName: "",
      password: "",
      department: "住宿运营部",
      businessLine: "stay",
      role: "operator",
      capabilities: []
    },
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
      accountUsers: [],
      accountAudit: [],
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

  if (actor && localStorage.getItem("workosnext.onboarded")) {
    state.view = defaultHomeForSession(actor, state);
  }
  applyUrlParams(state);
  if (state.view === "task" || state.view === "object") state.view = "workspace";
  if (!state.currentActor && state.view !== "login") state.view = "login";
  return state;
}

export function searchPreferenceKey(actor = null) {
  const id = actor?.userId || actor?.actorId || actor?.role || "anonymous";
  return `workosnext.search.recent.${id}`;
}

function loadRecentSearchesForActor(actor = null) {
  try {
    const raw = localStorage.getItem(searchPreferenceKey(actor));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 8) : [];
  } catch {
    return [];
  }
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
  if (params.has("lang")) state.lang = params.get("lang");
  if (params.has("view")) state.view = params.get("view");
  if (params.get("device") === "pc") {
    state.currentDevice = { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" };
    state.pcGovernance.currentDevice = { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" };
  }
  if (params.get("device") === "mobile") {
    state.currentDevice = { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" };
  }
  if (params.has("task")) {
    state.selectedTask = params.get("task");
  }
  if (params.has("workspace")) state.selectedWorkspace = params.get("workspace");
  if (params.has("card")) state.selectedCardId = params.get("card");
  if (params.has("workItem")) state.selectedWorkItemId = params.get("workItem");
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
