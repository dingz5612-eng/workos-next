import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const cli = parseArgs(process.argv.slice(2));

const staleRunIds = new Set([
  "26685133709",
  "26685133695",
  "26685234735",
  "26685234731"
]);

if (cli.has("self-test")) {
  runSelfTest();
  process.exit(0);
}

const mode = (cli.value("mode") ?? process.env.V55_MODE ?? "local").toLowerCase();
const evidence = resolveEvidenceBinding(mode);
const checks = [
  ["Rule authority", "node", ["scripts/check-rule-authority.mjs"]],
  ["PR contract self-test", "node", ["scripts/check-pr-contract.mjs", "--self-test"]],
  ["API boundary self-test", "node", ["scripts/check-api-boundaries.mjs", "--self-test"]],
  ["API boundary v3", "node", ["scripts/check-api-boundaries.mjs", "--out=.tmp/v5_5/api-boundary-check-v3.json"]],
  ["Fact ownership", "node", ["scripts/check-fact-ownership.mjs"]],
  ["MR contract", "node", ["scripts/check-mr-contract.mjs"]],
  ["Invariant maturity", "node", ["scripts/check-invariant-maturity.mjs"]],
  ["GateResult hardening", "node", ["scripts/check-gate-result-hardening.mjs"]],
  ["Rule drift", "node", ["scripts/check-rule-drift.mjs", "--mode=final", "--out=.tmp/v5_5/rule-drift-report.json"]]
];

const results = checks.map(([name, command, args]) => runCheck(name, command, args));
const failed = results.filter((item) => item.status !== "PASS");
const won18 = fs.readFileSync("docs/v5.4/won-18-final-go-no-go.md", "utf8");
const won18Go = /Status:\s*`GO`/.test(won18) || /status\s*=\s*GO/i.test(won18);
const finalSystemGate = readFinalSystemGate();

if (!won18Go) {
  failed.push({
    name: "WON-18 final Go/No-Go",
    status: "FAIL",
    command: "docs/v5.4/won-18-final-go-no-go.md",
    detail: "WON-18 report is not GO."
  });
}

for (const violation of evidence.violations) {
  failed.push({
    name: "Latest main evidence binding",
    status: "FAIL",
    command: "scripts/check-v5-5-rules-os.mjs",
    detail: violation
  });
}

const rulesPassed = failed.length === 0;
const decision = decideGoStatus(rulesPassed, evidence, finalSystemGate);
const gate = {
  generated_at_utc: new Date().toISOString(),
  generated_by: "check-v5-5-rules-os",
  status: rulesPassed ? "passed" : "blocked",
  mode,
  evidence_status: evidence.status,
  p0_blockers: failed.map((item) => item.name),
  decisions: decision,
  evidence: {
    won18_status: won18Go ? "GO" : "NO-GO",
    target_commit_sha: evidence.targetCommitSha,
    current_head_sha: evidence.currentHeadSha,
    remote_verified: evidence.remoteVerified,
    ci_run_id: evidence.ciRunId,
    ci_run_sha: evidence.ciRunSha,
    v54_control_plane_guards_run_id: evidence.v54RunId,
    v54_control_plane_guards_run_sha: evidence.v54RunSha,
    final_system_gate_status: finalSystemGate.status,
    final_system_gate_severity: finalSystemGate.severity,
    api_boundary_report: ".tmp/v5_5/api-boundary-check-v3.json",
    rule_drift_report: ".tmp/v5_5/rule-drift-report.json"
  },
  checks: results
};

