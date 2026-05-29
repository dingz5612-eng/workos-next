import { selectWorkbenchQueue } from "./surfaceSelectors.js";

export function countDomain(state, key) {
  const queue = selectWorkbenchQueue(state);
  return key === "all" ? queue.length : queue.filter((item) => item.domain === key).length;
}

export function countBadge(state, key) {
  return selectWorkbenchQueue(state).filter((item) => item.badges?.includes(key)).length;
}

export function queueTasks(state) {
  return selectWorkbenchQueue(state)
    .filter((item) => state.queueDomain === "all" || item.domain === state.queueDomain)
    .filter((item) => item.badges?.includes(state.queueBadge))
    .sort((a, b) => state.sort === "dueSort" ? String(a.due || "").localeCompare(String(b.due || "")) : (b.priority || 0) - (a.priority || 0));
}
