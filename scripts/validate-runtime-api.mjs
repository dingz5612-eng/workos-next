import { spawn } from "node:child_process";
import fs from "node:fs";

const baseUrl = process.env.WORKOS_API_VALIDATE_URL || "http://127.0.0.1:5197";
const externalApi = Boolean(process.env.WORKOS_API_VALIDATE_URL);
const openApi = JSON.parse(fs.readFileSync("docs/contracts/workos-runtime.openapi.json", "utf8"));
const sliceManifest = JSON.parse(fs.readFileSync("docs/contracts/slice-manifest.json", "utf8"));
const surfacePolicy = JSON.parse(fs.readFileSync("docs/contracts/runtime-surface-policy.json", "utf8"));
const lensContract = JSON.parse(fs.readFileSync("docs/contracts/accommodation-lens-contract.json", "utf8"));
const definitionRegistry = JSON.parse(fs.readFileSync("docs/contracts/definition/workitem-definition-registry.json", "utf8"));
const operationPanelRuntimeContractText = fs.readFileSync("docs/surface/operation-panel-runtime-contract.yml", "utf8");
const operationPanelRuntimeContract = JSON.parse(operationPanelRuntimeContractText);
const startupTimeoutMs = Number.parseInt(process.env.WORKOS_API_VALIDATE_TIMEOUT_MS ?? "90000", 10);
const defaultTestConnectionString =
  "Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev";
let apiProcess;
let apiProcessOutput = "";
let runtimeActorToken = "";

function apiRunArgs(outputName) {
  return [
    "run",
    "--project",
    "services/core-api/WorkOS.Api/WorkOS.Api.csproj",
    "-c",
    "Release",
    `-p:OutputPath=bin/Release/net10.0/${outputName}/`,
    `-p:IntermediateOutputPath=obj/${outputName}/Release/net10.0/`,
    "--no-launch-profile"
  ];
}

function startDevelopmentApi() {
  apiProcess = spawn("dotnet", apiRunArgs("validate-runtime-api"), {
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: "Development",
      ASPNETCORE_URLS: baseUrl,
      ConnectionStrings__WorkOSRuntime: process.env.ConnectionStrings__WorkOSRuntime || defaultTestConnectionString,
      WORKOS_TEST_CONNECTION: process.env.WORKOS_TEST_CONNECTION || defaultTestConnectionString,
      TEST_DATABASE: process.env.TEST_DATABASE || "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  apiProcess.stdout.on("data", (chunk) => {
    apiProcessOutput += chunk.toString();
  });
  apiProcess.stderr.on("data", (chunk) => {
    apiProcessOutput += chunk.toString();
  });
}

