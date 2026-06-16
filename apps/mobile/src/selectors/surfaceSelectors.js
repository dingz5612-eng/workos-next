import { normalizeOperationLifecycleState } from "../operationStatus.js";
import { normalizeQuery } from "../runtime/runtimeStore.js";
import { businessAnchorText } from "../businessAnchorKernel.js";

const activeStatuses = new Set(["ready", "blocked", "inProgress"]);
const terminalStatuses = new Set(["done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped"]);
const ledgerAmountFields = new Set([
  "receivedAmount",
  "confirmedAmount",
  "deductionAmount",
  "applyToBalanceAmount",
  "refundAmount",
  "allocatedAmount",
  "amount",
  "totalCharges",
  "balance"
]);

export function selectRuntimeWorkspaces(state) {
  return state.runtimeStore?.workspaces?.length ? state.runtimeStore.workspaces : [];
}

export function selectHomeSurface(state) {
  const workspaces = selectRuntimeWorkspaces(state);
  const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const source = state.runtimeStore?.homeSurface?.length
    ? state.runtimeStore.homeSurface
    : workspaces.map((workspace) => projectionHomeItem(workspace));
  return source
    .map((item) => ({ ...item, workspace: byId.get(item.workspaceId) }))
    .filter((item) => item.workspace)
    .filter((item) => homeItemAllowedForActor(item, state))
    .filter((item) => state.debugSurface || !isTerminalHomeItem(item))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

export function selectWorkbenchQueue(state) {
  const workspaces = selectRuntimeWorkspaces(state);
  const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const runtimeQueue = state.runtimeStore?.workQueue || [];
  if (state.apiStatus === "offline") {
    return runtimeQueue.length ? materializeQueue(runtimeQueue, byId, state) : [];
  }
  return runtimeQueue.length ? materializeQueue(runtimeQueue, byId, state) : [];
}

export function selectCompletedWorkbenchQueue(state) {
  const workspaces = selectRuntimeWorkspaces(state);
  const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const runtimeQueue = state.runtimeStore?.workQueue || [];
  if (!runtimeQueue.length) return [];
  return materializeQueue(runtimeQueue, byId, state, { terminal: "only" });
}

function materializeQueue(queue, byId, state, options = {}) {
  return queue
    .filter((item) => state.debugSurface || isOrdinaryPilotQueueItem(item))
    .filter((item) => state.debugSurface || isPersistedWorkItemId(item.workItemId || item.work_item_id))
    .map((item) => {
      const workspace = byId.get(item.workspaceId);
      const card = workspace ? selectCardById(workspace, item.cardId) || activeCard(workspace) : null;
      return {
        ...item,
        workspace,
        card,
        domain: queueDomainFor(item, workspace),
        badges: item.badges?.length ? item.badges : badgesFor(card),
        priority: item.priority ?? priorityFor(card?.status),
        source: item.source || state.runtimeStore?.queueSource || "runtime-api"
      };
    })
    .filter((item) => item.workItemId || item.work_item_id)
    .filter((item) => state.debugSurface || queueItemAllowedForActor(item, state))
    .filter((item) => {
      if (state.debugSurface) return true;
      const terminal = isTerminalQueueItem(item);
      if (options.terminal === "only") return terminal;
      return !terminal;
    });
}

function isOrdinaryPilotQueueItem(item = {}) {
  const tokens = [
    item.workItemId,
    item.work_item_id,
    item.queueItemId,
    item.workspaceId,
    item.domain,
    item.workItemType,
    item.work_item_type,
    item.source,
    item.projectionSource
  ].join(" ");
  return !/(runtimeAudit|\brf[-_:]|engineering|diagnostic|fixture_replay|projection_guard_shadow)/i.test(tokens);
}

function isTerminalQueueItem(item = {}) {
  return [
    item.lifecycleState,
    item.lifecycle_state,
    item.status,
    item.card?.status
  ].some((status) => terminalStatuses.has(String(status || "").trim()));
}

function isTerminalHomeItem(item = {}) {
  const card = selectCardById(item.workspace, item.cardId) || activeCard(item.workspace);
  return terminalStatuses.has(String(card?.status || "").trim());
}

function homeItemAllowedForActor(item = {}, state = {}) {
  if (state.debugSurface) return true;
  const role = String(state.currentActor?.role || "").toLowerCase();
  if (["admin", "manager", "releaseowner"].includes(role)) return true;
  const domain = item.workspace?.domain || item.domain || "";
  const scopedItem = {
    ...item,
    card: selectCardById(item.workspace, item.cardId),
    workspace: item.workspace
  };
  if (role === "finance") return domain === "finance" || isFinanceQueueItem(scopedItem);
  if (role === "repair") return domain === "repair";
  if (["operator", "frontdesk", "housekeeping"].includes(role)) return domain === "stay" && !isFinanceQueueItem(scopedItem);
  return domain === "stay" && !isFinanceQueueItem(scopedItem);
}

function queueItemAllowedForActor(item = {}, state = {}) {
  const role = String(state.currentActor?.role || "operator").toLowerCase();
  if (["admin", "manager", "releaseowner"].includes(role)) return true;
  const domain = item.domain || item.workspace?.domain || "";
  const ownerRole = String(item.ownerRole || item.owner_role || "").toLowerCase();
  if (role === "finance") return domain === "finance" || ownerRole === "finance" || isFinanceQueueItem(item);
  if (role === "repair") return domain === "repair" || ownerRole === "repair";
  if (["operator", "frontdesk", "housekeeping"].includes(role)) {
    const accommodationOwner = !ownerRole || ["operator", "frontdesk", "housekeeping"].includes(ownerRole);
    return domain === "stay" && accommodationOwner && !isFinanceQueueItem(item);
  }
  return domain === "stay" && !isFinanceQueueItem(item);
}

function isFinanceQueueItem(item = {}) {
  const text = [
    item.workItemType,
    item.work_item_type,
    item.workItemId,
    item.work_item_id,
    item.queueItemId,
    item.workspaceId,
    item.cardId,
    item.card?.id,
    item.card?.title?.["zh-CN"],
    item.card?.title?.["ru-RU"],
    item.card?.title,
    item.workspace?.title?.["zh-CN"],
    item.workspace?.title?.["ru-RU"],
    item.workspace?.summary?.["zh-CN"],
    item.workspace?.summary?.["ru-RU"],
    item.workspace?.next?.["zh-CN"],
    item.workspace?.next?.["ru-RU"],
    item.title?.["zh-CN"],
    item.title?.["ru-RU"],
    item.title,
    item.summary?.["zh-CN"],
    item.summary?.["ru-RU"],
    item.summary,
    item.next?.["zh-CN"],
    item.next?.["ru-RU"],
    item.next,
    item.domainGroup,
    item.reason
  ].join(" ");
  return /(ledgerCorrection|deposit|finance|payment|receipt|balance|settlement|押金|财务|账本|收款|余额|结算)/i.test(text);
}

export function selectSearchSurfaceResults(state, query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  const workspaces = selectRuntimeWorkspaces(state);
  const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const backendResults = state.runtimeStore?.searchResultsByQuery?.[normalized] || [];
  if (backendResults.length) {
    return backendResults
      .map((result) => withSurfaceCard(byId.get(result.workspaceId), result.cardId, result.score || 0, result))
      .filter(Boolean);
  }

  const found = workspaces
    .map((workspace) => withSurfaceScore(workspace, normalized))
    .filter((item) => item._score > 0)
    .sort((a, b) => b._score - a._score);
  return found.length ? found : workspaces;
}

export function selectLearningCatalog(state) {
  const catalog = state.runtimeStore?.learningCatalog || [];
  if (!catalog.length) {
    return selectRuntimeWorkspaces(state);
  }

  const workspaces = selectRuntimeWorkspaces(state);
  const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const grouped = new Map();
  for (const entry of catalog) {
    if (!entry?.workspaceId || !entry?.cardId) continue;
    const workspace = byId.get(entry.workspaceId);
    if (!workspace) continue;
    if (!grouped.has(entry.workspaceId)) {
      grouped.set(entry.workspaceId, { workspace, entries: [] });
    }
    grouped.get(entry.workspaceId).entries.push(entry);
  }

  return Array.from(grouped.values()).map(({ workspace, entries }) => ({
    ...workspace,
    cards: entries.map((entry) => learningCard(workspace, entry)),
    _learningSource: state.runtimeStore?.learningSource || "runtime-api"
  }));
}

export function selectWorkspaceById(state, workspaceId) {
  return selectRuntimeWorkspaces(state).find((workspace) => workspace.id === workspaceId);
}

export function selectCardById(workspace, cardId) {
  return workspace?.cards?.find((card) => card.id === cardId);
}

export function selectSurfaceStats(state) {
  const queue = selectWorkbenchQueue(state);
  return {
    myQueueCount: queue.filter((item) => item.badges?.includes("mine")).length,
    blockedCount: queue.filter((item) => item.badges?.includes("blocked") || item.card?.status === "blocked").length,
    confirmCount: queue.filter((item) => item.badges?.includes("confirm") || item.card?.confirmation?.required).length,
    queueCount: queue.length
  };
}

export function isUnsafeLedgerCarryForward(workspace, fieldId) {
  return workspace?.id?.includes("LEDGER") && ledgerAmountFields.has(fieldId);
}

export function activeCard(workspace) {
  return workspace?.cards?.find((card) => activeStatuses.has(normalizeOperationLifecycleState(card.status, ""))) || workspace?.cards?.[0];
}

function projectionHomeItem(workspace) {
  const card = activeCard(workspace);
  return {
    workspaceId: workspace.id,
    cardId: card?.id || "",
    domain: workspace.domain,
    domainGroup: domainGroupFor(workspace),
    priority: priorityFor(card?.status),
    status: card?.status || "",
    title: workspace.title,
    summary: workspace.summary,
    reason: workspace.next,
    source: "projection-fallback"
  };
}

function learningCard(workspace, entry) {
  const card = selectCardById(workspace, entry.cardId);
  if (card) {
    return {
      ...card,
      fields: {
        ...card.fields,
        business: entry.fields?.length ? entry.fields : card.fields?.business || []
      },
      evidence: entry.evidence?.length ? entry.evidence : card.evidence || [],
      checks: entry.checks?.length ? entry.checks : card.checks || [],
      blockerRules: entry.blockers?.length ? entry.blockers : card.blockerRules || []
    };
  }

  return {
    id: entry.cardId,
    status: "notStarted",
    title: entry.title || workspace.title,
    fields: { system: [], business: entry.fields || [], analytics: [] },
    evidence: entry.evidence || [],
    checks: entry.checks || [],
    blockerRules: entry.blockers || [],
    confirmation: { required: false, label: { "zh-CN": "", "ru-RU": "" } }
  };
}

function withSurfaceCard(workspace, cardId, score, result = {}) {
  if (!workspace) return null;
  return {
    ...workspace,
    _surfaceCardId: cardId,
    _score: score,
    score,
    localizedTitle: result.localizedTitle,
    localizedSubtitle: result.localizedSubtitle,
    localizedStatus: result.localizedStatus,
    localizedNextAction: result.localizedNextAction
  };
}

function withSurfaceScore(workspace, query) {
  const text = workspaceText(workspace);
  const score = text.includes(query) ? 50 : 0;
  return withSurfaceCard(workspace, activeCard(workspace)?.id, score);
}

function workspaceText(workspace) {
  return [
    workspace.id,
    workspace.domain,
    workspace.title?.["zh-CN"],
    workspace.title?.["ru-RU"],
    workspace.summary?.["zh-CN"],
    workspace.summary?.["ru-RU"],
    workspace.next?.["zh-CN"],
    workspace.next?.["ru-RU"],
    businessAnchorText(workspace),
    workspace.cards?.map((card) => `${card.id} ${card.title?.["zh-CN"] || ""} ${card.title?.["ru-RU"] || ""}`).join(" ")
  ].join(" ").toLocaleLowerCase();
}

function queueDomainFor(item = {}, workspace = {}) {
  const explicit = normalizeDomain(item.domain || item.domainGroup || item.domain_group || item.businessLine || item.business_line);
  const workspaceDomain = normalizeDomain(workspace?.domain || workspace?.businessLine || workspace?.business_line);
  if (explicit && explicit !== "operations" && explicit !== "ops") return explicit;
  if (workspaceDomain) return workspaceDomain;
  const text = [
    item.workItemType,
    item.work_item_type,
    item.workItemId,
    item.work_item_id,
    item.workspaceId,
    item.cardId,
    item.card?.id,
    item.workspace?.title?.["zh-CN"],
    item.workspace?.summary?.["zh-CN"]
  ].join(" ");
  if (/stay|dorm|room|bed|checkin|checkout|deposit|payment|service|expense|period|lead|住宿|房间|床位|入住|退住|押金|收款|线索/i.test(text)) return "stay";
  if (/repair|维修/i.test(text)) return "repair";
  if (/finance|ledger|财务|账本/i.test(text)) return "finance";
  return explicit || "";
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

function badgesFor(card) {
  if (!card) return [];
  const status = normalizeOperationLifecycleState(card.status, card.status);
  const badges = [status];
  if (activeStatuses.has(status)) badges.push("mine");
  if (card.status === "blocked") badges.push("blocked");
  if (card.confirmation?.required || card.Confirmation?.required) badges.push("confirm");
  return Array.from(new Set(badges));
}

function priorityFor(status) {
  const normalized = normalizeOperationLifecycleState(status, "");
  if (normalized === "blocked") return 100;
  if (normalized === "ready") return 90;
  if (normalized === "inProgress") return 80;
  return 40;
}

function isPersistedWorkItemId(value) {
  const id = String(value || "");
  return id.includes(":") || /^wi-/i.test(id);
}

function domainGroupFor(workspace) {
  if (workspace.domain === "stay") return "Accommodation";
  if (workspace.domain === "repair") return "Repair";
  if (workspace.domain === "finance") return "Finance";
  return "Operations";
}
