import { spawn } from "node:child_process";

const baseUrl = process.env.WORKOS_API_VALIDATE_URL || "http://127.0.0.1:5191";
const externalApi = Boolean(process.env.WORKOS_API_VALIDATE_URL);
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
    env: { ...process.env, ASPNETCORE_URLS: baseUrl },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

try {
  await waitForApi();
  await validateHealth();
  const projection = await getJson("/api/workspaces");
  validateProjectionEnvelope(projection);
  await validatePrepare(projection);
  await validateAccommodationLens();
  await validateConfirmPolicyResponse();
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

async function validateConfirmPolicyResponse() {
  const response = await fetch(`${baseUrl}/api/workspaces/W-STAY-RESOURCE/cards/roomSetup/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Request-Id": `api-contract-${Date.now()}` },
    body: JSON.stringify({
      language: "zh-CN",
      idempotencyKey: `api-contract-${Date.now()}`,
      fieldValues: {},
      evidenceIds: []
    })
  });
  assert(response.status === 401, `confirm without actor token must return 401, got ${response.status}`);
}

async function validateAccommodationLens() {
  const lens = await getJson("/api/lenses/accommodation/period-performance");
  assert(Array.isArray(lens), "accommodation lens response must be an array");
}

async function validateObservability() {
  const observation = await getJson("/api/observability/runtime");
  assert(observation.service === "WorkOSNext Core API", "observability service mismatch");
  assert(observation.workspaceCount >= 8, "observability workspaceCount must include seeded workspaces");
  assert(observation.cardCount >= 32, "observability cardCount must include seeded cards");
  assert(typeof observation.outboxCount === "number", "observability outboxCount must be numeric");
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

function validateProjectionEnvelope(projection) {
  assert(projection.projection === "IntentWorkspaceProjection", "projection type mismatch");
  for (const field of ["version", "sourceOfTruth"]) {
    assertNonEmptyString(projection[field], `projection.${field}`);
  }
  assert(Array.isArray(projection.languages) && projection.languages.includes("zh-CN") && projection.languages.includes("ru-RU"), "projection languages missing");
  assert(Array.isArray(projection.workspaces) && projection.workspaces.length === 16, "projection must return 16 workspaces");
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
