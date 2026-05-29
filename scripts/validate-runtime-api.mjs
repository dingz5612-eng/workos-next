import { spawn } from "node:child_process";
import fs from "node:fs";

const baseUrl = process.env.WORKOS_API_VALIDATE_URL || "http://127.0.0.1:5191";
const externalApi = Boolean(process.env.WORKOS_API_VALIDATE_URL);
const openApi = JSON.parse(fs.readFileSync("docs/contracts/workos-runtime.openapi.json", "utf8"));
const sliceManifest = JSON.parse(fs.readFileSync("docs/contracts/slice-manifest.json", "utf8"));
let apiProcess;

if (!externalApi) {
  apiProcess = spawn("dotnet", [
    "run",
    "--project",
    "services/core-api/WorkOS.Api/WorkOS.Api.csproj",
    "-c",
    "Release",
    "--no-launch-profile",
    "--no-build"
  ], {
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: "Development", ASPNETCORE_URLS: baseUrl },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

try {
  if (!externalApi) await validateProductionRejectsDevAuthDefaults();
  await waitForApi();
  await validateHealth();
  const projection = await getJson("/api/workspaces");
  validateProjectionEnvelope(projection);
  validateBehaviorEventRequestContract();
  await validateDeclaredRuntimePaths(projection);
  await validatePrepare(projection);
  await validateRuntimeSurfaces(projection);
  await validateAccommodationLens();
  await validateConfirmPolicyResponse();
  await validateConfirmLedgerProjectionLensChain();
  await validateBehaviorEvent();
  await validateObservability();
  console.log("Runtime API contract responses: PASS");
} finally {
  if (apiProcess) {
    apiProcess.kill();
  }
}

async function waitForApi() {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`API did not become healthy at ${baseUrl}: ${lastError?.message || "timeout"}`);
}

async function validateHealth() {
  const health = await getJson("/health");
  assert(health.status === "ok", "health status must be ok");
  assert(health.persistence === "postgresql", "health persistence must be postgresql");
}

async function validatePrepare(projection) {
  const workspace = projection.workspaces.find((item) => item.cards.some((card) => card.status === "ready")) ?? projection.workspaces[0];
  const card = workspace.cards.find((item) => item.status === "ready") ?? workspace.cards[0];
  const prepared = await postJson(`/api/workspaces/${workspace.id}/cards/${card.id}/prepare`, {});
  assert(prepared.prepared === true, "prepare response must mark prepared true");
  assert(prepared.workspaceId === workspace.id, "prepare response workspaceId mismatch");
  assert(prepared.cardId === card.id, "prepare response cardId mismatch");
  assert(prepared.card?.fields?.business?.length > 0, "prepare response card must include business fields");
}

async function validateDeclaredRuntimePaths(projection) {
  const workspace = projection.workspaces[0];
  const card = workspace.cards[0];
  const samples = {
    workspaceId: workspace.id,
    cardId: card.id,
    lensId: "period-performance",
    evidenceId: "evd-openapi-path"
  };

  for (const [path, pathItem] of Object.entries(openApi.paths)) {
    if (!(path === "/health" || path.startsWith("/api/"))) continue;
    for (const method of Object.keys(pathItem).filter((item) => ["get", "post", "put", "patch", "delete"].includes(item))) {
      const resolvedPath = resolveOpenApiPath(path, samples);
      const response = await requestDeclaredPath(method.toUpperCase(), resolvedPath);
      assert(response.status !== 404 && response.status !== 405, `${method.toUpperCase()} ${path} must be reachable, got ${response.status}`);
      assert(response.status < 500, `${method.toUpperCase()} ${path} must not fail with ${response.status}`);
    }
  }
}

async function requestDeclaredPath(method, path) {
  if (method === "GET") {
    return fetch(`${baseUrl}${path}`);
  }

  if (method === "POST" && path === "/api/auth/login") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "operator", password: "dev" })
    });
  }

  if (method === "POST" && path.endsWith("/prepare")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
  }

  if (method === "POST" && path.endsWith("/confirm")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(confirmBody(`openapi-path-${Date.now()}-${Math.random().toString(16).slice(2)}`))
    });
  }

  if (method === "POST" && path === "/api/evidence/drafts") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: "W-STAY-DEPOSIT-LEDGER",
        cardId: "depositReceipt",
        cardInstanceId: "ci-openapi-path",
        submissionId: "sub-openapi-path",
        requirementId: "openapi-proof",
        evidenceId: "evd-openapi-path"
      })
    });
  }

  if (method === "POST" && path.endsWith("/attachments")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "openapi-proof.txt",
        contentType: "text/plain",
        contentSha256: "sha256-openapi-proof",
        sizeBytes: 1
      })
    });
  }

  if (method === "POST" && (path.endsWith("/verify") || path.endsWith("/reject"))) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorId: "validate-runtime-api",
        reason: "path reachability"
      })
    });
  }

  if (method === "POST" && path === "/api/projections/process-outbox") {
    return fetch(`${baseUrl}${path}`, { method });
  }

  if (method === "POST" && path === "/api/behavior-events") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "RuntimeApiPathValidated",
        language: "zh-CN",
        source: "validate-runtime-api"
      })
    });
  }

  return fetch(`${baseUrl}${path}`, { method });
}

