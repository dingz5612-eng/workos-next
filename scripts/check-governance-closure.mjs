import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const reportPath = path.join(repoRoot, "docs", "v5.5", "governance-closure-report.md");
const acceptancePath = path.join(repoRoot, "docs", "acceptance", "14-governance-closure-go-no-go.md");
const outputArg = process.argv.find((arg) => arg.startsWith("--out="));
const outputPath = outputArg
  ? path.resolve(repoRoot, outputArg.slice("--out=".length))
  : path.join(repoRoot, ".tmp", "v5_5", "governance-closure-result.json");

const requiredStages = [
  "RF1 PR Contract Enforcement",
  "RF2 Latest Main Evidence Binding",
  "RF3 Rule Drift Final Mode",
  "RF4 Fact Ownership Deep Scanner",
  "RF5 GateResult Full Append-only",
  "RF6 UoW Failed Submission Audit",
  "RF7 OperationCase / WorkItem Persistence"
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

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

const report = read(reportPath);
const acceptance = read(acceptancePath);
const headSha = git(["rev-parse", "HEAD"]);
const branch = git(["branch", "--show-current"]);
const violations = [];

for (const stage of requiredStages) {
  if (!report.includes(stage)) {
    violations.push(`Governance report missing stage: ${stage}`);
  }
}

const requiredReportTokens = [
  "Governance Closure: `GO_FOR_ENGINEERING`",
  "Business Production: `BLOCKED`",
  "Final System Gate: `blocked`",
  "Repair Production: `BLOCKED`",
  "Parts Production: `BLOCKED`",
  "RF4-RF8 remain `STACKED_READY` until Central Merge Train."
];

for (const token of requiredReportTokens) {
  if (!report.includes(token)) {
    violations.push(`Governance report missing required token: ${token}`);
  }
}

if (/Business Production:\s*`?(GO|ALLOWED|PRODUCTION_READY)`?/i.test(report)) {
  violations.push("Governance report must not mark Business Production as allowed.");
}

const requiredAcceptanceTokens = [
  "Decision: `GO_FOR_ENGINEERING`",
  "Business Production: `BLOCKED`",
  "Repair / Parts: `L0_ONLY`"
];

for (const token of requiredAcceptanceTokens) {
  if (!acceptance.includes(token)) {
    violations.push(`Acceptance report missing required token: ${token}`);
  }
}

const result = {
  generatedAtUtc: new Date().toISOString(),
  branch,
  headSha,
  governanceClosure: "GO_FOR_ENGINEERING",
  businessProduction: "BLOCKED",
  finalSystemGate: "blocked",
  nextAllowedEngineeringStage: "RT-X stacked preconstruction",
  nextAllowedBusinessStage: "none",
  repairProduction: "BLOCKED",
  partsProduction: "BLOCKED",
  stages: [
    {
      id: "RF1",
      name: "PR Contract Enforcement",
      status: "FULLY_PASSED",
      pr: 20,
      evidenceRefs: ["PR #20", "main CI 26704201788", "main V5.4 Guards 26704201785"]
    },
    {
      id: "RF2",
      name: "Latest Main Evidence Binding",
      status: "FULLY_PASSED",
      pr: 21,
      evidenceRefs: ["PR #21", "main CI 26704514464", "main V5.4 Guards 26704514470"]
    },
    {
      id: "RF3",
      name: "Rule Drift Final Mode",
      status: "FULLY_PASSED",
      pr: 23,
      evidenceRefs: ["PR #23", "PR CI 26706154121", "PR V5.4 Guards 26706154125", "main CI 26706212666", "main V5.4 Guards 26706212650"]
    },
    {
      id: "RF4",
      name: "Fact Ownership Deep Scanner",
      status: "STACKED_READY",
      pr: null,
      evidenceRefs: ["branch codex/rf4-fact-ownership-deep-scanner", "head cbfe44c69b874f8d216bb5311635bd00fda5f42d"]
    },
    {
      id: "RF5",
      name: "GateResult Full Append-only",
      status: "STACKED_READY",
      pr: null,
      evidenceRefs: ["branch codex/rf5-gate-result-full-append-only", "head 9cd7b1acd4b092f44c219c9de6aa6129c8f488b1"]
    },
    {
      id: "RF6",
      name: "UoW Failed Submission Audit",
      status: "PR_OPENED",
      pr: 22,
      evidenceRefs: ["PR #22", "branch codex/rf6-uow-failed-submission-audit", "head 8390b3ccc1e9aa9c2d4af9766a97ebe79bb86772"]
    },
    {
      id: "RF7",
      name: "OperationCase / WorkItem Persistence",
      status: "PR_OPENED",
      pr: 24,
      evidenceRefs: ["PR #24", "branch codex/rf7-operationcase-workitem-persistence", "head a1d51d4232f805494dc1e6a4600384e4bfc89eb6"]
    }
  ],
  risks: {
    p0: [],
    p1: [
      "RF4-RF8 are not FULLY_PASSED until Central Merge Train merges each PR/branch in order and main is green after each merge."
    ],
    p2: [
      "Existing analyzer recommendation warnings may still appear in unrelated V5.4 guard output."
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
