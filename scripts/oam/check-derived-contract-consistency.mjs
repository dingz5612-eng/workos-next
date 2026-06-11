import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kernelPath = "docs/oam/system-operating-kernel.json";
const domainKernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const resultPath = "artifacts/oam/checks/derived-contract-consistency-result.json";
const manifestSpecs = [
  {
    path: "docs/oam/system-derived-contracts.json",
    version: "oam.system-derived-contracts.v1",
    kind: "system-derived",
    requiredTargets: [
      "docs/system/current-system-map.md",
      "docs/contracts/oam-responsibility-boundary-matrix.json",
      "docs/contracts/evidence/evidence-graph-refs-contract.json"
    ],
    requiredSources: [kernelPath, graphPath]
  },
  {
    path: "docs/oam/domain-derived-contracts.json",
    version: "oam.domain-derived-contracts.v1",
    kind: "domain-derived",
    requiredTargets: [
      "docs/business/domains/dormitory/domain-pack.yml",
      "docs/business/domains/dormitory/handoff-contract.json",
      "docs/business/domains/dormitory/dormitory-release-train.yml",
      "docs/business/domains/dormitory/dormitory-pilot-scenario-pack.yml",
      "docs/business/domains/dormitory/dormitory-seed-data-pack.json",
      "docs/business/domains/dormitory/dormitory-observability-contract.json",
      "docs/business/domains/dormitory/dormitory-operator-playbook.md",
      "docs/business/domains/dormitory/dormitory-pilot-go-no-go.json",
      ...dormitoryWorkItemTargets(),
      "docs/business/dormitory/workitem-catalog.yml",
      "docs/business/dormitory/workitem-decision-table.json",
      "docs/business/dormitory/value-streams.yml",
      "docs/business/dormitory/metrics-tree.yml",
      "docs/business/dormitory/metric-formula-contract.yml",
      "docs/business/dormitory/lens-map.yml",
      "docs/business/dormitory/workitem-sla.yml",
      "docs/business/dormitory/workitem-raci.yml",
      "docs/business/dormitory/go-no-go.yml",
      "docs/business/dormitory/evidence-policy.yml",
      "docs/business/dormitory/evidence-requirements.yml",
      "docs/scenarios/dormitory/golden-pilot.yml"
    ],
    requiredSources: [domainKernelPath, graphPath]
  },
  {
    path: "docs/oam/generated-contracts-manifest.json",
    version: "oam.generated-contracts-manifest.v1",
    kind: "generated-contracts",
    requiredTargets: [
      "docs/contracts/business/oam-business-object-field-registry.json",
      "docs/contracts/business/oam-workflow-state-registry.json",
      "docs/contracts/definition/workitem-definition-registry.json",
      "docs/contracts/admission/admission-matrix.json",
      "docs/contracts/admission/admission-contract.json",
      "docs/contracts/search/search-contract.json",
      "docs/contracts/accommodation-lens-contract.json"
    ],
    requiredSources: [kernelPath, domainKernelPath, graphPath]
  }
];
const forbiddenGeneratedTargets = new Set([
  "docs/oam/system-operating-kernel.json",
  "docs/business/domains/dormitory/dormitory-operating-kernel.json",
  "docs/surface/surface-contract.yml",
  "docs/contracts/database/oam-db-ownership-map.json",
  "docs/contracts/language/language-contract.json",
  "docs/read-intelligence/read-intelligence-kernel.json",
  "docs/finance/finance-ledger-kernel.json",
  "docs/identity/identity-permission-kernel.json"
]);

const violations = [];
const kernel = readJson(kernelPath);
const domainKernel = readJson(domainKernelPath);
const graph = readJson(graphPath);
const graphNodeIds = new Set((graph.nodes ?? []).map((node) => node.nodeId));
const allTargets = new Map();

for (const spec of manifestSpecs) {
  const manifest = readJson(spec.path);
  checkManifest(spec, manifest);
}

for (const [target, manifests] of allTargets) {
  if (manifests.length > 1) {
    fail("derived_target_duplicate_across_manifests", `${target} 同时出现在多个 generated manifest：${manifests.join(", ")}。`);
  }
}

writeResult();

if (violations.length) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log(`Derived contract consistency check: PASS (${allTargets.size} contracts across ${manifestSpecs.length} manifests)`);

