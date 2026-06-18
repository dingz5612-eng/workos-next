import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const controlPath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const benchmarkPath = "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json";
const generatedTrialPath = "docs/contracts/generated/dormitory/scenario2-start-gate-trial.generated.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario2-start-gate-trial-result.json";
const failures = [];
const forbiddenScenario1Objects = ["Room", "BedSet", "Bed", "BasicReadiness"];
const forbiddenScenario1Terms = ["房间号", "床位数", "床位 01..N", "基础就绪字段"];

const control = readJson(controlPath);
const benchmark = readJson(benchmarkPath);
const generatedTrial = readJson(generatedTrialPath);
const scenario2 = (control.scenarios ?? []).find((item) => item.scenarioNo === 2);
const trial = generatedTrial.trial ?? benchmark.scenario2StartGateTrial ?? {};

checkTrialIdentity();
checkRequiredReads();
checkDifferenceChecklist();
checkNoScenario1BusinessCopy();
checkHighRiskBoundaries();
checkNoGo();

const result = {
  version: "oam.dormitory-scenario2-start-gate-trial-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  controlPath,
  benchmarkPath,
  generatedTrialPath,
  controlDigest: digestFile(controlPath),
  benchmarkDigest: digestFile(benchmarkPath),
  generatedTrialDigest: digestFile(generatedTrialPath),
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (failures.length) {
  console.error("Dormitory scenario 2 start gate trial check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 2 start gate trial check: PASS (${result.generatedTrialDigest})`);

function checkTrialIdentity() {
  if (!scenario2) {
    fail("scenario 2 is missing from 13 scenario control.");
    return;
  }
  if (trial.scenarioNo !== 2 || trial.scenarioId !== scenario2.scenarioId || trial.nameZh !== scenario2.nameZh) {
    fail("scenario 2 trial must match 13 scenario control identity.");
  }
  if (trial.status !== "trial_gate_only_no_business_feature_development") {
    fail("scenario 2 trial must be gate-only and no business feature development.");
  }
  if (generatedTrial.trialResult?.status !== "PASS") fail("generated scenario 2 trial result must PASS.");
}

function checkRequiredReads() {
  for (const file of [controlPath, benchmarkPath]) {
    if (!(trial.reads ?? []).includes(file)) fail(`scenario 2 trial must read ${file}.`);
  }
  if (trial.positionConfirmedIn13ScenarioIndex !== true) fail("scenario 2 position must be confirmed in 13 scenario index.");
  for (const summary of ["房间摘要", "床位组摘要", "基础就绪摘要"]) {
    if (!(trial.upstreamReadonlySummaries ?? []).includes(summary)) fail(`scenario 2 trial missing upstream readonly summary ${summary}.`);
  }
}

function checkDifferenceChecklist() {
  const diff = trial.differenceChecklist ?? {};
  for (const object of ["OperationStatus", "OperationBlocker"]) {
    if (!(diff.objectDifference?.writes ?? []).includes(object)) fail(`scenario 2 trial must write ${object}.`);
    if (!(trial.ownedObjects ?? []).includes(object)) fail(`scenario 2 trial ownedObjects missing ${object}.`);
  }
  for (const state of ["可运营"]) {
    if (!(diff.stateDifference?.produces ?? []).includes(state)) fail(`scenario 2 trial must produce ${state}.`);
  }
  for (const state of ["基础就绪", "可报价", "可预订"]) {
    if (!(diff.stateDifference?.mustNotProduce ?? []).includes(state)) fail(`scenario 2 trial must not produce ${state}.`);
  }
  for (const section of ["fieldDifference", "evidenceDifference", "financeDifference", "pageDifference", "testDifference"]) {
    if (!diff[section] || typeof diff[section] !== "object") fail(`scenario 2 trial missing ${section}.`);
  }
  if (diff.financeDifference?.involvesAmount !== false) fail("scenario 2 trial must not involve amount.");
}

function checkNoScenario1BusinessCopy() {
  const diff = trial.differenceChecklist ?? {};
  for (const object of forbiddenScenario1Objects) {
    if ((diff.objectDifference?.writes ?? []).includes(object)) fail(`scenario 2 trial copied scenario 1 write object ${object}.`);
    if (!(diff.objectDifference?.doesNotWrite ?? []).includes(object)) fail(`scenario 2 trial must explicitly not write ${object}.`);
    if (!(trial.businessFieldsNotInheritedFromScenario1 ?? []).includes(object)) fail(`scenario 2 trial must list ${object} as non-inherited.`);
  }
  const userFacing = JSON.stringify({
    userFilled: diff.fieldDifference?.userFilled,
    userSelected: diff.fieldDifference?.userSelected,
    pages: diff.pageDifference?.pages,
    buttons: diff.pageDifference?.buttons
  });
  for (const term of forbiddenScenario1Terms) {
    if (userFacing.includes(term)) fail(`scenario 2 trial user-facing material copied scenario 1 term ${term}.`);
    if (!(trial.businessFieldsNotInheritedFromScenario1 ?? []).includes(term)) fail(`scenario 2 trial must list ${term} as non-inherited.`);
  }
}

function checkHighRiskBoundaries() {
  const boundary = trial.highRiskBoundaries ?? {};
  if (boundary.operationStatus !== true) fail("scenario 2 trial must identify operationStatus boundary.");
  if (boundary.mustNotEnterPriceOrReservation !== true) fail("scenario 2 trial must forbid direct price/reservation.");
  if (boundary.scenario11WorkSuggestionOnly !== true) fail("scenario 2 trial must treat scenario 11 work output as suggestion only.");
  if (boundary.financeGate !== false || boundary.inventory !== false || boundary.price !== false) {
    fail("scenario 2 trial must not claim finance, inventory or price truth ownership.");
  }
}

function checkNoGo() {
  if (generatedTrial.productionConfirmAllowed !== false || generatedTrial.releaseAuthority !== false || generatedTrial.finalGoNoGo !== "NO_GO") {
    fail("generated scenario 2 trial must keep NO_GO.");
  }
  const noGo = benchmark.NO_GO ?? {};
  if (noGo.businessFeatureDevelopmentAllowed !== false || noGo.productionConfirmAllowed !== false || noGo.businessGoLiveAllowed !== false || noGo.finalGoNoGo !== "NO_GO") {
    fail("benchmark NO_GO must keep feature development/production/go-live/final closed.");
  }
}

function readJson(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    fail(`${file} is missing.`);
    return {};
  }
  return JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function fail(message) {
  failures.push(message);
}
