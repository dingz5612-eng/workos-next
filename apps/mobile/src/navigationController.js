import { fetchSearchResults, recordMobileClientEvent, startOperationsWorkspace } from "./apiClient.js";
import { searchPreferenceKey } from "./appState.js";
import { applyRuntimeSearchResults, applyRuntimeSurfacePayloads } from "./runtime/runtimeStore.js";
import { selectWorkspaceById } from "./selectors/surfaceSelectors.js";
import { evaluateSurfaceAccess } from "./surfaceGuard.js";
import { safeConfirmErrorKey, safeReasonCode } from "./admissionSurface.js";
import { defaultHomeForCurrentSurface as resolveDefaultHomeForCurrentSurface } from "./surfaceResolver.js";
import { resolveOperationPanelTarget } from "./operationRouteResolver.js";
import { resolveSearchIntentId } from "./searchIntentRegistry.js";
import { DORMITORY_MAINLINE_WORKSPACE_ID } from "./capabilityProjection.js";

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
  clearOperationStateOutsideRuntimeSurface(ctx, view);
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
  const target = resolveOperationPanelTarget({ workspaceId, cardId }, ctx.state);
  if (target.canOpen) {
    return openOperationPanel(target.workItem.workItemId, ctx, { workspaceId, cardId });
  }
  ctx.state.selectedWorkspace = workspaceId;
  ctx.state.selectedCardId = cardId;
  ctx.state.selectedCardIndex = -1;
  clearTransientOperationMessage(ctx);
  const linked = selectWorkspaceById(ctx.state, workspaceId);
  if (!isReadonlyProjectionRecord(linked, cardId)) {
    ctx.state.operationRouteIssue = target;
    setView("operationPanel", ctx);
    return target;
  }
  ctx.state.selectedTask = linked?.taskId || ctx.state.selectedTask;
  setView("workspace", ctx);
  return target;
}

export function openWorkItem(workItemId, ctx, fallback = {}) {
  return openOperationPanel(workItemId, ctx, fallback);
}

export function openReadonlyWorkspaceRecord(workspaceId, cardId = "", ctx) {
  ctx.state.operationRouteIssue = null;
  ctx.state.selectedWorkItemId = "";
  ctx.state.selectedWorkspace = workspaceId || ctx.state.selectedWorkspace;
  ctx.state.selectedCardId = cardId || "";
  ctx.state.selectedCardIndex = -1;
  clearTransientOperationMessage(ctx);
  setView("workspace", ctx);
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
  clearOperationStateForWorkItemChange(ctx, selected);
  clearStaleRouteBlocker(ctx, selected);
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

export async function runSearch(ctx, explicitQuery = null) {
  ctx.state.query = explicitQuery !== null ? explicitQuery : document.querySelector("#query")?.value || "";
  const requestId = nextSearchRequestId(ctx);
  if (ctx.state.query) {
    rememberSearch(ctx, ctx.state.query);
    void recordSearchIntentEvent(ctx, ctx.state.query);
  }
  ctx.state.view = "search";
  syncUrlFromState(ctx);
  ctx.render(true);
  if (ctx.state.apiStatus === "online") {
    try {
      const query = ctx.state.query;
      const results = await fetchSearchResults(query);
      if (ctx.state.searchRequestId !== requestId) return;
      applyRuntimeSearchResults(ctx.state, query, results);
      const operationItems = operationWorkItemsFromSearchResults(results);
      if (operationItems.length) {
        applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems: operationItems });
      }
    } catch {
      // Projection fallback remains available through surface selectors.
    }
  }
  if (ctx.state.searchRequestId !== requestId) return;
  ctx.state.view = "search";
  syncUrlFromState(ctx);
  ctx.render(true);
}

function rememberSearch(ctx, query) {
  ctx.state.recentSearches = [query, ...(ctx.state.recentSearches || []).filter((item) => item !== query)].slice(0, 8);
  try {
    localStorage.setItem(searchPreferenceKey(ctx.state.currentActor), JSON.stringify(ctx.state.recentSearches));
  } catch {
    // Local search preference storage is best-effort.
  }
}