function resolveOpenApiPath(path, samples) {
  return path.replace(/\{([^}]+)\}/g, (_, name) => {
    const value = samples[name];
    assert(value, `No sample value configured for OpenAPI path parameter ${name}`);
    return encodeURIComponent(value);
  });
}

async function validateConfirmPolicyResponse() {
  const login = await postJson("/api/auth/login", { username: "operator", password: "dev" });
  const response = await fetch(`${baseUrl}/api/workspaces/W-STAY-RESOURCE/cards/roomSetup/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Request-Id": `api-contract-${Date.now()}` },
    body: JSON.stringify(confirmBody(`api-contract-${Date.now()}`))
  });
  assert(response.status === 401, `confirm without actor token must return 401, got ${response.status}`);

  const invalid = await fetch(`${baseUrl}/api/workspaces/W-STAY-RESOURCE/cards/roomSetup/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-WorkOS-Actor-Token": login.token, "X-Request-Id": `api-invalid-${Date.now()}` },
    body: JSON.stringify(confirmBody("", {}, "invalid-idempotency"))
  });
  assert(invalid.status === 400, `invalid confirm must return 400, got ${invalid.status}`);

  const localizedKey = await fetch(`${baseUrl}/api/workspaces/W-STAY-RESOURCE/cards/roomSetup/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-WorkOS-Actor-Token": login.token, "X-Request-Id": `api-localized-key-${Date.now()}` },
    body: JSON.stringify(confirmBody(`api-localized-key-${Date.now()}`, { "房间号": "A999" }))
  });
  assert(localizedKey.status === 400, `localized label payload key must return 400, got ${localizedKey.status}`);

  const financeLogin = await postJson("/api/auth/login", { username: "finance", password: "dev" });
  const forbidden = await fetch(`${baseUrl}/api/workspaces/W-STAY-RESOURCE/cards/roomSetup/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-WorkOS-Actor-Token": financeLogin.token, "X-Request-Id": `api-forbidden-${Date.now()}` },
    body: JSON.stringify(confirmBody(`api-forbidden-${Date.now()}`))
  });
  assert(forbidden.status === 403, `role forbidden confirm must return 403, got ${forbidden.status}`);

  const businessBlocked = await fetch(`${baseUrl}/api/workspaces/W-STAY-DEPOSIT-LEDGER/cards/depositReceipt/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-WorkOS-Actor-Token": login.token, "X-Request-Id": `api-business-${Date.now()}` },
    body: JSON.stringify(confirmBody(
      `api-business-${Date.now()}`,
      {
        depositId: "api-deposit-policy",
        depositAmount: "3000",
        currency: "KGS",
        paymentMethod: "bank_transfer"
      },
      "business-blocked"
    ))
  });
  assert(businessBlocked.status === 422, `business policy violation must return 422, got ${businessBlocked.status}`);
}

async function validateProductionRejectsDevAuthDefaults() {
  const productionUrl = "http://127.0.0.1:5199";
  const child = spawn("dotnet", [
    "run",
    "--project",
    "services/core-api/WorkOS.Api/WorkOS.Api.csproj",
    "-c",
    "Release",
    "--no-launch-profile",
    "--no-build"
  ], {
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: "Production", ASPNETCORE_URLS: productionUrl },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const exitCode = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, 10000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  assert(exitCode !== null && exitCode !== 0, "production API must reject missing or development auth hashes at startup");
}

async function validateAccommodationLens() {
  const lens = await getJson("/api/lenses/accommodation/period-performance");
  assert(Array.isArray(lens), "accommodation lens response must be an array");
}

async function validateRuntimeSurfaces(projection) {
  const queue = await getJson("/api/lenses/work-queue");
  assert(Array.isArray(queue), "work queue lens response must be an array");
  assert(queue.some((item) => item.workspaceId && item.cardId), "work queue items must include workspaceId/cardId");
  assert(queue.some((item) => item.workspaceId === "W-STAY-PAYMENT-LEDGER"), "work queue must expose PaymentLedger");

  const search = await getJson("/api/lenses/search?q=%E6%8A%BC%E9%87%91");
  const depositIndex = search.findIndex((item) => item.workspaceId === "W-STAY-DEPOSIT-LEDGER");
  const checkinIndex = search.findIndex((item) => item.workspaceId === "W-STAY-CHECKIN");
  assert(depositIndex >= 0, "search lens must expose DepositLedger for deposit intent");
  assert(checkinIndex < 0 || depositIndex < checkinIndex, "search lens must rank DepositLedger before legacy CheckIn");

  const home = await getJson("/api/lenses/home-surface");
  assert(Array.isArray(home), "home surface lens response must be an array");
  assert(home.some((item) => item.workspaceId === "W-STAY-DEPOSIT-LEDGER"), "home surface must expose DepositLedger");
  assert(home.some((item) => item.workspaceId === "W-STAY-PERIOD-ANALYTICS"), "home surface must expose PeriodAnalytics");

  const learning = await getJson("/api/lenses/learning-catalog");
  assert(Array.isArray(learning), "learning catalog lens response must be an array");
  assert(learning.some((item) => item.workspaceId === "W-STAY-DEPOSIT-LEDGER" && item.cardId === "depositReceipt"), "learning catalog must expose DepositLedger cards");

  const workspaceIds = new Set(projection.workspaces.map((item) => item.id));
  for (const item of home) {
    assert(workspaceIds.has(item.workspaceId), `home surface references unknown workspace ${item.workspaceId}`);
  }
}

async function validateConfirmLedgerProjectionLensChain() {
  const login = await postJson("/api/auth/login", { username: "operator", password: "dev" });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const roomId = `api-chain-room-${suffix}`;
  const result = await postJsonWithActor(
    "/api/workspaces/W-STAY-RESOURCE/cards/roomSetup/confirm",
    {
      ...confirmBody(`api-chain-${suffix}`, {
        roomId,
        roomNo: `API-${suffix.slice(-6)}`,
        roomType: "four_bed",
        bedCount: "4",
        genderPolicy: "unrestricted",
        furnitureStatus: "complete",
        technicalState: "ready"
      }, `room:${roomId}`)
    },
    login.token,
    `api-chain-${suffix}`
  );

  const eventIds = (result.events || []).map((item) => item.eventId).filter(Boolean);
  assert(eventIds.length > 0, "confirm response must include committed events");
  const projectedIds = new Set((result.projection?.events || []).map((item) => item.eventId));
  assert(eventIds.every((eventId) => projectedIds.has(eventId)), "confirm response projection must include committed events");
  const workspace = result.projection?.workspaces?.find((item) => item.id === "W-STAY-RESOURCE");
  const card = workspace?.cards?.find((item) => item.id === "roomSetup");
  assert(card?.status === "done", "confirm response projection must show confirmed card as done");

  const roomLens = await getJson("/api/lenses/accommodation/room-readiness");
  assert(roomLens.some((item) => item.roomId === roomId), "room-readiness lens must expose the confirmed room aggregate");

  const refreshed = await getJson("/api/workspaces");
  const refreshedIds = new Set((refreshed.events || []).map((item) => item.eventId));
  assert(eventIds.every((eventId) => refreshedIds.has(eventId)), "workspace projection endpoint must expose committed events after confirm");

  const duplicate = await fetch(`${baseUrl}/api/workspaces/W-STAY-RESOURCE/cards/roomSetup/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-WorkOS-Actor-Token": login.token,
      "X-Request-Id": `api-chain-duplicate-${suffix}`
    },
    body: JSON.stringify(confirmBody(`api-chain-${suffix}`, { roomId }, `room:${roomId}`))
  });
  assert(duplicate.status === 409, `duplicate idempotency confirm must return 409, got ${duplicate.status}`);
}