try {
  validateRuntimeIdentityBoundaryContract();
  if (!externalApi) {
    await validateProductionRejectsDevAuthDefaults();
    startDevelopmentApi();
  }
  await waitForApi();
  await validateHealth();
  await ensureRuntimeActorToken();
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
  while (Date.now() - started < startupTimeoutMs) {
    if (apiProcess?.exitCode !== null) {
      throw new Error(`API process exited before becoming healthy at ${baseUrl} with code ${apiProcess.exitCode}.\n${lastApiOutput()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`API did not become healthy at ${baseUrl} within ${startupTimeoutMs}ms: ${lastError?.message || "timeout"}.\n${lastApiOutput()}`);
}

function lastApiOutput() {
  const output = apiProcessOutput.trim();
  if (!output) {
    return "API process produced no stdout/stderr before the health check failed.";
  }
  return output.slice(-6000);
}

async function validateHealth() {
  const health = await getJson("/health");
  assert(health.status === "ok", "health status must be ok");
  assert(health.persistence === "postgresql", "health persistence must be postgresql");
}

async function validatePrepare(projection) {
  const item = await findStartAdapterWorkItem("W-STAY-RESOURCE", "roomSetup");
  const prepared = await postJson(workItemPath(workItemIdOf(item), "/prepare"), {
    workspaceId: workspaceIdOf(item),
    cardId: cardIdOf(item)
  });
  assert(prepared.projectionStatus === "prepared", "prepare response must mark projectionStatus prepared");
  assert(prepared.workspaceId === workspaceIdOf(item), "prepare response workspaceId mismatch");
  assert(prepared.cardId === cardIdOf(item), "prepare response cardId mismatch");
  assert(prepared.fieldContract?.business?.length > 0, "prepare response fieldContract must include business fields");
}

async function validateDeclaredRuntimePaths(projection) {
  const workspace = projection.workspaces[0];
  const card = workspace.cards[0];
  const samples = {
    workspaceId: workspace.id,
    cardId: card.id,
    lensId: "period-performance",
    evidenceId: "evd-openapi-path",
    token: "token-openapi-path",
    userId: "u-operator",
    deviceId: "device-openapi-path",
    candidateId: "candidate-openapi-path",
    bankTransactionId: "bank-tx-openapi-path",
    correctionRequestId: "correction-openapi-path",
    caseId: "W-STAY-RESOURCE",
    workItemId: "W-STAY-RESOURCE:roomSetup",
    submissionId: "cmd-openapi-path",
    exportType: "period-risk",
    releaseId: "oam.current-first-batch",
    gateResultId: "gate-oam-current-runner",
    id: "scr-oam-current-shadow-domain-events-vs-audit-events"
  };

  for (const [path, pathItem] of Object.entries(openApi.paths)) {
    if (!(path === "/health" || path.startsWith("/api/"))) continue;
    for (const method of Object.keys(pathItem).filter((item) => ["get", "post", "put", "patch", "delete"].includes(item))) {
      const resolvedPath = resolveOpenApiPath(path, samples);
      const response = await requestDeclaredPath(method.toUpperCase(), resolvedPath);
      const optionalControlPlaneDetail = resolvedPath.startsWith("/api/control-plane/") &&
        resolvedPath !== "/api/control-plane/releases" &&
        resolvedPath !== "/api/control-plane/invariant-checks";
      const optionalOperationsTraceDetail = resolvedPath.startsWith("/api/operations/trace/submissions/");
      if ((optionalControlPlaneDetail || optionalOperationsTraceDetail) && response.status === 404) continue;
      assert(response.status !== 404 && response.status !== 405, `${method.toUpperCase()} ${path} must be reachable, got ${response.status}`);
      assert(response.status < 500, `${method.toUpperCase()} ${path} must not fail with ${response.status}`);
    }
  }
}

async function requestDeclaredPath(method, path) {
  if (method === "GET") {
    if (path === "/api/control-plane/invariant-checks") {
      return fetch(`${baseUrl}${path}?releaseId=oam.current-first-batch`, { headers: authHeaders() });
    }
    if (path === "/api/reconciliation/match-candidates") {
      return fetch(`${baseUrl}${path}?tenantId=tenant-1`, { headers: authHeaders() });
    }
    return fetch(`${baseUrl}${path}`, { headers: authHeaders() });
  }

  if (method === "POST" && path === "/api/auth/login") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "operator", password: "dev" })
    });
  }

  if (method === "POST" && path === "/api/auth/logout") {
    const login = await postJson("/api/auth/login", { username: "operator", password: "dev" });
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-WorkOS-Actor-Token": login.token
      }
    });
  }

  if (method === "POST" && path === "/api/operations/cases") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workspaceId: "W-STAY-RESOURCE" })
    });
  }

  if (method === "POST" && path === "/api/operations/work-items") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        workItemId: "W-STAY-RESOURCE:roomSetup",
        workspaceId: "W-STAY-RESOURCE",
        cardId: "roomSetup",
        workItemType: "roomSetup",
        tenantId: "tenant-1",
        ownerRole: "operator"
      })
    });
  }

  if (method === "POST" && path.endsWith("/prepare")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: "{}"
    });
  }

  if (method === "POST" && path.endsWith("/confirm")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(confirmBody(`openapi-path-${Date.now()}-${Math.random().toString(16).slice(2)}`))
    });
  }

  if (method === "POST" && path === "/api/evidence/drafts") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
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

  if (method === "POST" && path === "/api/device-sessions") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        tenantId: "tenant-1",
        actorId: "u-operator",
        deviceId: "device-openapi-path",
        deviceTrustStatus: "trusted",
        userAgentHash: "ua-openapi-path"
      })
    });
  }

  if (method === "POST" && path.startsWith("/api/reconciliation/bank-statement-imports")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        tenantId: "tenant-1",
        sourceType: "manual_csv",
        importId: `openapi-import-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        csvContent: "occurredAt,amount,currency,direction,externalRef,description,counterparty\n2026-05-30,1,KGS,in,OPENAPI-1,OpenAPI path,Path Counterparty"
      })
    });
  }

  if (method === "POST" && path === "/api/reconciliation/match-candidates/generate") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tenantId: "tenant-1", windowDays: 3 })
    });
  }

  if (method === "POST" && path === "/api/reconciliation/mismatches/detect") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tenantId: "tenant-1", windowDays: 3 })
    });
  }

  if (method === "POST" &&
      (path.startsWith("/api/reconciliation/") || path.startsWith("/api/correction-center/")) &&
      path.endsWith("/reject")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tenantId: "tenant-1", approverId: "validate-runtime-api", reason: "path reachability" })
    });
  }

  if (method === "POST" && path.endsWith("/mismatch")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tenantId: "tenant-1", mismatchType: "manual_review", reason: "path reachability" })
    });
  }

  if (method === "POST" && path.endsWith("/ignore")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tenantId: "tenant-1", reason: "path reachability" })
    });
  }

  if (method === "POST" && path === "/api/correction-center/ledger-correction-requests") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        tenantId: "tenant-1",
        workItemId: "wi-openapi-path",
        caseId: null,
        targetLedgerType: "payment",
        targetEntryId: "entry-openapi-path",
        targetObjectType: "payment",
        targetObjectId: "payment-openapi-path",
        correctionType: "allocation_reversal",
        reason: "path reachability",
        requestedBy: "validate-runtime-api",
        riskLevel: "low"
      })
    });
  }

  if (method === "POST" && path.endsWith("/approve")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        tenantId: "tenant-1",
        approverId: "validate-runtime-api",
        note: "path reachability",
        actorRole: "finance",
        actorCapabilities: ["correction.approve"],
        deviceId: "device-openapi-path",
        deviceTrustStatus: "trusted",
        surface: "pc"
      })
    });
  }

  if (method === "POST" && path.endsWith("/apply")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        tenantId: "tenant-1",
        actorId: "validate-runtime-api",
        workItemId: "wi-openapi-path",
        reason: "path reachability"
      })
    });
  }

  if (method === "POST" && path.startsWith("/api/pc-governance/exports/")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        exportType: "period-risk",
        actorId: "validate-runtime-api",
        actorRole: "manager",
        actorCapabilities: ["pc.governance.export"],
        deviceId: "device-openapi-path",
        deviceTrustStatus: "trusted",
        surface: "pc",
        reason: "path reachability"
      })
    });
  }

  if (method === "POST" && path.endsWith("/attachments")) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
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
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        actorId: "validate-runtime-api",
        reason: "path reachability"
      })
    });
  }

  if (method === "POST" && path === "/api/projections/process-outbox") {
    return fetch(`${baseUrl}${path}`, { method, headers: authHeaders() });
  }

  if (method === "POST" && path === "/api/behavior-events") {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        eventType: "RuntimeApiPathValidated",
        language: "zh-CN",
        source: "validate-runtime-api"
      })
    });
  }

  return fetch(`${baseUrl}${path}`, { method, headers: authHeaders() });
}

