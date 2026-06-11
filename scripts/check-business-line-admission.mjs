import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const admissionRoot = path.join(root, "docs/business/admission");
const registryPath = path.join(root, "docs/business/business-line-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const lines = registry.businessLines ?? [];
const l0Lines = lines.filter(line => line.businessLineId !== "dormitory" && line.level === "L0 Contract Preview");
const admissionFiles = l0Lines.map(line => `${line.businessLineId}-l0-admission.yml`);
const expectedAdmissionIds = new Set(l0Lines.map(line => line.businessLineId));
const discoveredAdmissionIds = fs.readdirSync(admissionRoot)
  .filter(file => file.endsWith("-l0-admission.yml"))
  .map(file => file.replace("-l0-admission.yml", ""));

for (const id of discoveredAdmissionIds) {
  assert(expectedAdmissionIds.has(id), `Unregistered L0 admission file must be removed or registered: ${id}`);
}

const levels = read("business-line-levels.yml");
const gate = read("business-line-gate.yml");
for (const level of ["L0 Contract Preview", "L1 Internal Pilot", "L2 Production", "L3 Scaled Operation"]) {
  assert((levels.levels ?? []).some(item => item.level === level), `Missing business line level ${level}`);
}
for (const machineValue of ["L0_CONTRACT_PREVIEW", "L1_INTERNAL_PILOT", "L2_PRODUCTION", "L3_SCALED_OPERATION"]) {
  assert((levels.levels ?? []).some(item => item.machineValue === machineValue), `Missing business line level machineValue ${machineValue}`);
}
assert(levels.currentLocks?.businessProduction === "BLOCKED", "Business Production must remain BLOCKED in business line levels");
assert(levels.currentLocks?.dormitoryL2 === "BLOCKED", "Dormitory L2 must remain BLOCKED in business line levels");
assert(levels.currentLocks?.productionConfirmAllowed === false, "production_confirm must remain blocked in business line levels");
assert(levels.currentLocks?.finalGoNoGo === "NO_GO", "business line levels finalGoNoGo must remain NO_GO");
assert(levels.currentLocks?.nextStageAllowed === false, "business line levels nextStageAllowed must remain false");

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
  const businessLineId = file.replace("-l0-admission.yml", "");
  const admission = read(file);
  assert(admission.businessLineId === businessLineId, `${file} must declare businessLineId=${businessLineId}`);
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

const expectedContracts = {
  repair: {
    scopes: ["Repair.Request", "Repair.MasterData", "Repair.Dispatch", "Repair.Close"],
    boundaries: ["customer", "vehicle", "serviceOrder", "technician", "parts", "warranty", "payment"]
  },
  parts: {
    scopes: ["Parts.MasterData", "Parts.Inventory", "Parts.Sale", "Parts.Return", "Parts.Purchase"],
    boundaries: ["stock movement", "payment", "refund", "cost", "revenue"]
  },
  hr: {
    scopes: ["HR.MasterData", "HR.Recruiting", "HR.Onboarding", "HR.Attendance", "HR.Payroll"],
    boundaries: ["employee", "contract", "attendance", "payroll", "expense", "permission"]
  }
};

for (const [businessLineId, expected] of Object.entries(expectedContracts)) {
  if (!expectedAdmissionIds.has(businessLineId)) {
    continue;
  }

  const admission = read(`${businessLineId}-l0-admission.yml`);
  for (const scope of expected.scopes) {
    assert(admission.domainScopes.includes(scope), `${businessLineId} L0 missing ${scope}`);
  }

  for (const boundary of expected.boundaries) {
    assert(admission.boundaries.includes(boundary), `${businessLineId} L0 missing boundary ${boundary}`);
  }
}

for (const id of ["dormitory", "repair", "parts", "hr"]) {
  assert(lines.some(line => line.businessLineId === id), `Business line registry missing ${id}`);
}
for (const line of lines) {
  assert(line.productionAllowed === false, `${line.businessLineId} must keep productionAllowed=false before Central Merge Train and DORM-INT`);
  assert(line.productionConfirmAllowed === false, `${line.businessLineId} must keep productionConfirmAllowed=false`);
  assert(Array.isArray(line.blockedActions) && line.blockedActions.includes("production_confirm"), `${line.businessLineId} must block production_confirm`);
  if (line.businessLineId !== "dormitory") {
    assert(line.level === "L0 Contract Preview", `${line.businessLineId} must remain L0 Contract Preview`);
    assert(line.surfaceMode === "contract-preview", `${line.businessLineId} must stay contract-preview`);
  }
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
