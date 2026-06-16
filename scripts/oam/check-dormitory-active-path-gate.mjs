import fs from "node:fs";
import path from "node:path";
import { fileDigest, readJson, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-active-path-gate-result.json";
const pageEntryPath = "docs/contracts/generated/dormitory/13-scenario-page-entry-policy.generated.json";
const mobileControlPath = "apps/mobile/src/generated/oam/dormitory-13-scenario-control.generated.json";
const manifestPath = "docs/oam/dormitory-mainline-manifest.json";
const failures = [];

const pageEntry = readJson(pageEntryPath, root);
const mobileControl = readJson(mobileControlPath, root);
const manifest = readJson(manifestPath, root);
const oldTerms = [
  "Dormitory.FirstGoldenChain",
  "W-STAY-RESOURCE",
  "resource-saleability",
  "lead-reservation",
  "data-start-operations-workspace=\"W-STAY",
  "command(\"W-STAY",
  "roomReadiness",
  "roomRelease",
  "确认房间配置",
  "确认床位配置",
  "确认资源就绪"
];
const activeFiles = [
  "apps/mobile/src/capabilityProjection.js",
  "apps/mobile/src/views/operationPanelView.js",
  "apps/mobile/src/views/searchView.js",
  "apps/mobile/src/searchIntentHub.js",
  "apps/mobile/src/searchIntentRegistry.js",
  "apps/mobile/src/navigationController.js",
  "apps/mobile/src/eventBinder.js",
  "apps/mobile/src/operationController.js",
  "apps/mobile/src/operationRuntime.js",
  "apps/mobile/src/runtime/runtimeStore.js",
  "apps/mobile/src/apiClient.js",
  "services/core-api/WorkOS.Api/Program.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeEndpoints.cs",
  ".github/workflows/ci.yml",
  "scripts/surface/run-dormitory-real-browser-audits.ps1"
];

if (pageEntry.authorityId !== "Dormitory.Operating13ScenarioControl") fail("page entry policy must bind Dormitory.Operating13ScenarioControl.");
for (const key of ["today", "workItems", "search", "mine"]) {
  if (!pageEntry.pageEntryPolicy?.[key]) fail(`page entry policy missing ${key}.`);
}
if (!String(pageEntry.pageEntryPolicy?.search ?? "").includes("只读")) fail("search page entry policy must be read-only.");
if ((mobileControl.scenarios ?? []).length !== 13) fail("mobile control mirror must expose 13 scenarios.");
if ((manifest.activeMainlines ?? []).filter((item) => item.current === true).length !== 1) fail("mainline manifest must have one current active mainline.");

for (const file of activeFiles) {
  const text = readText(file);
  for (const term of oldTerms) {
    if (text.includes(term)) fail(`active path file ${file} contains forbidden old-chain term ${term}.`);
  }
}

const capabilityProjection = readText("apps/mobile/src/capabilityProjection.js");
if (!capabilityProjection.includes('import mainlineControl from "./generated/oam/dormitory-13-scenario-control.generated.json"')) {
  fail("capabilityProjection must import the generated 13-scenario mobile mirror.");
}
if (!capabilityProjection.includes("mainlineScenarioCatalog")) fail("capabilityProjection must expose generated mainline scenario catalog.");
if (!capabilityProjection.includes('DORMITORY_MAINLINE_WORKSPACE_ID = "W-DORM-MAINLINE"')) {
  fail("current mainline workspace id must be W-DORM-MAINLINE.");
}

const searchView = readText("apps/mobile/src/views/searchView.js");
if (!searchView.includes("mainlineScenarioCatalog")) fail("searchView must derive scenario entries from generated mainline catalog.");
if (!searchView.includes('resultType: "mainlineScenario"')) fail("searchView must render generated scenario directory entries.");
if (!searchView.includes('data-search-query')) fail("search scenario entries must query/read only, not write facts.");

const operationPanel = readText("apps/mobile/src/views/operationPanelView.js");
if (!operationPanel.includes("DORMITORY_MAINLINE_WORKSPACE_ID") || !operationPanel.includes("DORMITORY_SCENARIO1_STEPS")) {
  fail("operationPanel empty-state start action must use generated current mainline constants.");
}

const workflow = readText(".github/workflows/ci.yml");
for (const required of [
  "node scripts/oam/check-dormitory-active-path-gate.mjs",
  "node scripts/oam/check-dormitory-operation-execution-contract.mjs",
  "node scripts/oam/check-dormitory-local-test-environment-manager.mjs"
]) {
  if (!workflow.includes(required)) fail(`CI missing active-path execution gate: ${required}.`);
}

const result = {
  version: "oam.dormitory-active-path-gate-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  activeMainlineId: "Dormitory.13ScenarioMainline",
  pageEntryPolicyDigest: fileDigest(pageEntryPath, root),
  mobileControlDigest: fileDigest(mobileControlPath, root),
  manifestDigest: fileDigest(manifestPath, root),
  activeFiles,
  oldChainActivePathAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory active path gate check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory active path gate check: PASS");

function readText(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    fail(`required active path file missing: ${file}.`);
    return "";
  }
  return fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "");
}

function fail(message) {
  failures.push(message);
}
