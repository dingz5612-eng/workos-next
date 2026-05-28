import { runtimeApiPaths } from "./generated/runtimeApiPaths.js";

export function apiBaseUrl() {
  return resolveApiBaseUrl();
}

export function resolveApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_WORKOS_API_BASE_URL;
  if (envBaseUrl) return envBaseUrl.replace(/\/$/, "");
  const configured = localStorage.getItem("workosnext.apiBaseUrl");
  if (configured) return configured.replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:5180`;
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

export async function loginActor(username, password) {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.login}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(2400)
  });
  if (!response.ok) throw new Error("login_failed");
  return response.json();
}

export async function prepareCard(workspaceId, cardId) {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.prepareCard(workspaceId, cardId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(3200)
  });
  if (!response.ok) throw new Error("prepare_failed");
  return response.json();
}

export async function confirmCard(workspaceId, cardId, actorToken, body) {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.confirmCard(workspaceId, cardId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-WorkOS-Actor-Token": actorToken
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4200)
  });
  if (!response.ok) throw new Error("confirm_failed");
  return response.json();
}

export async function waitForProjectionEvent(eventId, onProjection) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const payload = await fetchWorkspaceProjection();
    onProjection(payload);
    if ((payload.events || []).some((item) => item.eventId === eventId)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
