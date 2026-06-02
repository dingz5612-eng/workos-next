import { fetchSearchResults } from "./apiClient.js";
import { applyRuntimeSearchResults } from "./runtime/runtimeStore.js";
import { selectWorkspaceById } from "./selectors/surfaceSelectors.js";
import { evaluateSurfaceAccess } from "./surfaceGuard.js";
import { defaultHomeForCurrentSurface as resolveDefaultHomeForCurrentSurface } from "./surfaceResolver.js";

export function setView(view, ctx) {
  if (!ctx.state.currentActor && view !== "login") {
    ctx.state.view = "login";
    ctx.render(true);
    return;
  }
  const access = evaluateSurfaceAccess(view, ctx.state);
  if (!access.allowed) {
    ctx.state.permissionDiagnostic = access;
    ctx.state.view = "permissionDiagnostic";
    ctx.render(true);
    return;
  }
  ctx.state.permissionDiagnostic = null;
  ctx.state.view = view;
  ctx.render(true);
}

export function setLang(lang, ctx) {
  ctx.state.lang = lang;
  localStorage.setItem("workosnext.lang", lang);
  ctx.render();
}

export function onboard(ctx) {
  localStorage.setItem("workosnext.onboarded", "1");
  setView(defaultHomeForCurrentSurface(ctx), ctx);
}

export function defaultHomeForCurrentSurface(ctx) {
  return resolveDefaultHomeForCurrentSurface(ctx.state);
}

export function openWorkspace(workspaceId, ctx, cardId = "") {
  ctx.state.selectedWorkspace = workspaceId;
  ctx.state.selectedCardId = cardId;
  ctx.state.selectedCardIndex = -1;
  const linked = selectWorkspaceById(ctx.state, workspaceId);
  ctx.state.selectedTask = linked?.taskId || ctx.state.selectedTask;
  setView("workspace", ctx);
}

export function openWorkItem(workItemId, ctx, fallback = {}) {
  const queueItem = (ctx.state.runtimeStore?.workQueue || []).find((item) => item.workItemId === workItemId || item.work_item_id === workItemId);
  const operationItem = (ctx.state.runtimeStore?.operationWorkItems || []).find((item) =>
    item.workItemId === workItemId || item.work_item_id === workItemId);
  const fallbackItem = findRuntimeWorkItemForFallback(ctx.state, fallback);
  const selected = queueItem || operationItem || fallbackItem || null;
  const resolvedWorkItemId = selected?.workItemId || selected?.work_item_id || workItemId;
  ctx.state.selectedWorkItemId = resolvedWorkItemId;
  ctx.state.selectedWorkspace = selected?.workspaceId || selected?.workspace_id || fallback.workspaceId || ctx.state.selectedWorkspace;
  ctx.state.selectedCardId = selected?.cardId || selected?.card_id || fallback.cardId || ctx.state.selectedCardId || "";
  ctx.state.selectedCardIndex = -1;
  setView("operationPanel", ctx);
}

function findRuntimeWorkItemForFallback(state, fallback = {}) {
  if (!fallback.workspaceId) return null;
  return [
    ...(state.runtimeStore?.operationWorkItems || []),
    ...(state.runtimeStore?.workQueue || [])
  ].find((item) =>
    (item.workspaceId || item.workspace_id) === fallback.workspaceId &&
    (!(item.cardId || item.card_id) || (item.cardId || item.card_id) === fallback.cardId) &&
    (item.workItemId || item.work_item_id));
}

export function selectCard(cardIndex, ctx) {
  ctx.state.selectedCardIndex = Number(cardIndex) || 0;
  ctx.state.selectedCardId = "";
  ctx.render(true);
}

export function updateSearchQuery(value, ctx) {
  ctx.state.query = value;
}

export async function runSearch(ctx) {
  ctx.state.query = document.querySelector("#query")?.value || "";
  if (ctx.state.query) {
    ctx.state.recentSearches = [ctx.state.query, ...(ctx.state.recentSearches || []).filter((item) => item !== ctx.state.query)].slice(0, 5);
  }
  if (ctx.state.apiStatus === "online") {
    try {
      applyRuntimeSearchResults(ctx.state, ctx.state.query, await fetchSearchResults(ctx.state.query));
    } catch {
      // Projection fallback remains available through surface selectors.
    }
  }
  ctx.state.view = "search";
  ctx.render(true);
}