function resolveOpenApiPath(path, samples) {
  return path.replace(/\{([^}]+)\}/g, (_, name) => {
    const value = samples[name];
    assert(value, `No sample value configured for OpenAPI path parameter ${name}`);
    return encodeURIComponent(value);
  });
}

function workItemPath(workItemId, suffix = "") {
  return `/api/operations/work-items/${encodeURIComponent(workItemId)}${suffix}`;
}

async function findStartAdapterWorkItem(workspaceId, cardId, options = {}) {
  return findOperationsWorkItem(workspaceId, cardId, { ...options, requireStartAdapterResult: true });
}

async function findOperationsWorkItem(workspaceId, cardId, options = {}) {
  const requireStartAdapterResult = options.requireStartAdapterResult === true;
  const actorToken = options.actorToken || "";
  if (!actorToken) {
    const items = await getJson("/api/operations/work-items");
    assert(Array.isArray(items), "Operations work-items response must be an array");
    const existingCandidates = items.filter((candidate) => matchesOperationsWorkItem(candidate, workspaceId, cardId));
    const existing = existingCandidates.find(isCurrentDefinitionWorkItem);
    if (existing) return existing;
  }

  const started = actorToken
    ? await postJsonWithActor(
      "/api/operations/workspaces/start",
      { templateWorkspaceId: workspaceId },
      actorToken,
      `api-start-${Date.now()}`)
    : await postJson("/api/operations/workspaces/start", { templateWorkspaceId: workspaceId });
  const startedItems = [started.workItem, ...(started.operationWorkItems || [])].filter(Boolean);
  const item = startedItems.find((candidate) =>
    matchesOperationsWorkItem(candidate, workspaceId, cardId) && isCurrentDefinitionWorkItem(candidate));
  if (!item) {
    const returned = startedItems.map((candidate) => ({
      workItemId: workItemIdOf(candidate),
      workspaceId: workspaceIdOf(candidate),
      cardId: cardIdOf(candidate),
      definitionId: definitionIdOf(candidate),
      definitionMode: definitionModeOf(candidate),
      admissionReason: admissionReasonOf(candidate)
    }));
    if (requireStartAdapterResult) {
      assert(false, `Operations Workspace Start must return a current WorkItem for ${workspaceId}/${cardId}; returned=${JSON.stringify(returned)}`);
    }
    assert(false, `Operations runtime validation requires a persisted current WorkItem for ${workspaceId}/${cardId}; no workspace/card create fallback is allowed; returned=${JSON.stringify(returned)}`);
  }
  assert(item, `Operations Workspace Start did not return a WorkItem for ${workspaceId}/${cardId}`);
  assert(workItemIdOf(item), `Operations WorkItem missing workItemId for ${workspaceId}/${cardId}`);
  return item;
}

