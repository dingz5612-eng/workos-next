import { selectWorkbenchQueue } from "./surfaceSelectors.js";
import { queueFiltersFromState } from "../queueFilterState.js";

export function countDomain(state, key) {
  const queue = selectWorkbenchQueue(state);
  return key === "all" ? queue.length : queue.filter((item) => item.domain === key).length;
}

export function countBadge(state, key) {
  return selectWorkbenchQueue(state).filter((item) => item.badges?.includes(key)).length;
}

export function countEvidenceState(state, key) {
  return selectWorkbenchQueue(state).filter((item) => evidenceStateFor(item) === key).length;
}

export function countTransferable(state) {
  return selectWorkbenchQueue(state).filter((item) => item.transferable === true).length;
}

export function selectTodayFocusQueue(state) {
  return selectWorkbenchQueue(state)
    .filter((item) => isTodayFocusItem(item, state))
    .sort((a, b) => todayPriority(b, state) - todayPriority(a, state));
}

export function todayFocusCounts(state) {
  const queue = selectTodayFocusQueue(state);
  return {
    mustDo: queue.filter((item) => isTodayMustDo(item, state)).length,
    dueSoon: queue.filter(isDueSoonOrOverdue).length,
    missingEvidence: queue.filter((item) => evidenceStateFor(item) === "missing").length,
    waitingOthers: queue.filter((item) => isWaitingOnOtherOwner(item, state)).length,
    waitingFinance: queue.filter(isWaitingFinance).length,
    syncing: syncingCount(state, queue),
    risk: queue.filter(isRiskReminder).length
  };
}

export function todayFocusItems(state) {
  const filter = state.todayFilter || "must-do";
  const queue = selectTodayFocusQueue(state);
  const filtered = queue.filter((item) => todayFilterMatches(item, filter, state));
  return filtered.length ? filtered : queue;
}

export function queueTasks(state) {
  const filters = queueFiltersFromState(state);
  return selectWorkbenchQueue(state)
    .filter((item) => filters.domain === "all" || item.domain === filters.domain)
    .filter((item) => filters.badge === "all" || item.badges?.includes(filters.badge))
    .filter((item) => filters.status === "all" || item.status === filters.status || item.lifecycleState === filters.status || item.card?.status === filters.status)
    .filter((item) => filters.ownerRole === "all" || ownerRoleMatches(item, filters.ownerRole, state))
    .filter((item) => filters.evidenceState === "all" || evidenceStateFor(item) === filters.evidenceState)
    .filter((item) => filters.transferable === "all" || transferableMatches(item, filters.transferable, state))
    .filter((item) => filters.riskLevel === "all" || item.riskLevel === filters.riskLevel || item.card?.riskLevel === filters.riskLevel)
    .filter((item) => filters.due === "all" || dueMatches(item, filters.due))
    .filter((item) => filters.scenario === "all" || scenarioForItem(item) === filters.scenario)
    .sort((a, b) => queueSort(a, b, state));
}

export function evidenceStateFor(item = {}) {
  const explicit = item.evidenceState || item.card?.evidenceState;
  if (explicit) return normalizeEvidenceState(explicit);
  const drafts = item.evidenceDrafts || item.card?.evidenceDrafts || [];
  if (drafts.some((draft) => ["rejected", "scope_mismatch", "wrong_scope", "expired", "upload_failed"].includes(normalizeEvidenceState(draft.status || draft.verificationStatus)))) return "missing";
  if (drafts.length) return "draft";
  return (item.card?.evidence || item.evidenceRequirements || []).length ? "system_ready" : "ready";
}

function ownerRoleMatches(item, filter, state) {
  if (filter === "mine") return item.ownerRole === state.currentActor?.role || item.badges?.includes("mine");
  if (filter === "not-mine") return isWaitingOnOtherOwner(item, state);
  return item.ownerRole === filter;
}

function transferableMatches(item, filter, state) {
  const transferable = item.transferable === true;
  return filter === "true" ? transferable : !transferable;
}

function normalizeEvidenceState(value = "") {
  const state = String(value || "").trim();
  if (state === "wrong_scope" || state === "scope_mismatch") return "missing";
  if (["rejected", "expired", "upload_failed", "locked"].includes(state)) return "missing";
  return state;
}

function queueSort(a, b, state) {
  const sort = state.sort || "smartSort";
  if (sort === "dueSort") return dueTimestamp(a) - dueTimestamp(b);
  if (sort === "riskSort") return riskRank(b) - riskRank(a) || (b.priority || 0) - (a.priority || 0);
  if (sort === "recentSort") return updatedTimestamp(b) - updatedTimestamp(a);
  return (b.priority || 0) - (a.priority || 0);
}

function todayFilterMatches(item, filter, state) {
  return {
    "must-do": () => isTodayMustDo(item, state),
    "due-soon": () => isDueSoonOrOverdue(item),
    "missing-evidence": () => evidenceStateFor(item) === "missing",
    "waiting-others": () => isWaitingOnOtherOwner(item, state),
    "waiting-finance": () => isWaitingFinance(item),
    "just-submitted": () => isSyncing(item),
    "risk-reminder": () => isRiskReminder(item)
  }[filter]?.() ?? isTodayMustDo(item, state);
}

