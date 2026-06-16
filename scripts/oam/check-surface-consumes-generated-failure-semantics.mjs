import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/surface-consumes-generated-failure-semantics-result.json";
const projection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const surfaceModel = readJsonIfExists("apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json", root);
const failureSemantics = readJsonIfExists("docs/contracts/generated/dormitory/failure-semantics.generated.json", root);
const admissionSurface = read("apps/mobile/src/admissionSurface.js");
const operationController = read("apps/mobile/src/operationController.js");
const operationCopy = read("apps/mobile/src/i18n/operationCopy.js");
const failures = [];

checkFailureRefs("capability projection", projection);
checkFailureRefs("mobile surface model", surfaceModel);
if (!admissionSurface.includes("safeConfirmErrorKey") || !admissionSurface.includes("operations.error.safe.409") || !admissionSurface.includes("operations.error.safe.422")) {
  fail("admissionSurface must map generated failure HTTP statuses to safe copy keys.");
}
if (!operationController.includes("actionResultFromError") ||
  !operationController.includes("actionResultFromBlockedConfirm") ||
  !operationController.includes("business_blocked_422")) {
  fail("operationController must convert validation failures into business action states.");
}
for (const key of ["operations.error.safe.409", "operations.error.safe.422"]) {
  const line = operationCopy.split(/\r?\n/).find((item) => item.includes(`"${key}"`)) ?? "";
  if (/(409|422)/.test(line.replace(key, ""))) fail(`${key} copy must not expose bare status code.`);
}
for (const item of failureSemantics?.failureSemantics ?? []) {
  if (!item.generatedRuleId || !item.code || !item.httpStatus) fail(`${item.caseId} must expose generatedRuleId/code/httpStatus.`);
}

writeJson(resultPath, {
  version: "oam.surface-consumes-generated-failure-semantics-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  failureSemanticsRef: projection?.failureSemanticsRef ?? null,
  failureCaseCount: failureSemantics?.failureSemantics?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
}, root);

if (failures.length) {
  console.error("Surface consumes generated failure semantics check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Surface consumes generated failure semantics check: PASS");

function checkFailureRefs(label, document) {
  if (document?.failureSemanticsRef !== "docs/contracts/generated/dormitory/failure-semantics.generated.json") {
    fail(`${label} must reference generated failure semantics.`);
  }
  const refs = document?.generatedBusinessRuleRefs?.failureSemantics;
  if (refs?.digest !== failureSemantics?.outputContentDigest) fail(`${label} must bind generated failure semantics digest.`);
  if (!Array.isArray(refs?.ruleIds) || refs.ruleIds.length === 0) fail(`${label} must carry failure semantics rule ids.`);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fail(message) {
  failures.push(message);
}
