import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const reportPath = path.join(repoRoot, "docs", "v5.5", "governance-closure-report.md");
const acceptancePath = path.join(repoRoot, "docs", "acceptance", "14-governance-closure-go-no-go.md");
const finalGatePath = path.join(repoRoot, "docs", "v5.4", "final-system-gate-result.json");
const outputArg = process.argv.find((arg) => arg.startsWith("--out="));
const outputPath = outputArg
  ? path.resolve(repoRoot, outputArg.slice("--out=".length))
  : path.join(repoRoot, ".tmp", "v5_5", "governance-closure-result.json");

const latestMainEvidence = {
  headSha: "c9f9bb0f6591fb01cada33431b780af9d94a70ab",
  ciRunId: "26737718512",
  ciRunUrl: "https://github.com/dingz5612-eng/workos-next/actions/runs/26737718512",
  controlPlaneRunId: "26737718494",
  controlPlaneRunUrl: "https://github.com/dingz5612-eng/workos-next/actions/runs/26737718494"
};

const stageEvidence = [
  {
    id: "RF1",
    name: "PR Contract Enforcement",
    status: "FULLY_PASSED",
    sha: "5b491d8",
    evidenceRefs: ["PR #20", "main CI 26704201788", "main V5.4 Guards 26704201785"]
  },
  {
    id: "RF2",
    name: "Latest Main Evidence Binding",
    status: "FULLY_PASSED",
    sha: "926181d",
    evidenceRefs: ["PR #21", "main CI 26704514464", "main V5.4 Guards 26704514470"]
  },
  {
    id: "RF3",
    name: "Rule Drift Final Mode",
    status: "FULLY_PASSED",
    sha: "7455c99",
    evidenceRefs: ["PR #23", "main CI 26706212666", "main V5.4 Guards 26706212650"]
  },
  {
    id: "RF4",
    name: "Fact Ownership Deep Scanner",
    status: "MAIN_GREEN",
    sha: "cbfe44c69b874f8d216bb5311635bd00fda5f42d",
    evidenceRefs: ["branch codex/rf4-fact-ownership-deep-scanner", "included in PR #34 stack", "latest main CI 26737718512", "latest main V5.4 Guards 26737718494"]
  },
  {
    id: "RF5",
    name: "GateResult Full Append-only",
    status: "MAIN_GREEN",
    sha: "9cd7b1acd4b092f44c219c9de6aa6129c8f488b1",
    evidenceRefs: ["branch codex/rf5-gate-result-full-append-only", "included in PR #34 stack", "latest main CI 26737718512", "latest main V5.4 Guards 26737718494"]
  },
  {
    id: "RF6",
    name: "UoW Failed Submission Audit",
    status: "MAIN_GREEN",
    sha: "8390b3ccc1e9aa9c2d4af9766a97ebe79bb86772",
    evidenceRefs: ["branch codex/rf6-uow-failed-submission-audit", "included in PR #34 stack", "latest main CI 26737718512", "latest main V5.4 Guards 26737718494"]
  },
  {
    id: "RF7",
    name: "OperationCase / WorkItem Persistence",
    status: "MAIN_GREEN",
    sha: "a1d51d4232f805494dc1e6a4600384e4bfc89eb6",
    evidenceRefs: ["PR #34", "merge c9f9bb0f6591fb01cada33431b780af9d94a70ab", "latest main CI 26737718512", "latest main V5.4 Guards 26737718494"]
  }
];

function fail(message, details = []) {
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  throw new Error(message);
}

function read(file) {
  if (!fs.existsSync(file)) {
    fail("Governance closure check failed.", [`Missing required file: ${path.relative(repoRoot, file)}`]);
  }
  return fs.readFileSync(file, "utf8");
}

function git(args, options = {}) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (options.allowFailure) {
      return null;
    }

    throw error;
  }
}

function isAncestor(ancestor, descendant) {
  return git(["merge-base", "--is-ancestor", ancestor, descendant], { allowFailure: true }) !== null;
}

const report = read(reportPath);
const acceptance = read(acceptancePath);
const finalGate = JSON.parse(read(finalGatePath));
const headSha = git(["rev-parse", "HEAD"]);
const branch = git(["branch", "--show-current"]);
const originMain = git(["rev-parse", "origin/main"], { allowFailure: true });
const violations = [];

