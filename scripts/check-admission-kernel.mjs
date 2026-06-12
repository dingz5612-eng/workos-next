import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const selfTest = process.argv.includes("--self-test");

const contract = readJson("docs/contracts/admission/admission-contract.json");
const matrix = readJson("docs/contracts/admission/admission-matrix.json");
const sources = readJson("docs/contracts/admission/admission-sources.json");
const currentState = readJson("docs/oam/current-admission-state.json");
const registry = readJson("docs/business/business-line-registry.json");
const surfacePolicy = readJson("docs/contracts/runtime-surface-policy.json");
const actorDevice = readJson("docs/contracts/admission/actor-device-admission-contract.json");
const admissionPolicy = readJson("docs/business/policies/admission-policy.yml");
const generatedManifest = readJson("docs/oam/generated-contracts-manifest.json");
const definitionRegistryContract = readJson("docs/contracts/definition/workitem-definition-registry.json");

if (selfTest) {
  const badState = { ...currentState, businessProduction: "OPEN" };
  const badFailures = runChecks({ currentState: badState });
  if (!badFailures.some((item) => item.includes("businessProduction"))) {
    throw new Error("Admission Kernel self-test did not detect opened production state.");
  }
  const badContract = structuredClone(contract);
  badContract.missingAdmissionBehavior = { ...badContract.missingAdmissionBehavior, confirmAllowed: true };
  const badContractFailures = runChecks({ currentState, contract: badContract });
  if (!badContractFailures.some((item) => item.includes("missingAdmissionBehavior.confirmAllowed"))) {
    throw new Error("Admission Kernel self-test did not detect missing admission confirmAllowed=true.");
  }
  const badStartMapSource = read("services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs")
    .replace('["W-DORM-MAINLINE:cert.roomSetupConfirm"] = "definition.dormitory.roomSetupConfirm.v1"', '["W-DORM-MAINLINE:cert.roomSetupConfirm"] = "definition.dormitory.missing.v1"');
  const badStartMapFailures = [];
  validateStartAdapterMaps(badStartMapSource, definitionRegistryContract, badStartMapFailures);
  if (!badStartMapFailures.some((item) => item.includes("StartAdapterDefinitionIds"))) {
    throw new Error("Admission Kernel self-test did not detect StartAdapterDefinitionIds registry mismatch.");
  }
  console.log("Admission Kernel self-test: PASS");
}

const failures = runChecks({ currentState });
if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("Admission Kernel check failed.");
}

console.log("Admission Kernel check: PASS");

function runChecks(context) {
  const failures = [];
  checkContract(context.contract ?? contract, failures);
  checkSources(failures);
  checkSourcePolicy(failures);
  checkCurrentState(context.currentState, failures);
  checkMatrix(context.currentState, failures);
  checkBusinessLineAlignment(failures);
  checkHighRiskSurfaceReasons(failures);
  checkHighRiskTrustClosure(failures);
  checkRuntimeImplementation(failures);
  checkMissingAdmissionFallbackImplementation(failures);
  return failures;
}

