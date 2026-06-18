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
const dormitory13RuntimeExecution = readJson("services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioRuntimeExecution.generated.json");

const resolveMethod = methodBody(registrySource, "Resolve");
const resolveStartAdapterMethod = methodBody(registrySource, "ResolveStartAdapter");
const confirmMethod = methodBody(canonicalSource, "ConfirmWorkItem");
const currentDecisionTypes = new Set(
  (decisionTable.decisions ?? [])
    .filter((item) => item.definitionRequired)
    .map((item) => item.workItemType)
);
const generatedRuntimeDefinitionIds = new Set(
  (dormitory13RuntimeExecution.scenarios ?? [])
    .flatMap((scenario) => scenario.definitions ?? [])
    .map((definition) => definition.definitionId)
);
const generatedRuntimeStartAdapters = new Map(
  (dormitory13RuntimeExecution.scenarios ?? [])
    .flatMap((scenario) => Object.entries(scenario.startAdapterDefinitionIds ?? {}))
);
const generatedRuntimeStartDefinitionIds = new Set(generatedRuntimeStartAdapters.values());
const currentDefinitions = (definitionRegistry.definitions ?? [])
  .filter((item) => currentDecisionTypes.has(item.workItemType) || generatedRuntimeDefinitionIds.has(item.definitionId));
const workflowsByDefinition = new Map((workflowRegistry.workflows ?? []).map((item) => [item.definitionId, item]));

