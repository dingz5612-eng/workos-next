import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const admissionRoot = path.join(root, "docs/business/admission");
const admissionFiles = [
  "repair-l0-admission.yml",
  "parts-l0-admission.yml",
  "business-3-l0-admission.yml",
  "business-4-l0-admission.yml",
  "business-5-l0-admission.yml",
  "business-6-l0-admission.yml",
  "business-7-l0-admission.yml"
];

const levels = read("business-line-levels.yml");
const gate = read("business-line-gate.yml");
for (const level of ["L0 Contract Preview", "L1 Pilot", "L2 Production", "L3 Scaled Operation"]) {
  assert((levels.levels ?? []).some(item => item.level === level), `Missing business line level ${level}`);
}

for (const question of [
  "factOwnership",
  "workItemCatalog",
  "evidencePolicy",
  "confirmationAuthority",
  "financeBoundary",
  "exceptionHandling",
  "lensMetrics",
  "auditRecords",
  "rollbackCompensation",
  "certificationScenarios",
  "ownerRole",
  "escalationRole",
  "admissionLevel",
  "productionForbidden",
  "l1EntryConditions"
]) {
  assert((gate.requiredQuestions ?? []).includes(question), `Business line gate missing question ${question}`);
}

for (const file of admissionFiles) {
  const admission = read(file);
  assert(admission.level === "L0 Contract Preview", `${file} must stay L0 Contract Preview`);
  assert(admission.admissionLevel === "L0 Contract Preview", `${file} must declare L0 admission level`);
  assert(admission.productionAllowed === false, `${file} must keep productionAllowed=false`);
  assert(admission.answers?.productionForbidden === true, `${file} must explicitly forbid production`);
  assert(Array.isArray(admission.productionWriteRoutes) && admission.productionWriteRoutes.length === 0, `${file} must not define production write routes`);
  assert(Array.isArray(admission.pageSpecificWriteApis) && admission.pageSpecificWriteApis.length === 0, `${file} must not define page-specific write APIs`);
  assert(Array.isArray(admission.productionWorkItems) && admission.productionWorkItems.length === 0, `${file} must not define production WorkItems`);
  assert(Array.isArray(admission.answers?.l1EntryConditions) && admission.answers.l1EntryConditions.length > 0, `${file} must define L1 entry conditions`);

  const hasConfirm = (admission.confirmActions ?? []).length > 0;
  const hasFactOwners = (admission.factOwners ?? []).length > 0;
  assert(!hasConfirm || hasFactOwners, `${file} cannot define confirm actions without Fact Owner`);
  assert(!hasConfirm, `${file} is L0 and must not define production confirm actions`);
}

const repair = read("repair-l0-admission.yml");
for (const scope of ["Repair.Request", "Repair.MasterData", "Repair.Dispatch", "Repair.Close"]) {
  assert(repair.domainScopes.includes(scope), `Repair L0 missing ${scope}`);
}
for (const boundary of ["customer", "vehicle", "serviceOrder", "technician", "parts", "warranty", "payment"]) {
  assert(repair.boundaries.includes(boundary), `Repair L0 missing boundary ${boundary}`);
}

const parts = read("parts-l0-admission.yml");
for (const scope of ["Parts.MasterData", "Parts.Inventory", "Parts.Sale", "Parts.Return", "Parts.Purchase"]) {
  assert(parts.domainScopes.includes(scope), `Parts L0 missing ${scope}`);
}
for (const boundary of ["stock movement", "payment", "refund", "cost", "revenue"]) {
  assert(parts.boundaries.includes(boundary), `Parts L0 missing boundary ${boundary}`);
}

console.log("Business line admission check: PASS");

function read(file) {
  const fullPath = path.join(admissionRoot, file);
  assert(fs.existsSync(fullPath), `Missing admission file: ${file}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
