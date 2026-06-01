import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const policyRoot = path.join(root, "docs/business/policies");
const policyFiles = [
  "evidence-policy.yml",
  "admission-policy.yml",
  "surface-policy.yml",
  "finance-policy.yml",
  "truth-owner-policy.yml",
  "permission-policy.yml",
  "cutover-policy.yml",
  "invariant-policy.yml"
];

const selfTest = process.argv.includes("--self-test");

assertFile("schemas/policy.schema.json");
const index = readJson("docs/business/policies/policy-index.yml");
for (const file of policyFiles) {
  assert((index.policies ?? []).includes(file), `policy-index.yml missing ${file}`);
  validatePolicy(readJson(path.join(policyRoot, file)), file);
}

const evidencePolicy = readJson("docs/business/dormitory/evidence-policy.yml");
assert(evidencePolicy.runtimeBinding?.loader === "DormitoryEvidencePolicyLoader", "Dormitory evidence policy must bind DormitoryEvidencePolicyLoader");
assert(evidencePolicy.runtimeBinding?.evaluator === "EvidencePolicyEvaluator", "Dormitory evidence policy must bind EvidencePolicyEvaluator");
assert(evidencePolicy.missingEvidenceBlocksConfirm === true, "missingEvidenceBlocksConfirm must be true");
assert(evidencePolicy.rejectedEvidenceBlocksConfirm === true, "rejectedEvidenceBlocksConfirm must be true");
assert(evidencePolicy.wrongScopeEvidenceBlocksConfirm === true, "wrongScopeEvidenceBlocksConfirm must be true");
assert((evidencePolicy.bindingRules ?? []).includes("workItemId"), "Evidence policy must bind workItemId");
assert((evidencePolicy.bindingRules ?? []).includes("submissionId"), "Evidence policy must bind submissionId");
assert((evidencePolicy.requirements ?? []).every(item => item.requirementId && (item.workItemTypes ?? []).length > 0), "Every evidence requirement must bind workItemTypes");

const depositMissing = evaluateEvidence(evidencePolicy, {
  workItemType: "Dorm.DepositConfirm",
  tenantId: "tenant-dormitory",
  workItemId: "wi-001",
  submissionId: "sub-001",
  evidenceRefs: []
});
assert(depositMissing.code === "missing_required_evidence", "Policy file must block missing Dorm.DepositConfirm evidence");

const depositRejected = evaluateEvidence(evidencePolicy, {
  workItemType: "Dorm.DepositConfirm",
  tenantId: "tenant-dormitory",
  workItemId: "wi-001",
  submissionId: "sub-001",
  evidenceRefs: [
    evidence("receipt-proof", "tenant-dormitory", "wi-001", "sub-001", "rejected"),
    evidence("deposit-policy", "tenant-dormitory", "wi-001", "sub-001", "verified")
  ]
});
assert(depositRejected.code === "rejected_evidence_blocks_confirm", "Policy file must block rejected evidence");

const depositWrongScope = evaluateEvidence(evidencePolicy, {
  workItemType: "Dorm.DepositConfirm",
  tenantId: "tenant-dormitory",
  workItemId: "wi-001",
  submissionId: "sub-001",
  evidenceRefs: [
    evidence("receipt-proof", "tenant-dormitory", "wi-other", "sub-001", "verified"),
    evidence("deposit-policy", "tenant-dormitory", "wi-001", "sub-001", "verified")
  ]
});
assert(depositWrongScope.code === "wrong_scope_evidence_blocks_confirm", "Policy file must block wrong-scope evidence");

const editedPolicy = structuredClone(evidencePolicy);
editedPolicy.missingEvidenceBlocksConfirm = false;
const editedDecision = evaluateEvidence(editedPolicy, {
  workItemType: "Dorm.DepositConfirm",
  tenantId: "tenant-dormitory",
  workItemId: "wi-001",
  submissionId: "sub-001",
  evidenceRefs: []
});
assert(editedDecision.allowed === true, "Changing evidence-policy.yml flags must change evaluator behavior");

execFileSync("node", ["scripts/check-admission-surface-alignment.mjs"], { cwd: root, stdio: "inherit" });

const financePolicy = readJson("docs/business/policies/finance-policy.yml");
assert(financePolicy.rules.businessDomainDirectLedgerEntryAllowed === false, "Finance policy must block direct LedgerEntry");
assert(financePolicy.rules.depositAsRevenueAllowed === false, "Finance policy must block deposit-as-revenue");

const truthPolicy = readJson("docs/business/policies/truth-owner-policy.yml");
assert(truthPolicy.rules.requiredOwners.PaymentFact === "FinanceTruthPack", "Truth owner policy must bind PaymentFact to FinanceTruthPack");
assert((truthPolicy.rules.centralTruthFacts ?? []).includes("Subject"), "Truth owner policy must include Subject central truth");

