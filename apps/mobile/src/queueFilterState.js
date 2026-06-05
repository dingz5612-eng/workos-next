export const defaultQueueFilters = {
  domain: "all",
  badge: "all",
  status: "all",
  ownerRole: "all",
  evidenceState: "all",
  transferable: "all",
  riskLevel: "all",
  due: "all",
  scenario: "all"
};

export function queueFiltersFromState(state = {}) {
  return {
    ...defaultQueueFilters,
    ...(state.queueFilters || {}),
    domain: state.queueFilters?.domain || state.queueDomain || defaultQueueFilters.domain,
    badge: state.queueFilters?.badge || state.queueBadge || defaultQueueFilters.badge
  };
}

export function writeQueueFilter(state, field, value) {
  const filters = queueFiltersFromState(state);
  const normalizedField = fieldMap[field] || field;
  if (!Object.prototype.hasOwnProperty.call(defaultQueueFilters, normalizedField)) return filters;
  const normalizedValue = value || defaultQueueFilters[normalizedField];
  state.queueFilters = { ...filters, [normalizedField]: normalizedValue };
  state.queueDomain = state.queueFilters.domain;
  state.queueBadge = state.queueFilters.badge;
  return state.queueFilters;
}

export function writeQueueFilters(state, patch = {}) {
  const filters = queueFiltersFromState(state);
  const next = { ...filters };
  for (const [field, value] of Object.entries(patch)) {
    const normalizedField = fieldMap[field] || field;
    if (!Object.prototype.hasOwnProperty.call(defaultQueueFilters, normalizedField)) continue;
    next[normalizedField] = value || defaultQueueFilters[normalizedField];
  }
  state.queueFilters = next;
  state.queueDomain = state.queueFilters.domain;
  state.queueBadge = state.queueFilters.badge;
  return state.queueFilters;
}

export function clearQueueFilters(state) {
  state.queueFilters = { ...defaultQueueFilters };
  state.queueDomain = defaultQueueFilters.domain;
  state.queueBadge = defaultQueueFilters.badge;
  return state.queueFilters;
}

export function workFilterToQueueFilters(id) {
  return {
    "all-work": { ...defaultQueueFilters },
    mine: { badge: "mine" },
    "can-do": { badge: "mine", status: "ready" },
    blocked: { status: "blocked" },
    "need-evidence": { evidenceState: "missing" },
    "waiting-others": { ownerRole: "not-mine" },
    "waiting-finance": { ownerRole: "finance" },
    "due-risk": { due: "risk" },
    "just-submitted": { status: "committed_projection_pending" },
    transferable: { transferable: "true" },
    accommodation: { domain: "stay" },
    "scenario-resource": { scenario: "resource" },
    "scenario-checkin": { scenario: "checkin" },
    "scenario-deposit": { scenario: "deposit" },
    "scenario-payment": { scenario: "payment" },
    "scenario-service": { scenario: "service" },
    "scenario-checkout": { scenario: "checkout" },
    "scenario-expense": { scenario: "expense" },
    "scenario-period": { scenario: "period" }
  }[id] || { badge: id };
}

export function workFilterToQueueFilter(id) {
  const filters = workFilterToQueueFilters(id);
  const [field, value] = Object.entries(filters)[0] || ["badge", id];
  return [field, value];
}

const fieldMap = {
  queueDomain: "domain",
  queueBadge: "badge",
  domain: "domain",
  badge: "badge"
};
