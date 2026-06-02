export const defaultQueueFilters = {
  domain: "all",
  badge: "mine",
  status: "all",
  ownerRole: "all",
  evidenceState: "all",
  transferable: "all",
  riskLevel: "all"
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

export function clearQueueFilters(state) {
  state.queueFilters = { ...defaultQueueFilters };
  state.queueDomain = defaultQueueFilters.domain;
  state.queueBadge = defaultQueueFilters.badge;
  return state.queueFilters;
}

export function workFilterToQueueFilter(id) {
  return {
    accommodation: ["domain", "stay"],
    "can-do": ["status", "ready"],
    blocked: ["status", "blocked"],
    "waiting-others": ["badge", "waiting"],
    "need-evidence": ["evidenceState", "missing"],
    transferable: ["transferable", "true"]
  }[id] || ["badge", id];
}

const fieldMap = {
  queueDomain: "domain",
  queueBadge: "badge",
  domain: "domain",
  badge: "badge"
};
