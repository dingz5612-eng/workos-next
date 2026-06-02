import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = process.cwd();
const generatedAt = new Date().toISOString();

const checkerCommands = [
  ["OAM-00", "node", ["scripts/release-state/check-evidence-reconciliation.mjs"]],
  ["OAM-00", "node", ["scripts/rt4/check-final-evidence-freshness.mjs"]],
  ["OAM-01", "node", ["scripts/release-state/check-current-release-state.mjs"]],
  ["OAM-01", "node", ["scripts/release-state/check-current-state-authority.mjs"]],
  ["OAM-02", "node", ["scripts/business/check-scenario-field-contract.mjs"]],
  ["OAM-02", "node", ["scripts/business/check-canonical-scenario-map.mjs"]],
  ["OAM-02", "node", ["scripts/business/check-evidence-coverage-contract.mjs"]],
  ["OAM-02", "node", ["scripts/business/check-ledger-posting-contract.mjs"]],
  ["OAM-02", "node", ["scripts/business/check-metric-formula-contract.mjs"]],
  ["OAM-03", "node", ["scripts/proof/check-runtime-proof-result.mjs"]],
  ["OAM-04", "node", ["scripts/surface/check-oam-04-surface-twin-plane-contract.mjs"]],
  ["OAM-05", "node", ["scripts/finance/check-finance-semantic-truth.mjs"]],
  ["OAM-05", "node", ["scripts/finance/check-ledger-basis-semantics.mjs"]],
  ["OAM-05", "node", ["scripts/check-ledger-semantic-rules.mjs"]],
  ["OAM-06", "node", ["scripts/trust/check-trust-boundary-kernel.mjs"]],
  ["OAM-07", "node", ["scripts/operations/check-dormitory-slo.mjs"]],
  ["OAM-07", "node", ["scripts/operations/generate-observation-day.mjs"]],
  ["OAM-07", "node", ["scripts/operations/check-l1-to-l2-readiness.mjs"]],
  ["OAM-07", "node", ["scripts/operations/check-incident-learning-loop.mjs"]],
  ["OAM-08", "node", ["scripts/golden-domain/check-domain-replication-pack.mjs"]],
  ["OAM-09", "node", ["scripts/portfolio/check-business-line-maturity.mjs"]],
  ["OAM-09", "node", ["scripts/portfolio/check-production-governance.mjs"]],
  ["OAM-FINAL", "node", ["scripts/rt4/verify-evidence-graph.mjs"]],
  ["OAM-FINAL", "node", ["scripts/rt4/check-completion-dashboard.mjs"]]
];

const stageArtifacts = [
  ["OAM-00", "artifacts/release-state/evidence-rebinding-result.json"],
  ["OAM-00", "artifacts/release-state/evidence-reconciliation-result.json"],
  ["OAM-01", "artifacts/release-state/current-state.json"],
  ["OAM-01", "artifacts/release-state/state-transition-log.json"],
  ["OAM-02", "artifacts/business/dormitory/business-semantic-contract-result.json"],
  ["OAM-03", "artifacts/proof/runtime-proof-result.json"],
  ["OAM-03", "artifacts/go-live/dormitory/runtime-proof-result.json"],
  ["OAM-04", "artifacts/surface/oam-04-surface-twin-plane-result.json"],
  ["OAM-05", "artifacts/finance/finance-semantic-truth-result.json"],
  ["OAM-05", "artifacts/go-live/dormitory/ledger-semantic-result.json"],
  ["OAM-06", "artifacts/trust/trust-boundary-result.json"],
  ["OAM-07", "artifacts/operations/dormitory/slo-result.json"],
  ["OAM-07", "artifacts/operations/dormitory/observation-day-01.json"],
  ["OAM-07", "artifacts/operations/dormitory/l1-to-l2-readiness.json"],
  ["OAM-08", "artifacts/golden-domain/dormitory/golden-pack-result.json"],
  ["OAM-09", "artifacts/portfolio/business-line-maturity-result.json"],
  ["OAM-09", "artifacts/portfolio/production-governance-result.json"]
];

const failures = [];
const commandResults = [];

