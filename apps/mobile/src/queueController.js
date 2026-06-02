import { clearQueueFilters, workFilterToQueueFilter, writeQueueFilter } from "./queueFilterState.js";

export function setQueueFilter(field, value, ctx) {
  writeQueueFilter(ctx.state, field, value);
  ctx.state.filterOpen = true;
  ctx.render();
}

export function setWorkFilter(id, ctx) {
  const [field, value] = workFilterToQueueFilter(id);
  writeQueueFilter(ctx.state, field, value);
  ctx.render();
}

export function clearQueueFilterState(ctx) {
  clearQueueFilters(ctx.state);
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