function checkContract(document, failures) {
  if (document.version !== "oam.admission-contract.v1") failures.push("admission-contract version mismatch.");
  for (const [field, expected] of Object.entries({
    generated: true,
    doNotEdit: true,
    architecture: "oam.current",
    manualEditAllowed: false,
    deterministicSort: true
  })) {
    if (document[field] !== expected) failures.push(`admission-contract ${field} must be ${expected}.`);
  }
  for (const field of ["kernelGraphHash", "sourceNodeRefs", "generatorVersion", "generatedFrom", "sourceRefs", "sourceContentDigest"]) {
    const value = document[field];
    if (!value || (Array.isArray(value) && value.length === 0)) failures.push(`admission-contract generated metadata missing ${field}.`);
  }
  for (const ref of ["kernel.system", "domain.dormitory", "graph.oam"]) {
    if (!(document.sourceNodeRefs || []).includes(ref)) failures.push(`admission-contract sourceNodeRefs missing ${ref}.`);
  }
  const manifestEntry = (generatedManifest.contracts || []).find((item) => item.targetPath === "docs/contracts/admission/admission-contract.json");
  if (!manifestEntry) failures.push("generated-contracts-manifest missing admission-contract entry.");
  if (manifestEntry && JSON.stringify(manifestEntry.sourceNodeRefs || []) !== JSON.stringify(document.sourceNodeRefs || [])) {
    failures.push("admission-contract sourceNodeRefs must match generated-contracts-manifest.");
  }
  const missingBehavior = document.missingAdmissionBehavior || {};
  for (const [field, expected] of Object.entries({
    visibleAllowed: true,
    prepareAllowed: false,
    confirmAllowed: false,
    productionAllowed: false,
    mode: "contract_preview",
    reason: "missing_admission_contract"
  })) {
    if (missingBehavior[field] !== expected) failures.push(`admission-contract missingAdmissionBehavior.${field} must be ${expected}.`);
  }
  if (!(missingBehavior.noGoItems || []).includes("missing_admission_contract")) {
    failures.push("admission-contract missingAdmissionBehavior.noGoItems must include missing_admission_contract.");
  }
  for (const field of [
    "visibleAllowed",
    "prepareAllowed",
    "confirmAllowed",
    "productionAllowed",
    "mode",
    "reason",
    "blockingSources",
    "requiredCapabilities",
    "requiredDeviceTrust",
    "businessLineState",
    "releaseState",
    "surfaceState",
    "noGoItems"
  ]) {
    if (!document.outputFields?.[field]) failures.push(`admission-contract missing output field: ${field}`);
  }
}

function checkSources(failures) {
  const ids = new Set((sources.sources || []).map((source) => source.id));
  for (const id of [
    "businessLineRegistry",
    "currentAdmissionState",
    "sliceManifest",
    "surfacePolicy",
    "apiBoundary",
    "factOwnership",
    "actorSession",
    "deviceTrust",
    "surface",
    "workItemDefinition"
  ]) {
    if (!ids.has(id)) failures.push(`admission-sources missing source: ${id}`);
  }
}

function checkSourcePolicy(failures) {
  if (admissionPolicy.policyId !== "business.admission-policy") failures.push("admission source policy id mismatch.");
  const behavior = admissionPolicy.rules?.missingAdmissionBehavior || {};
  for (const [field, expected] of Object.entries({
    visibleAllowed: true,
    prepareAllowed: false,
    confirmAllowed: false,
    productionAllowed: false,
    mode: "contract_preview",
    reason: "missing_admission_contract"
  })) {
    if (behavior[field] !== expected) failures.push(`admission source policy missingAdmissionBehavior.${field} must be ${expected}.`);
    if (contract.missingAdmissionBehavior?.[field] !== behavior[field]) {
      failures.push(`generated admission-contract missingAdmissionBehavior.${field} must match Source policy.`);
    }
  }
}

function checkCurrentState(state, failures) {
  if (state.version !== "oam.current-admission-state.v1") {
    failures.push("current admission state version mismatch.");
  }
  if (state.businessProduction !== "BLOCKED") {
    failures.push("current admission state businessProduction must remain BLOCKED.");
  }
  if (state.dormitoryProduction !== "BLOCKED") {
    failures.push("current admission state dormitoryProduction must remain BLOCKED.");
  }
  if (state.productionConfirmAllowed !== false) {
    failures.push("current admission state productionConfirmAllowed must be false.");
  }
  if (!Array.isArray(state.blockingSources) || !state.blockingSources.includes("docs/contracts/oam.current.json")) {
    failures.push("current admission state must cite the OAM contract.");
  }
}