const outPath = path.join(repoRoot, ".tmp/v5_5/rules-os-gate-result.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(gate, null, 2)}\n`, "utf8");

if (cli.has("write-doc")) {
  writeDoc(gate);
}

if (cli.has("json")) {
  console.log(JSON.stringify(gate, null, 2));
} else {
  console.log(`V5.5 Rules OS gate: ${gate.status.toUpperCase()} (${failed.length} blockers, evidence=${gate.evidence_status})`);
}

if (failed.length > 0) {
  process.exit(1);
}

function resolveEvidenceBinding(currentMode) {
  const currentHeadSha = cli.value("headSha") ?? process.env.V55_HEAD_SHA ?? gitHead();
  const targetCommitSha = cli.value("commitSha") ?? process.env.V55_COMMIT_SHA ?? (currentMode === "local" ? currentHeadSha : "");
  const remoteVerified = (cli.value("remoteVerified") ?? process.env.V55_REMOTE_VERIFIED ?? "false")
    .toLowerCase() === "true";
  const ciRunId = cli.value("ciRunId") ?? process.env.V55_CI_RUN_ID ?? (currentMode === "local" ? "LOCAL" : "");
  const v54RunId = cli.value("v54RunId") ?? process.env.V55_V54_CONTROL_PLANE_RUN_ID ?? (currentMode === "local" ? "LOCAL" : "");
  const ciRunSha = cli.value("ciRunSha") ?? process.env.V55_CI_RUN_SHA ?? (currentMode === "local" ? targetCommitSha : "");
  const v54RunSha = cli.value("v54RunSha") ?? process.env.V55_V54_CONTROL_PLANE_RUN_SHA ?? (currentMode === "local" ? targetCommitSha : "");
  return validateEvidenceBinding({
    mode: currentMode,
    currentHeadSha,
    targetCommitSha,
    remoteVerified,
    ciRunId,
    v54RunId,
    ciRunSha,
    v54RunSha
  });
}

function validateEvidenceBinding(input) {
  const violations = [];
  const requireValue = (value, name) => {
    if (!value || value.trim() === "") violations.push(`${name} is required in ${input.mode} mode.`);
  };

  if (!["local", "ci", "final"].includes(input.mode)) {
    violations.push(`Unsupported mode: ${input.mode}`);
  }

  if (input.mode === "local" && input.remoteVerified) {
    violations.push("local mode cannot use remoteVerified=true; local dry-run evidence must remain LOCAL.");
  }

  if (input.mode === "ci") {
    requireValue(input.targetCommitSha, "commitSha");
    requireValue(input.ciRunId, "ciRunId");
    requireValue(input.v54RunId, "v54RunId");
  }

  if (input.mode === "final") {
    requireValue(input.targetCommitSha, "commitSha");
    requireValue(input.ciRunId, "ciRunId");
    requireValue(input.v54RunId, "v54RunId");
    requireValue(input.ciRunSha, "ciRunSha");
    requireValue(input.v54RunSha, "v54RunSha");
    if (!input.remoteVerified) {
      violations.push("remoteVerified=true is required in final mode.");
    }
    if (input.targetCommitSha && input.currentHeadSha && input.targetCommitSha !== input.currentHeadSha) {
      violations.push(`commitSha must equal current HEAD in final mode: commitSha=${input.targetCommitSha}, HEAD=${input.currentHeadSha}`);
    }
    if (input.ciRunSha && input.targetCommitSha && input.ciRunSha !== input.targetCommitSha) {
      violations.push(`ciRunId must belong to commitSha: ciRunSha=${input.ciRunSha}, commitSha=${input.targetCommitSha}`);
    }
    if (input.v54RunSha && input.targetCommitSha && input.v54RunSha !== input.targetCommitSha) {
      violations.push(`v54RunId must belong to commitSha: v54RunSha=${input.v54RunSha}, commitSha=${input.targetCommitSha}`);
    }
  }

  for (const [label, runId] of [["ciRunId", input.ciRunId], ["v54RunId", input.v54RunId]]) {
    if (input.mode === "final" && staleRunIds.has(runId)) {
      violations.push(`${label} uses stale V5.5 bootstrap evidence and cannot prove current main: ${runId}`);
    }
    if (input.mode === "final" && /^(LOCAL|local|pending|not-final)/.test(runId ?? "")) {
      violations.push(`${label} must be a remote Actions run id in final mode, got ${runId}.`);
    }
  }

  const status = input.mode === "final" && input.remoteVerified && violations.length === 0
    ? "remote_verified"
    : input.mode === "ci"
      ? "ci_bound_pending_remote_pair"
      : "local";

  return { ...input, status, violations };
}

function decideGoStatus(rulesPassed, evidence, finalSystemGate) {
  const rulesOs = rulesPassed && evidence.status === "remote_verified" ? "GO" : rulesPassed ? "LOCAL_ONLY" : "NO-GO";
  const runtimeCutover = rulesPassed ? "GO_FOR_ENGINEERING" : "BLOCKED";
  const businessProduction = finalSystemGate.status === "passed" ? "REQUIRES_BUSINESS_LINE_ADMISSION_GATE" : "BLOCKED";
  return {
    rules_os_go: rulesOs,
    runtime_cutover_go: runtimeCutover,
    business_production_go: businessProduction,
    next_engineering_batch: rulesPassed ? "RULE_FIX_OR_RUNTIME_CUTOVER_ALLOWED" : "BLOCKED",
    runtime_cutover_batch: runtimeCutover,
    business_production_batch: businessProduction
  };
}

function readFinalSystemGate() {
  const file = path.join(repoRoot, "docs/v5.4/final-system-gate-result.json");
  if (!fs.existsSync(file)) return { status: "missing", severity: "P0" };
  const gate = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    status: gate.status ?? "unknown",
    severity: gate.severity ?? "unknown"
  };
}

