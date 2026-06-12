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
const admissionContractPath = "docs/contracts/admission/admission-contract.json";

const kernel = readJson(systemKernelPath);
const domainKernel = readJson(domainKernelPath);
const graph = readJson(graphPath);
const graphNodeIds = new Set((graph.nodes ?? []).map((node) => node.nodeId));
const graphNodesBySource = new Map();
for (const node of graph.nodes ?? []) {
  const sourceFile = slash(node.sourceFile);
  if (!sourceFile) continue;
  graphNodesBySource.set(sourceFile, [...(graphNodesBySource.get(sourceFile) ?? []), node]);
}
const sourceAuthorityNodeRefs = new Map([
  [systemKernelPath, "kernel.system"],
  [domainKernelPath, "domain.dormitory"],
  [graphPath, "graph.oam"]
]);
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
  sourceRefs: sourceRefsFor([systemKernelPath, graphPath]),
  contracts: contracts(systemTargets, [systemKernelPath, graphPath], "system-derived")
}));
writeJson(domainOutputPath, manifest({
  version: "oam.domain-derived-contracts.v1",
  manifestKind: "domain-derived",
  generatedFrom: [domainKernelPath, graphPath],
  sourceRefs: sourceRefsFor([domainKernelPath, graphPath]),
  contracts: contracts(domainTargets, [domainKernelPath, graphPath], "domain-derived")
}));
writeJson(generatedContractsOutputPath, manifest({
  version: "oam.generated-contracts-manifest.v1",
  manifestKind: "generated-contracts",
  generatedFrom: [systemKernelPath, domainKernelPath, graphPath],
  sourceRefs: sourceRefsFor([systemKernelPath, domainKernelPath, graphPath]),
  contracts: contracts(generatedContractTargets, [systemKernelPath, domainKernelPath, graphPath], "generated-contracts")
}));
writeAdmissionGeneratedContract();

console.log(`Generated layer manifests written: ${systemOutputPath}, ${domainOutputPath}, ${generatedContractsOutputPath}`);
console.log(`contracts=${systemTargets.length + domainTargets.length + generatedContractTargets.length}`);

function contracts(targetPaths, derivedFrom, manifestKind) {
  const sourceRefs = sourceRefsFor(derivedFrom);
  const sourceNodeRefs = [...sourceRefs];
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
    sourceRefs,
    sourceNodeRefs,
    sourceContentDigest: hashFiles(derivedFrom),
    kernelGraphHash: hashFile(graphPath),
    sourceKernelVersion: targetPath.includes("/domains/dormitory/") || targetPath.includes("/dormitory/") || targetPath.includes("/scenarios/")
      ? domainKernel.version
      : kernel.version,
    sourceGraphVersion: graph.version,
    manualEditAllowed: false,
    graphBinding: graphBindingFor(targetPath),
    checker: checkerFor(targetPath),
    sourceHashes,
    compilerInputDigest: digest({
      generatorVersion,
      manifestKind,
      targetPath,
      generatedFrom: derivedFrom,
      sourceRefs,
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
  const fileNodeId = `file.${file}`;
  if (graphNodeIds.has(fileNodeId)) return fileNodeId;
  const nodes = graphNodesBySource.get(file) ?? [];
  return nodes[0]?.nodeId ?? fileNodeId;
}

function sourceRefsFor(files) {
  return files.map((file) => sourceAuthorityNodeRefFor(file));
}

function sourceAuthorityNodeRefFor(file) {
  const authorityNodeRef = sourceAuthorityNodeRefs.get(file);
  if (!authorityNodeRef) return graphBindingFor(file);
  if (!graphNodeIds.has(authorityNodeRef)) {
    throw new Error(`source authority node ref missing from OAM graph: ${file} -> ${authorityNodeRef}`);
  }
  return authorityNodeRef;
}

function writeAdmissionGeneratedContract() {
  const generatedFrom = [systemKernelPath, domainKernelPath, graphPath];
  const sourceRefs = sourceRefsFor(generatedFrom);
  const sourceHashes = Object.fromEntries(generatedFrom.map((file) => [file, hashFile(file)]));
  const base = readJson(admissionContractPath);
  const doc = {
    ...base,
    generated: true,
    doNotEdit: true,
    architecture: "oam.current",
    generatedBy,
    generatorVersion,
    generatedFrom,
    sourceRefs,
    sourceNodeRefs: sourceRefs,
    sourceHash: hashFiles(generatedFrom),
    sourceContentDigest: hashFiles(generatedFrom),
    kernelGraphHash: hashFile(graphPath),
    sourceKernelVersion: kernel.version,
    sourceGraphVersion: graph.version,
    sourceHashes,
    manualEditAllowed: false,
    deterministicSort: true,
    missingAdmissionBehavior: {
      visibleAllowed: true,
      prepareAllowed: false,
      confirmAllowed: false,
      productionAllowed: false,
      mode: "contract_preview",
      reason: "missing_admission_contract",
      noGoItems: ["missing_admission_contract"]
    },
    compilerInputDigest: digest({
      generatorVersion,
      targetPath: admissionContractPath,
      generatedFrom,
      sourceRefs,
      sourceHashes,
      missingAdmissionBehavior: "confirmAllowed=false"
    })
  };
  doc.outputContentDigest = digest({ ...doc, outputContentDigest: "sha256:pending" });
  writeJson(admissionContractPath, doc);
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
