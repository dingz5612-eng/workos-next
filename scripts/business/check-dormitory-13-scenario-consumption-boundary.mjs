import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-13-scenario-consumption-boundary-result.json";
const sourcePath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const generatedPaths = {
  canonical: "docs/contracts/generated/dormitory/13-scenario-control.generated.json",
  scenarioIndex: "docs/contracts/generated/dormitory/13-scenario-index.generated.json",
  fieldMatrix: "docs/contracts/generated/dormitory/13-scenario-field-source-matrix.generated.json",
  pageEntryPolicy: "docs/contracts/generated/dormitory/13-scenario-page-entry-policy.generated.json",
  handoffSummaries: "docs/contracts/generated/dormitory/13-scenario-handoff-summaries.generated.json",
  financeBoundary: "docs/contracts/generated/dormitory/13-scenario-finance-boundary.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-13-scenario-control.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioControl.generated.json"
};
const failures = [];
const sourceDigest = fileDigest(sourcePath);
const docs = Object.fromEntries(Object.entries(generatedPaths).map(([key, file]) => [key, readJson(file)]));

for (const [key, file] of Object.entries(generatedPaths)) {
  const document = docs[key];
  if (document.generated !== true || document.doNotEdit !== true) fail(`${file} must be generated/doNotEdit.`);
  if (document.sourceContentDigest !== sourceDigest) fail(`${file} must bind the current 13 scenario Source digest.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final GO closed.`);
  }
}

if (docs.mobileMirror.consumer !== "surface") fail("mobile mirror must declare consumer=surface.");
if (docs.runtimeMirror.consumer !== "runtime") fail("runtime mirror must declare consumer=runtime.");
if ((docs.mobileMirror.scenarios ?? []).length !== 13) fail("surface generated mirror must expose 13 scenarios.");
if ((docs.runtimeMirror.scenarios ?? []).length !== 13) fail("runtime generated mirror must expose 13 scenarios.");
if (JSON.stringify(docs.mobileMirror.forbiddenUserInputFields ?? []) !== JSON.stringify(docs.runtimeMirror.forbiddenUserInputFields ?? [])) {
  fail("surface and runtime must consume the same forbidden internal field list.");
}
for (const internal of docs.fieldMatrix.forbiddenUserInputFields ?? []) {
  if ((docs.fieldMatrix.fieldSourceMatrix?.userFilled ?? []).includes(internal) ||
    (docs.fieldMatrix.fieldSourceMatrix?.userSelected ?? []).includes(internal)) {
    fail(`${internal} must not be user-filled or user-selected.`);
  }
}

if (!String(docs.pageEntryPolicy.pageEntryPolicy?.search ?? "").includes("只读")) fail("search page entry must remain readonly.");
for (const summary of docs.handoffSummaries.summaries ?? []) {
  if (!String(summary.downstreamRuleZh ?? "").includes("不得要求用户重新填写")) {
    fail(`scenario ${summary.scenarioNo} handoff must forbid downstream refilling confirmed upstream fields.`);
  }
}

const finance = docs.financeBoundary.financeBoundary ?? {};
if (JSON.stringify(finance.exclusiveTruthWriters ?? []) !== JSON.stringify(["finance-gate", "finance-kernel"])) {
  fail("finance truth must be exclusive to finance-gate and finance-kernel.");
}
for (const forbidden of ["Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "FinanceReceipt"]) {
  if (!(finance.financeTruthObjects ?? []).includes(forbidden)) fail(`finance truth object missing ${forbidden}.`);
}
if (JSON.stringify(docs.runtimeMirror.financeBoundary?.exclusiveTruthWriters ?? []) !== JSON.stringify(["finance-gate", "finance-kernel"])) {
  fail("runtime mirror must consume finance truth boundary from generated contract.");
}

const result = {
  version: "oam.dormitory-13-scenario-consumption-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  sourcePath,
  sourceDigest,
  generatedPaths,
  consumerBoundaries: {
    runtimeConsumesGenerated: true,
    surfaceConsumesGenerated: true,
    readModelSearchDashboardReportReadonly: true,
    financeGateExclusiveTruth: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory 13 scenario consumption boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory 13 scenario consumption boundary check: PASS (${sourceDigest})`);

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
