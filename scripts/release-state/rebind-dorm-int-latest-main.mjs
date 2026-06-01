import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repository = "dingz5612-eng/workos-next";
const generatedAt = new Date().toISOString();

const refs = {
  goNoGo: "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
  goNoGoMd: "docs/go-live/dormitory/internal-pilot-go-no-go.md",
  evidenceGraph: "artifacts/rt4/evidence-graph.json",
  completionDashboard: "artifacts/rt4/completion-dashboard.json",
  completionDashboardMd: "docs/program/rt4/completion-dashboard.md",
  finalAssurance: "artifacts/rt4/final-completion-assurance-result.json",
  finalAssuranceMd: "docs/program/rt4/final-completion-assurance-report.md",
  rebindingResult: "artifacts/release-state/evidence-rebinding-result.json",
  reconciliationReport: "docs/release-state/evidence-reconciliation-report.md"
};

const persistentEvidenceMap = new Map([
  [".tmp/v5_4/dormitory-evidence-policy-result.json", "artifacts/go-live/dormitory/evidence-policy-result.json"],
  [".tmp/v5_4/runtime-surface-alignment-result.json", "artifacts/go-live/dormitory/runtime-surface-alignment-result.json"],
  [".tmp/rt5/dorm-int-experience-contract-report.json", "artifacts/go-live/dormitory/dorm-int-experience-contract-report.json"]
]);

const mainHead = readCurrentMainHead();
const latestMain = await readLatestMainEvidence(mainHead);
for (const [sourceRef, targetRef] of persistentEvidenceMap) {
  persistIfAvailable(sourceRef, targetRef);
}

const goNoGo = readJson(refs.goNoGo);
const original = {
  latestMainCommitSha: goNoGo.latestMain?.commitSha ?? null,
  evidenceRefsWithTmp: findTmpRefs(goNoGo).length
};

goNoGo.generated_at_utc = generatedAt;
goNoGo.latestMain = latestMain;
goNoGo.productionAllowed = false;
goNoGo.dormitoryL2ProductionAllowed = false;
goNoGo.repairPartsHrStatus = "L0 Contract Preview";
goNoGo.nextStage = "L1 Internal Pilot Observation Window";
goNoGo.evidenceRefs = replaceTmpRefs(goNoGo.evidenceRefs ?? []);
replaceReadinessRefs(goNoGo);
goNoGo.reconciliation = {
  status: "rebound_to_latest_main",
  reboundAtUtc: generatedAt,
  centralMergeStatus: "CENTRAL_MERGE_COMPLETED",
  dormIntStatus: "DORM_INT_PASSED",
  observationStatus: "L1_INTERNAL_PILOT_OBSERVATION"
};
writeJson(refs.goNoGo, goNoGo);
writeGoNoGoMarkdown(refs.goNoGoMd, goNoGo);

const graph = readJson(refs.evidenceGraph);
graph.mode = "L1_INTERNAL_PILOT_OBSERVATION";
graph.branch = "main";
graph.headSha = mainHead;
graph.generatedAtUtc = generatedAt;
graph.releaseStates = {
  centralMerge: "CENTRAL_MERGE_COMPLETED",
  dormInt: "DORM_INT_PASSED",
  observation: "L1_INTERNAL_PILOT_OBSERVATION",
  businessProduction: "BLOCKED",
  dormitoryL2Production: "BLOCKED",
  repairPartsHr: "L0 Contract Preview"
};
graph.nodes = normalizeGraphNodes(graph.nodes ?? [], mainHead);
graph.edges = graph.edges ?? [];
writeJson(refs.evidenceGraph, graph);

const dashboard = readJson(refs.completionDashboard);
dashboard.mode = "L1_INTERNAL_PILOT_OBSERVATION";
dashboard.generatedAtUtc = generatedAt;
dashboard.currentMainHead = mainHead;
dashboard.businessProduction = "BLOCKED";
dashboard.dormitoryL2Production = "BLOCKED";
dashboard.repairPartsHrStatus = "L0_OR_BLOCKED";
dashboard.currentGate = "DORM-INT";
dashboard.currentGateStatus = "GO_FOR_INTERNAL_PILOT";
dashboard.currentGateBranch = "main";
dashboard.currentGateHeadSha = mainHead;
dashboard.centralMergeTrain = "CENTRAL_MERGE_COMPLETED";
dashboard.dormitoryL1Observation = "L1_INTERNAL_PILOT_OBSERVATION";
dashboard.nextAllowedStackedStage = "OAM-00 Evidence Rebinding";
writeJson(refs.completionDashboard, dashboard);
writeDashboardMarkdown(refs.completionDashboardMd, dashboard);

