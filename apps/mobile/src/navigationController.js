import { fetchSearchResults, startResourceSetup, startWorkspace } from "./apiClient.js";
import { applyRuntimeSearchResults } from "./runtime/runtimeStore.js";
import { selectWorkspaceById } from "./selectors/surfaceSelectors.js";
import { evaluateSurfaceAccess } from "./surfaceGuard.js";
import { defaultHomeForCurrentSurface as resolveDefaultHomeForCurrentSurface } from "./surfaceResolver.js";
import { resolveOperationPanelTarget } from "./operationRouteResolver.js";

export function setView(view, ctx) {
  if (!ctx.state.currentActor && view !== "login") {
    ctx.state.view = "login";
    syncUrlFromState(ctx);
    ctx.render(true);
    return;
  }
  const access = evaluateSurfaceAccess(view, ctx.state);
  if (!access.allowed) {
    ctx.state.permissionDiagnostic = access;
    ctx.state.view = "permissionDiagnostic";
    syncUrlFromState(ctx);
    ctx.render(true);
    return;
  }
  ctx.state.permissionDiagnostic = null;
  ctx.state.view = view;
  syncUrlFromState(ctx);
  ctx.render(true);
}

export function setLang(lang, ctx) {
  ctx.state.lang = lang;
  localStorage.setItem("workosnext.lang", lang);
  syncUrlFromState(ctx);
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
  clearTransientOperationMessage(ctx);
  const linked = selectWorkspaceById(ctx.state, workspaceId);
  ctx.state.selectedTask = linked?.taskId || ctx.state.selectedTask;
  setView("workspace", ctx);
}

export function openWorkItem(workItemId, ctx, fallback = {}) {
  return openOperationPanel(workItemId, ctx, fallback);
}

export function openOperationPanel(workItemId, ctx, fallback = {}) {
  const target = resolveOperationPanelTarget({ workItemId, ...fallback }, ctx.state);
  if (!target.canOpen) {
    ctx.state.operationRouteIssue = target;
    ctx.state.selectedWorkItemId = "";
    ctx.state.selectedWorkspace = fallback.workspaceId || ctx.state.selectedWorkspace;
    ctx.state.selectedCardId = fallback.cardId || ctx.state.selectedCardId || "";
    ctx.state.selectedCardIndex = -1;
    setView("operationPanel", ctx);
    return target;
  }
  const selected = target.workItem;
  ctx.state.operationRouteIssue = null;
  clearTransientOperationMessage(ctx);
  ctx.state.selectedWorkItemId = selected.workItemId;
  ctx.state.selectedWorkspace = selected.workspaceId || fallback.workspaceId || ctx.state.selectedWorkspace;
  ctx.state.selectedCardId = selected.cardId || fallback.cardId || ctx.state.selectedCardId || "";
  ctx.state.selectedCardIndex = -1;
  setView("operationPanel", ctx);
  return target;
}

export function selectCard(cardIndex, ctx) {
  ctx.state.selectedCardIndex = Number(cardIndex) || 0;
  ctx.state.selectedCardId = "";
  syncUrlFromState(ctx);
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
  syncUrlFromState(ctx);
  ctx.render(true);
}

export async function startResourceSetupCommand(ctx) {
  return startWorkspaceCommand(ctx, "W-STAY-RESOURCE", "roomSetup");
}

export async function startWorkspaceCommand(ctx, templateWorkspaceId, firstCardId = "") {
  if (!ctx.state.currentActor) {
    setView("login", ctx);
    return;
  }
  ctx.state.operationMessage = ctx.tr("submitting");
  ctx.render();
  try {
    const result = templateWorkspaceId === "W-STAY-RESOURCE"
      ? await startResourceSetup(ctx.state.currentActor.token || "")
      : await startWorkspace(templateWorkspaceId, ctx.state.currentActor.token || "");
    if (result?.projection) {
      ctx.applyRuntimeProjection(result.projection);
    } else {
      await ctx.hydrateProjectionFromApi();
    }
    const workspaceId = result?.workspace?.id || result?.workspace?.Id || latestStartedWorkspaceId(result?.projection, templateWorkspaceId);
    if (workspaceId) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "workspace");
      url.searchParams.set("workspace", workspaceId);
      if (firstCardId) url.searchParams.set("card", firstCardId);
      window.location.href = url.toString();
      return;
    }
    ctx.state.operationMessage = ctx.tr("apiOffline");
  } catch {
    ctx.state.operationMessage = ctx.tr("apiOffline");
  }
  ctx.render();
}

function latestStartedWorkspaceId(projection = {}, templateWorkspaceId = "W-STAY-RESOURCE") {
  return (projection.workspaces || projection.Workspaces || [])
    .filter((workspace) => String(workspace.id || workspace.Id || "").startsWith(`${templateWorkspaceId}-`))
    .map((workspace) => workspace.id || workspace.Id)
    .at(-1) || "";
}

export function syncUrlFromState(ctx) {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  const location = window.location || {};
  const base = location.href || location.origin || "http://localhost:5175/";
  let url;
  try {
    url = new URL(base, location.origin || "http://localhost:5175");
  } catch {
    return;
  }
  url.searchParams.set("view", ctx.state.view || "home");
  url.searchParams.set("lang", ctx.state.lang || "zh-CN");
  const surface = ctx.state.currentDevice?.surface;
  if (surface) url.searchParams.set("device", surface);
  if (["workspace", "operationPanel"].includes(ctx.state.view)) {
    if (ctx.state.selectedWorkspace) url.searchParams.set("workspace", ctx.state.selectedWorkspace);
    if (ctx.state.selectedCardId) url.searchParams.set("card", ctx.state.selectedCardId);
    if (ctx.state.selectedWorkItemId) url.searchParams.set("workItem", ctx.state.selectedWorkItemId);
  } else {
    url.searchParams.delete("workspace");
    url.searchParams.delete("card");
    url.searchParams.delete("workItem");
  }
  if (ctx.state.view === "search" && ctx.state.query) {
    url.searchParams.set("q", ctx.state.query);
  } else if (ctx.state.view !== "search") {
    url.searchParams.delete("q");
  }
  window.history.replaceState(null, "", url.toString());
}

function clearTransientOperationMessage(ctx) {
  const message = String(ctx.state.operationMessage || "");
  if (!message) return;
  const transient = [ctx.tr("apiOffline"), ctx.tr("submitting")];
  const offlineCopy = /运行服务未连接|Рабочий сервис не подключен|Иш кызматы туташкан жок/;
  if (transient.includes(message) || offlineCopy.test(message)) {
    ctx.state.operationMessage = "";
  }
}
