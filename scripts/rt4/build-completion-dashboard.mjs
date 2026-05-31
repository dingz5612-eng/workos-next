import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matrixPath = path.join(root, "docs", "program", "rt4", "six-file-requirement-matrix.yml");
const graphPath = path.join(root, "artifacts", "rt4", "evidence-graph.json");
const branchMatrixPath = path.join(root, "docs", "program", "rt4", "stacked-branch-matrix.yml");
const dashboardJsonPath = path.join(root, "artifacts", "rt4", "completion-dashboard.json");
const dashboardMdPath = path.join(root, "docs", "program", "rt4", "completion-dashboard.md");

const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const branchMatrix = JSON.parse(fs.readFileSync(branchMatrixPath, "utf8"));
const reqs = matrix.requirements ?? [];
const branches = branchMatrix.branches ?? [];

function coverage(priority) {
  const items = reqs.filter((req) => req.priority === priority);
  if (items.length === 0) return 100;
  const covered = items.filter((req) => req.status !== "not_started" || req.blockers?.length > 0).length;
  return Math.round((covered / items.length) * 100);
}

const currentBranch = [...branches].reverse().find((item) => item.localCiStatus === "LOCAL_PASSED") ?? branches.at(-1);
const currentGate = currentBranch?.taskId ?? "UNKNOWN";
const nextAllowed = currentGate === "RT-0"
  ? "RT-1 stacked preconstruction"
  : currentGate === "RT-1"
    ? "RT-DB stacked preconstruction"
    : currentGate === "RT-X"
    ? "RT-0 stacked preconstruction"
    : "next stacked preconstruction";

const dashboard = {
  version: "rt4.completion-dashboard.v1",
  mode: "STACKED_PRECONSTRUCTION",
  generatedAtUtc: new Date().toISOString(),
  businessProduction: "BLOCKED",
  dormitoryL2Production: "BLOCKED",
  repairPartsHrStatus: "L0_OR_BLOCKED",
  coverage: {
    p0: coverage("P0"),
    p1: coverage("P1"),
    p2: "tracked"
  },
  currentGate,
  currentGateStatus: currentBranch?.localCiStatus ?? "UNKNOWN",
  currentGateBranch: currentBranch?.branch ?? "",
  currentGateHeadSha: currentBranch?.headSha ?? "",
  nextAllowedStackedStage: nextAllowed,
  centralMergeTrain: "LOCKED_UNTIL_RT_FINAL_LOCAL_PASSED",
  evidenceGraphNodes: graph.nodes?.length ?? 0
};

fs.mkdirSync(path.dirname(dashboardJsonPath), { recursive: true });
fs.writeFileSync(dashboardJsonPath, `${JSON.stringify(dashboard, null, 2)}\n`);

const markdown = `# RT4 Completion Dashboard

Generated source: \`artifacts/rt4/completion-dashboard.json\`

Current mode: \`${dashboard.mode}\`

Business Production: \`${dashboard.businessProduction}\`

Dormitory L2: \`${dashboard.dormitoryL2Production}\`

Repair / Parts / HR: \`${dashboard.repairPartsHrStatus}\`

## Coverage

| Priority | Coverage |
| --- | --- |
| P0 | \`${dashboard.coverage.p0}%\` |
| P1 | \`${dashboard.coverage.p1}%\` |
| P2 | \`${dashboard.coverage.p2}\` |

## Current Gate

${dashboard.currentGate}: \`${dashboard.currentGateStatus}\`

Current branch: \`${dashboard.currentGateBranch}\`

Head sha: \`${dashboard.currentGateHeadSha}\`

Next allowed stage after ${dashboard.currentGate} local pass: \`${dashboard.nextAllowedStackedStage}\`.

Formal Central Merge Train: \`${dashboard.centralMergeTrain}\`.
`;

fs.writeFileSync(dashboardMdPath, markdown);
console.log(`RT4 completion dashboard: wrote ${path.relative(root, dashboardJsonPath)} and ${path.relative(root, dashboardMdPath)}`);
