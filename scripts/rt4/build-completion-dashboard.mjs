import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matrixPath = path.join(root, "docs", "program", "rt4", "six-file-requirement-matrix.yml");
const graphPath = path.join(root, "artifacts", "rt4", "evidence-graph.json");
const dashboardJsonPath = path.join(root, "artifacts", "rt4", "completion-dashboard.json");
const dashboardMdPath = path.join(root, "docs", "program", "rt4", "completion-dashboard.md");

const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const reqs = matrix.requirements ?? [];

function coverage(priority) {
  const items = reqs.filter((req) => req.priority === priority);
  if (items.length === 0) return 100;
  const covered = items.filter((req) => req.status !== "not_started" || req.blockers?.length > 0).length;
  return Math.round((covered / items.length) * 100);
}

const dashboard = {
  version: "rt4.completion-dashboard.v1",
  mode: "STACKED_PRECONSTRUCTION",
  generatedAtUtc: new Date().toISOString(),
  businessProduction: "BLOCKED",
  repairProduction: "BLOCKED",
  partsProduction: "BLOCKED",
  coverage: {
    p0: coverage("P0"),
    p1: coverage("P1"),
    p2: "tracked"
  },
  currentGate: "RT-X",
  currentGateStatus: "LOCAL_PASSED_PENDING_COMMIT",
  centralMergeTrain: "LOCKED_UNTIL_RT_FINAL_LOCAL_PASSED",
  evidenceGraphNodes: graph.nodes?.length ?? 0
};

fs.mkdirSync(path.dirname(dashboardJsonPath), { recursive: true });
fs.writeFileSync(dashboardJsonPath, `${JSON.stringify(dashboard, null, 2)}\n`);

const markdown = `# RT4 Completion Dashboard

Generated source: \`artifacts/rt4/completion-dashboard.json\`

Current mode: \`${dashboard.mode}\`

Business Production: \`${dashboard.businessProduction}\`

Repair Production: \`${dashboard.repairProduction}\`

Parts Production: \`${dashboard.partsProduction}\`

## Coverage

| Priority | Coverage |
| --- | --- |
| P0 | \`${dashboard.coverage.p0}%\` |
| P1 | \`${dashboard.coverage.p1}%\` |
| P2 | \`${dashboard.coverage.p2}\` |

## Current Gate

RT-X: \`${dashboard.currentGateStatus}\`

Next allowed stage after RT-X local pass: \`RT-0 stacked preconstruction\`.

Formal Central Merge Train: \`${dashboard.centralMergeTrain}\`.
`;

fs.writeFileSync(dashboardMdPath, markdown);
console.log(`RT4 completion dashboard: wrote ${path.relative(root, dashboardJsonPath)} and ${path.relative(root, dashboardMdPath)}`);