function validateRuntimeIdentityBoundaryContract() {
  const resolutionOrder = operationPanelRuntimeContract.persistedWorkItemResolutionOrder || [];
  assert(Array.isArray(resolutionOrder), "operation panel persistedWorkItemResolutionOrder must be an array");
  assert(resolutionOrder.length === 2 &&
    resolutionOrder[0] === "persisted workItemId from operationWorkItems" &&
    resolutionOrder[1] === "block",
    "operation panel actions may resolve only by persisted workItemId from operationWorkItems, then block");
  assert(!resolutionOrder.includes("workQueue") &&
    !resolutionOrder.some((item) => String(item).includes("workspaceId/cardId")),
    "workQueue and workspaceId/cardId must not appear in action identity resolution order");

  const actionIdentity = operationPanelRuntimeContract.actionIdentityPath || {};
  assert(actionIdentity.onlyAllowedIdentity === "persisted workItemId", "operation panel onlyAllowedIdentity must be persisted workItemId");
  assert(actionIdentity.prepare === "POST /api/operations/work-items/{workItemId}/prepare", "prepare path must use persisted workItemId");
  assert(actionIdentity.confirm === "POST /api/operations/work-items/{workItemId}/confirm", "confirm path must use persisted workItemId");
  assert(workItemPath("sample", "/confirm") === "/api/operations/work-items/sample/confirm", "runtime validator confirm path must use operation workItemId");

  const historicalReadOnlyPath = operationPanelRuntimeContract.historicalReadOnlyPath || {};
  assert(String(historicalReadOnlyPath.workQueue || "").includes("derived display view"), "workQueue must be documented as a derived display view");
  for (const forbidden of ["confirm identity", "prepare identity", "admission truth", "truth owner resolution", "ledger source"]) {
    assert((historicalReadOnlyPath.forbiddenFor || []).includes(forbidden), `historical read-only path must forbid ${forbidden}`);
  }

  const forbiddenInputs = new Set([
    ...(operationPanelRuntimeContract.OperationWorkItemRemovalContract?.forbiddenIdentityInputs || []),
    ...(operationPanelRuntimeContract.forbiddenFallback || [])
  ]);
  for (const forbidden of ["cardId", "sourceCardId", "workspaceCardId", "workspaceId/cardId fallback", "workQueue", "workspaceId/cardId persisted mapping"]) {
    assert(forbiddenInputs.has(forbidden), `operation panel contract must forbid ${forbidden} as action identity`);
  }

  const paths = Object.keys(openApi.paths || {});
  assert(paths.includes("/api/operations/work-items/{workItemId}/confirm"), "OpenAPI must expose operation WorkItem confirm path");
  assert(openApi.paths["/api/operations/work-items/{workItemId}/confirm"]?.post, "operation WorkItem confirm path must be POST");
  assert(!paths.some((path) => /\/api\/workspaces\/\{workspaceId\}\/cards\/\{cardId\}\/(prepare|confirm|admission|mutation)/.test(path)),
    "OpenAPI must not expose workspace/card action fallback paths");
}