const permissionPolicy = readJson("docs/business/policies/permission-policy.yml");
assert(permissionPolicy.rules.highRiskRequiresCapability === true, "Permission policy must require high-risk capability");
assert(permissionPolicy.rules.highRiskRequiresTrustedDevice === true, "Permission policy must require trusted device");

const cutoverPolicy = readJson("docs/business/policies/cutover-policy.yml");
assert(cutoverPolicy.rules.redShadowBlocksActiveLocked === true, "Cutover policy must block red shadow active/locked");
assert(cutoverPolicy.rules.missingRollbackBlocksActiveLocked === true, "Cutover policy must block missing rollback");

for (const token of [
  "PolicyLoader",
  "PolicyEvaluator",
  "EvidencePolicyEvaluator",
  "AdmissionPolicyEvaluator",
  "SurfacePolicyEvaluator",
  "FinancePolicyEvaluator",
  "TruthOwnerPolicyEvaluator",
  "PermissionPolicyEvaluator",
  "CutoverPolicyEvaluator"
]) {
  assert(sourceContains("services/core-api/WorkOS.Api/Runtime/BusinessPolicy/PolicyAsCode.cs", token), `Runtime policy source missing ${token}`);
}

assertFile("tests/WorkOS.PolicyAsCodeTests/WorkOS.PolicyAsCodeTests.csproj");
assert(sourceContains("tests/WorkOS.PolicyAsCodeTests/PolicyAsCodeTests.cs", "EvidencePolicyFileDrivesRuntimeBehavior"), "PolicyAsCodeTests must cover evidence policy behavior");
assert(sourceContains(".github/workflows/ci.yml", "check-policy-as-code.mjs"), "CI must run check-policy-as-code.mjs");
assert(sourceContains(".github/workflows/ci.yml", "WorkOS.PolicyAsCodeTests"), "CI must run WorkOS.PolicyAsCodeTests");

if (selfTest) {
  const badPolicy = structuredClone(evidencePolicy);
  badPolicy.rejectedEvidenceBlocksConfirm = false;
  const decision = evaluateEvidence(badPolicy, {
    workItemType: "Dorm.DepositConfirm",
    tenantId: "tenant-dormitory",
    workItemId: "wi-001",
    submissionId: "sub-001",
    evidenceRefs: [
      evidence("receipt-proof", "tenant-dormitory", "wi-001", "sub-001", "rejected"),
      evidence("deposit-policy", "tenant-dormitory", "wi-001", "sub-001", "verified")
    ]
  });
  assert(decision.allowed === true, "self-test must prove policy flag changes behavior");
  console.log("Policy-as-code self-test: PASS");
} else {
  console.log("Policy-as-code check: PASS");
}

function validatePolicy(policy, file) {
  for (const field of ["policyId", "policyType", "version", "owner", "runtimeBinding", "rules", "gateBinding"]) {
    assert(policy[field] !== undefined, `${file} missing ${field}`);
  }
  assert(policy.runtimeBinding.loader, `${file} missing runtimeBinding.loader`);
  assert(policy.runtimeBinding.evaluator, `${file} missing runtimeBinding.evaluator`);
  assert(policy.gateBinding.gateInput, `${file} missing gateBinding.gateInput`);
  assert(policy.gateBinding.failureSeverity, `${file} missing gateBinding.failureSeverity`);
}

function evaluateEvidence(policy, request) {
  const required = (policy.requirements ?? [])
    .filter(item => (item.workItemTypes ?? []).includes(request.workItemType))
    .map(item => item.requirementId);
  const refs = request.evidenceRefs ?? [];
  const missing = required.filter(id => !refs.some(ref => ref.requirementId === id));
  if (missing.length > 0 && policy.missingEvidenceBlocksConfirm === true) {
    return { allowed: false, code: "missing_required_evidence" };
  }
  const rejected = refs.filter(ref => required.includes(ref.requirementId) && ref.status === "rejected");
  if (rejected.length > 0 && policy.rejectedEvidenceBlocksConfirm === true) {
    return { allowed: false, code: "rejected_evidence_blocks_confirm" };
  }
  const wrongScope = refs.filter(ref =>
    required.includes(ref.requirementId) &&
    (ref.tenantId !== request.tenantId || ref.workItemId !== request.workItemId || ref.submissionId !== request.submissionId));
  if (wrongScope.length > 0 && policy.wrongScopeEvidenceBlocksConfirm === true) {
    return { allowed: false, code: "wrong_scope_evidence_blocks_confirm" };
  }
  return { allowed: true, code: "evidence_accepted" };
}

function evidence(requirementId, tenantId, workItemId, submissionId, status) {
  return { requirementId, tenantId, workItemId, submissionId, status };
}

function readJson(file) {
  assertFile(file);
  return JSON.parse(fs.readFileSync(path.resolve(root, file), "utf8"));
}

function assertFile(file) {
  assert(fs.existsSync(path.resolve(root, file)), `Missing file: ${file}`);
}

function sourceContains(file, token) {
  assertFile(file);
  return fs.readFileSync(path.resolve(root, file), "utf8").includes(token);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
