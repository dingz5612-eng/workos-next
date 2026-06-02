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
  return selectWorkbenchQueue(state).filter((item) => item.transferable || item.ownerRole !== state.currentActor?.role).length;
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
    .sort((a, b) => state.sort === "dueSort" ? String(a.due || "").localeCompare(String(b.due || "")) : (b.priority || 0) - (a.priority || 0));
}

export function evidenceStateFor(item = {}) {
  const explicit = item.evidenceState || item.card?.evidenceState;
  if (explicit) return explicit;
  const drafts = item.evidenceDrafts || item.card?.evidenceDrafts || [];
  if (drafts.some((draft) => draft.status === "rejected")) return "rejected";
  if (drafts.length) return "draft";
  return (item.card?.evidence || item.evidenceRequirements || []).length ? "missing" : "ready";
}

function ownerRoleMatches(item, filter, state) {
  if (filter === "mine") return item.ownerRole === state.currentActor?.role || item.badges?.includes("mine");
  return item.ownerRole === filter;
}

function transferableMatches(item, filter, state) {
  const transferable = Boolean(item.transferable || item.ownerRole && item.ownerRole !== state.currentActor?.role);
  return filter === "true" ? transferable : !transferable;
}