function matchesOperationsWorkItem(item, workspaceId, cardId) {
  const templateWorkspaceId = item?.payload?.templateWorkspaceId || "";
  return (workspaceIdOf(item) === workspaceId || templateWorkspaceId === workspaceId) &&
    cardIdOf(item) === cardId;
}

function isCurrentDefinitionWorkItem(item) {
  const definitionId = definitionIdOf(item);
  const definition = definitionRegistry.definitionsById?.get(definitionId) || definitionById(definitionId);
  const admissionReason = admissionReasonOf(item);
  const operationAxis = item?.payload?.operationAxis || "";
  const generatedTransitionPolicyId = item?.payload?.generatedTransitionPolicyId || "";
  return definitionId.startsWith("definition.") &&
    definition?.definitionMode === "oam-certification-current" &&
    (
      operationAxis === "Definition -> OperationCase -> WorkItem" ||
      operationAxis === "DomainEvent -> GeneratedTransitionPolicy -> WorkItem" ||
      Boolean(generatedTransitionPolicyId)
    ) &&
    !String(admissionReason).includes("definition_not_resolved") &&
    !String(admissionReason).includes("start_adapter_not_registered");
}

function definitionById(definitionId) {
  return (definitionRegistry.definitions || []).find((definition) => definition.definitionId === definitionId);
}

function definitionIdOf(item) {
  return item?.payload?.definitionId || item?.definitionId || "";
}

function definitionModeOf(item) {
  return definitionById(definitionIdOf(item))?.definitionMode || item?.definitionMode || "";
}

function admissionReasonOf(item) {
  return item?.admission?.reason || item?.admission?.code || "";
}

function workItemIdOf(item) {
  return item?.workItemId || item?.work_item_id || item?.id || "";
}

function workspaceIdOf(item) {
  return item?.workspaceId || item?.workspace_id || item?.workspace?.id || item?.payload?.workspaceId || "";
}

function cardIdOf(item) {
  return item?.cardId || item?.card_id || item?.card?.id || item?.payload?.cardId || "";
}

