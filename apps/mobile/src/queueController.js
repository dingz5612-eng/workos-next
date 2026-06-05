import { clearQueueFilters, defaultQueueFilters, workFilterToQueueFilters, writeQueueFilter, writeQueueFilters } from "./queueFilterState.js";

export function setQueueFilter(field, value, ctx) {
  writeQueueFilter(ctx.state, field, value);
  ctx.state.filterOpen = true;
  ctx.render();
}

export function setWorkFilter(id, ctx) {
  writeQueueFilters(ctx.state, { ...defaultQueueFilters, ...workFilterToQueueFilters(id) });
  ctx.render();
}

export function setWorkFilterAndOpen(id, ctx) {
  writeQueueFilters(ctx.state, { ...defaultQueueFilters, ...workFilterToQueueFilters(id) });
  ctx.state.view = "workbench";
  ctx.render(true);
}

export function setTodayFilter(id, ctx) {
  ctx.state.todayFilter = id || "must-do";
  ctx.render();
}

export function clearQueueFilterState(ctx) {
  clearQueueFilters(ctx.state);
  ctx.render();
}

export function setQueueSort(value, ctx) {
  ctx.state.sort = value;
  ctx.render();
}
