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
  const normalized = normalizeOperationLifecycleState(status, "");
  if (isCorrectionWorkItem(item) && !["done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped"].includes(normalized)) return 4;
  if (["done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped"].includes(normalized)) return 3;
  if (["ready", "blocked", "inProgress"].includes(normalized)) return 2;
  if (normalized) return 1;
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
    const entryAdmission = entryAdmissionForWorkItem(item, lifecycleState);
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
      businessTitle: entryAdmission.businessTitle,
      businessSummary: entryAdmission.businessSummary,
      legalActions: entryAdmission.legalActions,
      admissionDecision: entryAdmission.admissionDecision,
      nextAction: entryAdmission.nextAction,
      cannotSubmitReason: entryAdmission.cannotSubmitReason,
      readonlyReason: entryAdmission.readonlyReason,
      sourceScenario: entryAdmission.sourceScenario,
      admission: item.admission || item.Admission || null,
      admissionDecisionRef: item.admissionDecisionRef || item.admission_decision_ref || "",
      reason: entryAdmission.nextAction || item.failureReason || item.failure_reason || "",
      source: "operations-work-items"
    };
  });
}

function entryAdmissionForWorkItem(item = {}, lifecycleState = "") {
  const admission = item.admission || item.Admission || {};
  const admissionDecision = item.admissionDecision || item.admission_decision || admissionDecisionFor(admission);
  const cannotSubmitReason = item.cannotSubmitReason || item.cannot_submit_reason || (admission.confirmAllowed === false ? admission.reason || "" : "");
  const nextAction = item.nextAction || item.next_action || (admission.confirmAllowed === false ? "查看不能提交的原因" : "继续填写并提交");
  return {
    businessTitle: item.businessTitle || item.business_title || item.card?.title || item.Card?.title || item.workItemType || item.work_item_type || "",
    businessSummary: item.businessSummary || item.business_summary || item.workspace?.summary || item.Workspace?.summary || "",
    legalActions: normalizeEntryLegalActions(item.legalActions || item.legal_actions, admission, admissionDecision, cannotSubmitReason),
    admissionDecision,
    nextAction,
    cannotSubmitReason,
    readonlyReason: item.readonlyReason || item.readonly_reason || "入口只显示可做的下一步；提交必须通过办理页。",
    sourceScenario: item.sourceScenario || item.source_scenario || sourceScenarioForWorkItem(item, lifecycleState)
  };
}

function normalizeEntryLegalActions(actions = [], admission = {}, admissionDecision = "", cannotSubmitReason = "") {
  if (Array.isArray(actions) && actions.length) {
    return actions.map((entry) => ({
      action: entry.action || "",
      label: entry.label || "",
      view: entry.view || "",
      allowed: entry.allowed === true,
      writeBusinessFact: entry.writeBusinessFact === true || entry.write_business_fact === true,
      admissionDecision: entry.admissionDecision || entry.admission_decision || admissionDecision,
      cannotSubmitReason: entry.cannotSubmitReason || entry.cannot_submit_reason || ""
    }));
  }
  return [
    {
      action: "openWorkItem",
      label: "继续办理",
      view: "operationPanel",
      allowed: admission.visibleAllowed !== false && admission.prepareAllowed === true,
      writeBusinessFact: false,
      admissionDecision,
      cannotSubmitReason: ""
    },
    {
      action: "submitWorkItem",
      label: "提交办理",
      view: "operationPanel",
      allowed: admission.visibleAllowed !== false && admission.confirmAllowed === true,
      writeBusinessFact: true,
      admissionDecision,
      cannotSubmitReason
    }
  ];
}

function admissionDecisionFor(admission = {}) {
  if (admission.visibleAllowed === false) return "visible_blocked";
  if (admission.prepareAllowed !== true) return "visible_only";
  if (admission.confirmAllowed !== true) return "prepare_only_confirm_denied";
  if (admission.productionAllowed === true) return "confirm_allowed_production_allowed";
  return "confirm_allowed_production_blocked";
}

function sourceScenarioForWorkItem(item = {}, lifecycleState = "") {
  const text = [
    item.workItemType,
    item.work_item_type,
    item.workspaceId,
    item.workspace_id,
    item.cardId,
    item.card_id,
    lifecycleState
  ].join(" ");
  if (/ResourceOperationStatus|operation-status|operation/i.test(text)) return "lodging.resource-operation-status";
  if (/W-DORM-MAINLINE|ResourceSetup|ResourceReadiness|roomSetup|bedSetup/i.test(text)) return "lodging.resource-basic-readiness";
  return "lodging.unknown-entry";
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
