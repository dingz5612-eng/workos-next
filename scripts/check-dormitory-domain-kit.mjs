import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dormRoot = path.join(root, "docs/business/dormitory");
const requiredFiles = [
  "north-star.md",
  "metrics-tree.yml",
  "value-streams.yml",
  "workitem-catalog.yml",
  "workitem-sla.yml",
  "workitem-raci.yml",
  "evidence-policy.yml",
  "evidence-requirements.yml",
  "finance-control-rules.yml",
  "risk-command-rules.yml",
  "lens-map.yml",
  "certification-scenarios.json",
  "go-no-go.yml"
];

const requiredValueStreamFields = [
  "id",
  "name",
  "中文名称",
  "startEvent",
  "endState",
  "businessObjects",
  "factOwners",
  "workItemTypes",
  "requiredEvidence",
  "ledgerImpact",
  "lensOutputs",
  "risks",
  "SLA",
  "ownerRole",
  "escalationRole",
  "certificationScenario",
  "trainingScenario",
  "goNoGoCriteria"
];

const requiredWorkItems = [
  "Dorm.ResourceSetup",
  "Dorm.RoomReadinessCheck",
  "Dorm.BedAvailabilityConfirm",
  "Dorm.LeadFollowup",
  "Dorm.ReservationConfirm",
  "Dorm.CheckinPrepare",
  "Dorm.CheckinConfirm",
  "Dorm.BedAssignmentConfirm",
  "Dorm.ChargeGenerate",
  "Dorm.PaymentRegister",
  "Dorm.PaymentConfirm",
  "Dorm.DepositAssess",
  "Dorm.DepositReceive",
  "Dorm.DepositConfirm",
  "Dorm.ServiceTaskCreate",
  "Dorm.ServiceTaskComplete",
  "Dorm.RoomInspection",
  "Dorm.CheckoutSettlement",
  "Dorm.DepositDeduct",
  "Dorm.RefundApprove",
  "Dorm.ResourceRelease",
  "Dorm.PeriodReview",
  "Dorm.ExceptionResolve"
];

const requiredWorkItemFields = [
  "workItemType",
  "中文名称",
  "ownerRole",
  "backupOwner",
  "escalationOwner",
  "SLA",
  "requiredEvidence",
  "affectedFacts",
  "ledgerImpact",
  "confirmationPolicy",
  "riskLevel",
  "idempotencyScope",
  "factTraceRequired",
  "lensOutputs",
  "certificationScenario"
];

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(dormRoot, file)), `Missing Dormitory file: ${file}`);
}

const northStar = fs.readFileSync(path.join(dormRoot, "north-star.md"), "utf8");
for (const phrase of ["CommandSubmission", "DomainEvent", "LedgerTransaction", "deposit", "production-ready"]) {
  assert(northStar.includes(phrase), `north-star.md must mention ${phrase}`);
}

const metrics = readStructured("metrics-tree.yml");
assert(metrics.northStarMetric?.id === "trusted_available_bed_nights", "metrics-tree must declare trusted_available_bed_nights");
assert((metrics.metricTree ?? []).length >= 5, "metrics-tree must cover the five Dormitory value streams");
assert(metrics.productionAllowed === false, "Dormitory metrics must not allow production in B1");

const valueStreams = readStructured("value-streams.yml").valueStreams ?? [];
assert(valueStreams.length === 5, "Dormitory must define exactly five value streams");
for (const stream of valueStreams) {
  for (const field of requiredValueStreamFields) {
    assert(present(stream[field]), `Value stream ${stream.id ?? "<missing>"} missing ${field}`);
  }
}

const catalog = readStructured("workitem-catalog.yml");
const workItems = catalog.workItems ?? [];
const workItemTypes = new Set(workItems.map((item) => item.workItemType));
for (const type of requiredWorkItems) {
  assert(workItemTypes.has(type), `WorkItem catalog missing ${type}`);
}
for (const item of workItems) {
  for (const field of requiredWorkItemFields) {
    assert(present(item[field]), `WorkItem ${item.workItemType ?? "<missing>"} missing ${field}`);
  }
  assert(item.factTraceRequired === true, `WorkItem ${item.workItemType} must require FactTrace`);
}

const evidence = readStructured("evidence-policy.yml");
for (const binding of ["requirementId", "workItemId", "submissionId", "tenantId", "evidenceHash"]) {
  assert((evidence.bindingRules ?? []).includes(binding), `Evidence policy missing binding ${binding}`);
}
assert(evidence.missingEvidenceBlocksConfirm === true, "Missing evidence must block confirm");
assert(evidence.rejectedEvidenceBlocksConfirm === true, "Rejected evidence must block confirm");

const finance = readStructured("finance-control-rules.yml");
const financeText = JSON.stringify(finance).toLowerCase();
assert(financeText.includes("deposit is liability"), "Finance rules must state deposit is liability");
assert(!financeText.includes("deposit is revenue"), "Finance rules must not treat deposit as revenue");
assert(financeText.includes("balanced"), "Finance rules must require balanced ledger transactions");
assert(financeText.includes("immutable"), "Finance rules must require immutable ledger entries");

const risk = readStructured("risk-command-rules.yml");
for (const statusCode of [403, 409, 422]) {
  assert((risk.riskRules ?? []).some((item) => item.httpStatus === statusCode), `Risk rules missing ${statusCode}`);
}

const scenarios = JSON.parse(fs.readFileSync(path.join(dormRoot, "certification-scenarios.json"), "utf8"));
assert((scenarios.scenarios ?? []).length === 10, "Dormitory B1 certification scenarios must define ten dorm-cert scenarios");
assert(scenarios.productionAllowed === false, "Dormitory scenarios must not allow production in B1");

console.log("Dormitory Domain Kit check: PASS");

function readStructured(file) {
  return JSON.parse(fs.readFileSync(path.join(dormRoot, file), "utf8"));
}

function present(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
