import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Date().toISOString();

const template = readJson("docs/golden-domain/factory/domain-replication-template.yml");
const referencePack = readJson("docs/golden-domain/dormitory/reference-pack.yml");
const negative = readJson("docs/golden-domain/dormitory/negative-scenarios.yml");
const checklist = readJson("docs/golden-domain/dormitory/copy-to-next-domain-checklist.yml");

const failures = [];
const requiredSections = [
  "Domain Pack 模板",
  "Scenario Field Contract 模板",
  "Canonical Scenario Map 模板",
  "Evidence Policy 模板",
  "Ledger Posting Contract 模板",
  "Metric Formula Contract 模板",
  "Runtime Proof 模板",
  "Surface Contract 模板",
  "Finance Semantic 模板",
  "Trust Boundary 模板",
  "Observation SLO 模板",
  "Negative Scenario Library",
  "Next-domain Promotion Checklist"
];
const requiredNegativeIds = [
  "neg-out-of-scope-room-confirm",
  "neg-out-of-scope-user-confirm",
  "neg-unknown-device-high-risk-money-confirm",
  "neg-wrong-scope-evidence-confirm",
  "neg-deposit-as-revenue-attempt",
  "neg-refund-over-liability-attempt",
  "neg-duplicate-idempotency-key-different-payload",
  "neg-period-close-disabled-attempt",
  "neg-repair-production-confirm-attempt",
  "neg-parts-production-confirm-attempt",
  "neg-mobile-route-release-control-attempt",
  "neg-retired-route-without-workitem",
  "neg-manual-gateresult-passed-attempt",
  "neg-direct-ledger-entry-mutation-attempt"
];

assertFalse(template.productionAllowed, "replication template 不得允许 production。");
assertFalse(template.autoPromotionAllowed, "replication template 不得允许自动 promotion。");
assertFalse(referencePack.productionAllowed, "reference pack 不得允许 production。");
assertFalse(referencePack.l2ProductionAllowed, "reference pack 不得允许 L2。");
assertFalse(referencePack.businessProductionAllowed, "reference pack 不得允许 Business Production。");
assertFalse(referencePack.repairPartsHrProductionAllowed, "reference pack 不得允许 Repair / Parts / HR production。");
assertFalse(checklist.productionAllowed, "copy checklist 不得允许 production。");
assertFalse(checklist.autoPromotionAllowed, "copy checklist 不得允许自动 promotion。");

const sectionNames = new Set((referencePack.sections ?? []).map((item) => item.name));
for (const section of requiredSections) {
  assertTrue(sectionNames.has(section), `reference pack 缺少 section：${section}`);
}

for (const section of referencePack.sections ?? []) {
  assertPresent(section.ref, `reference pack section ${section.name} 缺少 ref。`);
  assertExists(section.ref, `reference pack section ${section.name} ref 不存在：${section.ref}`);
}

for (const consumer of referencePack.consumers ?? []) {
  assertEqual(consumer.allowedUse, "template_read_only", `${consumer.businessLine} 只能读取模板。`);
  assertEqual(consumer.maturity, "L0 Contract Preview", `${consumer.businessLine} 必须保持 L0。`);
}

const negativeById = new Map((negative.scenarios ?? []).map((item) => [item.id, item]));
for (const id of requiredNegativeIds) {
  const scenario = negativeById.get(id);
  assertTrue(Boolean(scenario), `negative scenario 缺失：${id}`);
  assertPresent(scenario?.owner, `negative scenario ${id} 缺少 owner。`);
  assertPresent(scenario?.nextAction, `negative scenario ${id} 缺少 nextAction。`);
  assertPresent(scenario?.auditRef, `negative scenario ${id} 缺少 auditRef。`);
  assertTrue(isBlockedStatus(scenario?.expectedStatus), `negative scenario ${id} 必须是 blocked / 403 / 409 / 422。`);
}

const defaultExpected = negative.defaultExpected ?? {};
assertFalse(defaultExpected.domainEventAllowed, "negative scenarios 不得允许 DomainEvent。");
assertFalse(defaultExpected.ledgerTransactionAllowed, "negative scenarios 不得允许 LedgerTransaction。");
assertTrue(defaultExpected.requiresRejectionTraceOrGateResult === true, "negative scenarios 必须要求 RejectionTrace 或 GateResult。");
assertTrue(defaultExpected.requiresVisibleNextAction === true, "negative scenarios 必须有 visible nextAction。");
assertTrue(defaultExpected.requiresOwner === true, "negative scenarios 必须有 owner。");
assertTrue(defaultExpected.requiresAuditRef === true, "negative scenarios 必须有 auditRef。");

for (const item of checklist.requiredBeforeNextDomainStage ?? []) {
  assertPresent(item, "copy checklist 不得包含空项。");
}
assertTrue((checklist.forbidden ?? []).some((item) => item.includes("Repair / Parts / HR")), "copy checklist 必须禁止 Repair / Parts / HR 被放开。");

const result = {
  generated_at_utc: generatedAt,
  generated_by: "check-domain-replication-pack",
  stage: "OAM-08",
  status: failures.length === 0 ? "passed" : "failed",
  businessLine: "Dormitory",
  productionAllowed: false,
  l2ProductionAllowed: false,
  businessProductionAllowed: false,
  goldenDomainReplication: "READY_FOR_NEXT_DOMAIN_CANDIDATE",
  referenceSectionCount: (referencePack.sections ?? []).length,
  negativeScenarioCount: (negative.scenarios ?? []).length,
  consumerStates: referencePack.consumers,
  noGoItems: failures,
  evidenceRefs: [
    "docs/golden-domain/factory/domain-replication-template.yml",
    "docs/golden-domain/dormitory/reference-pack.yml",
    "docs/golden-domain/dormitory/negative-scenarios.yml",
    "docs/golden-domain/dormitory/copy-to-next-domain-checklist.yml"
  ]
};
writeJson("artifacts/golden-domain/dormitory/golden-pack-result.json", result);

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("OAM-08 golden domain replication pack failed.");
}

console.log("OAM-08 golden domain replication pack: PASS");

function isBlockedStatus(status) {
  return [403, 409, 422, "blocked", "blocked_gate", "blocked_db"].includes(status);
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing required file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertExists(relativePath, message) {
  if (!fs.existsSync(path.join(root, relativePath))) failures.push(message);
}

function assertTrue(condition, message) {
  if (!condition) failures.push(message);
}

function assertFalse(value, message) {
  if (value !== false) failures.push(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) failures.push(`${message} actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

function assertPresent(value, message) {
  if (value === undefined || value === null || value === "") failures.push(message);
}
