import { runtimeApiPaths } from "./generated/runtimeApiPaths.js";

const ACTOR_SESSION_KEY = "workosnext.actorSession";
const API_BASE_URL_KEY = "workosnext.apiBaseUrl";
const CSRF_COOKIE_NAME = "workosnext_csrf";
const LOGIN_TIMEOUT_MS = 8000;

export function apiBaseUrl() {
  return resolveApiBaseUrl();
}

export function resolveApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_WORKOS_API_BASE_URL;
  if (envBaseUrl) return normalizeBaseUrl(envBaseUrl);
  const configured = localStorage.getItem(API_BASE_URL_KEY);
  if (isProductionRuntime()) {
    if (configured && isAllowedProductionApiBase(configured)) return normalizeBaseUrl(configured);
    if (configured) localStorage.removeItem(API_BASE_URL_KEY);
    return window.location.origin;
  }
  if (configured && !isStaleLocalFrontendUrl(configured)) return normalizeBaseUrl(configured);
  return `${window.location.protocol}//${window.location.hostname}:5191`;
}

export function isProductionRuntime() {
  return import.meta.env.PROD === true ||
    import.meta.env.MODE === "production" ||
    import.meta.env.VITE_WORKOS_RUNTIME_ENV === "production";
}

export function shouldPersistApiOverride(value) {
  if (!value) return false;
  if (!isProductionRuntime()) return !isStaleLocalFrontendUrl(value);
  return isAllowedProductionApiBase(value);
}

export function actorSessionForStorage(session = {}) {
  if (!isProductionRuntime()) return session;
  const { token, ...safeSession } = session || {};
  return safeSession;
}

export function clearStoredActorSession() {
  localStorage.removeItem(ACTOR_SESSION_KEY);
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/$/, "");
}

function isAllowedProductionApiBase(value) {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin === window.location.origin) return true;
    const allowed = String(import.meta.env.VITE_WORKOS_ALLOWED_API_BASE_URLS || "")
      .split(",")
      .map((item) => item.trim().replace(/\/$/, ""))
      .filter(Boolean);
    return allowed.includes(url.origin) || allowed.includes(normalizeBaseUrl(url.href));
  } catch {
    return false;
  }
}

function isStaleLocalFrontendUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    const localHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    return localHost && (url.port === window.location.port || url.port === "5180");
  } catch {
    return true;
  }
}

export async function checkHealth() {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.health}`, {
    credentials: "include",
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error("health_failed");
  return response.json();
}

export async function fetchWorkspaceProjection() {
  const response = await runtimeFetch(runtimeApiPaths.workspaces, { timeoutMs: 8000 });
  if (!response.ok) throw await apiError("projection_failed", response);
  return response.json();
}

export async function startOperationsWorkspace(templateWorkspaceId, actorToken = "", errorCode = "operation_workspace_start_failed") {
  const response = await runtimeFetch(runtimeApiPaths.operationsWorkspaceStart, {
    method: "POST",
    actorToken,
    body: JSON.stringify({ templateWorkspaceId }),
    timeoutMs: 20000
  });
  if (!response.ok) throw await apiError(errorCode, response);
  return response.json();
}

export async function fetchWorkQueue() {
  const response = await runtimeFetch(runtimeApiPaths.lensWorkQueue, { timeoutMs: 6000 });
  if (!response.ok) throw await apiError("work_queue_failed", response);
  return response.json();
}

export async function fetchOperationWorkItems(query = {}) {
  const url = new URL(`${apiBaseUrl()}${runtimeApiPaths.operationsWorkItems}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await runtimeFetch(url, { timeoutMs: 6000 });
  if (!response.ok) throw await apiError("operation_work_items_failed", response);
  return response.json();
}

export async function fetchOperationWorkItem(workItemId) {
  const response = await runtimeFetch(runtimeApiPaths.operationsWorkItem(workItemId), { timeoutMs: 2400 });
  if (!response.ok) throw await apiError("operation_work_item_failed", response);
  return response.json();
}

export async function createOperationCase(body) {
  const response = await runtimeFetch(runtimeApiPaths.operationsCases, {
    method: "POST",
    body: JSON.stringify(body || {}),
    timeoutMs: 20000
  });
  if (!response.ok) throw await apiError("operation_case_create_failed", response);
  return response.json();
}

export async function createOperationWorkItem(body) {
  const response = await runtimeFetch(runtimeApiPaths.operationsWorkItems, {
    method: "POST",
    body: JSON.stringify(body || {}),
    timeoutMs: 20000
  });
  if (!response.ok) throw await apiError("operation_work_item_create_failed", response);
  return response.json();
}

export async function prepareOperationWorkItem(workItemId, body = {}, actorToken = "") {
  const response = await runtimeFetch(runtimeApiPaths.operationsPrepare(workItemId), {
    method: "POST",
    actorToken,
    body: JSON.stringify(body || {}),
    timeoutMs: 20000
  });
  if (!response.ok) throw await apiError("operations_prepare_failed", response);
  return response.json();
}

export async function confirmOperationWorkItem(workItemId, actorToken, body = {}) {
  const response = await runtimeFetch(runtimeApiPaths.operationsConfirm(workItemId), {
    method: "POST",
    headers: {
      "X-Request-Id": body?.submissionId || body?.idempotencyKey || cryptoRandomRequestId()
    },
    actorToken,
    body: JSON.stringify(body || {}),
    timeoutMs: 60000
  });
  if (!response.ok) throw await apiError("operations_confirm_failed", response);
  return response.json();
}

export async function fetchSubmissionTrace(submissionId) {
  const response = await runtimeFetch(runtimeApiPaths.operationsTraceSubmission(submissionId), { timeoutMs: 2400 });
  if (!response.ok) throw await apiError("submission_trace_failed", response);
  return response.json();
}

