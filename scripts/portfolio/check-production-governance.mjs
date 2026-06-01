import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const failures = [];

const governance = readJson("docs/portfolio/production-governance.yml");
const maturity = readJson("docs/portfolio/business-line-maturity-model.yml");
const maturityResult = readJson("artifacts/portfolio/business-line-maturity-result.json");
const currentState = readJson("artifacts/release-state/current-state.json");
const registry = readJson("docs/business/business-line-registry.json");
const evidenceGraph = readJson("artifacts/rt4/evidence-graph.json");
const dashboard = readJson("artifacts/rt4/completion-dashboard.json");
const rtFinal = readJson("artifacts/rt4/final-completion-assurance-result.json");
const mainHead = currentMainHead();

assertFile("schemas/portfolio/production-governance.schema.json");
assert(governance.version === "portfolio.production-governance.v1", "生产治理合同版本不正确。");
assert(governance.finalSystemGateRequired === true, "Business Production 必须经过 Final System Gate。");
assert(governance.finalSystemGateStatus === "blocked", "当前 Final System Gate 必须保持 blocked。");
assert(governance.portfolioDecision === "blocked", "Portfolio production governance 必须 blocked。");
assertFalse(governance.businessProductionAllowed, "生产治理合同不得允许 Business Production。");

assert(currentState.currentMain?.headSha === mainHead, "current-state 必须绑定当前 origin/main。");
assert(currentState.authoritativeState?.businessProduction === "BLOCKED", "Authority 必须阻断 Business Production。");
assert(currentState.authoritativeState?.dormitoryL2 === "BLOCKED", "Authority 必须阻断 Dormitory L2。");
assert(currentState.prohibitedStates?.businessProductionAllowed === false, "Authority 禁止 Business Production。");
assert(currentState.prohibitedStates?.dormitoryL2ProductionAllowed === false, "Authority 禁止 Dormitory L2。");
assert(currentState.prohibitedStates?.repairPartsHrProductionAllowed === false, "Authority 禁止 Repair / Parts / HR production。");

assert(evidenceGraph.releaseStates?.businessProduction === "BLOCKED", "Evidence Graph 必须阻断 Business Production。");
assert(evidenceGraph.releaseStates?.dormitoryL2Production === "BLOCKED", "Evidence Graph 必须阻断 Dormitory L2。");
assert(dashboard.businessProduction === "BLOCKED", "Completion Dashboard 必须阻断 Business Production。");
assert(dashboard.dormitoryL2Production === "BLOCKED", "Completion Dashboard 必须阻断 Dormitory L2。");
assertFalse(rtFinal.businessProductionAllowed, "RT-FINAL artifact 不得允许 Business Production。");
assertFalse(rtFinal.dormitoryL2ProductionAllowed, "RT-FINAL artifact 不得允许 Dormitory L2。");
assert(rtFinal.repairPartsHrStatus === "L0 Contract Preview", "RT-FINAL 必须保持 Repair / Parts / HR L0。");

for (const rule of governance.businessLineRules ?? []) {
  const modelLine = businessLine(maturity.businessLines, rule.businessLineId);
  const registryLine = businessLine(registry.businessLines, rule.businessLineId);
  assert(Boolean(modelLine), `${rule.businessLineId} 缺少 maturity model 记录。`);
  assert(Boolean(registryLine), `${rule.businessLineId} 缺少 registry 记录。`);
  assertFalse(rule.productionAllowed, `${rule.businessLineId} governance rule 不得允许 production。`);
  assertFalse(rule.l2ProductionAllowed, `${rule.businessLineId} governance rule 不得允许 L2。`);
  assertFalse(registryLine?.productionAllowed, `${rule.businessLineId} registry 不得允许 production。`);
  assertFalse(registryLine?.productionConfirmAllowed, `${rule.businessLineId} registry 不得允许 production confirm。`);
}

const dormitoryRule = businessLine(governance.businessLineRules, "dormitory");
assert(dormitoryRule?.allowedMaturityState === "L1 Internal Pilot Observation", "DORM-INT GO 只能映射为 L1 Internal Pilot Observation。");
assert(dormitoryRule?.requiresSeparateL1ToL2Stage === true, "Dormitory L1 -> L2 必须要求独立 stage。");

for (const id of ["repair", "parts", "hr"]) {
  const rule = businessLine(governance.businessLineRules, id);
  assert(rule?.allowedMaturityState === "L0 Contract Preview", `${id} governance rule 必须保持 L0。`);
  assert(rule?.requiresIndependentGate === true, `${id} 必须有独立 gate。`);
}

assert(maturityResult.status === "passed", "Business-line maturity artifact 必须 passed。");
assertFalse(maturityResult.dormitory?.productionAllowed, "Maturity result 不得允许 Dormitory production。");
assertFalse(maturityResult.dormitory?.l2ProductionAllowed, "Maturity result 不得允许 Dormitory L2。");
assert(maturityResult.dormitory?.autoUpgradeBlocked === true, "Maturity result 必须阻断 Dormitory 自动升级。");

const activeStateText = JSON.stringify({
  currentState: currentState.authoritativeState,
  governanceDecision: governance.portfolioDecision,
  maturityResult
});
for (const forbidden of governance.forbiddenStates ?? []) {
  assert(!activeStateText.includes(forbidden), `禁止状态不得出现在 active authority 中：${forbidden}`);
}

for (const ref of governance.evidenceRefs ?? []) assertFile(ref);

const result = {
  generatedAtUtc: generatedAt,
  generatedBy: "check-production-governance",
  status: failures.length === 0 ? "passed" : "blocked",
  currentMainHead: mainHead,
  portfolioDecision: "blocked",
  businessProductionAllowed: false,
  finalSystemGateRequired: true,
  finalSystemGateStatus: "blocked",
  dormitory: {
    maturityState: "L1 Internal Pilot Observation",
    l2ProductionAllowed: false,
    productionAllowed: false,
    autoUpgradeBlocked: true
  },
  repairPartsHr: {
    maturityState: "L0 Contract Preview",
    productionAllowed: false,
    requiresIndependentGate: true
  },
  evidenceRefs: [
    "docs/portfolio/production-governance.yml",
    "artifacts/portfolio/business-line-maturity-result.json",
    "artifacts/release-state/current-state.json",
    "artifacts/rt4/evidence-graph.json",
    "artifacts/rt4/completion-dashboard.json",
    "artifacts/rt4/final-completion-assurance-result.json"
  ],
  noGoItems: failures,
  nextAction: "组合式生产治理保持 blocked；继续 L1 observation，不自动升级。"
};

writeJson("artifacts/portfolio/production-governance-result.json", result);

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("OAM-09 production governance failed.");
}

console.log("OAM-09 production governance: PASS");

function businessLine(lines, id) {
  return (lines ?? []).find((line) => line.businessLineId === id);
}

function readJson(relativePath) {
  assertFile(relativePath);
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) failures.push(`缺少文件：${relativePath}`);
}

function currentMainHead() {
  try {
    return execFileSync("git", ["rev-parse", "origin/main"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return execFileSync("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: root, encoding: "utf8" }).trim().split(/\s+/)[0];
  }
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertFalse(value, message) {
  if (value !== false) failures.push(message);
}
