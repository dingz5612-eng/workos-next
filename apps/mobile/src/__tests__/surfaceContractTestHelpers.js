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
    selectedWorkItemId: "wi-dorm-room-setup",
    selectedWorkspace: "W-DORM-MAINLINE",
    selectedCardId: "cert.roomSetupConfirm",
    selectedCardIndex: -1,
    currentActor: {
      role: "operator",
      displayName: "住宿经办人",
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
    id: "W-DORM-MAINLINE",
    domain: "stay",
    caseId: "case:W-DORM-MAINLINE",
    title: { "zh-CN": "房源建档与基础就绪" },
    summary: { "zh-CN": "房间建档、床位组确认和基础就绪确认" },
    next: { "zh-CN": "发起房源建档与基础就绪" },
    blockers: [],
    cards: [{
      id: "cert.roomSetupConfirm",
      status: "ready",
      workItemId: "wi-dorm-room-setup",
      title: { "zh-CN": "房间建档确认" },
      fields: {
        business: [
          { id: "buildingContextRef", label: { "zh-CN": "楼栋/区域" }, required: true },
          { id: "floor", label: { "zh-CN": "楼层" }, required: true },
          { id: "roomNo", label: { "zh-CN": "房间号" }, required: true },
          { id: "bedCount", label: { "zh-CN": "床位数量" }, required: true }
        ],
        system: [],
        analytics: []
      },
      values: {
        buildingContextRef: "1 号楼",
        floor: "3 层",
        roomNo: "301",
        bedCount: 6
      },
      evidence: [{ id: "room-basic-info-evidence", label: { "zh-CN": "房间基础资料证据" } }],
      checks: [],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
    }]
  };
  return {
    workspaces: [workspace],
    workQueue: [{
      queueItemId: "q-room",
      workItemId: "wi-dorm-room-setup",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
      caseId: "case:W-DORM-MAINLINE",
      workItemType: "Dorm.RoomSetupConfirm",
      lifecycleState: "ready",
      ownerRole: "operator",
      badges: ["mine", "ready"],
      traceRefs: ["trace-room"],
      commandSubmissionId: "cmd-room",
      reason: "发起房源建档与基础就绪",
      businessAnchor: {
        buildingContextRef: "1 号楼",
        floor: "3 层",
        roomNo: "301",
        bedCount: 6
      },
      admission: internalPilotAdmission
    }],
    operationWorkItems: [{
      workItemId: "wi-dorm-room-setup",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
      caseId: "case:W-DORM-MAINLINE",
      workItemType: "Dorm.RoomSetupConfirm",
      lifecycleState: "ready",
      ownerRole: "operator",
      traceRefs: ["trace-room"],
      reason: "发起房源建档与基础就绪",
      businessAnchor: {
        buildingContextRef: "1 号楼",
        floor: "3 层",
        roomNo: "301",
        bedCount: 6
      },
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
