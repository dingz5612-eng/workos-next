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
const allowedModes = new Set([
  "STACKED_PRECONSTRUCTION",
  "CENTRAL_MERGE_COMPLETED",
  "DORM_INT_PASSED",
  "L1_INTERNAL_PILOT_OBSERVATION"
]);

if (!allowedModes.has(graph.mode)) {
  violations.push(`Unexpected evidence graph mode: ${graph.mode}`);
}

if (graph.mode === "L1_INTERNAL_PILOT_OBSERVATION") {
  if (graph.releaseStates?.centralMerge !== "CENTRAL_MERGE_COMPLETED") {
    violations.push("Evidence graph must record CENTRAL_MERGE_COMPLETED in L1 observation mode.");
  }
  if (graph.releaseStates?.dormInt !== "DORM_INT_PASSED") {
    violations.push("Evidence graph must record DORM_INT_PASSED in L1 observation mode.");
  }
  if (graph.releaseStates?.observation !== "L1_INTERNAL_PILOT_OBSERVATION") {
    violations.push("Evidence graph must record L1_INTERNAL_PILOT_OBSERVATION in L1 observation mode.");
  }
  if (graph.releaseStates?.businessProduction !== "BLOCKED" || graph.releaseStates?.dormitoryL2Production !== "BLOCKED") {
    violations.push("Evidence graph must keep Business Production and Dormitory L2 blocked.");
  }
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