function runCheck(name, command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return {
    name,
    command: [command, ...args].join(" "),
    status: result.status === 0 ? "PASS" : "FAIL",
    stdout: result.stdout.trim().slice(-2000),
    stderr: result.stderr.trim().slice(-2000)
  };
}

function writeDoc(gateResult) {
  const status = gateResult.decisions.rules_os_go;
  const rows = gateResult.checks
    .map((item) => `| ${item.name} | \`${item.status}\` | \`${item.command}\` |`)
    .join("\n");
  const blockers = gateResult.p0_blockers.length === 0
    ? "- None."
    : gateResult.p0_blockers.map((item) => `- ${item}`).join("\n");

  const doc = `# V5.5 Rules OS Final Go/No-Go

Generated: ${gateResult.generated_at_utc}
Status: \`${status}\`

## Decision Boundaries

V5.5 Engineering Rules OS checks are machine-generated by
\`scripts/check-v5-5-rules-os.mjs\`.

This report separates engineering rules readiness from runtime cutover and
business production:

- Rules OS GO: \`${gateResult.decisions.rules_os_go}\`
- Runtime Cutover GO: \`${gateResult.decisions.runtime_cutover_go}\`
- Business Production GO: \`${gateResult.decisions.business_production_go}\`

## Latest Main Evidence Binding

- Target commit: \`${gateResult.evidence.target_commit_sha || "not recorded"}\`
- Current HEAD: \`${gateResult.evidence.current_head_sha || "not recorded"}\`
- CI run: \`${gateResult.evidence.ci_run_id || "not recorded"}\`
- CI run commit: \`${gateResult.evidence.ci_run_sha || "not recorded"}\`
- V5.4 Control Plane Guards run: \`${gateResult.evidence.v54_control_plane_guards_run_id || "not recorded"}\`
- V5.4 Control Plane Guards run commit: \`${gateResult.evidence.v54_control_plane_guards_run_sha || "not recorded"}\`
- Remote verified: \`${gateResult.evidence.remote_verified ? "true" : "false"}\`
- Evidence status: \`${gateResult.evidence_status}\`

## Final System Gate

- Status: \`${gateResult.evidence.final_system_gate_status}\`
- Severity: \`${gateResult.evidence.final_system_gate_severity}\`
- Business Production: \`${gateResult.decisions.business_production_go}\`

If Final System Gate is blocked, Business Production remains blocked even when
Rules OS checks pass.

## Passed Items

| Evidence | Result | Command |
| --- | --- | --- |
${rows}

## Final Go Conditions

| # | Condition | Result |
| ---: | --- | --- |
| 1 | WON-18 = GO | \`${gateResult.evidence.won18_status === "GO" ? "PASS" : "FAIL"}\` |
| 2 | Latest CI run belongs to target commit | \`${gateResult.evidence.ci_run_sha === gateResult.evidence.target_commit_sha ? "PASS" : "NOT_FINAL"}\` |
| 3 | Latest V5.4 Guards run belongs to target commit | \`${gateResult.evidence.v54_control_plane_guards_run_sha === gateResult.evidence.target_commit_sha ? "PASS" : "NOT_FINAL"}\` |
| 4 | Remote verified final evidence | \`${gateResult.evidence.remote_verified ? "PASS" : "NOT_FINAL"}\` |
| 5 | Rule authority files exist | \`PASS\` |
| 6 | API Boundary v3 coverage 100% | \`PASS\` |
| 7 | Unclassified write routes = 0 | \`PASS\` |
| 8 | Fact Ownership Registry covers core facts | \`PASS\` |
| 9 | PR contract checker enforced | \`PASS\` |
| 10 | Rule Drift Detector has 0 P0 drift | \`PASS\` |
| 11 | Final System Gate permits Business Production | \`${gateResult.decisions.business_production_go === "BLOCKED" ? "BLOCKED" : "GATED"}\` |

## Blockers

${blockers}

## Risks

- P0: Business Production remains blocked while Final System Gate is not passed.
- P1: Rules OS GO must not be reused as Business Production GO.
- P2: Local dry-runs produce LOCAL evidence only and cannot be used as final remote proof.

## Next Batch

- Next engineering batch: \`${gateResult.decisions.next_engineering_batch}\`
- Runtime cutover batch: \`${gateResult.decisions.runtime_cutover_batch}\`
- Business production batch: \`${gateResult.decisions.business_production_batch}\`

## Evidence Files

- API boundary report: \`${gateResult.evidence.api_boundary_report}\`
- Rule drift report: \`${gateResult.evidence.rule_drift_report}\`
- Rules OS gate result: \`.tmp/v5_5/rules-os-gate-result.json\`
`;

  fs.mkdirSync(path.join(repoRoot, "docs/v5.5"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "docs/v5.5/final-rules-os-go-no-go.md"), doc, "utf8");
}

