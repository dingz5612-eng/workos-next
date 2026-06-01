import fs from "node:fs";
import path from "node:path";
import {
  collectReleaseEvidence,
  expectedMrs,
  fail,
  loadFinalGate,
  parseArgs,
  replayFinalGate,
  repoRoot,
  runSelfTest,
  writeJson
} from "./release-evidence-lib.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.has("self-test")) {
  runSelfTest([
    () => assertGraphBlocksPassedGateWithMissingMrEvidence(),
    () => assertGraphAcceptsBlockedMissingMrEvidence()
  ]);
  console.log("check-release-evidence-graph self-test: PASS");
  process.exit(0);
}

const result = buildGraph({ root: repoRoot });
writeJson(path.join(repoRoot, ".tmp", "v5_4", "release-evidence-graph.json"), result.graph);

if (result.violations.length > 0) {
  fail("check-release-evidence-graph: FAIL", result.violations);
}

console.log(`check-release-evidence-graph: PASS (${result.graph.nodes.length} nodes, ${result.graph.edges.length} edges)`);

export function buildGraph({ root = repoRoot } = {}) {
  const evidence = collectReleaseEvidence(root);
  const replay = replayFinalGate(root);
  const finalGate = loadFinalGate(root).data;
  const violations = [];
  const nodes = [];
  const edges = [];

  for (const mr of expectedMrs) {
    addNode(nodes, `mr:${mr}`, "release-slice", { mr });
    addEvidenceNodes(nodes, edges, `mr:${mr}`, "manifest", evidence.manifests.get(mr));
    addEvidenceNodes(nodes, edges, `mr:${mr}`, "gate-result", evidence.gates.get(mr));
    addEvidenceNodes(nodes, edges, `mr:${mr}`, "invariant-checks", evidence.invariants.get(mr));
    addEvidenceNodes(nodes, edges, `mr:${mr}`, "shadow-compare", evidence.shadows.get(mr));
    addEvidenceNodes(nodes, edges, `mr:${mr}`, "rollback-instruction", evidence.rollbacks.get(mr));
    addEvidenceNodes(nodes, edges, `mr:${mr}`, "compensation-instruction", evidence.compensations.get(mr));
  }

  addNode(nodes, "gate:final_system_gate", "final-gate", {
    status: finalGate.status,
    severity: finalGate.severity
  });

  for (const mr of expectedMrs) {
    edges.push({ from: `mr:${mr}`, to: "gate:final_system_gate", relation: "feeds-final-gate" });
  }

  if (finalGate.status === "passed" && replay.missingMrs.length > 0) {
    violations.push(`Final gate is passed while release evidence is missing for ${replay.missingMrs.join(", ")}.`);
  }

  for (const [mr, gates] of evidence.gates) {
    if (!expectedMrs.includes(mr)) continue;
    if (!evidence.manifests.has(mr)) {
      for (const gate of gates) {
        violations.push(`Orphan GateResult without ReleaseManifest: ${relative(gate.file, root)}.`);
      }
    }
  }

  return {
    graph: {
      generatedAtUtc: new Date().toISOString(),
      finalGate: {
        status: finalGate.status,
        severity: finalGate.severity,
        replayStatus: replay.status,
        missingMrs: replay.missingMrs
      },
      nodes,
      edges
    },
    violations
  };
}

function addEvidenceNodes(nodes, edges, parentId, kind, items = []) {
  for (const item of items ?? []) {
    const id = `${kind}:${path.basename(item.file)}`;
    addNode(nodes, id, kind, {
      file: item.file.replaceAll("\\", "/"),
      status: item.data.status,
      ciRunId: item.data.ci_run_id
    });
    edges.push({ from: id, to: parentId, relation: "evidence-for" });
  }
}

function addNode(nodes, id, type, data) {
  if (!nodes.some((node) => node.id === id)) {
    nodes.push({ id, type, ...data });
  }
}

function assertGraphBlocksPassedGateWithMissingMrEvidence() {
  const root = makeTempRoot("passed-missing");
  writeFinalGate(root, "passed");
  const result = buildGraph({ root });
  assertViolation(result, "Final gate is passed");
}

function assertGraphAcceptsBlockedMissingMrEvidence() {
  const root = makeTempRoot("blocked-missing");
  writeFinalGate(root, "blocked");
  const result = buildGraph({ root });
  if (result.violations.length > 0) {
    throw new Error(`Expected blocked graph to pass; got ${JSON.stringify(result.violations)}`);
  }
}

function assertViolation(result, expected) {
  if (!result.violations.some((item) => item.includes(expected))) {
    throw new Error(`Expected violation containing ${expected}; got ${JSON.stringify(result.violations)}`);
  }
}

function makeTempRoot(name) {
  const root = fs.mkdtempSync(path.join(repoRoot, ".tmp", "v5_4", `${name}-`));
  fs.mkdirSync(path.join(root, "docs", "v5.4"), { recursive: true });
  return root;
}

function writeFinalGate(root, status) {
  fs.writeFileSync(path.join(root, "docs", "v5.4", "final-system-gate-result.json"), JSON.stringify({
    gate_result_id: "final_system_gate",
    status,
    severity: status === "passed" ? "P2" : "P0",
    ci_run_id: "123",
    business_signoff_refs: [],
    no_go_items: status === "passed" ? [] : ["missing package"],
    go_items: []
  }, null, 2));
}

function relative(file, root) {
  return path.relative(root, file).replaceAll("\\", "/");
}
