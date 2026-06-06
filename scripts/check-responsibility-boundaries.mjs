import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];

const files = {
  operationController: "apps/mobile/src/operationController.js",
  operationCaseContext: "apps/mobile/src/operationCaseContext.js",
  operationValidation: "apps/mobile/src/operationValidation.js",
  fieldSourceRenderer: "apps/mobile/src/fieldSourceRenderer.js",
  workspaceView: "apps/mobile/src/views/workspaceView.js",
  canonicalOperations: "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs",
  operationBranchResolver: "services/core-api/WorkOS.Api/Runtime/OperationBranchResolver.cs"
};

for (const [id, file] of Object.entries(files)) {
  if (!exists(file)) {
    violations.push(v("responsibility.file_missing", `${id} file is missing: ${file}`, { file }));
  }
}

const operationController = read(files.operationController);
const operationCaseContext = read(files.operationCaseContext);
const operationValidation = read(files.operationValidation);
const fieldSourceRenderer = read(files.fieldSourceRenderer);
const workspaceView = read(files.workspaceView);
const canonicalOperations = read(files.canonicalOperations);
const operationBranchResolver = read(files.operationBranchResolver);

for (const forbidden of [
  "function operationCaseContextPayloads",
  "function selectedOperationWorkItem",
  "function runtimeWorkItems",
  "function normalizeOperationWorkItemsPayload",
  "function validateRequiredFields",
  "function operationFieldParticipatesInUserSubmit",
  "function bedSetupCardinalityViolations"
]) {
  if (operationController.includes(forbidden)) {
    violations.push(v("responsibility.frontend_controller_overreach", `operationController.js must not own ${forbidden}.`, { forbidden }));
  }
}

for (const requiredImport of [
  "./operationCaseContext.js",
  "./operationValidation.js"
]) {
  if (!operationController.includes(requiredImport)) {
    violations.push(v("responsibility.frontend_controller_missing_kernel", `operationController.js must import ${requiredImport}.`, { requiredImport }));
  }
}

for (const requiredExport of [
  "export function operationCaseContextPayloads",
  "export function selectedOperationWorkItem",
  "export function runtimeWorkItems",
  "export function normalizeOperationWorkItemsPayload"
]) {
  if (!operationCaseContext.includes(requiredExport)) {
    violations.push(v("responsibility.case_context_missing_export", `operationCaseContext.js must own ${requiredExport}.`, { requiredExport }));
  }
}

if (!operationValidation.includes("export function validateRequiredFields")) {
  violations.push(v("responsibility.validation_missing_export", "operationValidation.js must own validateRequiredFields."));
}

for (const requiredExport of [
  "export function fieldSourceState",
  "export function operationFieldState",
  "export function operationFieldRequired",
  "export function operationFieldVisible",
  "export function currentMissingRequiredLabels",
  "export function currentMissingContextLabels",
  "export function sameWorkspaceEvents"
]) {
  if (!fieldSourceRenderer.includes(requiredExport)) {
    violations.push(v("responsibility.field_source_missing_export", `fieldSourceRenderer.js must own ${requiredExport}.`, { requiredExport }));
  }
}

if (!workspaceView.includes('from "../fieldSourceRenderer.js"')) {
  violations.push(v("responsibility.workspace_missing_field_source", "workspaceView.js must consume fieldSourceRenderer.js instead of owning page-private field source logic."));
}

for (const forbidden of [
  "function operationFieldState",
  "function carriedForwardValue",
  "function derivedChargeAmount",
  "function operationFieldRequired",
  "function operationFieldVisible",
  "function currentMissingRequiredLabels",
  "function currentMissingContextLabels",
  "function hasRequiredFieldValue"
]) {
  if (workspaceView.includes(forbidden)) {
    violations.push(v("responsibility.workspace_field_source_overreach", `workspaceView.js must not own ${forbidden}.`, { forbidden }));
  }
}

for (const forbidden of [
  "private static string NextOperationCard",
  "private static bool IsLeadReservationWorkspace"
]) {
  if (canonicalOperations.includes(forbidden)) {
    violations.push(v("responsibility.backend_service_overreach", `CanonicalOperationsApiService.cs must not own ${forbidden}.`, { forbidden }));
  }
}

if (!canonicalOperations.includes("OperationBranchResolver.NextCardId")) {
  violations.push(v("responsibility.backend_service_missing_resolver", "CanonicalOperationsApiService.cs must delegate next-step branching to OperationBranchResolver."));
}

for (const required of [
  "internal static class OperationBranchResolver",
  "public static string NextCardId",
  "reservationNextAction"
]) {
  if (!operationBranchResolver.includes(required)) {
    violations.push(v("responsibility.branch_resolver_incomplete", `OperationBranchResolver.cs is missing ${required}.`, { required }));
  }
}

writeReport(violations);

if (violations.length) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Responsibility boundary check failed.");
}

console.log("Responsibility boundary check: PASS");

function read(file) {
  return exists(file) ? fs.readFileSync(path.join(root, file), "utf8") : "";
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function writeReport(items) {
  const reportPath = path.join(root, "artifacts", "oam", "checks", "responsibility-boundaries-result.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    checkedAt: new Date().toISOString(),
    architecture: "oam.current",
    status: items.length ? "fail" : "pass",
    violations: items
  }, null, 2));
}

function v(id, message, details = {}) {
  return {
    id,
    severity: "P0",
    message,
    details
  };
}
