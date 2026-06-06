import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportPath = "artifacts/oam/checks/runtime-governance-v2-result.json";
const violations = [];

checkAdmissionKernel();
checkRuntimeActorAuthentication();
checkCorrectionCenter();
checkUnitOfWorkTruthOwner();
writeReport();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("Runtime governance v2 check: PASS");

function checkAdmissionKernel() {
  const source = read("services/core-api/WorkOS.Api/Runtime/AdmissionKernelService.cs");
  for (const term of [
    "EvaluateConfirm",
    "RuntimeActorContext actor",
    "VerifiedDeviceTrustContext deviceTrust",
    "BusinessLineAdmissionRegistry",
    "productionRequested",
    "high_risk_reason_required",
    "high_risk_evidence_refs_required",
    "trusted_device_unverified",
    "AdmissionDecisionRef"
  ]) {
    requireTerm(source, term, "admission_kernel_missing", `Admission Kernel 缺少 ${term}。`);
  }
}

function checkRuntimeActorAuthentication() {
  const source = read("services/core-api/WorkOS.Api/Runtime/RuntimeActorAuthentication.cs");
  for (const term of [
    "ProductionBrowserAuthPolicy",
    "PrimarySessionPath",
    "cookie+csrf",
    "CsrfCookieName",
    "HasValidCsrf",
    "ApiBearerSource",
    "PriorHeaderSource",
    "non-browser-actor-token"
  ]) {
    requireTerm(source, term, "actor_auth_missing", `RuntimeActorAuthentication 缺少 ${term}。`);
  }
  if (source.includes('source = "bearer"') || source.includes('source = "prior-header"')) {
    fail("actor_auth_source_ambiguous", "Bearer 或旧 header 路径必须明确标记为非浏览器/API 场景。");
  }
}

function checkCorrectionCenter() {
  const models = read("services/core-api/WorkOS.Api/Runtime/CorrectionCenterModels.cs");
  for (const term of ["EvidenceRefs", "AdmissionDecisionRef", "DeviceTrustStatus", "Surface"]) {
    requireTerm(models, term, "correction_model_missing", `CorrectionCenterModels 缺少 ${term}。`);
  }
  const storage = read("services/core-api/WorkOS.Api/Runtime/RuntimeCorrectionCenterStorage.cs");
  for (const term of [
    "correction.apply",
    "requireEvidenceAndAdmission: true",
    "AdmissionDecisionRef",
    "EvidenceRefs",
    "InsertReversalEntry",
    "InsertCorrectionEntry",
    "InsertCorrectionAudit"
  ]) {
    requireTerm(storage, term, "correction_storage_missing", `RuntimeCorrectionCenterStorage 缺少 ${term}。`);
  }
  const policy = read("services/core-api/WorkOS.Api/Runtime/RuntimeSecurityPolicy.cs");
  for (const term of [
    "ValidateHighRiskOperation",
    "trusted_device_required",
    "reason_required",
    "evidence_refs_required",
    "admission_decision_ref_required"
  ]) {
    requireTerm(policy, term, "runtime_security_policy_missing", `RuntimeSecurityPolicy 缺少 ${term}。`);
  }
}

function checkUnitOfWorkTruthOwner() {
  const source = read("services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs");
  for (const term of [
    "AllowedFacts",
    "ForbiddenFacts",
    "LedgerPolicy",
    "TruthOwnerRef",
    "ValidateDeclaredOutputFacts",
    "ValidateForbiddenOutputFacts",
    "ValidateLedgerPolicy",
    "ValidateLedgerBoundary",
    "EnrichDomainEventPayloads",
    "definitionRef",
    "truthOwnerRef",
    "producedFactIds",
    "LedgerSemanticRules.Validate"
  ]) {
    requireTerm(source, term, "uow_truth_owner_missing", `OperationsUnitOfWork 缺少 ${term}。`);
  }
  const definitionRegistry = read("docs/contracts/definition/workitem-definition-registry.json");
  for (const term of ["allowedFacts", "forbiddenFacts", "ledgerPolicyRef", "admissionPolicyRef", "productionConfirmAllowed"]) {
    requireTerm(definitionRegistry, term, "definition_registry_missing", `Definition Registry 缺少 ${term}。`);
  }
}

function requireTerm(source, term, id, message) {
  if (!source.includes(term)) {
    fail(id, message);
  }
}

function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    fail("path_missing", `路径不存在：${file}`);
    return "";
  }
  return fs.readFileSync(full, "utf8");
}

function writeReport() {
  const full = path.join(root, reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify({
    checkedAt: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "fail" : "pass",
    violations
  }, null, 2));
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}