function isTodayFocusItem(item, state) {
  return isTodayMustDo(item, state) ||
    isDueSoonOrOverdue(item) ||
    evidenceStateFor(item) === "missing" ||
    isWaitingOnOtherOwner(item, state) ||
    isWaitingFinance(item) ||
    isSyncing(item) ||
    isRiskReminder(item);
}

function isTodayMustDo(item, state) {
  return isMine(item, state) && canActNow(item) && !isSyncing(item);
}

function canActNow(item) {
  const status = String(item.status || item.lifecycleState || item.card?.status || "").toLowerCase();
  return ["ready", "available", "open", "prepared", "inprogress", "in_progress"].includes(status) ||
    item.badges?.includes("ready");
}

function isMine(item, state) {
  const role = String(state.currentActor?.role || "").toLowerCase();
  const owner = String(item.ownerRole || item.owner_role || "").toLowerCase();
  return item.badges?.includes("mine") || !owner || owner === role;
}

function isWaitingOnOtherOwner(item, state) {
  const owner = String(item.ownerRole || item.owner_role || "").toLowerCase();
  const role = String(state.currentActor?.role || "").toLowerCase();
  return Boolean(owner && role && owner !== role) || item.badges?.includes("waiting");
}

function isWaitingFinance(item = {}) {
  const owner = String(item.ownerRole || item.owner_role || "").toLowerCase();
  return owner === "finance" || item.badges?.includes("finance") || /finance|payment|deposit|ledger|押金|财务|收款|账本/i.test([
    item.workItemType,
    item.work_item_type,
    item.workspaceId,
    item.cardId,
    item.reason
  ].join(" "));
}

function isSyncing(item = {}) {
  const status = String(item.status || item.lifecycleState || item.card?.status || "").toLowerCase();
  return status === "committed_projection_pending" ||
    status === "syncing" ||
    item.badges?.includes("syncing") ||
    item.badges?.includes("just-submitted");
}

function syncingCount(state, queue) {
  const submitQueue = (state.submitQueue || []).filter((item) => item.status === "committed_projection_pending").length;
  return submitQueue + queue.filter(isSyncing).length;
}

function isRiskReminder(item = {}) {
  const state = String(item.status || item.lifecycleState || item.card?.status || "").toLowerCase();
  return ["blocked", "confirmdenied", "productionblocked"].includes(state) ||
    item.badges?.includes("blocked") ||
    riskRank(item) >= 3;
}

function isDueSoonOrOverdue(item = {}) {
  if (item.badges?.includes("soon") || item.badges?.includes("overdue")) return true;
  const due = dueTimestamp(item);
  if (!Number.isFinite(due)) return false;
  const now = Date.now();
  return due <= now + 24 * 60 * 60 * 1000;
}

function dueMatches(item, value) {
  return value === "risk" ? isDueSoonOrOverdue(item) : true;
}

function todayPriority(item, state) {
  return (isRiskReminder(item) ? 50 : 0) +
    (isDueSoonOrOverdue(item) ? 40 : 0) +
    (evidenceStateFor(item) === "missing" ? 30 : 0) +
    (isTodayMustDo(item, state) ? 20 : 0) +
    (item.priority || 0);
}

function dueTimestamp(item = {}) {
  const value = item.dueAtUtc || item.due_at_utc || item.dueAt || item.due || item.SLA || "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function updatedTimestamp(item = {}) {
  const value = item.updatedAtUtc || item.updated_at_utc || item.createdAtUtc || item.created_at_utc || item.dueAtUtc || "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function riskRank(item = {}) {
  const value = String(item.riskLevel || item.risk_level || item.card?.riskLevel || "").toLowerCase();
  return {
    p0: 5,
    critical: 5,
    p1: 4,
    high: 4,
    medium: 2,
    low: 1
  }[value] || 0;
}

function scenarioForItem(item = {}) {
  const text = [
    item.workspaceId,
    item.cardId,
    item.workItemType,
    item.work_item_type,
    item.reason,
    item.workspace?.title?.["zh-CN"],
    item.card?.title?.["zh-CN"]
  ].join(" ");
  if (/RESOURCE|roomSetup|bedSetup|rateSetup|roomReadiness|roomBlock|roomRelease|住宿资源|房间|床位/i.test(text)) return "resource";
  if (/CHECKIN|lead|reservation|resident|bedAssign|tariff|入住|预订|住客/i.test(text)) return "checkin";
  if (/DEPOSIT|deposit|押金/i.test(text)) return "deposit";
  if (/PAYMENT|payment|receipt|收款|付款/i.test(text)) return "payment";
  if (/SERVICE|service|clean|repair|清洁|维修|服务任务/i.test(text)) return "service";
  if (/CHECKOUT|checkout|settlement|退住|退房|结算/i.test(text)) return "checkout";
  if (/EXPENSE|expense|支出|成本/i.test(text)) return "expense";
  if (/PERIOD|period|review|复盘|周期/i.test(text)) return "period";
  return "other";
}
