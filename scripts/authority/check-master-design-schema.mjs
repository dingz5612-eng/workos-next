import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = "schemas/authority/master-design.schema.json";
const contractPath = "docs/contracts/authority/master-design.contract.json";
const resultPath = "artifacts/oam/checks/master-design-schema-result.json";
const violations = [];

const schema = readJson(schemaPath);
const contract = readJson(contractPath);
const expectedOrder = [
  "catalog.GetWorkItem",
  "definitions.Resolve(workItem)",
  "unresolved 422 reject",
  "VerifiedDeviceTrustContext.FromServerSession",
  "admission.EvaluateConfirm",
  "OperationsCommandRequest",
  "unitOfWork.Commit",
  "RecordWorkItemTransition",
  "DispatchNextOperationWorkItem"
];

if (schema.$id !== "workosnext.authority.master-design.schema.v1") fail("master_design.schema_id", `${schemaPath} $id mismatch.`);
for (const field of ["version", "status", "architecture", "designId", "authorityRefs", "canonicalConfirmOrder", "blockedMutationClasses", "releaseLocks"]) {
  if (!(schema.required ?? []).includes(field)) fail("master_design.schema_required", `${schemaPath} must require ${field}.`);
}
for (const [field, expected] of Object.entries({
  version: "workosnext.authority.master-design.v1",
  status: "authoritative-current-no-go",
  architecture: "oam.current"
})) {
  if (contract[field] !== expected) fail("master_design.contract_identity", `${contractPath} ${field} mismatch.`);
}
for (const ref of contract.authorityRefs ?? []) requirePath(ref, "authorityRefs");
if (JSON.stringify(contract.canonicalConfirmOrder) !== JSON.stringify(expectedOrder)) {
  fail("master_design.confirm_order", "Canonical confirm order drifted.");
}
for (const mutationClass of ["UnitOfWork", "CommandSubmission", "DomainEvent", "WorkItemEvent", "LedgerTransaction", "LedgerEntry", "Outbox", "confirmed transition", "next work item", "projection", "lens", "search", "WriteLog"]) {
  if (!(contract.blockedMutationClasses ?? []).includes(mutationClass)) {
    fail("master_design.blocked_mutation_missing", `Missing blocked mutation class ${mutationClass}.`);
  }
}
for (const [field, expected] of Object.entries({
  businessProduction: "BLOCKED",
  dormitoryL2: "BLOCKED",
  productionConfirmAllowed: false,
  finalGoNoGo: "NO_GO",
  nextStageAllowed: false
})) {
  if (contract.releaseLocks?.[field] !== expected) fail("master_design.release_lock_drift", `releaseLocks.${field} must remain ${expected}.`);
}

writeResult();
if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Master design authority check: PASS");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function requirePath(file, label) {
  if (!fs.existsSync(path.join(root, file))) fail("master_design.path_missing", `${label} references missing path: ${file}`);
}

function fail(id, message) {
  violations.push({ id, message });
}

function writeResult() {
  fs.mkdirSync(path.dirname(path.join(root, resultPath)), { recursive: true });
  fs.writeFileSync(path.join(root, resultPath), `${JSON.stringify({
    version: "workosnext.authority.master-design-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    violations
  }, null, 2)}\n`);
}
