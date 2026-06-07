import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = "docs/oam/system-handoff-contract.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const resultPath = "artifacts/oam/checks/system-handoff-contract-result.json";
const requiredFlow = [
  "Surface",
  "Admission",
  "Definition",
  "OperationCase",
  "WorkItem",
  "CommandSubmission",
  "UnitOfWork",
  "DomainEventOrLedgerEntry",
  "EvidenceFactTrace",
  "Outbox",
  "ProjectionLensSearch",
  "ReadSideSurface",
  "NextWorkItemOrDecision"
];
const requiredGroups = [
  "readonlyFields",
  "editableFields",
  "idempotencyFields",
  "evidenceFields",
  "projectionVersionFields",
  "failureFields"
];
const violations = [];
const contract = readJson(contractPath);
const graph = readJson(graphPath);

if (contract.version !== "oam.system-handoff-contract.v1" || contract.status !== "authoritative") {
  fail("handoff_identity_invalid", "系统 handoff 合同必须声明 oam.system-handoff-contract.v1 authoritative。");
}
if (contract.architecture !== "oam.current") {
  fail("handoff_architecture_invalid", "系统 handoff 合同必须绑定 oam.current。");
}
if (JSON.stringify(contract.flow ?? []) !== JSON.stringify(requiredFlow)) {
  fail("handoff_flow_invalid", "系统 handoff 流程必须覆盖 Surface 到 NextWorkItemOrDecision 的完整链路。");
}
for (const group of requiredGroups) {
  if (!Array.isArray(contract[group]) || contract[group].length === 0) {
    fail("handoff_group_missing", `系统 handoff 合同缺少 ${group}。`);
  }
}
for (const field of ["definitionId", "workItemId", "confirmedFacts"]) {
  if (!(contract.readonlyFields ?? []).includes(field)) {
    fail("handoff_locked_field_missing", `上游锁定字段缺少 ${field}。`);
  }
}
for (const field of ["idempotencyKey", "submissionId", "payloadHash"]) {
  if (!(contract.idempotencyFields ?? []).includes(field)) {
    fail("handoff_idempotency_field_missing", `幂等字段缺少 ${field}。`);
  }
}
for (const field of ["evidenceRefs", "admissionDecisionRef", "factTraceRef"]) {
  if (!(contract.evidenceFields ?? []).includes(field)) {
    fail("handoff_evidence_field_missing", `证据字段缺少 ${field}。`);
  }
}
if (!contract.lockedFieldPolicy?.includes("只读")) {
  fail("handoff_locked_policy_missing", "系统 handoff 必须声明上游已确认字段只读。");
}
if (!contract.missingFieldPolicy?.includes("阻断")) {
  fail("handoff_missing_policy_not_blocking", "系统 handoff 必须声明缺字段阻断 confirm。");
}
requirePath(contract.dormitoryImplementation, "宿舍领域 handoff 实现");
if (!graph.nodes?.some((node) => node.nodeId === "contract.handoff")) {
  fail("handoff_graph_node_missing", "OAM 图谱缺少 handoff 合同节点。");
}

writeResult();

if (violations.length) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log("System handoff contract check: PASS");

function readJson(file) {
  requirePath(file, file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function requirePath(file, label) {
  if (!file || !fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.system-handoff-contract-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
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
