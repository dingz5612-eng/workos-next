import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const failures = [];

const maturity = readJson("docs/portfolio/business-line-maturity-model.yml");
const gates = readJson("docs/portfolio/l0-l1-l2-production-gates.yml");
const currentState = readJson("artifacts/release-state/current-state.json");
const registry = readJson("docs/business/business-line-registry.json");
const dormInt = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
const l1ToL2 = readJson("artifacts/operations/dormitory/l1-to-l2-readiness.json");
const mainHead = currentMainHead();

const requiredStates = [
  "L0 Contract Preview",
  "L1 Internal Pilot Candidate",
  "L1 Internal Pilot Observation",
  "L1 Held",
  "L1 Rollback",
  "L2 Candidate",
  "L2 Production Ready",
  "Production Blocked"
];

assertFile("schemas/portfolio/business-line-maturity-model.schema.json");
assertFile("schemas/portfolio/l0-l1-l2-production-gates.schema.json");
assert(maturity.version === "portfolio.business-line-maturity-model.v1", "业务线成熟度模型版本不正确。");
assert(gates.version === "portfolio.l0-l1-l2-production-gates.v1", "L0/L1/L2/Production gates 版本不正确。");
assert(maturity.transitionEvidenceRequired === true, "每个 maturity transition 必须要求机器证据。");

for (const state of requiredStates) {
  const item = maturity.states?.find((candidate) => candidate.id === state);
  assert(Boolean(item), `缺少成熟度状态：${state}`);
  assert(item?.requiresMachineEvidence === true, `${state} 必须要求机器证据。`);
  assert(item?.productionAllowed === false, `${state} 不得直接允许 production。`);
}

const dormitoryModel = businessLine(maturity.businessLines, "dormitory");
assert(dormitoryModel?.currentMaturityState === "L1 Internal Pilot Observation", "Dormitory 必须保持 L1 Internal Pilot Observation。");
assertFalse(dormitoryModel?.productionAllowed, "Dormitory 不得允许 production。");
assertFalse(dormitoryModel?.l2ProductionAllowed, "Dormitory 不得允许 L2。");
assert(dormitoryModel?.independentMaturity === true, "Dormitory 必须独立 maturity。");

const dormitoryRegistry = businessLine(registry.businessLines, "dormitory");
assert(dormitoryRegistry?.level === "L1 Internal Pilot", "Business Line Registry 中 Dormitory 必须是 L1 Internal Pilot。");
assertFalse(dormitoryRegistry?.productionAllowed, "Registry 中 Dormitory productionAllowed 必须为 false。");
assertFalse(dormitoryRegistry?.productionConfirmAllowed, "Registry 中 Dormitory productionConfirmAllowed 必须为 false。");

assert(currentState.currentMain?.headSha === mainHead, "release-state current main 必须等于 origin/main。");
assert(currentState.authoritativeState?.dormitory === "L1_INTERNAL_PILOT_OBSERVATION", "Authority 必须把 Dormitory 裁决为 L1 observation。");
assert(currentState.authoritativeState?.dormitoryL2 === "BLOCKED", "Authority 必须阻断 Dormitory L2。");
assert(currentState.authoritativeState?.businessProduction === "BLOCKED", "Authority 必须阻断 Business Production。");
assert(dormInt.status === "GO_FOR_INTERNAL_PILOT", "DORM-INT 只能表示 L1 内测允许。");
assertFalse(dormInt.productionAllowed, "DORM-INT artifact 不得允许 production。");
assertFalse(dormInt.dormitoryL2ProductionAllowed, "DORM-INT artifact 不得允许 Dormitory L2。");
assert(l1ToL2.eligible === false, "L1 -> L2 readiness 必须默认 not eligible。");
assertFalse(l1ToL2.productionAllowed, "L1 -> L2 readiness 不得允许 production。");
assertFalse(l1ToL2.l2ProductionAllowed, "L1 -> L2 readiness 不得允许 L2。");

for (const id of ["repair", "parts", "hr"]) {
  const modelLine = businessLine(maturity.businessLines, id);
  const registryLine = businessLine(registry.businessLines, id);
  assert(modelLine?.currentMaturityState === "L0 Contract Preview", `${id} 在 maturity model 中必须保持 L0。`);
  assertFalse(modelLine?.productionAllowed, `${id} maturity model 不得允许 production。`);
  assertFalse(modelLine?.l2ProductionAllowed, `${id} maturity model 不得允许 L2。`);
  assert(registryLine?.level === "L0 Contract Preview", `${id} 在 registry 中必须保持 L0。`);
  assertFalse(registryLine?.productionAllowed, `${id} registry 不得允许 production。`);
  assertFalse(registryLine?.productionConfirmAllowed, `${id} registry 不得允许 production confirm。`);
}

for (const line of maturity.businessLines ?? []) {
  assert(line.independentMaturity === true, `${line.businessLineId} 必须有独立 maturity state。`);
  assert(Array.isArray(line.evidenceRefs) && line.evidenceRefs.length > 0, `${line.businessLineId} 必须有 transition evidence refs。`);
  for (const ref of line.evidenceRefs ?? []) assertFile(ref);
}

for (const gate of gates.gates ?? []) {
  assert(Array.isArray(gate.requiredEvidence) && gate.requiredEvidence.length > 0, `${gate.from} -> ${gate.to} 必须有机器 evidence。`);
  assertFalse(gate.productionAllowed, `${gate.from} -> ${gate.to} 不得直接允许 production。`);
}

const l1ToL2Gate = (gates.gates ?? []).find((gate) => gate.from === "L1 Internal Pilot Observation" && gate.to === "L2 Candidate");
assert(l1ToL2Gate?.requiresSeparateStage === true, "L1 observation -> L2 Candidate 必须单独 stage。");
assert(l1ToL2Gate?.requiresSeparatePr === true, "L1 observation -> L2 Candidate 必须单独 PR。");

const l2CandidateGate = (gates.gates ?? []).find((gate) => gate.from === "L2 Candidate" && gate.to === "L2 Production Ready");
assert(l2CandidateGate?.requiresSeparateStage === true, "L2 Candidate -> L2 Production Ready 必须单独 stage。");
assert(l2CandidateGate?.requiresSeparatePr === true, "L2 Candidate -> L2 Production Ready 必须单独 PR。");

const result = {
  generatedAtUtc: generatedAt,
  generatedBy: "check-business-line-maturity",
  status: failures.length === 0 ? "passed" : "blocked",
  currentMainHead: mainHead,
  dormitory: {
    maturityState: "L1 Internal Pilot Observation",
    l2ProductionAllowed: false,
    productionAllowed: false,
    autoUpgradeBlocked: true
  },
  businessProduction: {
    status: "blocked",
    finalSystemGateStatus: currentState.authoritativeState?.finalSystemGate ?? "blocked"
  },
  l0BusinessLines: ["repair", "parts", "hr"],
  transitionEvidenceRequired: true,
  independentMaturityStates: true,
  evidenceRefs: [
    "docs/portfolio/business-line-maturity-model.yml",
    "docs/portfolio/l0-l1-l2-production-gates.yml",
    "artifacts/release-state/current-state.json",
    "docs/business/business-line-registry.json",
    "artifacts/operations/dormitory/l1-to-l2-readiness.json"
  ],
  noGoItems: failures,
  nextAction: "继续 L1 Internal Pilot Observation；L1 -> L2 必须单独 stage / PR / gate。"
};

writeJson("artifacts/portfolio/business-line-maturity-result.json", result);

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("OAM-09 business-line maturity failed.");
}

console.log("OAM-09 business-line maturity: PASS");

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