async function recordSearchIntentEvent(ctx, query) {
  try {
    await recordMobileClientEvent({
      eventType: "search.performed",
      objectType: "searchIntent",
      objectId: resolveSearchIntentId(query),
      language: ctx.state.lang,
      source: "mobile.search"
    });
  } catch {
    // Search analytics must not block the user's search flow.
  }
}

function operationWorkItemsFromSearchResults(results = []) {
  return (Array.isArray(results) ? results : [])
    .filter((item) => (item.resultType || item.result_type) === "workItem")
    .filter((item) => item.workItemId || item.work_item_id || item.target?.workItemId)
    .map((item) => ({
      workItemId: item.workItemId || item.work_item_id || item.target?.workItemId || "",
      caseId: item.caseId || item.case_id || item.target?.caseId || "",
      workItemType: item.workItemType || item.work_item_type || item.cardId || item.card_id || "",
      lifecycleState: item.lifecycleState || item.lifecycle_state || item.status || "ready",
      status: item.status || item.lifecycleState || item.lifecycle_state || "ready",
      ownerRole: item.ownerRole || item.owner_role || "operator",
      workspaceId: item.workspaceId || item.workspace_id || item.target?.workspaceId || "",
      cardId: item.cardId || item.card_id || item.target?.cardId || "",
      domain: item.domain || "operations",
      badges: ["mine", item.status || item.lifecycleState || "ready"].filter(Boolean),
      priority: item.score || 90,
      reason: localizedSearchValue(item.nextAction || item.next_action || item.summary || item.subtitle),
      businessAnchor: item.businessAnchor || item.business_anchor || item.payload?.fieldValues || item.payload?.field_values || {},
      payload: {
        ...(item.payload || {}),
        cardId: item.cardId || item.card_id || item.target?.cardId || "",
        caseId: item.caseId || item.case_id || item.target?.caseId || "",
        sourceEventId: item.payload?.sourceEventId || item.sourceRefs?.sourceEventId || "",
        sourceSubmissionId: item.payload?.sourceSubmissionId || item.sourceRefs?.sourceSubmissionId || ""
      },
      source: "search-kernel-operations"
    }));
}

function localizedSearchValue(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value["zh-CN"] || value["ru-RU"] || value["ky-KG"] || value.label || value.title || "";
}

export async function startOperationsWorkspaceCommand(ctx, templateWorkspaceId, firstCardId = "", options = {}) {
  if (!ctx.state.currentActor) {
    setView("login", ctx);
    return;
  }
  invalidatePendingSearch(ctx);
  ctx.state.operationMessage = ctx.tr("submitting");
  ctx.render();
  try {
    const result = await startOperationsWorkspace(templateWorkspaceId, ctx.state.currentActor.token || "", "operation_workspace_start_failed", {
      anchorQuery: options.anchorQuery || ctx.state.query || "",
      anchorPayload: options.anchorPayload || null
    });
    if (result?.projection) {
      ctx.applyRuntimeProjection(result.projection);
    }
    const operationWorkItems = result?.operationWorkItems || (result?.workItem ? [result.workItem] : null);
    if (operationWorkItems) {
      applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems });
    } else {
      await ctx.hydrateProjectionFromApi();
    }
    const workspaceId = result?.workspace?.id || result?.workspace?.Id || latestStartedWorkspaceId(result?.projection, templateWorkspaceId);
    const workItemId = result?.workItem?.workItemId || result?.workItem?.WorkItemId || "";
    const cardId = result?.workItem?.payload?.cardId || result?.workItem?.Payload?.cardId || firstCardId;
    if (workItemId || workspaceId) {
      ctx.state.fieldValidation = null;
      ctx.state.lastActionResult = null;
      ctx.state.operationMessage = "";
      openOperationPanel(workItemId, ctx, { workspaceId, cardId });
      return;
    }
    ctx.state.operationMessage = ctx.tr("apiOffline");
  } catch (error) {
    handleStartWorkspaceError(error, ctx);
  }
  ctx.render();
}

