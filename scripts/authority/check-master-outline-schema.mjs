import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = "schemas/authority/master-outline.schema.json";
const contractPath = "docs/contracts/authority/master-outline.contract.json";
const resultPath = "artifacts/oam/checks/master-outline-schema-result.json";
const violations = [];

const schema = readJson(schemaPath);
const contract = readJson(contractPath);

requireSchema(schema, "workosnext.authority.master-outline.schema.v1", [
  "version",
  "status",
  "architecture",
  "outlineId",
  "authorityRefs",
  "businessProduction",
  "dormitoryL2",
  "productionConfirmAllowed",
  "finalGoNoGo",
  "nextStageAllowed",
  "businessLineLevels"
]);
requireContract(contract, {
  version: "workosnext.authority.master-outline.v1",
  status: "authoritative-current-no-go",
  architecture: "oam.current"
});

for (const [field, expected] of Object.entries({
  businessProduction: "BLOCKED",
  dormitoryL2: "BLOCKED",
  productionConfirmAllowed: false,
  finalGoNoGo: "NO_GO",
  nextStageAllowed: false
})) {
  if (contract[field] !== expected) fail("master_outline.lock_drift", `${field} must remain ${expected}.`);
}

for (const ref of contract.authorityRefs ?? []) requirePath(ref, "authorityRefs");
const levelValues = new Set((contract.businessLineLevels ?? []).map((level) => level.machineValue));
for (const required of ["L0_CONTRACT_PREVIEW", "L1_INTERNAL_PILOT", "L2_PRODUCTION"]) {
  if (!levelValues.has(required)) fail("master_outline.level_missing", `Missing business line level ${required}.`);
}
for (const retired of ["business-3", "business-4", "business-5", "business-6", "business-7"]) {
  if (!(contract.retiredRegistryTerms ?? []).includes(retired)) {
    fail("master_outline.retired_term_missing", `Missing retired registry term ${retired}.`);
  }
}

writeResult();
if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Master outline authority check: PASS");

function requireSchema(doc, id, required) {
  if (doc.$id !== id) fail("master_outline.schema_id", `${schemaPath} $id mismatch.`);
  for (const field of required) {
    if (!(doc.required ?? []).includes(field)) fail("master_outline.schema_required", `${schemaPath} must require ${field}.`);
  }
}

function requireContract(doc, expected) {
  for (const [field, value] of Object.entries(expected)) {
    if (doc[field] !== value) fail("master_outline.contract_identity", `${contractPath} ${field} mismatch.`);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function requirePath(file, label) {
  if (!fs.existsSync(path.join(root, file))) fail("master_outline.path_missing", `${label} references missing path: ${file}`);
}

function fail(id, message) {
  violations.push({ id, message });
}

function writeResult() {
  fs.mkdirSync(path.dirname(path.join(root, resultPath)), { recursive: true });
  fs.writeFileSync(path.join(root, resultPath), `${JSON.stringify({
    version: "workosnext.authority.master-outline-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    violations
  }, null, 2)}\n`);
}