if (originMain !== latestMainEvidence.headSha) {
  violations.push(`origin/main must be ${latestMainEvidence.headSha}; observed ${originMain ?? "unavailable"}`);
}

for (const stage of stageEvidence) {
  const stageLabel = `${stage.id} ${stage.name}`;
  if (!report.includes(stageLabel)) {
    violations.push(`Governance report missing stage: ${stageLabel}`);
  }

  if (!isAncestor(stage.sha, "origin/main")) {
    violations.push(`${stage.id} evidence commit ${stage.sha} is not contained in origin/main`);
  }
}

const requiredReportTokens = [
  "Governance Closure: `GO_FOR_ENGINEERING`",
  "Business Production: `BLOCKED`",
  "Final System Gate: `blocked`",
  `Latest main head: \`${latestMainEvidence.headSha}\``,
  `Latest main CI: \`${latestMainEvidence.ciRunId}\``,
  `Latest main V5.4 Control Plane Guards: \`${latestMainEvidence.controlPlaneRunId}\``,
  "RF8 local status is produced by `scripts/check-governance-closure.mjs` and clean Docker CI-equivalent, not by this static report.",
  "RT-X remains locked until RF8 is `LOCAL_PASSED`."
];

for (const token of requiredReportTokens) {
  if (!report.includes(token)) {
    violations.push(`Governance report missing required token: ${token}`);
  }
}

if (/Business Production:\s*`?(GO|ALLOWED|PRODUCTION_READY)`?/i.test(report)) {
  violations.push("Governance report must not mark Business Production as allowed.");
}

if (/Dormitory\s+L2\s+Production:\s*`?(GO|ALLOWED|PASSED|READY)`?/i.test(report)) {
  violations.push("Governance report must not mark Dormitory L2 Production as allowed.");
}

if (/Repair\s+Production:\s*`?(GO|ALLOWED|PASSED|READY)`?/i.test(report)) {
  violations.push("Governance report must not mark Repair Production as allowed.");
}

if (/Parts\s+Production:\s*`?(GO|ALLOWED|PASSED|READY)`?/i.test(report)) {
  violations.push("Governance report must not mark Parts Production as allowed.");
}

const requiredAcceptanceTokens = [
  "Decision: `GO_FOR_ENGINEERING`",
  "Business Production: `BLOCKED`",
  "Repair / Parts / HR: `L0_OR_BLOCKED`",
  "Next engineering stage after RF8 local pass: `RT-X stacked branch preconstruction`",
  "RT-X remains locked until RF8 is `LOCAL_PASSED`."
];

for (const token of requiredAcceptanceTokens) {
  if (!acceptance.includes(token)) {
    violations.push(`Acceptance report missing required token: ${token}`);
  }
}

if (finalGate.status !== "blocked") {
  violations.push(`Final System Gate must remain blocked for RF8 governance closure; observed ${finalGate.status}`);
}

const result = {
  generatedAtUtc: new Date().toISOString(),
  branch,
  headSha,
  latestMainEvidence,
  governanceClosure: "GO_FOR_ENGINEERING",
  businessProduction: "BLOCKED",
  finalSystemGate: finalGate.status,
  nextAllowedEngineeringStage: "RT-X stacked branch preconstruction after RF8 LOCAL_PASSED",
  nextAllowedBusinessStage: "none",
  dormitoryL2Production: "BLOCKED",
  repairPartsHrStatus: "L0_OR_BLOCKED",
  stages: [
    ...stageEvidence,
    {
      id: "RF8",
      name: "Governance Closure Final Report",
      status: "LOCAL_CHECKED_BY_SCRIPT",
      sha: headSha,
      evidenceRefs: [
        "docs/v5.5/governance-closure-report.md",
        "docs/acceptance/14-governance-closure-go-no-go.md",
        "scripts/check-governance-closure.mjs"
      ]
    }
  ],
  risks: {
    p0: [],
    p1: [
      "Final System Gate remains blocked; Business Production and Dormitory L2 are not allowed.",
      "RT-X cannot start until RF8 clean Docker CI-equivalent passes locally."
    ],
    p2: [
      "RF4-RF7 were integrated into latest main through the RF7 stacked merge; RF8 records that evidence without changing the merge train policy for later stages."
    ]
  },
  violations
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

if (violations.length > 0) {
  fail("Governance closure check failed.", violations);
}

console.log(`Governance closure check: PASS (${path.relative(repoRoot, outputPath)})`);
