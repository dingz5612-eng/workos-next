import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = "docs/oam/system-change-governance-contract.json";
const authorityPath = "docs/oam/current-authority-index.json";
const systemKernelPath = "docs/oam/system-operating-kernel.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const releaseGatePath = "scripts/oam/run-control-plane-checks.ps1";
const ciPath = ".github/workflows/ci.yml";
const resultPath = "artifacts/oam/checks/system-change-governance-result.json";
const requiredChangeTypes = [
  "field",
  "workItem",
  "databaseTable",
  "api",
  "lens",
  "metric",
  "evidenceType",
  "ledgerPath",
  "surfaceEntry",
  "deletedFile",
  "replacementFile",
  "derivedContract",
  "test",
  "gate"
];
const requiredPipelineZh = [
  "变更识别",
  "迭代登记",
  "系统/领域内核",
  "OAM 图谱",
  "派生合同",
  "运行实现",
  "门禁",
  "测试",
  "证据根",
  "发布"
];

const violations = [];
const contract = readJson(contractPath);
const authority = readJson(authorityPath);
const systemKernel = readJson(systemKernelPath);
const graph = readJson(graphPath);
const releaseGate = readText(releaseGatePath);
const ci = readText(ciPath);

requireValue(contract.version === "oam.system-change-governance-contract.v1", "change_governance_version", "系统变更治理合同版本必须为 oam.system-change-governance-contract.v1。");
requireValue(contract.status === "authoritative" && contract.architecture === "oam.current", "change_governance_identity", "系统变更治理合同必须绑定 authoritative + oam.current。");
for (const [field, expected] of Object.entries({
  authorityEntry: authorityPath,
  systemKernel: systemKernelPath,
  oamGraph: graphPath,
  lifecyclePolicy: "docs/oam/file-lifecycle-policy.json",
  engineeringLedger: "docs/oam/current-engineering-ledger.json",
  iterationKernel: "docs/oam/iteration-kernel.json",
  releaseGate: releaseGatePath,
  ciWorkflow: ciPath
})) {
  requireValue(contract[field] === expected, "change_governance_path_mismatch", `${field} 必须指向 ${expected}。`);
  requirePath(expected, `${field}`);
}

for (const changeType of requiredChangeTypes) {
  requireValue((contract.requiredChangeTypes ?? []).includes(changeType), "change_type_missing", `系统变更治理缺少变更类型：${changeType}。`);
}
for (const stage of requiredPipelineZh) {
  requireValue((contract.requiredPipelineZh ?? []).includes(stage), "pipeline_stage_missing", `系统变更治理缺少流程阶段：${stage}。`);
}
for (const rule of contract.rules ?? []) {
  for (const field of ["ruleId", "severity", "blocksRelease", "descriptionZh"]) {
    requireValue(rule[field] !== undefined && rule[field] !== "", "change_rule_field_missing", `${rule.ruleId ?? "<missing>"} 缺少 ${field}。`);
  }
  requireValue(rule.severity === "P0", "change_rule_not_p0", `${rule.ruleId} 必须是 P0。`);
  requireValue(rule.blocksRelease === true, "change_rule_not_blocking", `${rule.ruleId} 必须 blocksRelease=true。`);
}
requireValue(contract.failurePolicy?.defaultDecision === "NO_GO", "change_failure_policy_default", "系统变更治理失败默认必须是 NO_GO。");
requireValue(contract.failurePolicy?.failClosed === true, "change_failure_policy_fail_closed", "系统变更治理必须 failClosed=true。");

const authorityEntries = new Map((authority.entries ?? []).map((entry) => [entry.path, entry]));
const authorityEntry = authorityEntries.get(contractPath);
requireValue(Boolean(authorityEntry), "change_governance_authority_entry_missing", "current-authority-index 必须登记系统变更治理合同。");
requireValue(authorityEntry?.currentTruthAllowed === true, "change_governance_truth_not_allowed", "系统变更治理合同必须允许定义当前治理事实。");
requireValue(authorityEntry?.checker === "scripts/oam/check-system-change-governance.mjs", "change_governance_checker_mismatch", "系统变更治理合同的 checker 必须是自身检查器。");

const systemKernelIds = new Set((systemKernel.kernels ?? []).map((kernel) => kernel.kernelId));
requireValue(systemKernelIds.has("kernel.change-governance"), "system_kernel_change_governance_missing", "system-operating-kernel 必须登记 kernel.change-governance。");
const graphNodeIds = new Set((graph.nodes ?? []).map((node) => node.nodeId));
for (const nodeId of [
  "kernel.change-governance",
  `file.${contractPath}`,
  "file.scripts/oam/check-system-change-governance.mjs"
]) {
  requireValue(graphNodeIds.has(nodeId), "change_governance_graph_node_missing", `OAM 图谱缺少节点：${nodeId}。`);
}

for (const gate of contract.requiredGates ?? []) {
  requirePath(gate, `required gate ${gate}`, { allowEvidence: true });
  if (gate.startsWith("scripts/")) {
    requireValue(releaseGate.includes(gate), "change_gate_not_in_local_total_gate", `本地总门禁未接入：${gate}。`);
    requireValue(ci.includes(gate), "change_gate_not_in_ci", `CI 未接入：${gate}。`);
  }
}

writeResult();
if (violations.length) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log("System change governance check: PASS");

function readJson(file) {
  requirePath(file, file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function readText(file) {
  requirePath(file, file);
  return fs.existsSync(abs(file)) ? fs.readFileSync(abs(file), "utf8") : "";
}

function requirePath(file, label, options = {}) {
  if (options.allowEvidence && String(file).startsWith("artifacts/oam/")) return;
  if (!file || !fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function requireValue(condition, id, message) {
  if (!condition) fail(id, message);
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.system-change-governance-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    requiredChangeTypeCount: requiredChangeTypes.length,
    requiredPipelineStageCount: requiredPipelineZh.length,
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
