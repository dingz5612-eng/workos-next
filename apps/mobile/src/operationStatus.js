export function normalizeOperationLifecycleState(value, fallback = "ready") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const normalizedKey = raw.replace(/[\s_-]+/g, "").toLocaleLowerCase();
  const aliases = {
    available: "ready",
    open: "ready",
    prepared: "inProgress",
    active: "inProgress",
    inprogress: "inProgress",
    notstarted: "notStarted",
    blocked: "blocked",
    ready: "ready",
    done: "done",
    confirmed: "confirmed",
    completed: "completed",
    skipped: "skipped"
  };
  return aliases[normalizedKey] || raw;
}

export function operationStatusTranslationKey(value) {
  const state = normalizeOperationLifecycleState(value, "");
  const keyByStatus = {
    ready: "ready",
    done: "done",
    confirmed: "confirmed",
    completed: "completed",
    inProgress: "inProgress",
    notStarted: "notStarted",
    blocked: "blocked"
  };
  return keyByStatus[state] || state || value;
}
