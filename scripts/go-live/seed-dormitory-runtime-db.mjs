import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const scenariosPath = readArg("--scenarios=", "docs/go-live/dormitory/runtime-replay-scenarios.yml");
const outPath = readArg("--out=", "artifacts/go-live/dormitory/runtime-seed-result.json");
const connectionString = process.env.WORKOS_TEST_CONNECTION
  ?? process.env.ConnectionStrings__WorkOSRuntime
  ?? "Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev";

const scenariosDoc = JSON.parse(fs.readFileSync(path.join(root, scenariosPath), "utf8"));
const runId = readArg("--run-id=", `seed-${Date.now().toString(36)}`);
const server = await startApi();
globalThis.__baseUrl = server.baseUrl;
const apiCalls = [];
try {
  for (const scenario of (scenariosDoc.scenarios ?? []).filter((item) => /^dorm-live-\d{3}$/.test(item.scenarioId))) {
    const refs = refsFor(runId, scenario);
    await api("POST", "/api/operations/cases", {
      caseId: refs.caseId,
      tenantId: scenariosDoc.tenantId,
      workspaceId: scenario.workspaceId,
      caseType: "dormitory_runtime_replay"
    }, apiCalls);
    await api("POST", "/api/operations/work-items", {
      workItemId: refs.workItemId,
      tenantId: scenariosDoc.tenantId,
      workItemType: scenario.workItemType,
      workspaceId: scenario.workspaceId,
      targetWorkspaceId: scenario.workspaceId,
      cardId: scenario.cardId,
      ownerRole: scenario.ownerRole,
      payload: {
        caseId: refs.caseId,
        cardId: scenario.cardId,
        runtimeReplayRunId: runId,
        runtimeReplayScenarioId: scenario.scenarioId,
        ordinaryConfirmPath: "persisted_work_item"
      }
    }, apiCalls);
  }

  const result = {
    generated_at_utc: new Date().toISOString(),
    generated_by: "seed-dormitory-runtime-db",
    status: "passed",
    sourceMode: "real_api_db",
    runId,
    connectionString: maskConnection(connectionString),
    seededCaseCount: (scenariosDoc.scenarios ?? []).filter((item) => /^dorm-live-\d{3}$/.test(item.scenarioId)).length,
    apiCallsExecuted: apiCalls
  };
  writeJson(outPath, result);
  console.log("Dormitory runtime DB seed: PASS");
} finally {
  await stopApi(server);
}

async function startApi() {
  const port = Number(readArg("--port=", String(46100 + Math.floor(Math.random() * 500))));
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: "Development",
    ASPNETCORE_URLS: baseUrl,
    ConnectionStrings__WorkOSRuntime: connectionString,
    WORKOS_TEST_CONNECTION: connectionString,
    TEST_DATABASE: "true"
  };
  const child = spawn("dotnet", ["run", "--project", "services/core-api/WorkOS.Api/WorkOS.Api.csproj", "-c", "Release", "--no-launch-profile"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk.toString(); });
  child.stderr.on("data", (chunk) => { log += chunk.toString(); });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return { child, baseUrl, log: () => log };
    } catch {
      await delay(1000);
    }
  }
  child.kill();
  throw new Error(`API did not become ready for seed. ${log.slice(-2000)}`);
}

async function api(method, route, body, apiCalls) {
  const response = await fetch(`${globalThis.__baseUrl ?? ""}${route}`, {
    method,
    headers: { "Content-Type": "application/json", "X-WorkOS-Actor-Token": "operator-token" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  apiCalls.push({ method, path: route, statusCode: response.status });
  if (!response.ok) throw new Error(`${method} ${route} failed: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

function refsFor(runId, scenario) {
  const suffix = `${runId}-${scenario.scenarioId}`.replace(/[^a-zA-Z0-9-]/g, "-");
  return { caseId: `case-d1-${suffix}`, workItemId: `wi-d1-${suffix}` };
}

async function stopApi(server) {
  globalThis.__baseUrl = undefined;
  server.child.kill();
  await delay(500);
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function maskConnection(value) {
  return value.replace(/Password=[^;]+/i, "Password=***");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
