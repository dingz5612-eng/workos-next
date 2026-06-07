import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const requiredHandoffFields = [
  "caseId",
  "sourceWorkItemId",
  "leadId",
  "reservationId",
  "stayId",
  "roomId",
  "bedId",
  "ratePlanId",
  "depositId",
  "paymentId",
  "serviceTaskId",
  "expenseId",
  "evidenceRefs",
  "projectionVersion",
  "lockedFields",
  "missingFields",
  "nextWorkItemHints"
];
const derivedFiles = [
  "docs/business/domains/dormitory/handoff-contract.json",
  "docs/business/domains/dormitory/dormitory-release-train.yml",
  "docs/business/domains/dormitory/dormitory-pilot-scenario-pack.yml",
  "docs/business/domains/dormitory/dormitory-seed-data-pack.json",
  "docs/business/domains/dormitory/dormitory-observability-contract.json",
  "docs/business/domains/dormitory/dormitory-pilot-go-no-go.json",
  "docs/business/domains/dormitory/dormitory-operator-playbook.md"
];
const reportPath = "artifacts/oam/checks/dormitory-derived-contracts-result.json";
const violations = [];
const kernel = readJson(kernelPath);
const workItems = kernel.workItems ?? [];

for (const file of derivedFiles) {
  requireValue(fs.existsSync(abs(file)), "derived.file_missing", `缺少宿舍派生文件：${file}`, { file });
  if (file.endsWith(".md") || !fs.existsSync(abs(file))) continue;
  const doc = readJson(file);
  requireDerived(doc, file);
}

const handoff = readJson("docs/business/domains/dormitory/handoff-contract.json");
const handoffFieldIds = new Set((handoff.fields ?? []).map((item) => item.fieldId));
for (const field of requiredHandoffFields) {
  requireValue(handoffFieldIds.has(field), "handoff.field_missing", `handoff 缺少 ${field}。`, { field });
}
requireValue(String(handoff.invariantZh ?? "").includes("自动带入") && String(handoff.invariantZh ?? "").includes("只读"), "handoff.invariant_missing", "handoff 必须证明上游字段自动带入且只读。");

for (const item of workItems) {
  const file = `docs/business/domains/dormitory/workitems/${slug(item.workItemType)}.json`;
  requireValue(fs.existsSync(abs(file)), "workitem.file_missing", `${item.workItemType} 缺少派生操作文件。`, { workItemType: item.workItemType });
  if (!fs.existsSync(abs(file))) continue;
  const doc = readJson(file);
  requireDerived(doc, file);
  for (const field of ["entryFrom", "systemAutoFilled", "operatorFills", "leadApproves", "readonlyFields", "editableFields", "evidenceRequired", "submittedEvent", "ledgerImpact", "lensUpdates", "downstreamWorkItems", "failureRoutes", "tests"]) {
    requireValue(hasValue(doc[field]), "workitem.detail_missing", `${item.workItemType} 操作文件缺少 ${field}。`, { workItemType: item.workItemType, field });
  }
  requireValue((doc.systemAutoFilled ?? []).includes("projectionVersion"), "workitem.projection_version_missing", `${item.workItemType} 必须自动带入 projectionVersion。`, { workItemType: item.workItemType });
  requireValue((doc.readonlyFields ?? []).includes("definitionId"), "workitem.readonly_definition_missing", `${item.workItemType} 必须锁定 definitionId。`, { workItemType: item.workItemType });
  requireValue(!JSON.stringify(doc).includes('"cardId"'), "workitem.card_identity_present", `${item.workItemType} 不得使用 cardId 作为业务身份。`, { workItemType: item.workItemType });
}

const oldViews = [
  "docs/business/dormitory/workitem-catalog.yml",
  "docs/business/dormitory/workitem-decision-table.json",
  "docs/business/dormitory/value-streams.yml",
  "docs/business/dormitory/workitem-sla.yml",
  "docs/business/dormitory/workitem-raci.yml",
  "docs/business/dormitory/go-no-go.yml",
  "docs/business/dormitory/metrics-tree.yml",
  "docs/business/dormitory/metric-formula-contract.yml",
  "docs/business/dormitory/lens-map.yml"
];
for (const file of oldViews) {
  const doc = readJson(file);
  requireDerived(doc, file);
}

writeReport();
if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log(`Dormitory derived contracts check: PASS (${workItems.length} workItem files)`);

function requireDerived(doc, file) {
  requireValue((doc.derivedFrom ?? []).includes(kernelPath), "derived.source_missing", `${file} 必须 derivedFrom 宿舍内核。`, { file });
  requireValue(doc.generatedBy === "scripts/business/generate-dormitory-derived-contracts.mjs", "derived.generator_missing", `${file} generatedBy 不正确。`, { file });
  requireValue(doc.manualEditAllowed === false, "derived.manual_edit_allowed", `${file} 派生文件不得手改。`, { file });
  requireValue(Boolean(doc.sourceKernelVersion), "derived.kernel_version_missing", `${file} 缺少 sourceKernelVersion。`, { file });
  requireValue(Boolean(doc.graphBinding), "derived.graph_binding_missing", `${file} 缺少 graphBinding。`, { file });
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    violations.push({ id: "json_invalid", severity: "P0", message: `${file} 不是合法 JSON：${error.message}` });
    return {};
  }
}

function writeReport() {
  const full = abs(reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.dormitory-derived-contracts-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    violations
  }, null, 2)}\n`);
}

function slug(value) {
  return String(value).replace(/([a-z])([A-Z])/g, "$1-$2").replace(/\./g, "-").replace(/[^A-Za-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function abs(file) {
  return path.join(root, file);
}
