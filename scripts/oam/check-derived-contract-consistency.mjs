import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = "docs/oam/system-derived-contracts.json";
const kernelPath = "docs/oam/system-operating-kernel.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const resultPath = "artifacts/oam/checks/derived-contract-consistency-result.json";
const dormitoryWorkItemDerivedTargets = fs.existsSync(path.join(root, "docs/business/domains/dormitory/workitems"))
  ? fs.readdirSync(path.join(root, "docs/business/domains/dormitory/workitems"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => `docs/business/domains/dormitory/workitems/${file}`)
    .sort()
  : [];

const requiredTargets = [
  "docs/system/current-system-map.md",
  "docs/contracts/oam-responsibility-boundary-matrix.json",
  "docs/contracts/business/oam-business-object-field-registry.json",
  "docs/contracts/business/oam-workflow-state-registry.json",
  "docs/contracts/definition/workitem-definition-registry.json",
  "docs/contracts/database/oam-db-ownership-map.json",
  "docs/contracts/admission/admission-matrix.json",
  "docs/contracts/admission/admission-contract.json",
  "docs/contracts/evidence/evidence-graph-refs-contract.json",
  "docs/business/dormitory/evidence-policy.yml",
  "docs/business/dormitory/evidence-requirements.yml",
  "docs/contracts/search/search-contract.json",
  "docs/contracts/accommodation-lens-contract.json",
  "docs/surface/surface-contract.yml",
  "docs/business/dormitory/workitem-catalog.yml",
  "docs/business/dormitory/workitem-decision-table.json",
  "docs/business/dormitory/value-streams.yml",
  "docs/business/dormitory/metrics-tree.yml",
  "docs/business/dormitory/metric-formula-contract.yml",
  "docs/business/dormitory/lens-map.yml",
  "docs/business/dormitory/workitem-sla.yml",
  "docs/business/dormitory/workitem-raci.yml",
  "docs/business/dormitory/go-no-go.yml",
  "docs/business/domains/dormitory/dormitory-operating-kernel.json",
  "docs/business/domains/dormitory/handoff-contract.json",
  "docs/business/domains/dormitory/dormitory-release-train.yml",
  "docs/business/domains/dormitory/dormitory-pilot-scenario-pack.yml",
  "docs/business/domains/dormitory/dormitory-seed-data-pack.json",
  "docs/business/domains/dormitory/dormitory-observability-contract.json",
  "docs/business/domains/dormitory/dormitory-operator-playbook.md",
  "docs/business/domains/dormitory/dormitory-pilot-go-no-go.json",
  "docs/oam/system-change-governance-contract.json",
  "docs/oam/iteration-kernel.json",
  ...dormitoryWorkItemDerivedTargets
];
const violations = [];
const manifest = readJson(manifestPath);
const kernel = readJson(kernelPath);
const graph = readJson(graphPath);
const graphNodeIds = new Set((graph.nodes ?? []).map((node) => node.nodeId));
const contracts = manifest.contracts ?? [];
const contractByTarget = new Map(contracts.map((item) => [item.targetPath, item]));

if (manifest.version !== "oam.system-derived-contracts.v1" || manifest.status !== "generated") {
  fail("derived_manifest_identity_invalid", "派生合同 manifest 必须声明 oam.system-derived-contracts.v1 generated。");
}
if (manifest.sourceKernelVersion !== kernel.version) {
  fail("derived_kernel_version_mismatch", "派生合同 sourceKernelVersion 必须与系统内核一致。");
}
if (manifest.sourceGraphVersion !== graph.version) {
  fail("derived_graph_version_mismatch", "派生合同 sourceGraphVersion 必须与 OAM 图谱一致。");
}
for (const target of requiredTargets) {
  if (!contractByTarget.has(target)) {
    fail("derived_target_missing", `派生合同缺少目标：${target}`);
  }
}
for (const item of contracts) {
  requirePath(item.targetPath, `派生目标 ${item.targetPath}`);
  requirePath(item.generatedBy, `派生生成器 ${item.generatedBy}`);
  requirePath(item.checker, `派生检查器 ${item.checker}`);
  if (item.manualEditAllowed !== false) {
    fail("derived_manual_edit_allowed", `${item.targetPath} manualEditAllowed 必须为 false。`);
  }
  if (!Array.isArray(item.derivedFrom) || !item.derivedFrom.includes(kernelPath) || !item.derivedFrom.includes(graphPath)) {
    fail("derived_source_missing", `${item.targetPath} 必须 derivedFrom 系统内核和 OAM 图谱。`);
  }
  if (item.sourceKernelVersion !== kernel.version) {
    fail("derived_item_kernel_version_mismatch", `${item.targetPath} sourceKernelVersion 不一致。`);
  }
  if (!item.graphBinding || !graphNodeIds.has(item.graphBinding)) {
    fail("derived_graph_binding_missing", `${item.targetPath} graphBinding 不存在：${item.graphBinding}`);
  }
}

writeResult();

if (violations.length) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log(`Derived contract consistency check: PASS (${contracts.length} contracts)`);

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
    version: "oam.derived-contract-consistency-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    contractCount: contracts.length,
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
