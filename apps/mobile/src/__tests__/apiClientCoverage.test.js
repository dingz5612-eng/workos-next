import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  actorSessionForStorage,
  apiBaseUrl,
  attachEvidence,
  checkHealth,
  clearStoredActorSession,
  confirmOperationWorkItem,
  createEvidenceDraft,
  createOperationCase,
  createOperationWorkItem,
  fetchAccommodationLens,
  fetchCaseTrace,
  fetchHomeSurface,
  fetchLearningCatalog,
  fetchOperationWorkItem,
  fetchOperationWorkItems,
  fetchSearchResults,
  fetchSubmissionTrace,
  fetchWorkItemTrace,
  fetchWorkQueue,
  fetchWorkspaceProjection,
  loginActor,
  logoutActor,
  prepareOperationWorkItem,
  recordMobileClientEvent,
  registerDeviceSession,
  resolveApiBaseUrl,
  shouldPersistApiOverride,
  startOperationsWorkspace,
  waitForProjectionEvent,
  waitForProjectionEvents
} from "../apiClient.js";

describe("OAM mobile API client coverage", () => {
  let storage;
  let queuedResponses;
  let fetchMock;

  beforeEach(() => {
    storage = new Map();
    queuedResponses = [];
    fetchMock = vi.fn(async () => queuedResponses.shift() || ok({ ok: true, events: [{ eventId: "evt-projected" }] }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    });
    vi.stubGlobal("window", {
      location: {
        origin: "https://app.workos.test",
        protocol: "http:",
        hostname: "localhost",
        port: "5173"
      }
    });
    vi.stubGlobal("document", { cookie: "workosnext_csrf=csrf-token" });
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("resolves development and production base URLs without persisting stale local frontend origins", () => {
    storage.set("workosnext.apiBaseUrl", "http://localhost:5180");

    expect(resolveApiBaseUrl()).toBe("http://localhost:5191");
    expect(apiBaseUrl()).toBe("http://localhost:5191");
    expect(shouldPersistApiOverride("http://localhost:5180")).toBe(false);
    expect(shouldPersistApiOverride("http://localhost:5191")).toBe(true);
    expect(actorSessionForStorage({ token: "dev-token", role: "operator" })).toEqual({ token: "dev-token", role: "operator" });

    vi.stubEnv("MODE", "production");
    storage.set("workosnext.apiBaseUrl", "https://evil.workos.test");

    expect(resolveApiBaseUrl()).toBe("https://app.workos.test");
    expect(storage.get("workosnext.apiBaseUrl")).toBeUndefined();
    expect(shouldPersistApiOverride("https://evil.workos.test")).toBe(false);
    expect(actorSessionForStorage({ token: "prod-token", role: "operator" })).toEqual({ role: "operator" });
  });

  it("covers runtime API success wrappers, query parameters, CSRF headers, and projection waiting", async () => {
    queuedResponses.push(
      ok({ healthy: true }),
      ...Array.from({ length: 26 }, (_, index) => ok({ index, events: [{ eventId: "evt-projected" }] }))
    );

    await expect(checkHealth()).resolves.toEqual({ healthy: true });
    await expect(fetchWorkspaceProjection()).resolves.toMatchObject({ index: 0 });
    await expect(startOperationsWorkspace("W-DORM-MAINLINE", "actor-token", "start_failed", { anchorQuery: "A101", anchorPayload: { roomNo: "301" } })).resolves.toMatchObject({ index: 1 });
    await expect(fetchWorkQueue()).resolves.toMatchObject({ index: 2 });
    await expect(fetchOperationWorkItems({ tenantId: "tenant-oam", empty: "" })).resolves.toMatchObject({ index: 3 });
    await expect(fetchOperationWorkItem("wi-1")).resolves.toMatchObject({ index: 4 });
    await expect(createOperationCase({ caseId: "case-1" })).resolves.toMatchObject({ index: 5 });
    await expect(createOperationWorkItem({ workItemId: "wi-2" })).resolves.toMatchObject({ index: 6 });
    await expect(prepareOperationWorkItem("wi-2", { draft: true }, "actor-token")).resolves.toMatchObject({ index: 7 });
    await expect(confirmOperationWorkItem("wi-2", "actor-token", { idempotencyKey: "idem-1" })).resolves.toMatchObject({ index: 8 });
    await expect(fetchSubmissionTrace("sub-1")).resolves.toMatchObject({ index: 9 });
    await expect(fetchWorkItemTrace("wi-2")).resolves.toMatchObject({ index: 10 });
    await expect(fetchCaseTrace("case-1")).resolves.toMatchObject({ index: 11 });
    await expect(fetchSearchResults("押金")).resolves.toMatchObject({ index: 12 });
    await expect(recordMobileClientEvent({ eventType: "SearchViewed", objectType: "workspace", objectId: "W1" })).resolves.toMatchObject({ index: 13 });
    await expect(fetchHomeSurface()).resolves.toMatchObject({ index: 14 });
    await expect(fetchLearningCatalog()).resolves.toMatchObject({ index: 15 });
    await expect(fetchAccommodationLens("stay-balance")).resolves.toMatchObject({ index: 16 });
    await expect(createEvidenceDraft({ evidenceId: "ev-1" }, "actor-token")).resolves.toMatchObject({ index: 17 });
    await expect(attachEvidence("ev-1", { workItemId: "wi-2" }, "actor-token")).resolves.toMatchObject({ index: 18 });
    await expect(loginActor("operator", "secret")).resolves.toMatchObject({ index: 19 });
    await expect(logoutActor()).resolves.toMatchObject({ index: 20 });
    await expect(registerDeviceSession({ deviceId: "device-1" })).resolves.toMatchObject({ index: 21 });
    await expect(waitForProjectionEvents([], vi.fn())).resolves.toBe(true);
    await expect(waitForProjectionEvent("evt-projected")).resolves.toBe(true);

    const queryCall = fetchMock.mock.calls.find(([url]) => url instanceof URL && String(url).includes("/api/operations/work-items"));
    expect(queryCall[0].searchParams.get("tenantId")).toBe("tenant-oam");
    expect(queryCall[0].searchParams.has("empty")).toBe(false);

    const confirmCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/api/operations/work-items/wi-2/confirm"));
    expect(confirmCall[1].headers["X-CSRF-Token"]).toBe("csrf-token");
    expect(confirmCall[1].headers["X-WorkOS-Actor-Token"]).toBe("actor-token");
    expect(confirmCall[1].headers["X-Request-Id"]).toBe("idem-1");
  });

  it("surfaces safe API errors and clears stored actor session on authentication failure only", async () => {
    storage.set("workosnext.actorSession", JSON.stringify({ token: "expired" }));
    queuedResponses.push(fail(401, { error: "actor_session_required", reason: "expired" }));

    await expect(fetchWorkspaceProjection()).rejects.toMatchObject({
      code: "actor_session_required",
      reason: "expired",
      status: 401
    });
    expect(storage.get("workosnext.actorSession")).toBeUndefined();

    storage.set("workosnext.actorSession", JSON.stringify({ token: "still-present" }));
    queuedResponses.push(jsonFailure(422));

    await expect(startOperationsWorkspace("W-DORM-MAINLINE", "", "workspace_start_blocked")).rejects.toMatchObject({
      code: "workspace_start_blocked",
      reason: "",
      status: 422
    });
    expect(storage.get("workosnext.actorSession")).toBe(JSON.stringify({ token: "still-present" }));

    clearStoredActorSession();
    expect(storage.get("workosnext.actorSession")).toBeUndefined();
  });

  it("covers URL parsing fallbacks, request id fallback, and projection timeout miss", async () => {
    expect(shouldPersistApiOverride("http://[invalid")).toBe(false);

    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_WORKOS_ALLOWED_API_BASE_URLS", "https://api.workos.test,https://edge.workos.test/runtime");
    expect(shouldPersistApiOverride("https://edge.workos.test/runtime")).toBe(true);
    expect(shouldPersistApiOverride("http://[invalid")).toBe(false);

    vi.stubEnv("MODE", "development");
    vi.stubGlobal("crypto", {});
    queuedResponses.push(ok({ confirmed: true }));
    await expect(confirmOperationWorkItem("wi-with-generated-request", "actor-token", {})).resolves.toEqual({ confirmed: true });
    const generatedRequestCall = fetchMock.mock.calls.find(([url]) => String(url).includes("wi-with-generated-request"));
    expect(generatedRequestCall[1].headers["X-Request-Id"]).toMatch(/^req-/);

    vi.useFakeTimers();
    queuedResponses.push(...Array.from({ length: 8 }, () => ok({ events: [] })));
    const pending = waitForProjectionEvents(["missing-event"]);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe(false);
    vi.useRealTimers();
  });
});

function ok(body) {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => body)
  };
}

function fail(status, body) {
  return {
    ok: false,
    status,
    json: vi.fn(async () => body)
  };
}

function jsonFailure(status) {
  return {
    ok: false,
    status,
    json: vi.fn(async () => {
      throw new Error("invalid json");
    })
  };
}