async function validateConfirmPolicyResponse() {
  const login = await postJson("/api/auth/login", { username: "operator", password: "dev" });
  const roomWorkItem = await findStartAdapterWorkItem("W-STAY-RESOURCE", "roomSetup");
  const roomConfirmPath = workItemPath(workItemIdOf(roomWorkItem), "/confirm");
  const response = await fetch(`${baseUrl}${roomConfirmPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Request-Id": `api-contract-${Date.now()}` },
    body: JSON.stringify(confirmBody(`api-contract-${Date.now()}`))
  });
  assert(response.status === 401, `confirm without actor token must return 401, got ${response.status}`);

  const invalid = await fetch(`${baseUrl}${roomConfirmPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-WorkOS-Actor-Token": login.token, "X-Request-Id": `api-invalid-${Date.now()}` },
    body: JSON.stringify(confirmBody("", {}, "invalid-idempotency"))
  });
  assert(invalid.status === 422, `confirm without idempotencyKey must return 422, got ${invalid.status}`);

  const localizedKey = await fetch(`${baseUrl}${roomConfirmPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-WorkOS-Actor-Token": login.token, "X-Request-Id": `api-localized-key-${Date.now()}` },
    body: JSON.stringify(confirmBody(`api-localized-key-${Date.now()}`, { "未知字段": "A999" }))
  });
  assert(localizedKey.status === 400, `unknown localized label payload key must return 400, got ${localizedKey.status}`);

  const financeLogin = await postJson("/api/auth/login", { username: "finance", password: "dev" });
  assert(financeLogin.role === "finance", `finance login must return finance role, got ${financeLogin.role}`);
  const forbidden = await fetch(`${baseUrl}${roomConfirmPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-WorkOS-Actor-Token": financeLogin.token, "X-Request-Id": `api-forbidden-${Date.now()}` },
    body: JSON.stringify(confirmBody(`api-forbidden-${Date.now()}`))
  });
  assert(forbidden.status === 403, `role forbidden confirm must return 403, got ${forbidden.status}`);

  const paymentWorkItem = await findStartAdapterWorkItem("W-STAY-PAYMENT-LEDGER", "paymentReceipt");
  const businessBlocked = await fetch(`${baseUrl}${workItemPath(workItemIdOf(paymentWorkItem), "/confirm")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-WorkOS-Actor-Token": login.token, "X-Request-Id": `api-business-${Date.now()}` },
    body: JSON.stringify(confirmBody(
      `api-business-${Date.now()}`,
      {
        paymentId: "api-payment-policy",
        paymentAmount: "3000",
        paymentMethod: "bank_transfer",
        payerName: "Runtime API validation",
        receivedBy: "finance",
        currency: "KGS",
        sourcePack: "business-domain",
        targetFact: "LedgerEntry"
      },
      "business-blocked"
    ))
  });
  const businessBlockedBody = await businessBlocked.text();
  assert(
    businessBlocked.status === 422,
    `business policy violation must return 422, got ${businessBlocked.status}: ${businessBlockedBody}`
  );
}

async function validateProductionRejectsDevAuthDefaults() {
  const productionUrl = "http://127.0.0.1:5199";
  const child = spawn("dotnet", apiRunArgs("validate-runtime-api-production"), {
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: "Production", ASPNETCORE_URLS: productionUrl },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const exitCode = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, 30000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  assert(exitCode !== null && exitCode !== 0, "production API must reject missing or development auth hashes at startup");
}

async function validateAccommodationLens() {
  for (const lens of lensContract.lenses || []) {
    const result = await getJson(`/api/lenses/accommodation/${lens.id}`);
    assert(Array.isArray(result), `${lens.id} response must be an array`);
    if (result.length > 0) {
      assert(Array.isArray(result[0].sourceOfTruthTables), `${lens.id} must expose sourceOfTruthTables`);
      assert(typeof result[0].projectionLagSeconds === "number", `${lens.id} must expose projectionLagSeconds`);
    }
  }
}

async function validateRuntimeSurfaces(projection) {
  const queue = await getJson("/api/lenses/work-queue");
  assert(Array.isArray(queue), "work queue lens response must be an array");
  for (const item of queue) {
    assert(item.workItemId, "work queue lens items must be real work items, not projection templates");
    assert(item.workspaceId && item.cardId, "work queue items must include workspaceId/cardId");
    assert(item.source !== "projection-fallback", "work queue must not synthesize actionable cases from projection templates");
  }

  const home = await getJson("/api/lenses/home-surface");
  assert(Array.isArray(home), "home surface lens response must be an array");

  const learning = await getJson("/api/lenses/learning-catalog");
  assert(Array.isArray(learning), "learning catalog lens response must be an array");

  const workspaceIds = new Set(projection.workspaces.map((item) => item.id));
  for (const item of home) {
    assert(workspaceIds.has(item.workspaceId), `home surface references unknown workspace ${item.workspaceId}`);
  }

  const policies = new Map((surfacePolicy.policies || []).map((item) => [item.sliceId, item]));
  for (const slice of sliceManifest.slices.filter((item) => item.status === "production-slice")) {
    const policy = policies.get(slice.id);
    assert(policy, `production slice ${slice.id} must have surface policy`);
    assert(home.some((item) => item.workspaceId === slice.workspaceId) || policy.hiddenReason, `home surface must expose ${slice.id}`);
    assert(learning.some((item) => item.workspaceId === slice.workspaceId) || policy.hiddenReason, `learning catalog must expose ${slice.id}`);

    const query = encodeURIComponent(policy.search?.keywords?.[0] || slice.workspaceId);
    const search = await getJson(`/api/lenses/search?q=${query}`);
    assert(search.some((item) => item.workspaceId === slice.workspaceId) || policy.hiddenReason, `search lens must expose ${slice.id}`);
  }
}

async function validateConfirmLedgerProjectionLensChain() {
  const login = await postJson("/api/auth/login", { username: "operator", password: "dev" });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const roomId = `api-chain-room-${suffix}`;
  const confirmRequest = {
    ...confirmBody(`api-chain-${suffix}`, {
      roomId,
      roomNo: `API-${suffix.slice(-6)}`,
      roomType: "four_bed",
      bedCount: "4",
      genderPolicy: "unrestricted",
      furnitureStatus: "complete",
      technicalState: "ready"
    }, `room:${roomId}`)
  };
  const chainWorkItem = await findStartAdapterWorkItem("W-STAY-RESOURCE", "roomSetup");
  const workItemId = workItemIdOf(chainWorkItem);
  const confirmPath = workItemPath(workItemId, "/confirm");
  const result = await postJsonWithActor(
    confirmPath,
    confirmRequest,
    login.token,
    `api-chain-${suffix}`
  );

  const eventIds = result.source === "operations_unit_of_work"
    ? (result.resultEventIds || []).filter(Boolean)
    : (result.events || []).map((item) => item.eventId).filter(Boolean);
  assert(eventIds.length > 0, "confirm response must include committed event refs");
  assert(result.confirmed === true, "confirm response must mark confirmed true");
  assert(result.commitStatus === "committed", `confirm response commitStatus must be committed, got ${result.commitStatus}`);
  assert(Array.isArray(result.resultEventIds), "confirm response must include resultEventIds");
  assert(result.resultEventIds.join("|") === eventIds.join("|"), "confirm response resultEventIds must match committed event refs");

  if (result.source === "operations_unit_of_work") {
    assert(result.commandSubmissionId, "S4 Operations confirm must expose commandSubmissionId");
    assert(result.traceUrl === `/api/operations/trace/submissions/${result.commandSubmissionId}`, "S4 Operations confirm must expose canonical traceUrl");
    assert(result.projectionStatus === "pending", `S4 UoW Operations confirm projectionStatus must be pending, got ${result.projectionStatus}`);
    const trace = await getJson(result.traceUrl);
    assert(trace.submissionRef === result.commandSubmissionId, "S4 trace must bind to the commandSubmissionId");
    assert(trace.workItemRef === result.workItemId, "S4 trace must bind to the non-persisted-resolved workItemId");
    assert((trace.domainEventRefs || []).join("|") === eventIds.join("|"), "S4 trace domainEventRefs must match resultEventIds");

    const duplicate = await fetch(`${baseUrl}${confirmPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WorkOS-Actor-Token": login.token,
        "X-Request-Id": `api-chain-duplicate-${suffix}`
      },
      body: JSON.stringify(confirmRequest)
    });
    assert(duplicate.status === 200, `duplicate idempotency confirm must return committed 200, got ${duplicate.status}`);
    const duplicateResult = await duplicate.json();
    assert(duplicateResult.commitStatus === "committed", "duplicate confirm must preserve committed commitStatus");
    assert(duplicateResult.commandSubmissionId === result.commandSubmissionId, "duplicate confirm must return the original commandSubmissionId");
    assert(duplicateResult.resultEventIds?.[0] === eventIds[0], "duplicate confirm must return the original domain event id");

    const conflict = await fetch(`${baseUrl}${confirmPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WorkOS-Actor-Token": login.token,
        "X-Request-Id": `api-chain-conflict-${suffix}`
      },
      body: JSON.stringify(confirmBody(`api-chain-${suffix}`, { roomId: `${roomId}-changed` }, `room:${roomId}`))
    });
    assert(conflict.status === 409, `different payload with same idempotency key must return 409, got ${conflict.status}`);
    return;
  }

  assert(result.projectionStatus === "projected", `confirm response projectionStatus must be projected, got ${result.projectionStatus}`);
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

  const duplicate = await fetch(`${baseUrl}${confirmPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-WorkOS-Actor-Token": login.token,
      "X-Request-Id": `api-chain-duplicate-${suffix}`
    },
    body: JSON.stringify(confirmRequest)
  });
  assert(duplicate.status === 200, `duplicate idempotency confirm must return committed 200, got ${duplicate.status}`);
  const duplicateResult = await duplicate.json();
  assert(duplicateResult.commitStatus === "committed", "duplicate confirm must preserve committed commitStatus");
  assert(duplicateResult.resultEventIds?.[0] === eventIds[0], "duplicate confirm must return the original committed event id");
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
  assert(typeof observation.projectionLagSeconds === "number", "observability projectionLagSeconds must be numeric");
  assert(typeof observation.failedConfirmReasonDistribution === "object", "observability failedConfirmReasonDistribution must be an object");
  assert(typeof observation.surfaceCoverageMissingCount === "number", "observability surfaceCoverageMissingCount must be numeric");
  assert(typeof observation.ledgerInvariantViolationCount === "number", "observability ledgerInvariantViolationCount must be numeric");
  assert(typeof observation.schemaVersion === "string", "observability schemaVersion must be a string");
  assert(typeof observation.activeArchitectureExceptionCount === "number", "observability activeArchitectureExceptionCount must be numeric");
  assert(Array.isArray(observation.activeArchitectureExceptions), "observability activeArchitectureExceptions must be an array");
  assert(typeof observation.productionMetrics?.runtime?.confirmLatencyP95Ms === "number", "observability must expose runtime confirm latency p95");
  assert(typeof observation.productionMetrics?.runtime?.idempotencyConflictCount === "number", "observability must expose idempotency conflict count");
  assert(typeof observation.productionMetrics?.outbox?.deadLetterCount === "number", "observability must expose outbox dead-letter count");
  assert(typeof observation.productionMetrics?.projection?.staleLensCount === "number", "observability must expose stale lens count");
  assert(typeof observation.productionMetrics?.mobile?.workItemBundleP95Ms === "number", "observability must expose WorkItemBundle p95");
  assert(typeof observation.productionMetrics?.money?.allocationOverAvailableViolations === "number", "observability must expose money allocation violations");
  assert(typeof observation.productionMetrics?.deposit?.availableRefundNegativeCount === "number", "observability must expose deposit availableRefund violations");
  assert(typeof observation.productionMetrics?.checkout?.fakeCloseAttempts === "number", "observability must expose checkout fake close attempts");
  assert(typeof observation.productionMetrics?.controlPlane?.gateResultStatus === "string", "observability must expose control plane GateResult status");
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
  const response = await fetch(`${baseUrl}${path}`, { headers: authHeaders() });
  assert(response.ok, `${path} expected 2xx, got ${response.status}`);
  return response.json();
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: path === "/api/auth/login"
      ? { "Content-Type": "application/json" }
      : authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body)
  });
  assert(response.ok, `${path} expected 2xx, got ${response.status}`);
  return response.json();
}

async function ensureRuntimeActorToken() {
  if (runtimeActorToken) return runtimeActorToken;
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "operator", password: "dev" })
  });
  assert(response.ok, `/api/auth/login expected 2xx, got ${response.status}`);
  const login = await response.json();
  runtimeActorToken = login.token;
  assert(runtimeActorToken, "Development login must return actor token for validator");
  return runtimeActorToken;
}

function authHeaders(headers = {}) {
  return runtimeActorToken
    ? { ...headers, "X-WorkOS-Actor-Token": runtimeActorToken }
    : headers;
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
