import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = "docs/contracts/evidence/evidence-graph-refs-contract.json";
const alignmentReportPath = "artifacts/oam/checks/company-kernel-alignment-result.json";
const reportPath = "artifacts/oam/checks/evidence-contract-refs-result.json";
const alignmentRefs = [
  "docs/oam/current-architecture.md",
  "docs/oam/current-authority-index.json",
  "docs/contracts/oam.current.json",
  "docs/oam/current-architecture.manifest.json",
  "docs/system/current-system-map.md",
  "docs/contracts/oam-responsibility-boundary-matrix.json",
  "docs/contracts/business/oam-business-object-field-registry.json",
  "docs/contracts/business/oam-workflow-state-registry.json",
  "docs/contracts/database/oam-db-ownership-map.json",
  "docs/system/oam-p0-rule-ledger.json"
];
const violations = [];

for (const ref of alignmentRefs) {
  requirePath(ref, `公司内核对齐引用 ${ref}`);
}
writeAlignmentReport();

const contract = readJson(contractPath);
if (contract.version !== "oam.evidence-graph-refs-contract.v1" || contract.status !== "authoritative-evidence-contract") {
  fail("evidence_contract_identity_invalid", "证据引用合同必须声明 oam.evidence-graph-refs-contract.v1 authoritative-evidence-contract。");
}

for (const ref of contract.requiredRefs ?? []) {
  requirePath(ref, `证据合同 requiredRef ${ref}`, { allowGeneratedEvidence: true });
}

if (contract.businessFactWriteAllowed !== false) {
  fail("evidence_contract_business_write", "证据合同不得允许业务事实写入。");
}
if (contract.appendOnlyEvidenceRequired !== true) {
  fail("evidence_contract_append_only_missing", "证据合同必须要求追加式证据。");
}

writeReport();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("Evidence contract refs check: PASS");

function writeAlignmentReport() {
  const report = {
    checkedAt: new Date().toISOString(),
    architecture: "oam.current",
    status: "pass",
    kernel: "company-kernel-alignment",
    alignedRefs: alignmentRefs,
    closure: {
      currentAuthority: "docs/oam/current-authority-index.json",
      responsibilityBoundary: "docs/contracts/oam-responsibility-boundary-matrix.json",
      businessObjects: "docs/contracts/business/oam-business-object-field-registry.json",
      workflowStates: "docs/contracts/business/oam-workflow-state-registry.json",
      databaseOwnership: "docs/contracts/database/oam-db-ownership-map.json",
      p0ReleaseKernel: "docs/system/oam-p0-rule-ledger.json"
    }
  };
  writeJson(alignmentReportPath, report);
}

function readJson(file) {
  requirePath(file, file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function requirePath(file, label, options = {}) {
  if (options.allowGeneratedEvidence && isGeneratedEvidencePath(file)) {
    return;
  }
  if (!fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function isGeneratedEvidencePath(file) {
  return typeof file === "string" && (
    file.startsWith("artifacts/oam/evidence/") ||
    file.startsWith("artifacts/oam/checks/") ||
    file.startsWith("artifacts/oam/test-results/") ||
    file === "artifacts/oam/final-report.json"
  );
}

function writeReport() {
  writeJson(reportPath, {
    checkedAt: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "fail" : "pass",
    checkedContract: contractPath,
    alignmentReport: alignmentReportPath,
    violations
  });
}

function writeJson(file, value) {
  const full = abs(file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(value, null, 2));
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function abs(file) {
  return path.join(root, file);
}
