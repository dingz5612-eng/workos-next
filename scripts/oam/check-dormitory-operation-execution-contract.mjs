import fs from "node:fs";
import path from "node:path";
import { fileDigest, readJson, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const contractPath = "docs/oam/dormitory-operation-execution-contract.json";
const resultPath = "artifacts/oam/checks/dormitory-operation-execution-contract-result.json";
const failures = [];
const contract = readJson(contractPath, root);

if (contract.version !== "oam.dormitory-operation-execution-contract.v1") fail("execution contract version mismatch.");
if (contract.status !== "authoritative") fail("execution contract must be authoritative.");
if (contract.mainlineId !== "Dormitory.13ScenarioMainline") fail("execution contract must bind Dormitory.13ScenarioMainline.");
for (const [rule, expected] of Object.entries(contract.rules ?? {})) {
  if (expected !== true) fail(`execution rule ${rule} must be true.`);
}
if (contract.productionConfirmAllowed !== false || contract.releaseAuthority !== false || contract.finalGoNoGo !== "NO_GO") {
  fail("execution contract must keep production/release/final GO closed.");
}

const program = readText("services/core-api/WorkOS.Api/Program.cs");
const startFunction = slice(program, "static IResult StartOperationsWorkspace", "static IResult AppendExperienceEvent");
if (!startFunction.includes("projection = new")) fail("start endpoint must return a minimal projection envelope.");
if (!startFunction.includes("workspaces = new[] { started.Workspace }")) fail("start endpoint must return only the started workspace projection.");
if (!startFunction.includes("started.OperationWorkItems")) fail("start endpoint must return started operation work items.");
if (startFunction.includes("runtime.GetAll(")) fail("start endpoint must not return runtime.GetAll().");

const navigation = readText("apps/mobile/src/navigationController.js");
const startCommand = slice(navigation, "export async function startOperationsWorkspaceCommand", "function handleStartWorkspaceError");
if (!startCommand.includes('ctx.state.operationMessage = ctx.tr("submitting")') || !startCommand.includes("ctx.render();")) {
  fail("start command must give immediate feedback before network call.");
}
if (!startCommand.includes("ctx.applyRuntimeProjection(result.projection)")) fail("start command must consume minimal projection payload.");
if (!startCommand.includes("applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems })")) {
  fail("start command must merge returned operation work items locally.");
}
if (!/else\s*{\s*await ctx\.hydrateProjectionFromApi\(\);/s.test(startCommand)) {
  fail("start command may hydrate only when minimal operation work items are missing.");
}

const operationController = readText("apps/mobile/src/operationController.js");
const submitCommand = slice(operationController, "export async function submitCurrentCard", "function operationSubmissionValues");
if (!submitCommand.includes('ctx.state.operationMessage = ctx.tr("submitting")') || !submitCommand.includes("ctx.render();")) {
  fail("submit command must give immediate feedback before evidence/prepare/confirm.");
}
if (!submitCommand.includes("materializeEvidenceObjects") ||
  !submitCommand.includes("submitWorkItemOperation") ||
  !submitCommand.includes("persistedWorkItemIdFor")) {
  fail("submit command must submit the current persisted work item only.");
}
if (submitCommand.includes("refreshDefaultAccommodationLenses(") || submitCommand.includes("await refreshAccommodationLenses(")) {
  fail("submit command must not foreground-refresh accommodation lenses.");
}

const operationRuntime = readText("apps/mobile/src/operationRuntime.js");
const submitRuntime = slice(operationRuntime, "export async function submitWorkItemOperation", "function workItemIdFor");
if (!submitRuntime.includes("prepareOperationWorkItem") || !submitRuntime.includes("confirmOperationWorkItem")) {
  fail("operation runtime must prepare then confirm current work item.");
}
if (!submitRuntime.includes("scheduleCommittedReadSideSync")) fail("committed read side sync must be scheduled after confirm.");
if (!submitRuntime.includes('readSideSyncStatus: "scheduled"')) fail("committed submit result must report scheduled read side sync.");
if (submitRuntime.includes("await waitForProjectionEvents") || submitRuntime.includes("await refreshAccommodationLenses") || submitRuntime.includes("await fetchOperationWorkItems")) {
  fail("foreground submit must not wait for projection/lens/work-item refresh.");
}
const syncFunction = slice(operationRuntime, "async function syncCommittedReadSide", "function isCommittedConfirm");
for (const required of ["waitForProjectionEvents", "refreshAccommodationLenses", "fetchOperationWorkItems"]) {
  if (!syncFunction.includes(required)) fail(`background sync must include ${required}.`);
}

const apiClient = readText("apps/mobile/src/apiClient.js");
if (!apiClient.includes("operationsWorkspaceStart")) fail("api client must use operations workspace start endpoint.");
if (!apiClient.includes("operationsConfirm(workItemId)")) fail("api client must use operations work-item confirm endpoint.");

const result = {
  version: "oam.dormitory-operation-execution-contract-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  contractPath,
  contractDigest: fileDigest(contractPath, root),
  startReturnsSingleWorkspaceProjection: true,
  submitReadSideSyncForegroundAllowed: false,
  backgroundSyncRequired: true,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory operation execution contract check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory operation execution contract check: PASS");

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
}

function slice(text, startToken, endToken) {
  const start = text.indexOf(startToken);
  if (start < 0) return "";
  const end = text.indexOf(endToken, start + startToken.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

function fail(message) {
  failures.push(message);
}
