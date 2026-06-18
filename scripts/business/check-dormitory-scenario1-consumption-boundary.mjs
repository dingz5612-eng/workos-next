import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario1-consumption-boundary-result.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario1-handoff.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1ResourceBasicReadiness.generated.json"
};
const failures = [];
const scenarioDigest = fileDigest(scenarioPath);
const packageIndexDigest = fileDigest(packageIndexPath);
const docs = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJson(file)]));

for (const [key, file] of Object.entries(generatedPaths)) {
  const document = docs[key];
  if (document.generated !== true || document.doNotEdit !== true) fail(`${file} must be generated/doNotEdit.`);
  if (document.sourceContentDigest !== scenarioDigest) fail(`${file} must bind scenario Source digest.`);
  if (document.packageIndexContentDigest !== packageIndexDigest) fail(`${file} must bind package index Source digest.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final GO closed.`);
  }
}

if (docs.mobileMirror.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (docs.runtimeMirror.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");
if (JSON.stringify(docs.mobileMirror.fields?.forbiddenUserInputFields ?? []) !== JSON.stringify(docs.runtimeMirror.fields?.forbiddenUserInputFields ?? [])) {
  fail("surface and runtime mirrors must consume same forbidden internal fields.");
}
for (const internal of ["roomId", "bedId", "workItemId", "stableRef", "projectionVersion", "digest", "domainEventId"]) {
  if (!(docs.mobileMirror.fields?.forbiddenUserInputFields ?? []).includes(internal)) fail(`mobile mirror missing forbidden field ${internal}.`);
  if ((docs.mobileMirror.fields?.userFilled ?? []).includes(internal) || (docs.mobileMirror.fields?.userSelected ?? []).includes(internal)) {
    fail(`mobile mirror exposes ${internal} as user input.`);
  }
}

const commandIds = (docs.runtimeMirror.commands ?? []).map((item) => item.commandId);
if (JSON.stringify(commandIds) !== JSON.stringify(["Dorm.RoomSetupConfirm", "Dorm.BedSetupConfirm", "Dorm.ResourceReadinessConfirm"])) {
  fail("runtime mirror must expose exactly the three scenario 1 commands.");
}
for (const command of docs.runtimeMirror.commands ?? []) {
  if (command.idempotencyRequired !== true || command.concurrencyVersionCheckRequired !== true) fail(`${command.commandId} must consume idempotency/concurrency rules.`);
  for (const forbidden of ["运营状态", "价格", "报价", "预订", "入住", "收款", "押金", "退款", "账务"]) {
    if (!(command.forbiddenWritesZh ?? []).includes(forbidden)) fail(`${command.commandId} missing forbidden runtime write ${forbidden}.`);
  }
}
if (docs.runtimeMirror.bedGenerationRule?.onlySourceOfBedQuantity !== "room.bedCount") fail("runtime mirror must consume room.bedCount bed quantity rule.");
const readinessLabels = (docs.runtimeMirror.readinessConclusionOptions ?? []).map((item) => item.labelZh);
if (JSON.stringify(readinessLabels) !== JSON.stringify(["通过", "不通过", "需补充"])) fail("runtime mirror must consume basic readiness conclusion labels.");
if (!String(docs.surfaceNavigation.surfaceNavigation?.searchZh ?? "").includes("只读")) fail("surface search must remain readonly.");
if (!String(docs.handoff.downstreamNoRefillRuleZh ?? "").includes("不得要求用户重新填写")) fail("handoff must forbid downstream refill.");
for (const forbiddenTerm of ["可售", "可预订", "金链", "生产发布", "final GO"]) {
  if (!(docs.mobileMirror.forbiddenUserVisibleTermsZh ?? []).includes(forbiddenTerm)) fail(`mobile mirror missing forbidden user visible term ${forbiddenTerm}.`);
}

const result = {
  version: "oam.dormitory-scenario1-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scenarioPath,
  packageIndexPath,
  scenarioDigest,
  packageIndexDigest,
  generatedPaths,
  consumerBoundaries: {
    runtimeConsumesGenerated: true,
    surfaceConsumesGenerated: true,
    searchDashboardReportReadonly: true,
    downstreamScenario2ReadonlySummaryOnly: true,
    productionReleaseFinalClosed: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario 1 consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario 1 consumption boundary check: PASS (${scenarioDigest})`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function fail(message) {
  failures.push(message);
}
