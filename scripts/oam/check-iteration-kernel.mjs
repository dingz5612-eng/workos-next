import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const iterationPath = "docs/oam/iteration-kernel.json";
const manualPath = "docs/oam/iteration-kernel.md";
const changeGovernancePath = "docs/oam/system-change-governance-contract.json";
const authorityPath = "docs/oam/current-authority-index.json";
const systemKernelPath = "docs/oam/system-operating-kernel.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const releaseGatePath = "scripts/oam/run-control-plane-checks.ps1";
const ciPath = ".github/workflows/ci.yml";
const resultPath = "artifacts/oam/checks/iteration-kernel-result.json";
const requiredCurrentIterationFields = [
  "iterationId",
  "nameZh",
  "goalZh",
  "scopeInZh",
  "scopeOutZh",
  "entryConditionsZh",
  "exitConditionsZh",
  "serialStagesZh",
  "parallelWorkZh",
  "failureRepairRuleZh",
  "evidenceRequirements",
  "legacyHandlingZh",
  "rollbackPolicyZh",
  "pilotFeedbackZh",
  "nextIterationCarryOverZh"
];

const violations = [];
const iteration = readJson(iterationPath);
const authority = readJson(authorityPath);
const systemKernel = readJson(systemKernelPath);
const graph = readJson(graphPath);
const releaseGate = readText(releaseGatePath);
const ci = readText(ciPath);
const manual = readText(manualPath);

requireValue(iteration.version === "oam.iteration-kernel.v1", "iteration_kernel_version", "迭代内核版本必须为 oam.iteration-kernel.v1。");
requireValue(iteration.status === "authoritative" && iteration.architecture === "oam.current", "iteration_kernel_identity", "迭代内核必须绑定 authoritative + oam.current。");
for (const [field, expected] of Object.entries({
  authorityEntry: authorityPath,
  changeGovernance: changeGovernancePath,
  systemKernel: systemKernelPath,
  oamGraph: graphPath,
  releaseGate: releaseGatePath,
  ciWorkflow: ciPath
})) {
  requireValue(iteration[field] === expected, "iteration_kernel_path_mismatch", `${field} 必须指向 ${expected}。`);
  requirePath(expected, `${field}`);
}

const current = iteration.currentIteration ?? {};
for (const field of requiredCurrentIterationFields) {
  const value = current[field];
  requireValue(value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0), "iteration_current_field_missing", `currentIteration 缺少 ${field}。`);
}
requireValue(String(current.iterationId ?? "") === iteration.currentIteration?.iterationId, "iteration_id_missing", "当前迭代必须声明稳定 iterationId。");
for (const stage of ["冻结本地事实", "建立唯一生效工程总账", "收敛宿舍业务唯一内核", "全量验收与提交"]) {
  requireValue((current.serialStagesZh ?? []).includes(stage), "iteration_serial_stage_missing", `迭代串行阶段缺少：${stage}。`);
}
requireValue(String(current.failureRepairRuleZh ?? "").includes("修复") && String(current.failureRepairRuleZh ?? "").includes("重跑"), "iteration_failure_rule_weak", "失败修复规则必须明确先修复并重跑。");
for (const evidence of current.evidenceRequirements ?? []) {
  requireValue(String(evidence).startsWith("artifacts/oam/"), "iteration_evidence_path_invalid", `迭代证据必须位于 artifacts/oam：${evidence}。`);
}
requireValue(manual.includes("只做人读说明") && manual.includes(iterationPath), "iteration_manual_truth_boundary_missing", "迭代手册必须声明只做人读说明且引用机器内核。");

const authorityEntries = new Map((authority.entries ?? []).map((entry) => [entry.path, entry]));
for (const [file, checker, truthAllowed] of [
  [iterationPath, "scripts/oam/check-iteration-kernel.mjs", true],
  [manualPath, "scripts/oam/check-iteration-kernel.mjs", false]
]) {
  const entry = authorityEntries.get(file);
  requireValue(Boolean(entry), "iteration_authority_entry_missing", `current-authority-index 必须登记：${file}。`);
  requireValue(entry?.checker === checker, "iteration_authority_checker_mismatch", `${file} 的 checker 必须是 ${checker}。`);
  requireValue(entry?.currentTruthAllowed === truthAllowed, "iteration_authority_truth_mismatch", `${file} currentTruthAllowed 不正确。`);
}

const systemKernelIds = new Set((systemKernel.kernels ?? []).map((kernel) => kernel.kernelId));
requireValue(systemKernelIds.has("kernel.iteration-governance"), "system_kernel_iteration_governance_missing", "system-operating-kernel 必须登记 kernel.iteration-governance。");
const graphNodeIds = new Set((graph.nodes ?? []).map((node) => node.nodeId));
for (const nodeId of [
  "kernel.iteration-governance",
  `file.${iterationPath}`,
  `file.${manualPath}`,
  "file.scripts/oam/check-iteration-kernel.mjs"
]) {
  requireValue(graphNodeIds.has(nodeId), "iteration_graph_node_missing", `OAM 图谱缺少节点：${nodeId}。`);
}

for (const gate of iteration.requiredGates ?? []) {
  requirePath(gate, `required gate ${gate}`, { allowEvidence: true });
  if (gate.startsWith("scripts/")) {
    requireValue(releaseGate.includes(gate), "iteration_gate_not_in_local_total_gate", `本地总门禁未接入：${gate}。`);
    requireValue(ci.includes(gate), "iteration_gate_not_in_ci", `CI 未接入：${gate}。`);
  }
}

writeResult();
if (violations.length) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log("Iteration kernel check: PASS");

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
    version: "oam.iteration-kernel-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    iterationId: iteration.currentIteration?.iterationId ?? "missing",
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