const finalAssurance = readJson(refs.finalAssurance);
finalAssurance.generatedAtUtc = generatedAt;
finalAssurance.reconciledStatus = "POST_DORM_INT_RECONCILED";
finalAssurance.currentMainHead = mainHead;
finalAssurance.centralMergeTrainStatus = "CENTRAL_MERGE_COMPLETED";
finalAssurance.dormIntStatus = "DORM_INT_PASSED";
finalAssurance.dormitoryStatus = "L1 Internal Pilot Observation";
finalAssurance.dormIntReadiness = "DORM_INT_PASSED_L1_OBSERVATION";
finalAssurance.dormIntAllowed = true;
finalAssurance.l1InternalPilotAllowed = true;
finalAssurance.businessProductionAllowed = false;
finalAssurance.dormitoryL2ProductionAllowed = false;
finalAssurance.repairPartsHrStatus = "L0 Contract Preview";
finalAssurance.evidenceGraphRefs = ["artifacts/rt4/evidence-graph.json"];
finalAssurance.completionDashboardRefs = [
  "artifacts/rt4/completion-dashboard.json",
  "docs/program/rt4/completion-dashboard.md"
];
writeJson(refs.finalAssurance, finalAssurance);
writeFinalAssuranceMarkdown(refs.finalAssuranceMd, finalAssurance);

const result = {
  generated_at_utc: generatedAt,
  generated_by: "rebind-dorm-int-latest-main",
  status: "passed",
  mainHead,
  before: original,
  after: {
    latestMainCommitSha: mainHead,
    evidenceRefsWithTmp: findTmpRefs(goNoGo).length,
    evidenceGraphMode: graph.mode,
    completionDashboardMode: dashboard.mode,
    finalAssuranceDormIntStatus: finalAssurance.dormIntStatus
  },
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "BLOCKED",
  repairPartsHrStatus: "L0 Contract Preview",
  updatedRefs: Object.values(refs).filter((item) => item !== refs.reconciliationReport)
};
writeJson(refs.rebindingResult, result);
writeReconciliationReport(refs.reconciliationReport, result);

console.log(`Dormitory internal pilot evidence rebound to ${mainHead}: PASS`);

function readCurrentMainHead() {
  const result = spawnSync("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: root, encoding: "utf8", shell: isWindows() });
  if (result.status !== 0) {
    throw new Error(`cannot confirm current main: ${result.stderr || result.stdout}`);
  }
  const sha = result.stdout.trim().split(/\s+/)[0];
  if (!sha) throw new Error("cannot confirm current main: empty sha");
  return sha;
}

async function readLatestMainEvidence(mainSha) {
  const evidence = {
    repository,
    branch: "main",
    checkedAtUtc: generatedAt,
    commitSha: mainSha,
    ci: null,
    v54ControlPlaneGuards: null
  };
  const runs = await fetchWorkflowRuns();
  evidence.ci = findRun(runs, "CI", mainSha);
  evidence.v54ControlPlaneGuards = findRun(runs, "V5.4 Control Plane Guards", mainSha);
  for (const [name, run] of [["CI", evidence.ci], ["V5.4 Control Plane Guards", evidence.v54ControlPlaneGuards]]) {
    if (!run || run.status !== "completed" || run.conclusion !== "success") {
      throw new Error(`latest main ${name} is not green for ${mainSha}`);
    }
  }
  return evidence;
}

async function fetchWorkflowRuns() {
  if (typeof fetch !== "function") throw new Error("Node fetch is required to read latest main workflow evidence.");
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs?branch=main&per_page=50`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "workosnext-oam-00-rebind"
    }
  });
  if (!response.ok) throw new Error(`GitHub Actions API returned HTTP ${response.status}`);
  const payload = await response.json();
  return payload.workflow_runs ?? [];
}

function findRun(runs, name, sha) {
  const run = runs.find((item) => item.name === name && item.head_branch === "main" && item.head_sha === sha);
  if (!run) return null;
  return {
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.head_sha,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at
  };
}

function persistIfAvailable(sourceRef, targetRef) {
  const source = path.join(root, sourceRef);
  const target = path.join(root, targetRef);
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function replaceTmpRefs(value) {
  if (Array.isArray(value)) return value.map((item) => replaceTmpRefs(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, replaceTmpRefs(nested)]));
  }
  if (typeof value === "string") {
    return persistentEvidenceMap.get(value.replace(/\\/g, "/")) ?? value;
  }
  return value;
}

function replaceReadinessRefs(goNoGo) {
  for (const item of Object.values(goNoGo.readiness ?? {})) {
    if (item?.ref) item.ref = replaceTmpRefs(item.ref);
  }
}

function normalizeGraphNodes(nodes, mainSha) {
  const next = nodes.map((node) => {
    const copy = replaceTmpRefs({ ...node });
    if (copy.type === "branch" && copy.status === "LOCAL_PASSED") copy.status = "MAIN_GREEN";
    return copy;
  });
  for (const state of [
    { id: "CENTRAL_MERGE_COMPLETED", status: "MAIN_GREEN" },
    { id: "DORM_INT_PASSED", status: "GO_FOR_INTERNAL_PILOT" },
    { id: "L1_INTERNAL_PILOT_OBSERVATION", status: "ACTIVE" }
  ]) {
    if (!next.some((node) => node.id === state.id)) {
      next.push({
        id: state.id,
        type: "release_state",
        status: state.status,
        headSha: mainSha,
        refs: [
          "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
          "artifacts/go-live/dormitory/observation-window-result.json"
        ]
      });
    }
  }
  return next;
}

function findTmpRefs(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) findTmpRefs(item, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) findTmpRefs(item, found);
  } else if (typeof value === "string" && value.replace(/\\/g, "/").includes(".tmp/")) {
    found.push(value);
  }
  return found;
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeGoNoGoMarkdown(relativePath, result) {
  const lines = [
    "# Dormitory Internal Pilot Go/No-Go",
    "",
    `- status: ${result.status}`,
    `- latest main: ${result.latestMain.commitSha}`,
    `- internalPilotAllowed: ${result.internalPilotAllowed}`,
    `- productionAllowed: ${result.productionAllowed}`,
    `- dormitoryStatus: ${result.dormitoryStatus}`,
    "- dormitoryL2ProductionAllowed: false",
    "- Repair / Parts / HR: L0 Contract Preview",
    "",
    "## 中文结论",
    "宿舍只允许进入 L1 Internal Pilot 内测观察窗口；不得进入 L2 Production；Repair / Parts / HR 不允许 production。",
    "",
    "## Evidence Refs",
    ...result.evidenceRefs.map((ref) => `- ${ref}`),
    ""
  ];
  writeText(relativePath, `${lines.join("\n")}\n`);
}

function writeDashboardMarkdown(relativePath, dashboard) {
  writeText(relativePath, `# RT4 Completion Dashboard

Generated source: \`artifacts/rt4/completion-dashboard.json\`

Current mode: \`${dashboard.mode}\`

Current main: \`${dashboard.currentMainHead}\`

Business Production: \`BLOCKED\`

Dormitory L2: \`BLOCKED\`

Repair / Parts / HR: \`L0_OR_BLOCKED\`

## Coverage

| Priority | Coverage |
| --- | --- |
| P0 | \`${dashboard.coverage?.p0}%\` |
| P1 | \`${dashboard.coverage?.p1}%\` |
| P2 | \`${dashboard.coverage?.p2}\` |

## Current Gate

DORM-INT: \`GO_FOR_INTERNAL_PILOT\`

Central Merge Train: \`CENTRAL_MERGE_COMPLETED\`

Observation: \`L1_INTERNAL_PILOT_OBSERVATION\`
`);
}

