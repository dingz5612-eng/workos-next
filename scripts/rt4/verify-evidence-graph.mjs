import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const graphPath = path.join(root, "artifacts", "rt4", "evidence-graph.json");

function fail(message, details = []) {
  for (const detail of details) console.error(`- ${detail}`);
  throw new Error(message);
}

if (!fs.existsSync(graphPath)) {
  fail("RT4 evidence graph verification failed.", [`Missing file: ${path.relative(root, graphPath)}`]);
}

const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const violations = [];
const requirementNodes = graph.nodes?.filter((node) => node.type === "requirement") ?? [];

if (graph.mode !== "STACKED_PRECONSTRUCTION") {
  violations.push(`Unexpected evidence graph mode: ${graph.mode}`);
}

if (requirementNodes.length === 0) {
  violations.push("Evidence graph has no requirement nodes.");
}

for (const node of requirementNodes.filter((item) => item.priority === "P0")) {
  if (!node.refs || node.refs.length === 0) {
    violations.push(`P0 requirement node ${node.id} has no refs.`);
  }
}

if ((graph.edges ?? []).length === 0) {
  violations.push("Evidence graph has no edges.");
}

if (violations.length > 0) fail("RT4 evidence graph verification failed.", violations);

console.log(`RT4 evidence graph verification: PASS (nodes=${graph.nodes.length}, edges=${graph.edges.length})`);
