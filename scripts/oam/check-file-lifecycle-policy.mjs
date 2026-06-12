import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const policyPath = "docs/oam/file-lifecycle-policy.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const ledgerPath = "docs/oam/current-engineering-ledger.json";
const resultPath = "artifacts/oam/checks/file-lifecycle-policy-result.json";
const allowedStates = new Set([
  "active_authority",
  "active_contract",
  "active_runtime",
  "active_validation",
  "active_evidence",
  "derived_view",
  "human_manual",
  "delete_now"
]);
const requiredFileNodeFields = [
  "nodeId",
  "nodeType",
  "sourceFile",
  "lifecycleState",
  "currentTruthAllowed",
  "manualEditAllowed",
  "ciReferenceAllowed",
  "owner",
  "sourceKernel",
  "checker",
  "evidence",
  "replacementPath",
  "absorbedBy",
  "removalProofGate",
  "deletionConditionZh"
];

const violations = [];
const policy = readJson(policyPath);
const lifecycleRegistry = policy.fileLifecycleRegistry ?? {};
const graph = readJson(graphPath);
const ledger = readJson(ledgerPath);
const currentFiles = listCurrentFiles();
const fileNodes = (graph.nodes ?? []).filter((node) => node.nodeType === "File");
const fileNodeByPath = new Map(fileNodes.map((node) => [slash(node.sourceFile), node]));

if (policy.version !== "oam.file-lifecycle-policy.v1" || policy.status !== "authoritative") {
  fail("file_lifecycle_policy_identity", "文件生命周期策略必须声明 oam.file-lifecycle-policy.v1 authoritative。");
}
if (policy.architecture !== "oam.current") {
  fail("file_lifecycle_policy_architecture", "文件生命周期策略必须绑定 oam.current。");
}
if (!sameSet(policy.allowedLifecycleStates ?? [], [...allowedStates])) {
  fail("file_lifecycle_allowed_states", "文件生命周期状态只能使用指定枚举。");
}
validateFileLifecycleRegistry(lifecycleRegistry);

for (const file of currentFiles) {
  const node = fileNodeByPath.get(file);
  if (!node) {
    fail("file_node_missing", `当前保留文件缺少 File 节点：${file}`);
    continue;
  }
  validateFileNode(node, file, true);
}

for (const node of fileNodes) {
  validateFileNode(node, slash(node.sourceFile ?? ""), currentFiles.includes(slash(node.sourceFile ?? "")));
}

for (const state of policy.allowedLifecycleStates ?? []) {
  if (!allowedStates.has(state)) {
    fail("file_lifecycle_state_unknown", `未知文件生命周期状态：${state}`);
  }
}

const requiredEdgeTypes = ["absorbedBy", "replacedBy", "referenceBlockedBy", "deletionProvenBy", "mustNotBeReferencedBy"];
for (const edgeType of requiredEdgeTypes) {
  if (!(graph.requiredEdgeTypes ?? []).includes(edgeType)) {
    fail("file_lifecycle_edge_type_missing", `OAM 图谱缺少文件生命周期关系：${edgeType}`);
  }
}

for (const entry of ledger.files ?? []) {
  const node = fileNodeByPath.get(slash(entry.path ?? ""));
  if (!node) {
    fail("ledger_file_without_graph_node", `工程总账文件未被图谱逐项校验：${entry.path}`);
    continue;
  }
  if (entry.lifecycleState !== node.lifecycleState) {
    fail("ledger_lifecycle_mismatch", `${entry.path} 生命周期与图谱不一致。`);
  }
  if (entry.sourceKernel !== node.sourceKernel) {
    fail("ledger_source_kernel_mismatch", `${entry.path} sourceKernel 与图谱不一致。`);
  }
}

writeResult();

if (violations.length) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log(`File lifecycle policy check: PASS (${currentFiles.length} files)`);