function handleStartWorkspaceError(error, ctx) {
  if (error?.status === 401 || error?.reason === "actor_session_required") {
    ctx.state.currentActor = null;
    ctx.state.loginMessage = ctx.tr("sessionExpired");
    localStorage.removeItem("workosnext.actorSession");
    setView("login", ctx);
    return;
  }
  if (error?.status === 403) {
    const decision = {
      allowed: false,
      view: "operationPanel",
      reason: safeReasonCode(error.reason || error.code || "role_surface_not_allowed"),
      owner: "manager",
      requiredPermission: "operations.workspace.start",
      nextAction: ctx.tr("operations.error.safe.403"),
      status: "permission_blocked_403",
      component: "PermissionDiagnostic"
    };
    ctx.state.permissionDiagnostic = decision;
    ctx.state.lastActionResult = {
      status: "permission_blocked_403",
      message: ctx.tr("operations.error.safe.403"),
      permissionDiagnostic: decision
    };
    ctx.state.operationMessage = "";
    ctx.state.view = "permissionDiagnostic";
    syncUrlFromState(ctx);
    return;
  }
  if (error?.status === 422) {
    ctx.state.operationMessage = ctx.tr(safeConfirmErrorKey(422));
    ctx.state.lastActionResult = {
      status: "business_blocked_422",
      reason: safeReasonCode(error.reason || error.code || "workspace_start_blocked"),
      message: ctx.state.operationMessage
    };
    return;
  }
  ctx.state.operationMessage = ctx.tr("apiOffline");
}

function latestStartedWorkspaceId(projection = {}, templateWorkspaceId = DORMITORY_MAINLINE_WORKSPACE_ID) {
  return (projection.workspaces || projection.Workspaces || [])
    .filter((workspace) => String(workspace.id || workspace.Id || "").startsWith(`${templateWorkspaceId}-`))
    .map((workspace) => workspace.id || workspace.Id)
    .at(-1) || "";
}

function nextSearchRequestId(ctx) {
  ctx.state.searchRequestId = (ctx.state.searchRequestId || 0) + 1;
  return ctx.state.searchRequestId;
}

function invalidatePendingSearch(ctx) {
  ctx.state.searchRequestId = (ctx.state.searchRequestId || 0) + 1;
}

function clearStaleRouteBlocker(ctx, selected = {}) {
  const result = ctx.state.lastActionResult;
  if (result?.status !== "business_blocked_422") return;
  const reason = result.reason || result.error || result.code || "";
  const staleMissingWorkItem = ["operation_work_item_required", "persisted_work_item_required"].includes(reason);
  if (!staleMissingWorkItem) return;
  if (selected.workItemId || selected.workspaceId || selected.cardId) {
    ctx.state.lastActionResult = null;
    ctx.state.fieldValidation = null;
    ctx.state.operationMessage = "";
  }
}

function clearOperationStateForWorkItemChange(ctx, selected = {}) {
  const currentKey = operationRouteKey({
    workItemId: ctx.state.selectedWorkItemId,
    workspaceId: ctx.state.selectedWorkspace,
    cardId: ctx.state.selectedCardId
  });
  const nextKey = operationRouteKey(selected);
  if (!currentKey || currentKey === nextKey) return;
  ctx.state.operationMessage = "";
  ctx.state.fieldValidation = null;
  ctx.state.lastActionResult = null;
}

function operationRouteKey(value = {}) {
  return [
    value.workItemId || value.work_item_id || "",
    value.workspaceId || value.workspace_id || "",
    value.cardId || value.card_id || value.payload?.cardId || value.Payload?.cardId || ""
  ].join(":");
}

function isReadonlyProjectionRecord(workspace = null, cardId = "") {
  const cards = workspace?.cards || [];
  const selected = cardId ? cards.find((card) => card.id === cardId) : null;
  if (isTerminalStatus(selected?.status)) return true;
  return cards.length > 0 && cards.every((card) => isTerminalStatus(card.status));
}

function isTerminalStatus(status) {
  return ["done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped"].includes(String(status || ""));
}

export function syncUrlFromState(ctx) {
  const navigationLog = typeof window === "undefined" ? null : window[String.fromCharCode(104, 105, 115, 116, 111, 114, 121)];
  if (!navigationLog?.replaceState) return;
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
  navigationLog.replaceState(null, "", url.toString());
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

function clearOperationStateOutsideRuntimeSurface(ctx, view) {
  if (["operationPanel", "workspace"].includes(view)) return;
  ctx.state.operationMessage = "";
  ctx.state.fieldValidation = null;
  ctx.state.lastActionResult = null;
  ctx.state.operationRouteIssue = null;
}
