import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = "schemas/authority/truth-ownership-matrix.schema.json";
const contractPath = "docs/contracts/authority/truth-ownership-matrix.contract.json";
const registryPath = "docs/business/truth-owner-registry.yml";
const resultPath = "artifacts/oam/checks/truth-ownership-matrix-result.json";
const violations = [];

const schema = readJson(schemaPath);
const contract = readJson(contractPath);
const registry = readJson(registryPath);
const registryOwners = new Map((registry.truthOwners ?? []).map((item) => [item.factId, item]));
const requiredChain = ["AmountBasisProposal", "AmountBasisReviewed", "AmountBasis", "FinancialFact", "LedgerTransaction", "LedgerEntry"];

if (schema.$id !== "workosnext.authority.truth-ownership-matrix.schema.v1") {
  fail("truth_matrix.schema_id", `${schemaPath} $id mismatch.`);
}
for (const field of ["version", "status", "architecture", "matrixId", "truthOwners", "financeStateChain", "readSideBoundaries"]) {
  if (!(schema.required ?? []).includes(field)) fail("truth_matrix.schema_required", `${schemaPath} must require ${field}.`);
}
for (const [field, expected] of Object.entries({
  version: "workosnext.authority.truth-ownership-matrix.v1",
  status: "authoritative-current-no-go",
  architecture: "oam.current"
})) {
  if (contract[field] !== expected) fail("truth_matrix.contract_identity", `${contractPath} ${field} mismatch.`);
}
requirePath(contract.truthOwnerRegistryRef, "truthOwnerRegistryRef");
if (JSON.stringify(contract.financeStateChain) !== JSON.stringify(requiredChain)) {
  fail("truth_matrix.finance_chain", "Finance state chain must be AmountBasisProposal -> AmountBasisReviewed -> AmountBasis -> FinancialFact -> LedgerTransaction -> LedgerEntry.");
}
for (const factId of requiredChain) {
  const owner = registryOwners.get(factId);
  if (!owner) {
    fail("truth_matrix.registry_fact_missing", `${registryPath} missing ${factId}.`);
    continue;
  }
  if (["FinancialFact", "LedgerTransaction", "LedgerEntry"].includes(factId) && owner.truthLevel !== "centerTruth") {
    fail("truth_matrix.center_truth_missing", `${factId} must remain centerTruth.`);
  }
  if (["LedgerTransaction", "LedgerEntry"].includes(factId) && owner.owner !== "MoneyKernelPack") {
    fail("truth_matrix.money_owner_drift", `${factId} must be owned by MoneyKernelPack.`);
  }
}
for (const readSide of ["SearchResult", "LensReadModel", "DashboardSummary", "SharedReceipt"]) {
  if (!(contract.readSideBoundaries ?? []).includes(readSide)) {
    fail("truth_matrix.read_side_missing", `Missing read-side boundary ${readSide}.`);
  }
}
if (contract.readSideFinanceTruthAllowed !== false || contract.nonOwnerCommitAllowed !== false) {
  fail("truth_matrix.boundary_drift", "Read side finance truth and non-owner commits must remain forbidden.");
}

writeResult();
if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Truth ownership matrix check: PASS");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function requirePath(file, label) {
  if (!file || !fs.existsSync(path.join(root, file))) fail("truth_matrix.path_missing", `${label} references missing path: ${file}`);
}

function fail(id, message) {
  violations.push({ id, message });
}

function writeResult() {
  fs.mkdirSync(path.dirname(path.join(root, resultPath)), { recursive: true });
  fs.writeFileSync(path.join(root, resultPath), `${JSON.stringify({
    version: "workosnext.authority.truth-ownership-matrix-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    violations
  }, null, 2)}\n`);
}
