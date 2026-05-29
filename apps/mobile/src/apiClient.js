import { runtimeApiPaths } from "./generated/runtimeApiPaths.js";

export function apiBaseUrl() {
  return resolveApiBaseUrl();
}

export function resolveApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_WORKOS_API_BASE_URL;
  if (envBaseUrl) return envBaseUrl.replace(/\/$/, "");
  const configured = localStorage.getItem("workosnext.apiBaseUrl");
  if (configured && !isStaleLocalFrontendUrl(configured)) return configured.replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:5191`;
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
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.health}`, { signal: AbortSignal.timeout(1600) });
  if (!response.ok) throw new Error("health_failed");
  return response.json();
}

export async function fetchWorkspaceProjection() {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.workspaces}`, { signal: AbortSignal.timeout(2400) });
  if (!response.ok) throw new Error("projection_failed");
  return response.json();
}

export async function fetchWorkQueue() {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.lensWorkQueue}`, { signal: AbortSignal.timeout(2400) });
  if (!response.ok) throw new Error("work_queue_failed");
  return response.json();
}

export async function fetchSearchResults(q = "") {
  const url = new URL(`${apiBaseUrl()}${runtimeApiPaths.lensSearch}`);
  if (q) url.searchParams.set("q", q);
  const response = await fetch(url, { signal: AbortSignal.timeout(2400) });
  if (!response.ok) throw new Error("search_failed");
  return response.json();
}

export async function fetchHomeSurface() {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.homeSurface}`, { signal: AbortSignal.timeout(2400) });
  if (!response.ok) throw new Error("home_surface_failed");
  return response.json();
}

export async function fetchLearningCatalog() {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.learningCatalog}`, { signal: AbortSignal.timeout(2400) });
  if (!response.ok) throw new Error("learning_catalog_failed");
  return response.json();
}

export async function fetchAccommodationLens(lensId) {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.accommodationLens(lensId)}`, { signal: AbortSignal.timeout(2400) });
  if (!response.ok) throw new Error("lens_failed");
  return response.json();
}

export async function loginActor(username, password) {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.login}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(2400)
  });
  if (!response.ok) throw await apiError("login_failed", response);
  return response.json();
}

export async function prepareCard(workspaceId, cardId) {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.prepareCard(workspaceId, cardId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(3200)
  });
  if (!response.ok) throw await apiError("prepare_failed", response);
  return response.json();
}

export async function confirmCard(workspaceId, cardId, actorToken, body) {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.confirmCard(workspaceId, cardId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-WorkOS-Actor-Token": actorToken,
      "X-Request-Id": body?.submissionId || body?.idempotencyKey || cryptoRandomRequestId()
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4200)
  });
  if (!response.ok) throw await apiError("confirm_failed", response);
  return response.json();
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
  return error;
}

export async function waitForProjectionEvent(eventId, onProjection) {
  return waitForProjectionEvents(eventId ? [eventId] : [], onProjection);
}

export async function waitForProjectionEvents(eventIds, onProjection) {
  const expectedIds = (eventIds || []).filter(Boolean);
  if (!expectedIds.length) return;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const payload = await fetchWorkspaceProjection();
    onProjection(payload);
    const projectedIds = new Set((payload.events || []).map((item) => item.eventId));
    if (expectedIds.every((eventId) => projectedIds.has(eventId))) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
