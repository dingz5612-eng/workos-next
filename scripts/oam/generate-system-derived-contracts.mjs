import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputPath = "docs/oam/system-derived-contracts.json";
const kernel = readJson("docs/oam/system-operating-kernel.json");
const graph = readJson("docs/oam/oam-kernel-graph.json");
const targetPaths = [
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
  "docs/business/dormitory/go-no-go.yml"
];

const graphNodeBySource = new Map((graph.nodes ?? []).map((node) => [slash(node.sourceFile), node]));
const contracts = targetPaths.map((targetPath) => ({
  targetPath,
  derivedFrom: ["docs/oam/system-operating-kernel.json", "docs/oam/oam-kernel-graph.json"],
  generatedBy: "scripts/oam/generate-system-derived-contracts.mjs",
  sourceKernelVersion: kernel.version,
  sourceGraphVersion: graph.version,
  manualEditAllowed: false,
  graphBinding: graphNodeBySource.get(targetPath)?.nodeId ?? "kernel.system",
  checker: checkerFor(targetPath)
}));

writeJson(outputPath, {
  version: "oam.system-derived-contracts.v1",
  status: "generated",
  architecture: "oam.current",
  generatedBy: "scripts/oam/generate-system-derived-contracts.mjs",
  sourceKernel: "docs/oam/system-operating-kernel.json",
  sourceGraph: "docs/oam/oam-kernel-graph.json",
  sourceKernelVersion: kernel.version,
  sourceGraphVersion: graph.version,
  contracts
});

console.log(`System derived contracts generated: ${outputPath}`);
console.log(`contracts=${contracts.length}`);

function checkerFor(file) {
  if (file.includes("/dormitory/")) return "scripts/business/check-dormitory-execution-kernel.mjs";
  if (file.includes("/admission/")) return "scripts/check-admission-kernel.mjs";
  if (file.includes("/search/")) return "scripts/check-search-kernel.mjs";
  if (file.includes("database")) return "scripts/oam/check-db-ownership-map.mjs";
  if (file.includes("workflow")) return "scripts/oam/check-workflow-state-registry.mjs";
  if (file.includes("business-object")) return "scripts/oam/check-business-object-field-registry.mjs";
  return "scripts/oam/check-derived-contract-consistency.mjs";
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slash(value) {
  return String(value || "").replace(/\\/g, "/");
}