function checkMatrix(state, failures) {
  const entries = matrix.entries || [];
  const requiredEntries = [
    "dormitory_l1_internal_pilot_observation",
    "dormitory_production_blocked",
    "repair_l0_contract_preview",
    "parts_l0_contract_preview",
    "hr_l0_contract_preview",
    "payment_confirmation",
    "deposit_refund",
    "period_close",
    "bulk_import",
    "production_confirm",
    "prepare_only",
    "contract_preview"
  ];
  for (const id of requiredEntries) {
    if (!entries.some((entry) => entry.id === id)) failures.push(`admission-matrix missing entry: ${id}`);
  }

  if (state.businessProduction === "BLOCKED") {
    for (const entry of entries) {
      if (entry.productionAllowed !== false) failures.push(`${entry.id} productionAllowed must be false while businessProduction is BLOCKED.`);
    }
  }

  for (const entry of entries) {
    for (const field of ["visibleAllowed", "prepareAllowed", "confirmAllowed", "productionAllowed"]) {
      if (typeof entry[field] !== "boolean") failures.push(`${entry.id}.${field} must be boolean.`);
    }
    if (!entry.mode || !entry.reason || !Array.isArray(entry.blockingSources) || !Array.isArray(entry.noGoItems)) {
      failures.push(`${entry.id} must include mode, reason, blockingSources, and noGoItems.`);
    }
    if (entry.mode === "contract_preview" || entry.mode === "prepare_only") {
      if (entry.visibleAllowed === entry.confirmAllowed) failures.push(`${entry.id} must prove visibleAllowed is not confirmAllowed.`);
      if (entry.prepareAllowed === entry.productionAllowed) failures.push(`${entry.id} must prove prepareAllowed is not productionAllowed.`);
      if (entry.confirmAllowed !== false || entry.productionAllowed !== false) failures.push(`${entry.id} cannot confirm or produce.`);
    }
    if (entry.highRisk) {
      if (!Array.isArray(entry.requiredCapabilities) || entry.requiredCapabilities.length === 0) failures.push(`${entry.id} high-risk action requires capability.`);
      if (!Array.isArray(entry.requiredDeviceTrust) || entry.requiredDeviceTrust.length === 0) failures.push(`${entry.id} high-risk action requires device trust.`);
      if (!entry.reason || entry.reason.length < 20) failures.push(`${entry.id} high-risk action requires admission reason.`);
    }
  }
}

function checkBusinessLineAlignment(failures) {
  const entries = matrix.entries || [];
  const productionConfirm = entries.find((entry) => entry.id === "production_confirm");
  if (productionConfirm?.productionAllowed !== false || productionConfirm?.confirmAllowed !== false) {
    failures.push("production_confirm must be blocked.");
  }

  for (const line of registry.businessLines || []) {
    if (line.productionAllowed !== false) failures.push(`${line.businessLineId} registry productionAllowed must remain false.`);
    if (line.productionConfirmAllowed !== false) failures.push(`${line.businessLineId} registry productionConfirmAllowed must remain false.`);
    if (!(line.blockedActions || []).includes("production_confirm")) failures.push(`${line.businessLineId} must block production_confirm.`);

    const lineEntries = entries.filter((entry) =>
      entry.businessLineId === line.businessLineId ||
      (entry.businessLineIds || []).includes(line.businessLineId)
    );
    if (lineEntries.length === 0) failures.push(`admission-matrix missing business line coverage: ${line.businessLineId}`);
    if (line.level === "L0 Contract Preview") {
      for (const entry of lineEntries) {
        if (entry.confirmAllowed !== false || entry.productionAllowed !== false) {
          failures.push(`${line.businessLineId} L0 Contract Preview can only prepare/learn, not confirm.`);
        }
      }
    }
  }
}

function checkHighRiskSurfaceReasons(failures) {
  const policies = surfacePolicy.policies || [];
  for (const entry of matrix.entries || []) {
    if (!entry.highRisk || !Array.isArray(entry.surfaceRefs)) continue;
    for (const ref of entry.surfaceRefs) {
      const policy = policies.find((item) => item.sliceId === ref.sliceId);
      const card = (policy?.cards || []).find((item) => item.cardId === ref.cardId);
      if (!card) {
        failures.push(`${entry.id} references missing surface card: ${ref.sliceId}/${ref.cardId}`);
        continue;
      }
      if (!card.admissionReason || card.admissionReason.length < 20) {
        failures.push(`${ref.sliceId}/${ref.cardId} high-risk surface card must declare admissionReason.`);
      }
    }
  }
}

