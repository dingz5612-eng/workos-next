import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportPath = "artifacts/oam/checks/operation-identity-boundary-result.json";
const violations = [];

const registrySource = read("services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs");
const canonicalSource = read("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs");
const canonicalMap = readJson("docs/business/dormitory/canonical-scenario-map.json");
const decisionTable = readJson("docs/business/dormitory/workitem-decision-table.json");
const definitionRegistry = readJson("docs/contracts/definition/workitem-definition-registry.json");
const workflowRegistry = readJson("docs/contracts/business/oam-workflow-state-registry.json");

const resolveMethod = methodBody(registrySource, "Resolve");
const confirmMethod = methodBody(canonicalSource, "ConfirmWorkItem");
const currentDecisionTypes = new Set(
  (decisionTable.decisions ?? [])
    .filter((item) => item.definitionRequired)
    .map((item) => item.workItemType)
);
const currentDefinitions = (definitionRegistry.definitions ?? [])
  .filter((item) => currentDecisionTypes.has(item.workItemType));
const sourceCardsInWorkflow = new Set((workflowRegistry.workflows ?? []).map((item) => item.sourceCardId));

if (!resolveMethod.includes("FindByDefinitionId(payloadDefinitionId)") ||
    !resolveMethod.includes("FindByDefinitionId(workItem.DefinitionVersionId)") ||
    !resolveMethod.includes("FindByWorkItemType(workItem.WorkItemType)")) {
  fail("definition_resolution_axis_invalid", "WorkItem Definition resolution must prefer payload definitionId, definitionVersionId, then workItemType.");
}
if (resolveMethod.includes("FindBySourceCardId") || resolveMethod.includes("ResolveByWorkspaceCard")) {
  fail("confirm_resolution_uses_surface_source", "Confirm Definition resolution must not use sourceCardId or workspace/card resolution.");
}
if (!confirmMethod.includes("definitions.Resolve(workItem)")) {
  fail("confirm_definition_resolve_missing", "Canonical confirm must resolve Definition from WorkItem identity.");
}
if (confirmMethod.includes("definitions.Resolve(workItem, normalized.CardId)")) {
  fail("confirm_definition_resolve_uses_card_id", "Canonical confirm must not use normalized.CardId as business definition identity.");
}
if (confirmMethod.includes("FirstNonEmpty(definition.DefinitionId")) {
  fail("confirm_definition_fallback_present", "Command definition identity must be resolved-only; workItemType fallback is forbidden.");
}
if (confirmMethod.includes("ResolveByWorkspaceCard")) {
  fail("confirm_workspace_card_resolve_present", "Canonical confirm must not resolve Definition through workspace/card.");
}
for (const required of [
  "admission.EvaluateConfirm",
  "AdmissionRejected",
  "definition.ToTrace()",
  "[\"definitionId\"] = definition.DefinitionId",
  "[\"sourceCardId\"] = definition.SourceCardId",
  "[\"admissionDecisionRef\"] = admission.AdmissionDecisionRef"
]) {
  if (!canonicalSource.includes(required)) {
    fail("confirm_trace_binding_missing", `Canonical confirm missing trace binding: ${required}`);
  }
}

if (canonicalMap.uniqueness?.ordinaryMobileConfirmCannotUseWorkspaceCardFallback !== true) {
  fail("canonical_workspace_card_fallback_not_blocked", "Canonical map must forbid ordinary mobile confirm workspace/card fallback.");
}
if ("scenarioWorkItemCardOwnerSurfaceTuple" in (canonicalMap.uniqueness ?? {})) {
  fail("canonical_card_tuple_present", "Canonical map must not define card-based business identity tuple.");
}
for (const mapping of canonicalMap.mappings ?? []) {
  for (const forbiddenKey of ["cardId", "surfaceCardId"]) {
    if (forbiddenKey in mapping) {
      fail("canonical_forbidden_card_key", `Canonical mapping must not include ${forbiddenKey}: ${mapping.scenarioId}`);
    }
  }
  if (!mapping.definitionId || !mapping.workItemId || !mapping.workItemType || !mapping.surfaceId || !mapping.sourceCardId) {
    fail("canonical_identity_tuple_incomplete", `Canonical mapping identity tuple incomplete: ${mapping.scenarioId}`);
  }
}

for (const definition of currentDefinitions) {
  if (definition.definitionMode !== "oam-certification-current") {
    fail("current_definition_mode_invalid", `${definition.definitionId} must be oam-certification-current.`);
  }
  if (!String(definition.sourceCardId ?? "").startsWith("cert.")) {
    fail("current_definition_source_invalid", `${definition.definitionId} sourceCardId must be a canonical surface source.`);
  }
  if (!sourceCardsInWorkflow.has(definition.sourceCardId)) {
    fail("current_definition_workflow_missing", `${definition.definitionId} sourceCardId is not bound by workflow registry.`);
  }
}

for (const definition of definitionRegistry.definitions ?? []) {
  if (currentDecisionTypes.has(definition.workItemType)) continue;
  if (definition.definitionMode !== "surface-input-adapter") {
    fail("non_current_definition_mode_invalid", `${definition.definitionId} is not a current execution identity and must be surface-input-adapter.`);
  }
}

writeReport();
if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("Operation identity boundary check: PASS");

function methodBody(source, methodName) {
  const marker = methodName === "Resolve"
    ? "public WorkItemDefinitionResolution Resolve("
    : ` ${methodName}(`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const brace = source.indexOf("{", start);
  if (brace < 0) return "";
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  return source.slice(start);
}

function readJson(file) {
  return JSON.parse(read(file));
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fail(id, message) {
  violations.push({ severity: "P0", id, message });
}

function writeReport() {
  const full = path.join(root, reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    checkedAt: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    violations
  }, null, 2)}\n`, "utf8");
}