function validateFileNode(node, file, fileExistsInCurrentSet) {
  for (const field of requiredFileNodeFields) {
    if (!(field in node) || node[field] === null || node[field] === undefined || node[field] === "") {
      fail("file_node_field_missing", `${file || node.nodeId} 缺少 ${field}。`);
    }
  }
  if (!allowedStates.has(node.lifecycleState)) {
    fail("file_node_state_unknown", `${file} 使用未知生命周期：${node.lifecycleState}`);
  }
  if (node.lifecycleState === "delete_now" && fileExistsInCurrentSet) {
    fail("delete_now_file_present", `delete_now 文件不得存在于当前文件集合：${file}`);
  }
  if (node.lifecycleState === "human_manual" && node.currentTruthAllowed !== false) {
    fail("human_manual_truth_allowed", `${file} 是 human_manual，currentTruthAllowed 必须为 false。`);
  }
  if (node.lifecycleState === "derived_view") {
    for (const field of ["derivedFrom", "generatedBy", "sourceKernelVersion", "graphBinding"]) {
      if (!node[field]) {
        fail("derived_view_field_missing", `${file} 是 derived_view，必须声明 ${field}。`);
      }
    }
    if (node.manualEditAllowed !== false) {
      fail("derived_view_manual_edit_allowed", `${file} 是 derived_view，manualEditAllowed 必须为 false。`);
    }
  }
  if (node.replacementPath && !exists(node.replacementPath)) {
    fail("replacement_path_missing", `${file} replacementPath 不存在：${node.replacementPath}`);
  }
  if (!Array.isArray(node.consumers) || node.consumers.length === 0) {
    fail("file_node_consumers_missing", `${file} 必须声明消费者。`);
  }
  if (!node.checker || !exists(node.checker)) {
    fail("file_node_checker_missing", `${file} checker 不存在：${node.checker}`);
  }
  if (!node.evidence) {
    fail("file_node_evidence_missing", `${file} 必须声明证据。`);
  }
  if (!node.removalProofGate || !exists(node.removalProofGate)) {
    fail("file_node_removal_gate_missing", `${file} removalProofGate 不存在：${node.removalProofGate}`);
  }
}