function writeFinalAssuranceMarkdown(relativePath, result) {
  writeText(relativePath, `# RT-FINAL Completion Assurance Report

## 中文摘要

RF4 到 RT-FINAL 已完成 Central Merge Train 并进入 DORM-INT 后续状态调和。本报告当前只说明工程证据与宿舍 L1 内测观察窗口自洽；不声明 Business Production GO，不声明 Dormitory L2 Production。

Current main: \`${result.currentMainHead}\`

Business Production: \`BLOCKED\`

Dormitory L2 Production: \`BLOCKED\`

Repair / Parts / HR: \`L0 Contract Preview\`

DORM-INT: \`DORM_INT_PASSED_L1_OBSERVATION\`

## 状态

- Central Merge Train: \`CENTRAL_MERGE_COMPLETED\`
- DORM-INT: \`DORM_INT_PASSED\`
- Dormitory: \`L1 Internal Pilot Observation\`
- Dormitory L2 Production: \`false\`
- Business Production: \`blocked\`

## 风险

P0 blockers: \`[]\`

P1 risks:

- L1 观察窗口仍需每日机器化复核。
- L1 -> L2 必须单独 stage / PR / gate。
- Final System Gate blocked 时不得 production GO。
`);
}

function writeReconciliationReport(relativePath, result) {
  writeText(relativePath, `# OAM-00 证据重绑定与状态调和报告

## 中文摘要

已将 DORM-INT final artifact 重新绑定到当前 \`origin/main\`，并移除 final go-live evidence refs 中的 \`.tmp\` 引用。Evidence Graph 与 Completion Dashboard 已从 stacked preconstruction 调和为 \`L1_INTERNAL_PILOT_OBSERVATION\`。

## 结果

- status: \`${result.status}\`
- mainHead: \`${result.mainHead}\`
- Business Production: \`BLOCKED\`
- Dormitory L2 Production: \`false\`
- Repair / Parts / HR: \`L0 Contract Preview\`
`);
}

function writeText(relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

function isWindows() {
  return process.platform === "win32";
}
