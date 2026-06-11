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

if (selfTest) {
  const badState = { ...currentState, businessProduction: "OPEN" };
  const badFailures = runChecks({ currentState: badState });
  if (!badFailures.some((item) => item.includes("businessProduction"))) {
    throw new Error("Admission Kernel self-test did not detect opened production state.");
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
  checkContract(failures);
  checkSources(failures);
  checkCurrentState(context.currentState, failures);
  checkMatrix(context.currentState, failures);
  checkBusinessLineAlignment(failures);
  checkHighRiskSurfaceReasons(failures);
  checkHighRiskTrustClosure(failures);
  checkRuntimeImplementation(failures);
  return failures;
}

function checkContract(failures) {
  if (contract.version !== "oam.admission-contract.v1") failures.push("admission-contract version mismatch.");
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
    if (!contract.outputFields?.[field]) failures.push(`admission-contract missing output field: ${field}`);
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
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(fullPath, "utf8");
}

function methodBody(source, methodName) {
  const markers = [
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

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}
