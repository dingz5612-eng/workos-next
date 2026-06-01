import fs from "node:fs";
import path from "node:path";
import {
  assertFinalGateCannotClaimProduction,
  fail,
  loadFinalGate,
  parseArgs,
  replayFinalGate,
  repoRoot,
  runSelfTest,
  stableHash,
  writeJson
} from "./release-evidence-lib.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.has("self-test")) {
  runSelfTest([
    () => assertReplayRejectsManualPassedGate(),
    () => assertReplayKeepsMissingPackagesBlocked()
  ]);
  console.log("replay-final-gate self-test: PASS");
  process.exit(0);
}

const gatePath = args.value("gate");
const result = replay({ root: repoRoot, gatePath });
writeJson(path.join(repoRoot, ".tmp", "v5_4", "final-gate-replay.json"), result);

if (result.violations.length > 0) {
  fail("replay-final-gate: FAIL", result.violations);
}

console.log(`replay-final-gate: PASS (declared=${result.declared.status}, replay=${result.replay.status})`);

export function replay({ root = repoRoot, gatePath = undefined } = {}) {
  const declared = loadFinalGate(root, gatePath).data;
  const replayed = replayFinalGate(root);
  const violations = [];
  assertFinalGateCannotClaimProduction(declared, replayed, violations);

  if (declared.status !== replayed.status) {
    violations.push(`Declared final gate status ${declared.status} does not match replay status ${replayed.status}.`);
  }

  if (declared.severity !== replayed.severity) {
    violations.push(`Declared final gate severity ${declared.severity} does not match replay severity ${replayed.severity}.`);
  }

  if (replayed.status === "blocked" && (!Array.isArray(declared.no_go_items) || declared.no_go_items.length === 0)) {
    violations.push("Blocked final gate must retain no_go_items.");
  }

  return {
    status: violations.length === 0 ? "passed" : "blocked",
    declared: {
      gateResultId: declared.gate_result_id,
      status: declared.status,
      severity: declared.severity,
      ciRunId: declared.ci_run_id,
      inputHashPresent: Boolean(declared.input_hash),
      resultHashPresent: Boolean(declared.result_hash)
    },
    replay: {
      status: replayed.status,
      severity: replayed.severity,
      missingMrs: replayed.missingMrs,
      noGoItems: replayed.noGoItems,
      resultReplayHash: stableHash({
        status: replayed.status,
        severity: replayed.severity,
        no_go_items: replayed.noGoItems,
        go_items: replayed.goItems
      })
    },
    violations
  };
}

function assertReplayRejectsManualPassedGate() {
  const root = makeTempRoot("manual-passed");
  writeFinalGate(root, {
    status: "passed",
    severity: "P2",
    ci_run_id: "123",
    no_go_items: [],
    business_signoff_refs: []
  });
  const result = replay({ root });
  assertViolation(result, "recomputes blocked");
}

function assertReplayKeepsMissingPackagesBlocked() {
  const root = makeTempRoot("missing-packages");
  writeFinalGate(root, {
    status: "blocked",
    severity: "P0",
    ci_run_id: "local-final-system",
    no_go_items: ["MR-03 missing"],
    business_signoff_refs: []
  });
  const result = replay({ root });
  if (result.violations.length > 0) {
    throw new Error(`Expected blocked gate with missing packages to replay cleanly; got ${JSON.stringify(result.violations)}`);
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

function writeFinalGate(root, overrides) {
  const gate = {
    gate_result_id: "final_system_gate",
    release_id: "release-final-system",
    mr_id: "FINAL-SYSTEM",
    status: "blocked",
    severity: "P0",
    ci_run_id: "local-final-system",
    business_signoff_refs: [],
    no_go_items: ["missing package"],
    go_items: [],
    input_hash: "input",
    result_hash: "result",
    ...overrides
  };
  fs.writeFileSync(path.join(root, "docs", "v5.4", "final-system-gate-result.json"), `${JSON.stringify(gate, null, 2)}\n`);
}