function checkHighRiskTrustClosure(failures) {
  if (actorDevice.verifiedDeviceTrustContext?.requiredForHighRisk !== true) {
    failures.push("actor-device contract must require verified device trust for high-risk actions.");
  }
  if (actorDevice.correctionApplyAdmission?.requiresTrustedDevice !== true ||
      actorDevice.correctionApplyAdmission?.requiresEvidenceRefs !== true ||
      actorDevice.correctionApplyAdmission?.requiresAdmissionDecisionRef !== true ||
      actorDevice.correctionApplyAdmission?.appendOnly !== true) {
    failures.push("actor-device contract must define CorrectionApplyAdmission with trusted device, evidenceRefs, admissionDecisionRef, and append-only.");
  }
  if (actorDevice.productionBrowserAuthPolicy?.primaryPath !== "Cookie + CSRF" ||
      actorDevice.productionBrowserAuthPolicy?.browserBearerPrimaryPathAllowed !== false ||
      actorDevice.productionBrowserAuthPolicy?.priorHeaderPrimaryPathAllowed !== false) {
    failures.push("production browser auth policy must keep Cookie + CSRF as primary path and forbid Bearer/header primary browser path.");
  }
  const requiredActions = [
    "production_confirm",
    "payment_confirmation",
    "deposit_refund",
    "period_close",
    "bulk_import",
    "correction_apply",
    "release_state_change",
    "business_signoff",
    "management_cockpit_decision_that_affects_execution",
    "shared_receipt_that_affects_block_or_risk"
  ];
  const actions = new Set(actorDevice.highRiskActionMatrix?.actions ?? []);
  for (const action of requiredActions) {
    if (!actions.has(action)) failures.push(`high-risk action matrix missing action: ${action}`);
  }
}

