export function setQueueFilter(field, value, ctx) {
  const mappedField = field === "queueDomain" ? "domain" : field === "queueBadge" ? "badge" : field;
  ctx.state.queueFilters = {
    domain: ctx.state.queueDomain || "all",
    badge: ctx.state.queueBadge || "mine",
    status: "all",
    ownerRole: "mine",
    evidenceState: "all",
    transferable: "all",
    ...(ctx.state.queueFilters || {}),
    [mappedField]: value
  };
  ctx.state.queueDomain = ctx.state.queueFilters.domain;
  ctx.state.queueBadge = ctx.state.queueFilters.badge;
  ctx.render();
}

export function toggleFilters(ctx) {
  ctx.state.filterOpen = !ctx.state.filterOpen;
  ctx.render();
}

export function openAdvancedFilters(ctx) {
  ctx.state.advancedOpen = true;
  ctx.render();
}

export function closeAdvancedFilters(ctx) {
  ctx.state.advancedOpen = false;
  ctx.render();
}

export function setQueueSort(value, ctx) {
  ctx.state.sort = value;
  ctx.render();
}