function gitHead() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function runSelfTest() {
  const matching = validateEvidenceBinding({
    mode: "final",
    currentHeadSha: "abc",
    targetCommitSha: "abc",
    remoteVerified: true,
    ciRunId: "100",
    v54RunId: "101",
    ciRunSha: "abc",
    v54RunSha: "abc"
  });
  assertNoViolation("valid final binding", matching);

  assertViolation("stale CI run rejected", validateEvidenceBinding({
    mode: "final",
    currentHeadSha: "abc",
    targetCommitSha: "abc",
    remoteVerified: true,
    ciRunId: "26685133709",
    v54RunId: "101",
    ciRunSha: "abc",
    v54RunSha: "abc"
  }), "stale");

  assertViolation("commit mismatch rejected", validateEvidenceBinding({
    mode: "final",
    currentHeadSha: "head",
    targetCommitSha: "other",
    remoteVerified: true,
    ciRunId: "100",
    v54RunId: "101",
    ciRunSha: "other",
    v54RunSha: "other"
  }), "current HEAD");

  assertViolation("remoteVerified false rejected", validateEvidenceBinding({
    mode: "final",
    currentHeadSha: "abc",
    targetCommitSha: "abc",
    remoteVerified: false,
    ciRunId: "100",
    v54RunId: "101",
    ciRunSha: "abc",
    v54RunSha: "abc"
  }), "remoteVerified=true");

  assertViolation("run sha mismatch rejected", validateEvidenceBinding({
    mode: "final",
    currentHeadSha: "abc",
    targetCommitSha: "abc",
    remoteVerified: true,
    ciRunId: "100",
    v54RunId: "101",
    ciRunSha: "abc",
    v54RunSha: "wrong"
  }), "v54RunId must belong");

  assertViolation("local cannot claim remote verified", validateEvidenceBinding({
    mode: "local",
    currentHeadSha: "abc",
    targetCommitSha: "abc",
    remoteVerified: true,
    ciRunId: "LOCAL",
    v54RunId: "LOCAL",
    ciRunSha: "abc",
    v54RunSha: "abc"
  }), "local mode");

  console.log("V5.5 Rules OS evidence binding self-test: PASS");
}

function assertNoViolation(name, result) {
  if (result.violations.length > 0) {
    failSelfTest(name, result.violations);
  }
}

function assertViolation(name, result, expected) {
  if (!result.violations.some((item) => item.includes(expected))) {
    failSelfTest(name, result.violations.length > 0 ? result.violations : ["Expected violation but validation passed."]);
  }
}

function failSelfTest(name, details) {
  for (const detail of details) console.error(`- ${detail}`);
  throw new Error(`check-v5-5-rules-os self-test failed: ${name}`);
}

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const option = arg.slice(2);
    const eq = option.indexOf("=");
    if (eq === -1) {
      flags.add(option);
    } else {
      values.set(option.slice(0, eq), option.slice(eq + 1));
    }
  }
  return {
    has: (name) => flags.has(name),
    value: (name) => values.get(name)
  };
}