function validateFileLifecycleRegistry(registry) {
  const requiredLifecycles = [
    "source",
    "generated",
    "tooling",
    "runtime",
    "evidence",
    "release",
    "retired",
    "referenceOnly"
  ];
  if (registry.version !== "oam.file-lifecycle-registry.v1" || registry.status !== "authoritative") {
    fail("file_lifecycle_registry_identity", "File Lifecycle Registry 必须声明 oam.file-lifecycle-registry.v1 authoritative。");
  }
  if (registry.registryAuthority !== policyPath) {
    fail("file_lifecycle_registry_authority", `File Lifecycle Registry 必须以内嵌方式绑定 ${policyPath}。`);
  }
  if (registry.architecture !== "oam.current") {
    fail("file_lifecycle_registry_architecture", "File Lifecycle Registry 必须绑定 oam.current。");
  }
  if (!sameSet(Object.keys(registry.canonicalLifecycles ?? {}), requiredLifecycles)) {
    fail("file_lifecycle_registry_lifecycles", "File Lifecycle Registry 必须且只能定义 source/generated/tooling/runtime/evidence/release/retired/referenceOnly。");
  }
  if (!Array.isArray(registry.classificationPriority) || registry.classificationPriority.length === 0) {
    fail("file_lifecycle_registry_priority", "File Lifecycle Registry 必须定义分类优先级。");
  }
  if ((registry.classificationPriority ?? [])[0] !== "sourceWhitelist") {
    fail("file_lifecycle_registry_source_priority", "Source 白名单必须是生命周期分类第一优先级。");
  }
  for (const lifecycle of requiredLifecycles) {
    const item = registry.canonicalLifecycles?.[lifecycle];
    if (!item) continue;
    for (const field of ["responsibilityZh", "manualEditAllowed", "businessFactAuthorityAllowed", "contractAuthorityAllowed", "canDefineBusinessFacts", "proofOnly"]) {
      if (!(field in item)) {
        fail("file_lifecycle_registry_field_missing", `${lifecycle} 缺少 ${field}。`);
      }
    }
    if (!/[\u3400-\u9fff]/.test(String(item.responsibilityZh ?? ""))) {
      fail("file_lifecycle_registry_chinese_missing", `${lifecycle} 必须包含中文职责说明。`);
    }
  }
  if (registry.canonicalLifecycles?.source?.businessFactAuthorityAllowed !== true) {
    fail("file_lifecycle_registry_source_authority", "source 必须允许业务事实权威。");
  }
  if (registry.canonicalLifecycles?.generated?.manualEditAllowed !== false ||
    registry.canonicalLifecycles?.generated?.businessFactAuthorityAllowed !== false ||
    registry.canonicalLifecycles?.generated?.doNotEditRequired !== true) {
    fail("file_lifecycle_registry_generated_boundary", "generated 必须禁止手改、禁止业务事实权威并要求 doNotEdit。");
  }
  if (registry.canonicalLifecycles?.tooling?.manualEditAllowed !== true ||
    registry.canonicalLifecycles?.tooling?.businessFactAuthorityAllowed !== false) {
    fail("file_lifecycle_registry_tooling_boundary", "tooling 必须可人工维护且不得拥有业务事实权威。");
  }
  for (const lifecycle of ["evidence", "release"]) {
    if (registry.canonicalLifecycles?.[lifecycle]?.proofOnly !== true ||
      registry.canonicalLifecycles?.[lifecycle]?.businessFactAuthorityAllowed !== false) {
      fail("file_lifecycle_registry_proof_boundary", `${lifecycle} 只能证明，不得定义业务事实。`);
    }
  }
  for (const state of allowedStates) {
    const lifecycle = registry.stateToLifecycle?.[state];
    if (!requiredLifecycles.includes(lifecycle)) {
      fail("file_lifecycle_registry_state_mapping", `${state} 必须映射到唯一 canonical lifecycle。`);
    }
  }
  if (!Array.isArray(registry.pathRules) || registry.pathRules.length === 0) {
    fail("file_lifecycle_registry_rules_missing", "File Lifecycle Registry 必须定义路径分类规则。");
  }
  const ruleIds = new Set();
  let hasSourceWhitelistRule = false;
  for (const rule of registry.pathRules ?? []) {
    if (!rule.id || ruleIds.has(rule.id)) {
      fail("file_lifecycle_registry_rule_id", `路径规则 id 缺失或重复：${rule.id ?? "<missing>"}`);
    }
    ruleIds.add(rule.id);
    if (!["sourceWhitelist", "exactPath", "prefix", "suffix", "contains"].includes(rule.matchType)) {
      fail("file_lifecycle_registry_rule_match_type", `${rule.id} 使用未知 matchType：${rule.matchType}`);
    }
    if (!requiredLifecycles.includes(rule.lifecycle)) {
      fail("file_lifecycle_registry_rule_lifecycle", `${rule.id} 使用未知 lifecycle：${rule.lifecycle}`);
    }
    if (rule.matchType === "sourceWhitelist") {
      hasSourceWhitelistRule = true;
    } else if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) {
      fail("file_lifecycle_registry_rule_patterns", `${rule.id} 必须声明 patterns。`);
    }
  }
  if (!hasSourceWhitelistRule) {
    fail("file_lifecycle_registry_source_rule_missing", "File Lifecycle Registry 必须声明 sourceWhitelist 路径规则。");
  }
}

function listCurrentFiles() {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .map((item) => slash(item.trim()))
    .filter(Boolean)
    .filter((item) => !item.startsWith("artifacts/oam/authority-cleanup/"))
    .filter((item) => !item.startsWith("artifacts/oam/checks/"))
    .filter((item) => !item.startsWith("artifacts/oam/evidence/"))
    .filter((item) => !item.startsWith("artifacts/oam/proofs/"))
    .filter((item) => !item.startsWith("artifacts/oam/test-results/"))
    .filter((item) => item !== "artifacts/oam/final-report.json")
    .sort((left, right) => left.localeCompare(right));
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.file-lifecycle-policy-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    fileLifecycleRegistry: {
      version: lifecycleRegistry.version ?? null,
      status: violations.some((item) => item.id.startsWith("file_lifecycle_registry")) ? "failed" : "passed",
      lifecycleCount: Object.keys(lifecycleRegistry.canonicalLifecycles ?? {}).length,
      pathRuleCount: lifecycleRegistry.pathRules?.length ?? 0
    },
    currentFileCount: currentFiles.length,
    graphFileNodeCount: fileNodes.length,
    violationCount: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function sameSet(left, right) {
  return JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function abs(file) {
  return path.join(root, file);
}

function slash(value) {
  return String(value || "").replace(/\\/g, "/");
}
