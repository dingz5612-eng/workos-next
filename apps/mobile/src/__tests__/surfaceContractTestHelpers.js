import fs from "node:fs";
import { shell } from "../appShell.js";
import { i18n } from "../i18n.js";
import { routeView } from "../appRouter.js";

export function createSurfaceCtx(overrides = {}) {
  ensureBrowserMocks();
  const state = {
    view: "home",
    lang: "zh-CN",
    apiStatus: "online",
    query: "住宿",
    recentSearches: [],
    queueDomain: "all",
    queueBadge: "all",
    todayFilter: "must-do",
    selectedWorkItemId: "W-STAY-RESOURCE:roomSetup",
    selectedWorkspace: "W-STAY-RESOURCE",
    selectedCardId: "roomSetup",
    selectedCardIndex: -1,
    currentActor: {
      role: "operator",
      displayName: "内测经办人",
      token: "operator-token",
      capabilities: ["operation.confirm"]
    },
    currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
    pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" } },
    runtimeStore: runtimeStore(),
    ...overrides
  };
  decorateRuntimeStoreAdmissions(state.runtimeStore);
  const ctx = {
    state,
    shell: (content) => shell(content, ctx),
    tr: (key) => escape(i18n[state.lang]?.[key] || key),
    tx: (value) => escape(typeof value === "string" ? value : value?.[state.lang] || value?.["zh-CN"] || ""),
    localTerm: (value) => escape(value?.label?.[state.lang] || value?.label?.["zh-CN"] || value?.id || value),
    escapeHtml: escape,
    escapeAttr: escape,
    metric: (value, label) => `<article><span>${label}</span><strong>${value}</strong></article>`,
    workspace: () => state.runtimeStore.workspaces[0],
    hydrateProjectionFromApi: async () => {},
    render: () => {}
  };
  return ctx;
}

export function internalPilotAdmissionFixture() {
  return {
    visibleAllowed: true,
    prepareAllowed: true,
    confirmAllowed: true,
    productionAllowed: false,
    mode: "internal_pilot_observation",
    reason: "business_production_blocked",
    admissionDecisionRef: "admission:test:internal-pilot"
  };
}

export function decorateRuntimeStoreAdmissions(store = {}) {
  const admission = store.commandAdmission || internalPilotAdmissionFixture();
  for (const collectionName of ["workQueue", "operationWorkItems"]) {
    for (const item of store[collectionName] || []) {
      if (!item.admission) item.admission = admission;
    }
  }
  for (const results of Object.values(store.searchResultsByQuery || {})) {
    for (const item of Array.isArray(results) ? results : []) {
      if ((item.resultType || item.result_type) === "workItem" && !item.admission) item.admission = admission;
    }
  }
  return store;
}

export function renderSurface(view, overrides = {}) {
  ensureBrowserMocks();
  const ctx = createSurfaceCtx({ view, ...overrides });
  return routeView(ctx);
}

export function runtimeStore() {
  const internalPilotAdmission = internalPilotAdmissionFixture();
  const workspace = {
    id: "W-STAY-RESOURCE",
    domain: "stay",
    caseId: "case:W-STAY-RESOURCE",
    title: { "zh-CN": "住宿资源" },
    summary: { "zh-CN": "房间床位入住资源" },
    next: { "zh-CN": "先配置房间和床位" },
    blockers: [],
    cards: [{
      id: "roomSetup",
      status: "ready",
      workItemId: "T-ROOM-CREATE",
      title: { "zh-CN": "房间床位配置" },
      fields: { business: [], system: [], analytics: [] },
      evidence: [{ id: "room-duplicate-check", label: { "zh-CN": "房间重复校验" } }],
      checks: [],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
    }]
  };
  return {
    workspaces: [workspace],
    workQueue: [{
      queueItemId: "q-room",
      workItemId: "W-STAY-RESOURCE:roomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      caseId: "case:W-STAY-RESOURCE",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "ready",
      ownerRole: "operator",
      badges: ["mine", "ready"],
      traceRefs: ["trace-room"],
      commandSubmissionId: "cmd-room",
      reason: "先配置房间和床位",
      admission: internalPilotAdmission
    }],
    operationWorkItems: [{
      workItemId: "W-STAY-RESOURCE:roomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      caseId: "case:W-STAY-RESOURCE",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "ready",
      ownerRole: "operator",
      traceRefs: ["trace-room"],
      reason: "先配置房间和床位",
      admission: internalPilotAdmission
    }],
    homeSurface: [],
    learningCatalog: [],
    searchResultsByQuery: {}
  };
}

export function visibleText(html) {
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

export function source(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

export function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function ensureBrowserMocks() {
  if (!globalThis.localStorage) {
    const storage = new Map();
    globalThis.localStorage = {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    };
  }
  if (!globalThis.window) {
    globalThis.window = {
      location: {
        protocol: "http:",
        hostname: "localhost",
        port: "5175",
        origin: "http://localhost:5175"
      }
    };
  }
}