if (!resolveMethod.includes("FindByDefinitionId(payloadDefinitionId)") ||
    !resolveMethod.includes("FindByDefinitionId(workItem.DefinitionVersionId)") ||
    !resolveMethod.includes("FindByWorkItemType(workItem.WorkItemType)")) {
  fail("definition_resolution_axis_invalid", "WorkItem Definition resolution must prefer payload definitionId, definitionVersionId, then workItemType.");
}
if (resolveMethod.includes("FindBySourceCardId") || resolveMethod.includes("ResolveByWorkspaceCard")) {
  fail("confirm_resolution_uses_surface_source", "Confirm Definition resolution must not use sourceCardId or workspace/card resolution.");
}
if (confirmMethod.includes("ResolveStartAdapter")) {
  fail("confirm_resolution_uses_start_adapter", "Canonical confirm must not resolve Definition through the Start Adapter Map.");
}
if (/public\s+string\?\s+SourceCardId/.test(registrySource) || /SourceCardId\s*\?\?/.test(registrySource)) {
  fail("registry_source_card_promoted_to_current_identity", "Top-level sourceCardId must remain migration/UI read-only data and cannot be promoted into definition resolution.");
}
if (!registrySource.includes("StartAdapterDefinitionIds") || !registrySource.includes("ResolveStartAdapter")) {
  fail("start_adapter_map_missing", "Search/Start admission must use a server-side Start Adapter Map instead of client-submitted admission.");
}
if (resolveStartAdapterMethod.includes("ResolveByWorkspaceCard") || resolveStartAdapterMethod.includes("FindBySourceCardId")) {
  fail("start_adapter_non_current_fallback_present", "Start Adapter must not fallback to nonCurrent workspace/card or sourceCardId definition resolution.");
}
if (!resolveStartAdapterMethod.includes("start_adapter_not_registered")) {
  fail("start_adapter_missing_unregistered_rejection", "Unmapped Start Adapter input must remain unresolved instead of promoting old card identity.");
}
validateStartAdapterMaps();
if (!registrySource.includes("Migration/audit/read-only explanation only")) {
  fail("migration_audit_resolver_comment_missing", "ResolveByWorkspaceCard / FindBySourceCardId must be explicitly marked migration/audit/read-only only.");
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
for (const forbiddenTraceField of ["[\"sourceCardId\"]", "[\"definitionSourceCardId\"]"]) {
  if (confirmMethod.includes(forbiddenTraceField)) {
    fail("confirm_source_card_trace_present", `Canonical confirm must not write ${forbiddenTraceField} as current trace identity.`);
  }
}
for (const required of [
  "admission.EvaluateConfirm",
  "AdmissionRejected",
  "definition.ToTrace()",
  "[\"definitionId\"] = definition.DefinitionId",
  "[\"admissionDecisionRef\"] = admission.AdmissionDecisionRef"
]) {
  if (!canonicalSource.includes(required)) {
    fail("confirm_trace_binding_missing", `Canonical confirm missing trace binding: ${required}`);
  }
}
for (const file of [
  "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs",
  "services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs",
  "services/core-api/WorkOS.Api/Runtime/CorrectionCenterService.cs",
  "services/core-api/WorkOS.Api/Runtime/RuntimeCorrectionCenterStorage.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs"
]) {
  const source = read(file);
  for (const resolver of ["ResolveByWorkspaceCard(", "FindBySourceCardId("]) {
    if (source.includes(resolver)) {
      fail("old_resolver_current_path_call", `${file} must not call ${resolver} from current runtime/search/admission/finance paths.`);
    }
  }
}

if (canonicalMap.uniqueness?.ordinaryMobileConfirmCannotUseWorkspaceCardFallback !== true) {
  fail("canonical_workspace_card_fallback_not_blocked", "Canonical map must forbid ordinary mobile confirm workspace/card fallback.");
}
if ("scenarioWorkItemCardOwnerSurfaceTuple" in (canonicalMap.uniqueness ?? {})) {
  fail("canonical_card_tuple_present", "Canonical map must not define card-based business identity tuple.");
}
for (const mapping of canonicalMap.mappings ?? []) {
  for (const forbiddenKey of ["cardId", "surfaceCardId", "sourceCardId"]) {
    if (forbiddenKey in mapping) {
      fail("canonical_forbidden_card_key", `Canonical mapping must not include ${forbiddenKey}: ${mapping.scenarioId}`);
    }
  }
  if (!mapping.definitionId || !mapping.workItemId || !mapping.workItemType || !mapping.commandType || !mapping.surfaceId) {
    fail("canonical_identity_tuple_incomplete", `Canonical mapping identity tuple incomplete: ${mapping.scenarioId}`);
  }
  requireMigrationRefs(mapping, `canonical mapping ${mapping.scenarioId}`);
}

for (const definition of currentDefinitions) {
  if (definition.definitionMode !== "oam-certification-current") {
    fail("current_definition_mode_invalid", `${definition.definitionId} must be oam-certification-current.`);
  }
  if (!definition.commandType || !definition.workItemType || !definition.definitionId) {
    fail("current_definition_identity_incomplete", `${definition.definitionId} must bind definitionId/workItemType/commandType.`);
  }
  requireMigrationRefs(definition, `definition ${definition.definitionId}`);
  const workflow = workflowsByDefinition.get(definition.definitionId);
  if (!workflow && !generatedRuntimeDefinitionIds.has(definition.definitionId)) {
    fail("current_definition_workflow_missing", `${definition.definitionId} is not bound by workflow registry.`);
  } else if (workflow) {
    if (workflow.workItemType !== definition.workItemType || workflow.commandType !== definition.commandType) {
      fail("current_definition_workflow_identity_mismatch", `${definition.definitionId} workflow must bind the same workItemType and commandType.`);
    }
  } else if (!generatedRuntimeStartDefinitionIds.has(definition.definitionId)) {
    fail("generated_runtime_start_adapter_missing", `${definition.definitionId} must be bound by Dormitory13ScenarioRuntimeExecution startAdapterDefinitionIds.`);
  }
}

for (const definition of definitionRegistry.definitions ?? []) {
  if ("sourceCardId" in definition) {
    fail("definition_top_level_source_card_id_present", `${definition.definitionId} must preserve sourceCardId only as read-only migrationRefs.`);
  }
  if (workflowsByDefinition.has(definition.definitionId) || generatedRuntimeDefinitionIds.has(definition.definitionId)) continue;
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

function validateStartAdapterMaps() {
  const startMap = parseCSharpStringMap(registrySource, "StartAdapterDefinitionIds");
  for (const [key, definitionId] of generatedRuntimeStartAdapters) {
    startMap.set(key, definitionId);
  }
  const routeMap = parseCSharpStringMap(registrySource, "StartUiRouteDefinitionKeys");
  const definitionsById = new Map((definitionRegistry.definitions ?? []).map((item) => [item.definitionId, item]));
  if (startMap.size === 0) {
    fail("start_adapter_definition_map_empty", "StartAdapterDefinitionIds must not be empty.");
  }
  for (const [key, definitionId] of startMap.entries()) {
    const [workspaceId, cardId] = splitStartAdapterKey(key);
    const definition = definitionsById.get(definitionId);
    if (!definition) {
      fail("start_adapter_definition_missing", `StartAdapterDefinitionIds ${key} references missing definition ${definitionId}.`);
      continue;
    }
    if (definition.definitionMode !== "oam-certification-current") {
      fail("start_adapter_definition_not_current", `StartAdapterDefinitionIds ${key} must reference current definition ${definitionId}.`);
    }
    if (isCapabilityStartAdapterKey(key, definition)) {
      continue;
    }
    if (definition.workspaceId !== workspaceId) {
      fail("start_adapter_workspace_mismatch", `StartAdapterDefinitionIds ${key} workspace must match registry ${definition.workspaceId}.`);
    }
    const sourceCardRef = (definition.migrationRefs ?? []).find((ref) => ref.type === "sourceCardId");
    if (!sourceCardRef || sourceCardRef.value !== cardId) {
      fail("start_adapter_source_card_mismatch", `StartAdapterDefinitionIds ${key} sourceCardId must match definition migrationRefs.`);
      continue;
    }
    for (const [field, expected] of [
      ["readOnly", true],
      ["executable", false],
      ["affectsAdmission", false],
      ["affectsRuntimeConfirm", false],
      ["affectsBusinessIdentity", false],
      ["affectsLedger", false]
    ]) {
      if (sourceCardRef[field] !== expected) {
        fail("start_adapter_migration_policy_invalid", `StartAdapterDefinitionIds ${key} migrationRefs.sourceCardId.${field} must be ${expected}.`);
      }
    }
  }
  if (routeMap.size === 0) {
    fail("start_route_map_missing", "Start UI route inputs must map to current StartAdapterDefinitionIds keys.");
  }
  for (const [routeKey, currentKey] of routeMap.entries()) {
    if (String(currentKey).startsWith("definition.")) {
      fail("start_route_map_points_to_definition", `Start route ${routeKey} must point to a current StartAdapterDefinitionIds key, not definitionId.`);
    }
    if (!startMap.has(currentKey)) {
      fail("start_route_map_target_missing", `Start route ${routeKey} points to unknown current key ${currentKey}.`);
    }
  }
}

function parseCSharpStringMap(source, mapName) {
  const start = source.indexOf(mapName);
  if (start < 0) return new Map();
  const brace = source.indexOf("{", start);
  if (brace < 0) return new Map();
  let depth = 0;
  let end = -1;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      end = index;
      break;
    }
  }
  const body = end < 0 ? source.slice(brace) : source.slice(brace, end + 1);
  const map = new Map();
  for (const match of body.matchAll(/\["([^"]+)"\]\s*=\s*"([^"]+)"/g)) {
    map.set(match[1], match[2]);
  }
  return map;
}

function splitStartAdapterKey(key) {
  const separator = key.indexOf(":");
  if (separator < 0) return [key, ""];
  return [key.slice(0, separator), key.slice(separator + 1)];
}

function isCapabilityStartAdapterKey(key, definition) {
  const [capabilityId, workItemType] = splitStartAdapterKey(key);
  return capabilityId === "Dormitory.FirstGoldenChain" &&
    workItemType === definition.workItemType &&
    [
      "Dorm.RoomSetupConfirm",
      "Dorm.BedSetupConfirm",
      "Dorm.ResourceReadinessConfirm"
    ].includes(workItemType);
}

function requireMigrationRefs(item, label) {
  const sourceCardRef = (item.migrationRefs ?? []).find((ref) => ref.type === "sourceCardId");
  if (!sourceCardRef) {
    fail("migration_ref_missing", `${label} must preserve sourceCardId only in migrationRefs.`);
    return;
  }
  for (const [key, expected] of [
    ["readOnly", true],
    ["executable", false],
    ["affectsAdmission", false],
    ["affectsRuntimeConfirm", false],
    ["affectsBusinessIdentity", false],
    ["affectsLedger", false]
  ]) {
    if (sourceCardRef[key] !== expected) {
      fail("migration_ref_policy_invalid", `${label} migrationRefs.sourceCardId.${key} must be ${expected}.`);
    }
  }
  if (sourceCardRef.deletionProofRef !== "docs/contracts/definition/source-id-migration-fence.json") {
    fail("migration_ref_deletion_proof_missing", `${label} migrationRefs.sourceCardId must bind deletion proof.`);
  }
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