function main() {
  for (const [stage, artifactPath] of stageArtifacts) {
    if (!exists(artifactPath)) failures.push(`${stage} 缺少 artifact：${artifactPath}`);
  }

  for (const [stage, command, args] of checkerCommands) {
    commandResults.push(runChecker(stage, command, args));
  }

  const mainHead = currentMainHead();
  const currentState = readJson("artifacts/release-state/current-state.json");
  const goNoGo = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
  const evidenceGraph = readJson("artifacts/rt4/evidence-graph.json");
  const dashboard = readJson("artifacts/rt4/completion-dashboard.json");
  const rtFinal = readJson("artifacts/rt4/final-completion-assurance-result.json");
  const maturity = readJson("artifacts/portfolio/business-line-maturity-result.json");
  const productionGovernance = readJson("artifacts/portfolio/production-governance-result.json");

  assertEqual(currentState.currentMain?.headSha, mainHead, "current-state main HEAD 必须等于 origin/main。");
  assertEqual(currentState.currentMain?.ci?.headSha, mainHead, "current-state CI headSha 必须等于 origin/main。");
  assertEqual(currentState.currentMain?.ci?.conclusion, "success", "current-state CI 必须 green。");
  assertEqual(currentState.currentMain?.v54ControlPlaneGuards?.headSha, mainHead, "current-state V5.4 Guards headSha 必须等于 origin/main。");
  assertEqual(currentState.currentMain?.v54ControlPlaneGuards?.conclusion, "success", "current-state V5.4 Guards 必须 green。");

  assertEqual(goNoGo.latestMain?.commitSha, mainHead, "DORM-INT final artifact latestMain.commitSha 必须等于 origin/main。");
  assertEqual(goNoGo.latestMain?.ci?.headSha, mainHead, "DORM-INT final artifact CI headSha 必须等于 origin/main。");
  assertEqual(goNoGo.latestMain?.v54ControlPlaneGuards?.headSha, mainHead, "DORM-INT final artifact V5.4 Guards headSha 必须等于 origin/main。");
  assertNoTmpRefs("artifacts/go-live/dormitory/internal-pilot-go-no-go.json", goNoGo);
  assertNoTmpRefs("artifacts/rt4/evidence-graph.json", evidenceGraph);
  assertNoTmpRefs("artifacts/rt4/completion-dashboard.json", dashboard);

  assertEqual(evidenceGraph.mode, "L1_INTERNAL_PILOT_OBSERVATION", "Evidence Graph 必须处于 L1 观察窗口。");
  assertEqual(dashboard.mode, "L1_INTERNAL_PILOT_OBSERVATION", "Completion Dashboard 必须处于 L1 观察窗口。");
  assertEqual(currentState.authoritativeState?.dormitory, "L1_INTERNAL_PILOT_OBSERVATION", "Dormitory 只能是 L1_INTERNAL_PILOT_OBSERVATION。");
  assertEqual(currentState.authoritativeState?.businessProduction, "BLOCKED", "Business Production 必须 blocked。");
  assertEqual(currentState.authoritativeState?.dormitoryL2, "BLOCKED", "Dormitory L2 必须 blocked。");
  assertEqual(currentState.authoritativeState?.repair, "L0 Contract Preview", "Repair 必须保持 L0 Contract Preview。");
  assertEqual(currentState.authoritativeState?.parts, "L0 Contract Preview", "Parts 必须保持 L0 Contract Preview。");
  assertEqual(currentState.authoritativeState?.hr, "L0 Contract Preview", "HR 必须保持 L0 Contract Preview。");

  assertFalse(goNoGo.productionAllowed, "DORM-INT final artifact 不得允许 production。");
  assertFalse(goNoGo.dormitoryL2ProductionAllowed, "DORM-INT final artifact 不得允许 Dormitory L2。");
  assertFalse(rtFinal.businessProductionAllowed, "RT-FINAL artifact 不得允许 Business Production。");
  assertFalse(rtFinal.dormitoryL2ProductionAllowed, "RT-FINAL artifact 不得允许 Dormitory L2。");
  assertEqual(rtFinal.repairPartsHrStatus, "L0 Contract Preview", "RT-FINAL 必须保持 Repair / Parts / HR L0。");
  assertFalse(maturity.dormitory?.productionAllowed, "Business-line maturity 不得允许 Dormitory production。");
  assertFalse(maturity.dormitory?.l2ProductionAllowed, "Business-line maturity 不得允许 Dormitory L2。");
  assertEqual(productionGovernance.portfolioDecision, "blocked", "Portfolio production governance 必须 blocked。");
  assertFalse(productionGovernance.businessProductionAllowed, "Portfolio production governance 不得允许 Business Production。");

  const oamStages = buildStageSummary();
  const result = {
    generatedAtUtc: generatedAt,
    generatedBy: "check-oam-final-acceptance",
    branch: currentBranch(),
    currentMainHead: mainHead,
    ciRunId: currentState.currentMain?.ci?.id ?? null,
    v54GuardsRunId: currentState.currentMain?.v54ControlPlaneGuards?.id ?? null,
    status: failures.length === 0 ? "passed" : "failed",
    finalStatus: failures.length === 0 ? "OAM_FINAL_ACCEPTANCE_LOCAL_PASSED" : "OAM_FINAL_ACCEPTANCE_FAILED",
    oamStages,
    currentStateSummary: {
      dormitory: "L1_INTERNAL_PILOT_OBSERVATION",
      dormitoryL2ProductionAllowed: false,
      businessProduction: "blocked",
      repairPartsHr: "L0 Contract Preview"
    },
    evidenceGraphStatus: evidenceGraph.mode,
    completionDashboardStatus: dashboard.mode,
    noGoItems: failures,
    holdItems: [],
    evidenceRefs: [
      "artifacts/release-state/current-state.json",
      "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
      "artifacts/rt4/evidence-graph.json",
      "artifacts/rt4/completion-dashboard.json",
      "artifacts/portfolio/business-line-maturity-result.json",
      "artifacts/portfolio/production-governance-result.json"
    ],
    tests: commandResults
  };

  writeJson("artifacts/oam/oam-final-acceptance-result.json", result);
  writeMarkdown("docs/oam/oam-final-acceptance-report.md", renderReport(result));
  upsertEvidenceLedger([
    ledgerEntry("OAM_FINAL_ACCEPTANCE", result.finalStatus, "artifacts/oam/oam-final-acceptance-result.json", mainHead),
    ledgerEntry("CURRENT_STATE_AUTHORITY", "L1_INTERNAL_PILOT_OBSERVATION", "artifacts/release-state/current-state.json", mainHead),
    ledgerEntry("PORTFOLIO_GOVERNANCE", "BLOCKED", "artifacts/portfolio/production-governance-result.json", mainHead)
  ]);

  if (failures.length > 0) {
    for (const failure of failures) console.error(`P0 ${failure}`);
    throw new Error("OAM final acceptance failed.");
  }

  console.log("OAM final acceptance: PASS");
}