function checkManifest(spec, manifest) {
  if (manifest.version !== spec.version || manifest.status !== "generated" || manifest.manifestKind !== spec.kind) {
    fail("derived_manifest_identity_invalid", `${spec.path} 必须声明 ${spec.version} generated 且 manifestKind=${spec.kind}。`);
  }
  for (const field of ["generated", "doNotEdit", "generatorVersion", "generatedFrom", "sourceRefs", "sourceHash", "sourceContentDigest", "kernelGraphHash", "compilerInputDigest", "outputContentDigest", "deterministicSort"]) {
    const value = manifest[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      fail("generated_manifest_metadata_missing", `${spec.path} 缺少 generated metadata：${field}。`);
    }
  }
  if (manifest.generated !== true || manifest.doNotEdit !== true || manifest.deterministicSort !== true) {
    fail("generated_manifest_flags_invalid", `${spec.path} 必须 generated=true、doNotEdit=true、deterministicSort=true。`);
  }
  if (JSON.stringify(manifest.generatedFrom) !== JSON.stringify(spec.requiredSources)) {
    fail("generated_manifest_sources_invalid", `${spec.path} generatedFrom 必须是 ${spec.requiredSources.join(", ")}。`);
  }
  if (manifest.kernelGraphHash !== hashFile(graphPath)) {
    fail("generated_manifest_graph_hash_invalid", `${spec.path} kernelGraphHash 与当前 OAM 图谱不一致。`);
  }
  if (manifest.sourceKernelVersion !== expectedKernelVersion(spec)) {
    fail("generated_manifest_kernel_version_invalid", `${spec.path} sourceKernelVersion 不正确。`);
  }
  const expectedOutputDigest = digest({ ...manifest, outputContentDigest: "sha256:pending" });
  if (manifest.outputContentDigest !== expectedOutputDigest) {
    fail("generated_manifest_output_digest_invalid", `${spec.path} outputContentDigest 不正确。`);
  }

  const contractByTarget = new Map((manifest.contracts ?? []).map((item) => [item.targetPath, item]));
  for (const target of spec.requiredTargets) {
    if (!contractByTarget.has(target)) {
      fail("derived_target_missing", `${spec.path} 缺少目标：${target}`);
    }
  }
  for (const item of manifest.contracts ?? []) {
    const target = item.targetPath;
    allTargets.set(target, [...(allTargets.get(target) ?? []), spec.path]);
    if (forbiddenGeneratedTargets.has(target)) {
      fail("source_file_in_generated_manifest", `${target} 是 Source Layer 文件，不得登记为 generated manifest 目标。`);
    }
    requirePath(target, `派生目标 ${target}`);
    requirePath(item.generatedBy, `派生生成器 ${item.generatedBy}`);
    requirePath(item.checker, `派生检查器 ${item.checker}`);
    if (item.manifestKind !== spec.kind) {
      fail("derived_item_manifest_kind_invalid", `${target} manifestKind 必须是 ${spec.kind}。`);
    }
    if (item.manualEditAllowed !== false) {
      fail("derived_manual_edit_allowed", `${target} manualEditAllowed 必须为 false。`);
    }
    if (JSON.stringify(item.derivedFrom) !== JSON.stringify(spec.requiredSources)) {
      fail("derived_source_missing", `${target} 必须 derivedFrom ${spec.requiredSources.join(", ")}。`);
    }
    if (item.sourceGraphVersion !== graph.version) {
      fail("derived_item_graph_version_mismatch", `${target} sourceGraphVersion 不一致。`);
    }
    if (item.sourceKernelVersion !== expectedItemKernelVersion(spec, target)) {
      fail("derived_item_kernel_version_mismatch", `${target} sourceKernelVersion 不一致。`);
    }
    if (!item.graphBinding || !graphNodeIds.has(item.graphBinding)) {
      fail("derived_graph_binding_missing", `${target} graphBinding 不存在：${item.graphBinding}`);
    }
    if (!item.sourceHashes || Object.keys(item.sourceHashes).length !== spec.requiredSources.length) {
      fail("derived_source_hashes_missing", `${target} 必须记录每个输入 Source hash。`);
    }
  }
}

function expectedKernelVersion(spec) {
  return spec.kind === "domain-derived" ? domainKernel.version : kernel.version;
}

function expectedItemKernelVersion(spec, target) {
  if (spec.kind === "domain-derived" || target.includes("/domains/dormitory/") || target.includes("/dormitory/") || target.includes("/scenarios/")) {
    return domainKernel.version;
  }
  return kernel.version;
}

function dormitoryWorkItemTargets() {
  const dir = path.join(root, "docs/business/domains/dormitory/workitems");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => `docs/business/domains/dormitory/workitems/${file}`)
    .sort();
}

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
    manifestCount: manifestSpecs.length,
    contractCount: allTargets.size,
    violationCount: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function hashFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(abs(file), "utf8")).digest("hex")}`;
}

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function abs(file) {
  return path.join(root, file);
}
