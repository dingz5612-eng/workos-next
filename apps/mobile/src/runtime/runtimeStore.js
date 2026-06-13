import { normalizeOperationLifecycleState } from "../operationStatus.js";

export function createRuntimeStore() {
  return {
    projection: null,
    workspaces: [],
    events: [],
    workQueue: [],
    operationWorkItems: [],
    searchResultsByQuery: {},
    homeSurface: [],
    learningCatalog: [],
    accommodationLenses: {},
    apiStatus: "checking",
    lastHydratedAt: "",
    source: "empty-runtime",
    queueSource: "runtime-api",
    homeSource: "runtime-api",
    learningSource: "runtime-api"
  };
}

export function applyRuntimeProjection(state, payload) {
  if (!payload?.workspaces?.length) return;
  const store = ensureRuntimeStore(state);
  store.projection = payload;
  store.workspaces = payload.workspaces;
  store.events = payload.events || [];
  store.lastHydratedAt = new Date().toISOString();
  store.source = state.apiStatus === "online" ? "runtime-api" : "offline-cache";
  state.projectionEvents = store.events;
}

export function applyRuntimeSurfacePayloads(state, payloads = {}) {
  const store = ensureRuntimeStore(state);
  if (payloads.workQueue) {
    store.workQueue = payloads.workQueue;
    store.queueSource = "runtime-api";
  }
  if (payloads.operationWorkItems) {
    const incoming = Array.isArray(payloads.operationWorkItems) ? payloads.operationWorkItems : [];
    const removedIds = removedOperationWorkItemIds(payloads, incoming);
    store.operationWorkItems = mergeOperationWorkItems(store.operationWorkItems, incoming, removedIds);
    store.workspaces = mergeOperationWorkItemStatuses(store.workspaces, payloads.operationWorkItems);
    store.workQueue = operationWorkItemsToQueue(store.operationWorkItems);
    store.queueSource = "operations-work-items";
  }
  if (payloads.homeSurface) {
    store.homeSurface = payloads.homeSurface;
    store.homeSource = "runtime-api";
  }
  if (payloads.learningCatalog) {
    store.learningCatalog = payloads.learningCatalog;
    store.learningSource = "runtime-api";
  }
  if (payloads.accommodationLenses) {
    store.accommodationLenses = payloads.accommodationLenses;
    state.accommodationLenses = payloads.accommodationLenses;
  }
}

export function workspaceWithOperationWorkItemStatuses(workspace = null, workItems = []) {
  if (!workspace) return workspace;
  return mergeOperationWorkItemStatuses([workspace], workItems)[0] || workspace;
}

export function mergeOperationWorkItemStatuses(workspaces = [], workItems = []) {
  const statusesByWorkspaceCard = statusIndex(workItems);
  if (!statusesByWorkspaceCard.size) return workspaces;
  return (workspaces || []).map((workspace) => {
    const cards = (workspace.cards || []).map((card) => {
      const next = statusesByWorkspaceCard.get(`${workspace.id}:${card.id}`);
      return next && statusRank(next.status, next.item) >= statusRank(card.status)
        ? cardWithOperationStatus(card, next.status, next.item)
        : card;
    });
    return { ...workspace, cards };
  });
}

export function mergeOperationWorkItems(existing = [], incoming = [], removedIds = new Set()) {
  const byId = new Map();
  for (const item of [...incoming, ...existing]) {
    const id = operationWorkItemIdOf(item);
    if (removedIds.has(id)) continue;
    if (!id || byId.has(id)) continue;
    if (isRemovedOperationWorkItem(item)) continue;
    byId.set(id, item);
  }
  return Array.from(byId.values());
}

function removedOperationWorkItemIds(payloads = {}, incoming = []) {
  const ids = new Set();
  const explicitIds = [
    ...(Array.isArray(payloads.removedWorkItemIds) ? payloads.removedWorkItemIds : []),
    ...(Array.isArray(payloads.removed_work_item_ids) ? payloads.removed_work_item_ids : [])
  ];
  for (const id of explicitIds) {
    const normalized = String(id || "").trim();
    if (normalized) ids.add(normalized);
  }
  for (const item of incoming) {
    const id = operationWorkItemIdOf(item);
    if (id && isRemovedOperationWorkItem(item)) ids.add(id);
  }
  return ids;
}

function operationWorkItemIdOf(item = {}) {
  return String(item?.workItemId || item?.work_item_id || item?.id || "").trim();
}

function isRemovedOperationWorkItem(item = {}) {
  const lifecycleState = normalizeOperationLifecycleState(item.lifecycleState || item.lifecycle_state || item.status, "");
  return item.tombstone === true ||
    item.removed === true ||
    item.isDeleted === true ||
    ["closed", "cancelled", "canceled", "revoked", "removed", "deleted"].includes(lifecycleState);
}

function cardWithOperationStatus(card = {}, status = "", item = {}) {
  const correction = correctionMeta(item);
  return {
    ...card,
    status,
    ...correction
  };
}

function statusIndex(workItems = []) {
  const index = new Map();
  for (const item of Array.isArray(workItems) ? workItems : []) {
    const workspaceId = item.workspaceId || item.workspace_id || item.workspace?.id || "";
    const cardId = cardIdOf(item) || item.card?.id || "";
    if (!workspaceId || !cardId) continue;
    const nextStatus = normalizeOperationLifecycleState(item.lifecycleState || item.lifecycle_state || item.status || item.card?.status);
    if (!nextStatus) continue;
    const key = `${workspaceId}:${cardId}`;
    const current = index.get(key);
    if (statusRank(nextStatus, item) >= statusRank(current?.status, current?.item)) {
      index.set(key, { status: nextStatus, item });
    }
  }
  return index;
}