async function validateObservability() {
  const observation = await getJson("/api/observability/runtime");
  assert(observation.service === "WorkOSNext Core API", "observability service mismatch");
  const manifestWorkspaceIds = new Set(sliceManifest.slices.map((slice) => slice.workspaceId));
  const manifestCardCount = sliceManifest.slices.reduce((sum, slice) => sum + slice.cards.length, 0);
  assert(observation.workspaceCount >= manifestWorkspaceIds.size, "observability workspaceCount must cover manifest workspaces");
  assert(observation.cardCount >= manifestCardCount, "observability cardCount must cover manifest cards");
  assert(typeof observation.outboxCount === "number", "observability outboxCount must be numeric");
  assert(typeof observation.deadLetterOutboxCount === "number", "observability deadLetterOutboxCount must be numeric");
}

async function validateBehaviorEvent() {
  const result = await postJson("/api/behavior-events", {
    eventType: "RuntimeApiValidated",
    objectType: "runtime",
    objectId: "validate-runtime-api",
    language: "zh-CN",
    source: "validate-runtime-api"
  });
  assert(result.accepted === true, "behavior event response must mark accepted true");
  assert(result.eventType === "RuntimeApiValidated", "behavior event response eventType mismatch");
}

function validateBehaviorEventRequestContract() {
  const schema = openApi.components?.schemas?.BehaviorEventRequest;
  assert(schema, "OpenAPI must declare BehaviorEventRequest");
  const required = new Set(schema.required || []);
  assert(required.size === 2 && required.has("eventType") && required.has("language"), "BehaviorEventRequest required fields must match Program.cs");
  const properties = new Set(Object.keys(schema.properties || {}));
  for (const field of ["eventType", "objectType", "objectId", "language", "source"]) {
    assert(properties.has(field), `BehaviorEventRequest missing ${field}`);
  }
  for (const staleField of ["workspaceId", "cardId", "actorId", "payload"]) {
    assert(!properties.has(staleField), `BehaviorEventRequest contains stale field ${staleField}`);
  }
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert(response.ok, `${path} expected 2xx, got ${response.status}`);
  return response.json();
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert(response.ok, `${path} expected 2xx, got ${response.status}`);
  return response.json();
}