function checkRuntimeImplementation(failures) {
  const admissionSource = read("services/core-api/WorkOS.Api/Runtime/AdmissionKernelService.cs");
  for (const term of [
    "AdmissionKernelService",
    "EvaluateConfirm",
    "EvaluateSearch",
    "ProductionAllowed",
    "ConfirmAllowed",
    "BusinessLineAdmissionRegistry",
    "production_blocked",
    "contract_preview",
    "VerifiedDeviceTrustContext",
    "HighRiskActionMatrix",
    "high_risk_reason_required",
    "high_risk_evidence_refs_required",
    "trusted_device_unverified"
  ]) {
    if (!admissionSource.includes(term)) failures.push(`AdmissionKernelService.cs missing ${term}.`);
  }
  for (const term of [
    "MissingAdmissionPolicy",
    "MissingAdmissionContract",
    "missing_admission_contract"
  ]) {
    if (!admissionSource.includes(term)) failures.push(`AdmissionKernelService.cs missing missing admission runtime guard: ${term}.`);
  }
  if (admissionSource.includes("BlockProductionOnly")) {
    failures.push("AdmissionKernelService must not allow unresolved definition confirm through BlockProductionOnly.");
  }
  if (!/!definition\.Resolved[\s\S]*AdmissionKernelDecision\.Blocked/.test(admissionSource)) {
    failures.push("Unresolved WorkItem Definition must be blocked before confirm reaches Unit of Work.");
  }
  if (!/definition_not_resolved_for_production_confirm/.test(admissionSource)) {
    failures.push("Unresolved definition admission must expose definition_not_resolved_for_production_confirm no-go item.");
  }
  if (!admissionSource.includes("docs/oam/current-admission-state.json")) {
    failures.push("AdmissionKernelService must cite the current OAM admission state.");
  }

  const operationsRuntime = read("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs");
  const createRequest = recordBody(operationsRuntime, "CreateWorkItemRequest");
  if (!createRequest) {
    failures.push("OperationsRuntimeService.cs must define CreateWorkItemRequest.");
  }
  for (const forbidden of ["Admission", "AdmissionDecisionRef"]) {
    if (createRequest.includes(forbidden)) {
      failures.push(`CreateWorkItemRequest must not accept client-supplied ${forbidden}.`);
    }
  }
  if (operationsRuntime.includes("request.Admission") || operationsRuntime.includes("request.AdmissionDecisionRef")) {
    failures.push("OperationsRuntimeService.CreateWorkItem must not persist client-supplied admission.");
  }
  const confirmRequest = recordBody(operationsRuntime, "ConfirmWorkItemRequest");
  if (!confirmRequest) {
    failures.push("OperationsRuntimeService.cs must define ConfirmWorkItemRequest.");
  }
  for (const forbidden of ["Admission", "AdmissionDecisionRef", "ConfirmAllowed", "ProductionAllowed", "Capability", "PolicyRef", "TrustedDevice", "DeviceTrustStatus", "Surface"]) {
    if (confirmRequest.includes(forbidden)) {
      failures.push(`ConfirmWorkItemRequest must not accept client-supplied ${forbidden}.`);
    }
  }
  const operationsEndpoints = read("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeEndpoints.cs");
  for (const forbidden of ["request.Surface", "request.DeviceTrustStatus", "request.TrustedDevice"]) {
    if (operationsEndpoints.includes(forbidden)) {
      failures.push(`OperationsRuntimeEndpoints.cs must not use client-supplied trust/admission field ${forbidden}.`);
    }
  }

  const canonical = read("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs");
  for (const term of [
    "admission.EvaluateConfirm",
    "AdmissionRejected",
    "[\"admission\"]",
    "[\"admissionDecisionRef\"]",
    "VerifiedDeviceTrustContext.FromServerSession",
    "catalog.FindDeviceSession",
    "HighRiskReason",
    "DeviceTrustStatus",
    "EvidenceIds"
  ]) {
    if (!canonical.includes(term)) failures.push(`CanonicalOperationsApiService.cs missing Admission Kernel binding: ${term}.`);
  }
  const unresolvedGate = canonical.indexOf("if (!definition.Resolved)");
  const resolveIndex = canonical.indexOf("var definition = definitions.Resolve(workItem);");
  const admissionIndex = canonical.indexOf("var admissionDecision = admission.EvaluateConfirm(");
  const commandIndex = canonical.indexOf("var command = new OperationsCommandRequest(");
  const commitIndex = canonical.indexOf("var commit = unitOfWork.Commit(command)");
  const transitionIndex = canonical.indexOf("catalog.RecordWorkItemTransition(");
  const dispatchIndex = canonical.indexOf("DispatchNextOperationWorkItem(");
  if ([resolveIndex, unresolvedGate, admissionIndex, commandIndex, commitIndex, transitionIndex, dispatchIndex].some((index) => index < 0)) {
    failures.push("CanonicalOperationsApiService.cs cannot find definition resolve, unresolved gate, admission, command, commit, transition, or dispatch statement.");
  } else if (!(resolveIndex < unresolvedGate &&
      unresolvedGate < admissionIndex &&
      admissionIndex < commandIndex &&
      commandIndex < commitIndex &&
      commitIndex < transitionIndex &&
      transitionIndex < dispatchIndex)) {
    failures.push("CanonicalOperationsApiService.cs must resolve definition, hard-gate unresolved, then evaluate admission, command, commit, transition, and dispatch in that order.");
  }
  if (canonical.includes("definitions.Resolve(workItem, normalized.CardId)")) {
    failures.push("CanonicalOperationsApiService.cs must not resolve business definition from normalized.CardId.");
  }
  if (canonical.includes("FirstNonEmpty(definition.DefinitionId")) {
    failures.push("CanonicalOperationsApiService.cs must not fall back from definition.DefinitionId to workItemType for command definition identity.");
  }
  if (!canonical.includes("StatusCodes.Status422UnprocessableEntity") || !admissionSource.includes("definition_not_resolved_for_production_confirm")) {
    failures.push("Unresolved definition hard gate must return 422 AdmissionRejected with definition_not_resolved_for_production_confirm.");
  }
  const dispatchMethod = methodBody(canonical, "DispatchNextOperationWorkItem");
  if (dispatchMethod.includes("WorkspaceSeedCatalog") || dispatchMethod.includes("OperationBranchResolver.NextCardId")) {
    failures.push("DispatchNextOperationWorkItem must use generated transition policy, not WorkspaceSeedCatalog or OperationBranchResolver.NextCardId.");
  }
  if (!dispatchMethod.includes("GeneratedTransitionPolicy.ResolveNext")) {
    failures.push("DispatchNextOperationWorkItem must delegate downstream WorkItem selection to GeneratedTransitionPolicy.");
  }
  if (canonical.includes("VerifiedDeviceTrustContext.FromRequest")) {
    failures.push("CanonicalOperationsApiService.cs must not trust request.DeviceTrustStatus for VerifiedDeviceTrustContext.");
  }
  if (!canonical.includes("definitions.ResolveStartAdapter") || canonical.includes("GeneratedP0StartDefinitionId")) {
    failures.push("CanonicalOperationsApiService must use the server-side Start Adapter Map instead of hard-coded P0 start fallback.");
  }

  const definitionRegistry = read("services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs");
  if (/public\s+string\?\s+SourceCardId/.test(definitionRegistry) || /SourceCardId\s*\?\?/.test(definitionRegistry)) {
    failures.push("WorkItemDefinitionRegistryService must not promote top-level sourceCardId into definition resolution.");
  }
  if (!definitionRegistry.includes("StartAdapterDefinitionIds") || !definitionRegistry.includes("ResolveStartAdapter")) {
    failures.push("WorkItemDefinitionRegistryService must expose a server-side Start Adapter Map for Search/Start admission.");
  }
  const startAdapterResolver = methodBody(definitionRegistry, "ResolveStartAdapter");
  if (startAdapterResolver.includes("ResolveByWorkspaceCard") || startAdapterResolver.includes("FindBySourceCardId")) {
    failures.push("ResolveStartAdapter must not fallback to nonCurrent workspace/card or sourceCardId definition resolution.");
  }
  if (!startAdapterResolver.includes("start_adapter_not_registered")) {
    failures.push("ResolveStartAdapter must hard-unresolve unmapped workspace/card inputs as start_adapter_not_registered.");
  }
  validateStartAdapterMaps(definitionRegistry, definitionRegistryContract, failures);
  for (const definition of definitionRegistryContract.definitions || []) {
    if ("sourceCardId" in definition) {
      failures.push(`${definition.definitionId} must preserve sourceCardId only as read-only migrationRefs.`);
    }
  }
  const migrationSourceCard = propertyBody(definitionRegistry, "MigrationSourceCardId");
  if (!migrationSourceCard.includes("MigrationRefs?.FirstOrDefault")) {
    failures.push("MigrationSourceCardId must be derived only from read-only migrationRefs.");
  }

  const correctionModels = read("services/core-api/WorkOS.Api/Runtime/CorrectionCenterModels.cs");
  for (const term of ["EvidenceRefs", "AdmissionDecisionRef", "DeviceTrustStatus", "Surface"]) {
    if (!correctionModels.includes(term)) failures.push(`CorrectionCenterModels.cs missing high-risk apply context: ${term}.`);
  }
  const correctionStorage = read("services/core-api/WorkOS.Api/Runtime/RuntimeCorrectionCenterStorage.cs");
  for (const term of ["correction.apply", "requireEvidenceAndAdmission: true", "AdmissionDecisionRef", "EvidenceRefs"]) {
    if (!correctionStorage.includes(term)) failures.push(`RuntimeCorrectionCenterStorage.cs missing CorrectionApplyAdmission guard: ${term}.`);
  }

  const actorAuth = read("services/core-api/WorkOS.Api/Runtime/RuntimeActorAuthentication.cs");
  for (const term of ["ProductionBrowserAuthPolicy", "PrimarySessionPath", "cookie+csrf", "ApiBearerSource", "PriorHeaderSource"]) {
    if (!actorAuth.includes(term)) failures.push(`RuntimeActorAuthentication.cs missing production browser auth policy token: ${term}.`);
  }
  if (actorAuth.includes('source = "bearer"') || actorAuth.includes('source = "prior-header"')) {
    failures.push("RuntimeActorAuthentication must not label Bearer/prior header as production browser auth source.");
  }

  const searchKernel = read("services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs");
  if (!searchKernel.includes("admission.EvaluateSearch")) {
    failures.push("SearchKernelService must label search results through Admission Kernel.");
  }
  if (!searchKernel.includes("definitions.ResolveStartAdapter")) {
    failures.push("SearchKernelService must resolve active command admission through the server-side Start Adapter Map.");
  }

  const releasePolicy = read("services/core-api/WorkOS.Api/Runtime/ReleaseAdmissionPolicy.cs");
  for (const term of [
    "CanEnableProductionConfirm",
    "CanPromoteDormitoryL2",
    "business_production_blocked_by_current_admission_state",
    "dormitory_l2_blocked_by_current_admission_state",
    "production_confirm_blocked_by_current_admission_state"
  ]) {
    if (!releasePolicy.includes(term)) failures.push(`ReleaseAdmissionPolicy.cs missing release admission lock: ${term}.`);
  }
  if (!/canEnableProductionConfirm\s*=\s*canLock[\s\S]*ProductionConfirmAllowed[\s\S]*BusinessProduction\.Equals\("BLOCKED"/.test(releasePolicy)) {
    failures.push("CanEnableProductionConfirm must be false while current-admission-state blocks production.");
  }
  if (!/canPromoteDormitoryL2\s*=\s*canLock[\s\S]*BusinessProduction\.Equals\("BLOCKED"[\s\S]*DormitoryProduction\.Equals\("BLOCKED"/.test(releasePolicy)) {
    failures.push("CanPromoteDormitoryL2 must be false while current-admission-state blocks Dormitory L2.");
  }
}

function validateStartAdapterMaps(registrySource, registryContract, failures) {
  const startMap = parseCSharpStringMap(registrySource, "StartAdapterDefinitionIds");
  const routeMap = parseCSharpStringMap(registrySource, "StartUiRouteDefinitionKeys");
  if (startMap.size === 0) {
    failures.push("StartAdapterDefinitionIds must not be empty.");
  }
  const definitionsById = new Map((registryContract.definitions || []).map((item) => [item.definitionId, item]));
  for (const [key, definitionId] of startMap.entries()) {
    const [workspaceId, cardId] = splitStartAdapterKey(key);
    const definition = definitionsById.get(definitionId);
    if (!definition) {
      failures.push(`StartAdapterDefinitionIds ${key} references missing definition ${definitionId}.`);
      continue;
    }
    if (definition.definitionMode !== "oam-certification-current") {
      failures.push(`StartAdapterDefinitionIds ${key} must reference oam-certification-current definition, actual ${definition.definitionMode}.`);
    }
    if (definition.workspaceId !== workspaceId) {
      failures.push(`StartAdapterDefinitionIds ${key} workspaceId must match registry ${definition.workspaceId}.`);
    }
    const migrationRef = (definition.migrationRefs || []).find((item) => item.type === "sourceCardId");
    if (!migrationRef || migrationRef.value !== cardId) {
      failures.push(`StartAdapterDefinitionIds ${key} sourceCardId must match registry migrationRefs.sourceCardId.`);
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
      if (migrationRef[field] !== expected) {
        failures.push(`StartAdapterDefinitionIds ${key} migrationRef.${field} must be ${expected}.`);
      }
    }
  }
  if (routeMap.size === 0) {
    failures.push("StartUiRouteDefinitionKeys must bind UI route inputs to current registry keys.");
  }
  for (const [routeKey, currentKey] of routeMap.entries()) {
    if (String(currentKey).startsWith("definition.")) {
      failures.push(`StartUiRouteDefinitionKeys ${routeKey} must point to a current registry key, not a definitionId.`);
    }
    if (!startMap.has(currentKey)) {
      failures.push(`StartUiRouteDefinitionKeys ${routeKey} points to unknown StartAdapterDefinitionIds key ${currentKey}.`);
    }
  }
}

function checkMissingAdmissionFallbackImplementation(failures) {
  const surface = read("apps/mobile/src/admissionSurface.js");
  const search = read("apps/mobile/src/searchIntentHub.js");
  const searchView = read("apps/mobile/src/views/searchView.js");
  if (surface.includes("prepareAllowed: value.prepareAllowed !== false")) {
    failures.push("normalizeAdmissionState must not default missing prepareAllowed to true.");
  }
  if (!/function\s+missingAdmissionState[\s\S]*prepareAllowed:\s*false[\s\S]*confirmAllowed:\s*false[\s\S]*productionAllowed:\s*false[\s\S]*missing_admission_contract/.test(surface)) {
    failures.push("admissionSurface.js must define missingAdmissionState with prepare/confirm/production all false.");
  }
  if (!/if\s*\(!hasExplicitAdmission\)\s*return\s+missingAdmissionState/.test(surface)) {
    failures.push("admissionStateFromWorkItem must use missingAdmissionState when no explicit admission is present.");
  }
  if (!search.includes("missingAdmissionState") || /prepareAllowed:\s*true[\s\S]{0,160}confirmAllowed:\s*true/.test(search)) {
    failures.push("searchIntentHub.js missing admission fallback must not infer prepareAllowed/confirmAllowed.");
  }
  if (searchView.includes("runtimeStore?.commandAdmission") ||
      searchView.includes("businessLineAdmission?.dormitoryCommandAdmission")) {
    failures.push("Search active commands must not consume local runtimeStore/businessLine command admission.");
  }
  if (!/source\s*===\s*"SearchKernelService"/.test(searchView) ||
      !/admissionDecisionRef[\s\S]{0,260}item\.admission/.test(searchView)) {
    failures.push("Search active commands must require a backend SearchKernelService admission envelope with admissionDecisionRef.");
  }
  const operationTests = read("apps/mobile/src/__tests__/OperationActionStateContract.test.js");
  const searchTests = read("apps/mobile/src/__tests__/SearchIntentHubContract.test.js");
  if (!operationTests.includes("does not bind submit when a Surface card has no Admission contract")) {
    failures.push("Surface missing admission negative test is required.");
  }
  if (!searchTests.includes("keeps Search items without Admission contract readonly")) {
    failures.push("Search missing admission negative test is required.");
  }
  const runtimeTests = read("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs");
  if (!runtimeTests.includes("operations_confirm_blocks_missing_admission_policy_before_unit_of_work")) {
    failures.push("Runtime missing admission negative test is required.");
  }
  if (!searchTests.includes("keeps active commands readonly when no backend Search Kernel admission exists")) {
    failures.push("Search command admission negative test must prove local command admission is ignored.");
  }
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(fullPath, "utf8");
}

function methodBody(source, methodName) {
  const markers = [
    `private WorkItemDefinitionResolution ${methodName}(`,
    `public WorkItemDefinitionResolution ${methodName}(`,
    `private static WorkItemDefinitionResolution ${methodName}(`,
    `public static WorkItemDefinitionResolution ${methodName}(`,
    `private void ${methodName}(`,
    `public void ${methodName}(`,
    `private static void ${methodName}(`,
    `public static void ${methodName}(`
  ];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? -1;
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

function propertyBody(source, propertyName) {
  const marker = `public string ${propertyName} =>`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const end = source.indexOf(";", start);
  return end < 0 ? source.slice(start) : source.slice(start, end + 1);
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

function recordBody(source, recordName) {
  const marker = `public sealed record ${recordName}(`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const end = source.indexOf(");", start);
  return end < 0 ? "" : source.slice(start, end + 2);
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}