export async function fetchWorkItemTrace(workItemId) {
  const response = await runtimeFetch(runtimeApiPaths.operationsTraceWorkItem(workItemId), { timeoutMs: 2400 });
  if (!response.ok) throw await apiError("work_item_trace_failed", response);
  return response.json();
}

export async function fetchCaseTrace(caseId) {
  const response = await runtimeFetch(runtimeApiPaths.operationsTraceCase(caseId), { timeoutMs: 2400 });
  if (!response.ok) throw await apiError("case_trace_failed", response);
  return response.json();
}

export async function fetchSearchResults(q = "") {
  const url = new URL(`${apiBaseUrl()}${runtimeApiPaths.lensSearch}`);
  if (q) url.searchParams.set("q", q);
  const response = await runtimeFetch(url, { timeoutMs: 6000 });
  if (!response.ok) throw await apiError("search_failed", response);
  return response.json();
}

export async function recordMobileClientEvent(event = {}) {
  const response = await runtimeFetch(runtimeApiPaths.mobileClientEvents, {
    method: "POST",
    body: JSON.stringify({
      eventType: event.eventType,
      objectType: event.objectType,
      objectId: event.objectId,
      language: event.language || "zh-CN",
      source: event.source || "mobile.search"
    }),
    timeoutMs: 2400
  });
  if (!response.ok) throw await apiError("behavior_event_failed", response);
  return response.json();
}

export async function fetchHomeSurface() {
  const response = await runtimeFetch(runtimeApiPaths.homeSurface, { timeoutMs: 6000 });
  if (!response.ok) throw await apiError("home_surface_failed", response);
  return response.json();
}

export async function fetchLearningCatalog() {
  const response = await runtimeFetch(runtimeApiPaths.learningCatalog, { timeoutMs: 6000 });
  if (!response.ok) throw await apiError("learning_catalog_failed", response);
  return response.json();
}

export async function fetchAccommodationLens(lensId) {
  const response = await runtimeFetch(runtimeApiPaths.accommodationLens(lensId), { timeoutMs: 6000 });
  if (!response.ok) throw await apiError("lens_failed", response);
  return response.json();
}

export async function createEvidenceDraft(body, actorToken = "") {
  const response = await runtimeFetch(runtimeApiPaths.evidenceDrafts, {
    method: "POST",
    actorToken,
    body: JSON.stringify(body),
    timeoutMs: 2400
  });
  if (!response.ok) throw await apiError("evidence_draft_failed", response);
  return response.json();
}

export async function attachEvidence(evidenceId, body, actorToken = "") {
  const response = await runtimeFetch(runtimeApiPaths.evidenceAttachments(evidenceId), {
    method: "POST",
    actorToken,
    body: JSON.stringify(body),
    timeoutMs: 2400
  });
  if (!response.ok) throw await apiError("evidence_attach_failed", response);
  return response.json();
}

export async function loginActor(username, password) {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.login}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS)
  });
  if (!response.ok) throw await apiError("login_failed", response);
  return response.json();
}

export async function logoutActor() {
  const response = await runtimeFetch(runtimeApiPaths.logout, {
    method: "POST",
    body: JSON.stringify({}),
    timeoutMs: 2400
  });
  if (!response.ok) throw await apiError("logout_failed", response);
  return response.json();
}

export async function registerDeviceSession(body) {
  const response = await runtimeFetch(runtimeApiPaths.deviceSessions, {
    method: "POST",
    body: JSON.stringify(body || {}),
    timeoutMs: 2400
  });
  if (!response.ok) throw await apiError("device_session_failed", response);
  return response.json();
}

async function runtimeFetch(pathOrUrl, options = {}) {
  const method = options.method || "GET";
  const headers = {
    ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };
  const csrf = csrfToken();
  if (method !== "GET" && csrf) headers["X-CSRF-Token"] = csrf;
  if (options.actorToken && !isProductionRuntime()) {
    headers["X-WorkOS-Actor-Token"] = options.actorToken;
  }
  return fetch(runtimeUrl(pathOrUrl), {
    method,
    headers,
    credentials: "include",
    body: options.body,
    signal: AbortSignal.timeout(options.timeoutMs || 2400)
  });
}

function runtimeUrl(pathOrUrl) {
  if (pathOrUrl instanceof URL) return pathOrUrl;
  if (String(pathOrUrl).startsWith("http://") || String(pathOrUrl).startsWith("https://")) return pathOrUrl;
  return `${apiBaseUrl()}${pathOrUrl}`;
}

function csrfToken() {
  const cookie = globalThis.document?.cookie || "";
  const prefix = `${CSRF_COOKIE_NAME}=`;
  return cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) || "";
}

function cryptoRandomRequestId() {
  return globalThis.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function apiError(code, response) {
  let details = {};
  try {
    details = await response.json();
  } catch {
    details = {};
  }
  const error = new Error(details.error || code);
  error.code = details.error || code;
  error.reason = details.reason || "";
  error.status = response.status;
  if (response.status === 401) {
    clearStoredActorSession();
  }
  return error;
}

export async function waitForProjectionEvent(eventId, onProjection) {
  return waitForProjectionEvents(eventId ? [eventId] : [], onProjection);
}

export async function waitForProjectionEvents(eventIds, onProjection) {
  const expectedIds = (eventIds || []).filter(Boolean);
  if (!expectedIds.length) return true;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const payload = await fetchWorkspaceProjection();
    if (onProjection) onProjection(payload);
    const projectedIds = new Set((payload.events || []).map((item) => item.eventId));
    if (expectedIds.every((eventId) => projectedIds.has(eventId))) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}