function buildStageSummary() {
  const byStage = new Map();
  for (const [stage, artifactPath] of stageArtifacts) {
    const item = byStage.get(stage) ?? { stage, artifacts: [], checkers: [] };
    item.artifacts.push(artifactPath);
    byStage.set(stage, item);
  }
  for (const command of commandResults) {
    const item = byStage.get(command.stage) ?? { stage: command.stage, artifacts: [], checkers: [] };
    item.checkers.push({ command: command.commandLine, status: command.status });
    byStage.set(command.stage, item);
  }
  return [...byStage.values()].map((item) => ({
    ...item,
    status: item.checkers.every((checker) => checker.status === "passed") ? "passed" : "failed"
  }));
}

function runChecker(stage, command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: false });
  const commandLine = [command, ...args].join(" ");
  if (result.status !== 0) {
    failures.push(`${stage} checker failed: ${commandLine}\n${tail(result.stderr || result.stdout)}`);
    return { stage, commandLine, status: "failed" };
  }
  console.log(`${stage} checker passed: ${commandLine}`);
  return { stage, commandLine, status: "passed" };
}

function renderReport(result) {
  const lines = [
    "# OAM 最终签收报告",
    "",
    `生成时间：${result.generatedAtUtc}`,
    `当前 main HEAD：${result.currentMainHead}`,
    `CI run id：${result.ciRunId}`,
    `V5.4 Guards run id：${result.v54GuardsRunId}`,
    `最终状态：${result.finalStatus}`,
    "",
    "## 状态裁决",
    "",
    "- 宿舍保持 L1 Internal Pilot Observation。",
    "- Dormitory L2 Production = false。",
    "- Business Production = blocked。",
    "- Repair / Parts / HR = L0 Contract Preview。",
    "",
    "## OAM 阶段证据",
    "",
    ...result.oamStages.map((stage) => `- ${stage.stage}: ${stage.status}; artifacts=${stage.artifacts.join(", ")}`),
    "",
    "## No-Go / Hold",
    "",
    ...(result.noGoItems.length ? result.noGoItems.map((item) => `- ${item}`) : ["- 无 P0 No-Go。"]),
    ...(result.holdItems.length ? result.holdItems.map((item) => `- ${item}`) : ["- 无未决 Hold。"])
  ];
  return `${lines.join("\n")}\n`;
}

function ledgerEntry(id, status, ref, mainHead) {
  return {
    id,
    generatedAtUtc: generatedAt,
    status,
    ref,
    currentMainHead: mainHead,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHr: "L0 Contract Preview"
  };
}

function upsertEvidenceLedger(entries) {
  const ledgerPath = path.join(root, "artifacts/evidence/evidence-ledger.jsonl");
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const existing = fs.existsSync(ledgerPath)
    ? fs.readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of entries) byId.set(entry.id, entry);
  fs.writeFileSync(ledgerPath, `${[...byId.values()].map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMarkdown(relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

function currentMainHead() {
  return execFileSync("git", ["rev-parse", "origin/main"], { cwd: root, encoding: "utf8" }).trim();
}

function currentBranch() {
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) failures.push(`${message} actual=${actual ?? "null"} expected=${expected ?? "null"}`);
}

function assertFalse(actual, message) {
  if (actual !== false) failures.push(`${message} actual=${actual ?? "null"}`);
}

function assertNoTmpRefs(label, value) {
  if (JSON.stringify(value).includes(".tmp")) failures.push(`${label} 不允许包含 .tmp evidence ref。`);
}

function tail(text) {
  return String(text).split(/\r?\n/).filter(Boolean).slice(-8).join("\n");
}

main();
