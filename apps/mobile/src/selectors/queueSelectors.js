import { selectWorkbenchQueue } from "./surfaceSelectors.js";

export function countDomain(state, key) {
  const queue = selectWorkbenchQueue(state);
  return key === "all" ? queue.length : queue.filter((item) => item.domain === key).length;
}

export function countBadge(state, key) {
  return selectWorkbenchQueue(state).filter((item) => item.badges?.includes(key)).length;
}

export function queueTasks(state) {
  const filters = queueFilters(state);
  return selectWorkbenchQueue(state)
    .filter((item) => filters.domain === "all" || item.domain === filters.domain)
    .filter((item) => filters.badge === "all" || item.badges?.includes(filters.badge))
    .filter((item) => filters.status === "all" || item.status === filters.status || item.card?.status === filters.status)
    .filter((item) => filters.ownerRole === "all" || filters.ownerRole === "mine" || item.ownerRole === filters.ownerRole)
    .filter((item) => filters.evidenceState === "all" || item.evidenceState === filters.evidenceState)
    .filter((item) => filters.transferable === "all" || Boolean(item.transferable) === (filters.transferable === "true"))
    .sort((a, b) => state.sort === "dueSort" ? String(a.due || "").localeCompare(String(b.due || "")) : (b.priority || 0) - (a.priority || 0));
}

export function queueFilters(state = {}) {
  return {
    domain: state.queueFilters?.domain ?? state.queueDomain ?? "all",
    badge: state.queueFilters?.badge ?? state.queueBadge ?? "mine",
    status: state.queueFilters?.status ?? "all",
    ownerRole: state.queueFilters?.ownerRole ?? "mine",
    evidenceState: state.queueFilters?.evidenceState ?? "all",
    transferable: state.queueFilters?.transferable ?? "all"
  };
}