function statusRank(status = "", item = {}) {
  if (isCorrectionWorkItem(item) && !["done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped"].includes(String(status))) return 4;
  if (["done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped"].includes(String(status))) return 3;
  if (["ready", "blocked", "inProgress"].includes(String(status))) return 2;
  if (status) return 1;
  return 0;
}

function isCorrectionWorkItem(item = {}) {
  const payload = item.payload || item.Payload || {};
  return payload.correctionMode === "append_only" || payload.operationMode === "correction";
}

function correctionMeta(item = {}) {
  if (!isCorrectionWorkItem(item)) return {};
  const payload = item.payload || item.Payload || {};
  return {
    operationMode: "correction",
    correctionMode: "append_only",
    sourceWorkItemId: payload.sourceWorkItemId || payload.source_work_item_id || "",
    sourceCardStatus: payload.sourceCardStatus || payload.source_card_status || ""
  };
}

function operationWorkItemsToQueue(workItems) {
  return (Array.isArray(workItems) ? workItems : []).map((item) => {
    const lifecycleState = normalizeOperationLifecycleState(item.lifecycleState || item.lifecycle_state || item.status);
    const workspace = item.workspace || item.Workspace || {};
    return {
      queueItemId: `q-${item.workItemId || item.work_item_id}`,
      workItemId: item.workItemId || item.work_item_id,
      caseId: item.caseId || item.case_id,
      workItemType: item.workItemType || item.work_item_type,
      lifecycleState,
      ownerRole: item.ownerRole || item.owner_role,
      workspaceId: item.workspaceId || item.workspace_id,
      cardId: cardIdOf(item),
      domain: queueDomainOf(item, workspace),
      badges: ["mine", lifecycleState].filter(Boolean),
      priority: queuePriorityOf(item.priority),
      reason: item.nextAction || item.next_action || item.failureReason || item.failure_reason || "",
      source: "operations-work-items"
    };
  });
}

function queueDomainOf(item = {}, workspace = {}) {
  const explicit = normalizeDomain(item.domain || item.domain_group || item.businessLine || item.business_line);
  const workspaceDomain = normalizeDomain(workspace.domain || workspace.businessLine || workspace.business_line);
  if (explicit && explicit !== "operations" && explicit !== "ops") return explicit;
  if (workspaceDomain) return workspaceDomain;
  const text = [
    item.workItemType,
    item.work_item_type,
    item.workspaceId,
    item.workspace_id,
    item.caseId,
    item.case_id,
    item.cardId,
    item.card_id
  ].join(" ");
  if (/stay|dorm|room|bed|checkin|checkout|deposit|payment|service|expense|period|lead|住宿|房间|床位|入住|退住|押金|收款|线索/i.test(text)) return "stay";
  if (/repair|维修/i.test(text)) return "repair";
  if (/finance|ledger|财务|账本/i.test(text)) return "finance";
  return explicit || "operations";
}

function normalizeDomain(value = "") {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (["accommodation", "dormitory", "dorm", "stay"].includes(text)) return "stay";
  if (["finance", "money", "ledger"].includes(text)) return "finance";
  if (["repair", "service"].includes(text)) return "repair";
  if (["operations", "operation", "ops"].includes(text)) return text === "ops" ? "ops" : "operations";
  return text;
}

function queuePriorityOf(value) {
  if (typeof value === "number") return value;
  const text = String(value || "").trim().toLowerCase();
  if (text === "critical" || text === "urgent") return 110;
  if (text === "high") return 100;
  if (text === "normal" || !text) return 80;
  if (text === "low") return 50;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 80;
}

function cardIdOf(item = {}) {
  return item.cardId ||
    item.card_id ||
    item.payload?.cardId ||
    item.Payload?.cardId ||
    item.sourceRefs?.payload?.cardId ||
    item.source_refs?.payload?.cardId ||
    "";
}

export function applyRuntimeSearchResults(state, query, results) {
  const store = ensureRuntimeStore(state);
  store.searchResultsByQuery[normalizeQuery(query)] = results || [];
}

export function applyRuntimeOfflineFallback(state) {
  const store = ensureRuntimeStore(state);
  state.apiStatus = "offline";
  store.apiStatus = "offline";
  store.source = store.workspaces?.length ? "offline-cache" : "offline-empty";
  store.queueSource = store.workQueue?.length ? store.queueSource || "offline-cache" : "offline-empty";
  store.homeSource = store.homeSurface?.length ? store.homeSource || "offline-cache" : "offline-empty";
  store.learningSource = store.learningCatalog?.length ? store.learningSource || "offline-cache" : "offline-empty";
  store.workspaces = store.workspaces?.length ? store.workspaces : [];
  store.workQueue = store.workQueue?.length ? store.workQueue : [];
}

export function ensureRuntimeStore(state) {
  if (!state.runtimeStore) state.runtimeStore = createRuntimeStore();
  state.runtimeStore.apiStatus = state.apiStatus;
  return state.runtimeStore;
}

export function normalizeQuery(value) {
  return String(value || "").trim().toLocaleLowerCase();
}