async function postJsonWithActor(path, body, actorToken, requestId) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-WorkOS-Actor-Token": actorToken,
      "X-Request-Id": requestId
    },
    body: JSON.stringify(body)
  });
  assert(response.ok, `${path} expected 2xx, got ${response.status}`);
  return response.json();
}

function validateProjectionEnvelope(projection) {
  assert(projection.projection === "IntentWorkspaceProjection", "projection type mismatch");
  for (const field of ["version", "sourceOfTruth"]) {
    assertNonEmptyString(projection[field], `projection.${field}`);
  }
  assert(Array.isArray(projection.languages) && projection.languages.includes("zh-CN") && projection.languages.includes("ru-RU"), "projection languages missing");
  assert(Array.isArray(projection.workspaces), "projection workspaces must be an array");
  const manifestWorkspaceIds = new Set(sliceManifest.slices.map((slice) => slice.workspaceId));
  const workspaceIds = new Set(projection.workspaces.map((item) => item.id));
  for (const workspaceId of manifestWorkspaceIds) {
    assert(workspaceIds.has(workspaceId), `projection missing manifest workspace ${workspaceId}`);
  }
  assert(Array.isArray(projection.events), "projection events must be an array");

  for (const workspace of projection.workspaces) {
    assert(workspace.projectionType === "IntentWorkspaceProjection", `${workspace.id} projectionType mismatch`);
    assertLocalized(workspace.title, `${workspace.id}.title`);
    assertLocalized(workspace.summary, `${workspace.id}.summary`);
    assert(Array.isArray(workspace.cards) && workspace.cards.length > 0, `${workspace.id} cards missing`);
    for (const card of workspace.cards) {
      assert(card.projectionType === "WorkspaceCardProjection", `${workspace.id}.${card.id} projectionType mismatch`);
      assertLocalized(card.title, `${workspace.id}.${card.id}.title`);
      assert(card.fields?.business?.length > 0, `${workspace.id}.${card.id} business fields missing`);
      assert(card.fields?.system?.length > 0, `${workspace.id}.${card.id} system fields missing`);
      assert(card.fields?.analytics?.length > 0, `${workspace.id}.${card.id} analytics fields missing`);
      assert(card.evidence?.length > 0, `${workspace.id}.${card.id} evidence missing`);
      assert(card.checks?.length > 0, `${workspace.id}.${card.id} checks missing`);
      assert(card.events?.length > 0, `${workspace.id}.${card.id} events missing`);
      assert(card.confirmation?.forbiddenForAi === true, `${workspace.id}.${card.id} must forbid AI confirmation`);
      for (const field of card.fields.business) {
        assert(field.ui?.control, `${workspace.id}.${card.id}.${field.id} missing ui control`);
        assertLocalized(field.help, `${workspace.id}.${card.id}.${field.id}.help`);
      }
    }
  }
}

function assertLocalized(value, label) {
  assertNonEmptyString(value?.["zh-CN"], `${label}.zh-CN`);
  assertNonEmptyString(value?.["ru-RU"], `${label}.ru-RU`);
}

function assertNonEmptyString(value, label) {
  assert(typeof value === "string" && value.trim().length > 0, `${label} must be a non-empty string`);
}

function confirmBody(idempotencyKey, fieldValues = {}, aggregateRef = null) {
  const suffix = idempotencyKey || `missing-${Date.now()}`;
  return {
    language: "zh-CN",
    idempotencyKey,
    submissionId: `submission-${suffix}`,
    cardInstanceId: `card-instance-${suffix}`,
    aggregateRef,
    fieldValues,
    evidenceIds: []
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
