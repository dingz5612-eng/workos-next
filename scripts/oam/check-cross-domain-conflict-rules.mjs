import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rulesPath = "docs/oam/current-oam-cross-domain-conflict-rules.json";
const financePath = "docs/finance/finance-ledger-kernel.json";
const compilerPath = "docs/oam/compiler-generated-contract-kernel.json";
const identityPath = "docs/identity/identity-permission-kernel.json";
const resultPath = "artifacts/oam/checks/cross-domain-conflict-rules-result.json";
const violations = [];
const document = readJson(rulesPath);
const finance = readJson(financePath);
const compiler = readJson(compilerPath);
const identity = readJson(identityPath);
const rules = document.rules ?? [];
const byConflict = new Map(rules.map((rule) => [rule.conflict, rule]));
const expected = [
  ["business write", "Operations Runtime"],
  ["field display", "generated surface model"],
  ["search result", "generated read model"],
  ["KPI", "sourceFacts lineage"],
  ["ledger write", "Finance / Ledger Kernel"],
  ["permission", "Identity / Permission Kernel"],
  ["release GO", "latest SHA + CI run id + artifact digest + final report digest"],
  ["Codex scope expansion", "00 总控"],
  ["any P0", "NO_GO"]
];

if (document.version !== "oam.current-cross-domain-conflict-rules.v1" || document.status !== "authoritative") {
  fail("conflict_rules_identity", "Cross-domain conflict rules must be authoritative oam.current-cross-domain-conflict-rules.v1.");
}
if (document.accountable !== "00-OAM-Total-Control") {
  fail("conflict_rules_accountable", "Cross-domain conflict rules must be accountable to 00.");
}
for (const [conflict, resolution] of expected) {
  const rule = byConflict.get(conflict);
  if (!rule) {
    fail("conflict_rule_missing", `Missing conflict rule: ${conflict}.`);
    continue;
  }
  if (rule.resolution !== resolution) {
    fail("conflict_rule_resolution", `${conflict} must resolve to ${resolution}, actual ${rule.resolution}.`);
  }
  if (rule.goNoGoOnViolation !== "NO_GO") {
    fail("conflict_rule_no_go", `${conflict} must force NO_GO on violation.`);
  }
}
const releaseRule = byConflict.get("release GO");
for (const field of ["latest SHA", "CI run id", "artifact digest", "final report digest"]) {
  if (!(releaseRule?.requiredEvidence ?? []).includes(field)) {
    fail("release_go_evidence_missing", `release GO must require ${field}.`);
  }
}
if (document.evidenceGraphPolicy?.replacesOamKernelGraph !== false || document.evidenceGraphPolicy?.evidenceGraphProofOnly !== true) {
  fail("evidence_graph_replaces_oam_kernel_graph", "Evidence Graph must not replace OAM Kernel Graph.");
}
checkFinanceTruth();
checkGeneratedContracts();
checkIdentityPermission();

writeResult();

if (violations.length > 0) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log(`Cross-domain conflict rules check: PASS (${rules.length} rules)`);

function checkFinanceTruth() {
  const statements = finance.statements ?? {};
  if (statements.dormitoryBusinessBasisIsNotFinanceTruth !== true) {
    fail("finance_truth_dormitory_basis", "Dormitory business basis is not finance truth must be declared.");
  }
  if (statements.sharedReceiptIsNotFinanceTruth !== true) {
    fail("finance_truth_shared_receipt", "SharedReceipt is not finance truth must be declared.");
  }
  if (statements.dashboardSummaryIsNotFinanceTruth !== true) {
    fail("finance_truth_dashboard_summary", "DashboardSummary is not finance truth must be declared.");
  }
  if (statements.ledgerEntryMustPassFinanceLedgerKernel !== true) {
    fail("ledger_entry_finance_kernel", "LedgerEntry must pass Finance / Ledger Kernel.");
  }
  const modes = finance.ledgerEffect?.mode ?? [];
  for (const mode of ["none", "basis_only", "finance_kernel"]) {
    if (!modes.includes(mode)) {
      fail("ledger_effect_mode_missing", `ledgerEffect.mode missing ${mode}.`);
    }
  }
  for (const owner of ["Dormitory business basis", "SharedReceipt", "DashboardSummary", "Data / KPI", "Control Plane"]) {
    if (!(finance.forbiddenFinanceTruthOwners ?? []).includes(owner)) {
      fail("finance_forbidden_owner_missing", `Finance truth must not be owned by ${owner}.`);
    }
  }
}

function checkGeneratedContracts() {
  if (compiler.generatedFiles?.sourceTruthAllowed !== false) {
    fail("generated_source_truth", "Generated file must not be marked as source truth.");
  }
  if (compiler.generatedFiles?.manualEditAllowed !== false) {
    fail("generated_manual_edit", "Generated files must forbid manual edit.");
  }
  const metadata = compiler.generatedFiles?.requiredMetadata ?? {};
  for (const key of ["generated", "doNotEdit", "kernelGraphHash", "sourceNodeRefs", "generatorVersion", "generatedFrom"]) {
    if (!(key in metadata)) {
      fail("generated_metadata_missing", `Generated contract metadata missing ${key}.`);
    }
  }
}

function checkIdentityPermission() {
  const objects = identity.domainObjects ?? [];
  for (const item of ["Subject", "Actor", "Account", "Role", "Capability", "PermissionEnvelope", "DeviceSession", "TenantMatch", "Relationship"]) {
    if (!objects.includes(item)) {
      fail("identity_object_missing", `Identity / Permission Kernel missing ${item}.`);
    }
  }
  if (identity.forbidden?.requestSelfReportedDeviceTrustStatus !== true) {
    fail("self_reported_device_trust_allowed", "Request self-reported deviceTrustStatus must be forbidden.");
  }
  if (identity.forbidden?.tenantMatchedFixedTrue !== true) {
    fail("tenant_matched_fixed_true_allowed", "TenantMatched fixed true must be forbidden.");
  }
  if (identity.required?.permissionEnvelopeRequiredForReadSideOutputs !== true) {
    fail("permission_envelope_required", "PermissionEnvelope is required for read-side outputs.");
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.cross-domain-conflict-rules-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    ruleCount: rules.length,
    violationCount: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function abs(file) {
  return path.join(root, file);
}
