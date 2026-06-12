import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatorVersion = "oam.generated-layer-manifest-compiler.v1";
const generatedBy = "scripts/oam/generate-system-derived-contracts.mjs";
const systemKernelPath = "docs/oam/system-operating-kernel.json";
const domainKernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const systemOutputPath = "docs/oam/system-derived-contracts.json";
const domainOutputPath = "docs/oam/domain-derived-contracts.json";
const generatedContractsOutputPath = "docs/oam/generated-contracts-manifest.json";

const kernel = readJson(systemKernelPath);
const domainKernel = readJson(domainKernelPath);
const graph = readJson(graphPath);
const graphNodeBySource = new Map((graph.nodes ?? []).map((node) => [slash(node.sourceFile), node]));
const dormitoryWorkItemDerivedTargets = fs.existsSync(path.join(root, "docs/business/domains/dormitory/workitems"))
  ? fs.readdirSync(path.join(root, "docs/business/domains/dormitory/workitems"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => `docs/business/domains/dormitory/workitems/${file}`)
    .sort()
  : [];

const systemTargets = [
  "docs/system/current-system-map.md",
  "docs/contracts/oam-responsibility-boundary-matrix.json",
  "docs/contracts/evidence/evidence-graph-refs-contract.json"
];
const domainTargets = [
  "docs/business/domains/dormitory/domain-pack.yml",
  "docs/business/domains/dormitory/handoff-contract.json",
  "docs/business/domains/dormitory/dormitory-release-train.yml",
  "docs/business/domains/dormitory/dormitory-pilot-scenario-pack.yml",
  "docs/business/domains/dormitory/dormitory-seed-data-pack.json",
  "docs/business/domains/dormitory/dormitory-observability-contract.json",
  "docs/business/domains/dormitory/dormitory-operator-playbook.md",
  "docs/business/domains/dormitory/dormitory-pilot-go-no-go.json",
  ...dormitoryWorkItemDerivedTargets,
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
];
const generatedContractTargets = [
  "docs/contracts/business/oam-business-object-field-registry.json",
  "docs/contracts/business/oam-workflow-state-registry.json",
  "docs/contracts/definition/workitem-definition-registry.json",
  "docs/contracts/admission/admission-matrix.json",
  "docs/contracts/admission/admission-contract.json",
  "docs/contracts/search/search-contract.json",
  "docs/contracts/accommodation-lens-contract.json"
];

writeJson(systemOutputPath, manifest({
  version: "oam.system-derived-contracts.v1",
  manifestKind: "system-derived",
  generatedFrom: [systemKernelPath, graphPath],
  sourceRefs: ["kernel.system", "graph.authority"],
  contracts: contracts(systemTargets, [systemKernelPath, graphPath], "system-derived")
}));
writeJson(domainOutputPath, manifest({
  version: "oam.domain-derived-contracts.v1",
  manifestKind: "domain-derived",
  generatedFrom: [domainKernelPath, graphPath],
  sourceRefs: ["domain.dormitory", "graph.authority"],
  contracts: contracts(domainTargets, [domainKernelPath, graphPath], "domain-derived")
}));
writeJson(generatedContractsOutputPath, manifest({
  version: "oam.generated-contracts-manifest.v1",
  manifestKind: "generated-contracts",
  generatedFrom: [systemKernelPath, domainKernelPath, graphPath],
  sourceRefs: ["kernel.system", "domain.dormitory", "graph.authority"],
  contracts: contracts(generatedContractTargets, [systemKernelPath, domainKernelPath, graphPath], "generated-contracts")
}));

console.log(`Generated layer manifests written: ${systemOutputPath}, ${domainOutputPath}, ${generatedContractsOutputPath}`);
console.log(`contracts=${systemTargets.length + domainTargets.length + generatedContractTargets.length}`);

function contracts(targetPaths, derivedFrom, manifestKind) {
  const sourceNodeRefs = derivedFrom.map((file) => graphNodeBySource.get(file)?.nodeId ?? graphBindingFor(file));
  const sourceHashes = Object.fromEntries(derivedFrom.map((file) => [file, hashFile(file)]));
  return [...targetPaths].sort((a, b) => a.localeCompare(b)).map((targetPath) => ({
    targetPath,
    generated: true,
    doNotEdit: true,
    manifestKind,
    derivedFrom,
    generatedBy,
    generatorVersion,
    generatedFrom: derivedFrom,
    sourceRefs: derivedFrom,
    sourceNodeRefs,
    sourceContentDigest: hashFiles(derivedFrom),
    kernelGraphHash: hashFile(graphPath),
    sourceKernelVersion: targetPath.includes("/domains/dormitory/") || targetPath.includes("/dormitory/") || targetPath.includes("/scenarios/")
      ? domainKernel.version
      : kernel.version,
    sourceGraphVersion: graph.version,
    manualEditAllowed: false,
    graphBinding: graphNodeBySource.get(targetPath)?.nodeId ?? graphBindingFor(targetPath),
    checker: checkerFor(targetPath),
    sourceHashes,
    compilerInputDigest: digest({
      generatorVersion,
      manifestKind,
      targetPath,
      generatedFrom: derivedFrom,
      sourceNodeRefs,
      sourceHashes
    })
  }));
}

function manifest({ version, manifestKind, generatedFrom, sourceRefs, contracts }) {
  const doc = {
    version,
    status: "generated",
    architecture: "oam.current",
    generated: true,
    doNotEdit: true,
    manifestKind,
    generatedBy,
    generatorVersion,
    generatedFrom,
    sourceRefs,
    sourceKernel: generatedFrom[0],
    sourceGraph: graphPath,
    sourceKernelVersion: generatedFrom[0] === domainKernelPath ? domainKernel.version : kernel.version,
    sourceGraphVersion: graph.version,
    sourceHash: hashFiles(generatedFrom),
    sourceContentDigest: hashFiles(generatedFrom),
    kernelGraphHash: hashFile(graphPath),
    deterministicSort: true,
    contracts
  };
  doc.compilerInputDigest = digest({
    generatorVersion,
    manifestKind,
    generatedFrom,
    sourceRefs,
    contracts: contracts.map((item) => item.targetPath)
  });
  doc.outputContentDigest = digest({ ...doc, outputContentDigest: "sha256:pending" });
  return doc;
}

function checkerFor(file) {
  if (file.includes("/domains/dormitory/dormitory-release-train")) return "scripts/business/check-dormitory-release-train.mjs";
  if (file.includes("/domains/dormitory/dormitory-pilot-scenario-pack")) return "scripts/business/check-dormitory-pilot-scenario-pack.mjs";
  if (file.includes("/domains/dormitory/")) return "scripts/business/check-dormitory-derived-contracts.mjs";
  if (file.includes("/dormitory/")) return "scripts/business/check-dormitory-execution-kernel.mjs";
  if (file.includes("/admission/")) return "scripts/check-admission-kernel.mjs";
  if (file.includes("/search/")) return "scripts/check-search-kernel.mjs";
  if (file.includes("workflow")) return "scripts/oam/check-workflow-state-registry.mjs";
  if (file.includes("business-object")) return "scripts/oam/check-business-object-field-registry.mjs";
  return "scripts/oam/check-derived-contract-consistency.mjs";
}

function graphBindingFor(file) {
  const node = graph.nodes?.find((item) => item.sourceFile === file);
  return node?.nodeId ?? `file.${file}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file), "utf8")).digest("hex")}`;
}

function hashFiles(files) {
  return digest(Object.fromEntries(files.map((file) => [file, hashFile(file)])));
}

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slash(value) {
  return String(value || "").replace(/\\/g, "/");
}
