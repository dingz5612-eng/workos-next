import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/surface-consumes-generated-invariants-result.json";
const projection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const surfaceModel = readJsonIfExists("apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json", root);
const businessInvariants = readJsonIfExists("docs/contracts/generated/dormitory/business-invariants.generated.json", root);
const operationValidation = read("apps/mobile/src/operationValidation.js");
const capabilityProjectionSource = read("apps/mobile/src/capabilityProjection.js");
const optionSetContract = read("apps/mobile/src/controls/optionSetContract.js");
const failures = [];

checkGeneratedRefs("capability projection", projection);
checkGeneratedRefs("mobile surface model", surfaceModel);
const closedReadinessValues = businessInvariants?.closedOptionSets?.readinessState ?? [];
const surfaceReadinessValues = (projection?.optionSets?.readinessState ?? []).map((item) => item.value);
if (JSON.stringify(surfaceReadinessValues) !== JSON.stringify(closedReadinessValues)) {
  fail("surface readinessState option values must match generated business invariants.");
}
const roomSetup = step("Dorm.RoomSetupConfirm");
const bedSetup = step("Dorm.BedSetupConfirm");
const readiness = step("Dorm.ResourceReadinessConfirm");
if (!field(roomSetup, "bedCount")?.userSubmitted) fail("bedCount must be user submitted only on RoomSetupConfirm.");
if (field(roomSetup, "capacity")?.userSubmitted) fail("capacity is a historical alias and must not remain a user-submitted surface field.");
for (const other of [bedSetup, readiness]) {
  if ((other?.fields ?? []).some((item) => ["capacity", "bedCount"].includes(item.fieldId) && item.userSubmitted === true)) {
    fail(`${other.workItemType} must not user-submit bedCount/capacity.`);
  }
}
for (const [currentStep, fieldIds] of [
  [roomSetup, ["roomId"]],
  [bedSetup, ["roomId", "bedId"]],
  [readiness, ["roomId", "bedId"]]
]) {
  for (const fieldId of fieldIds) {
    const currentField = field(currentStep, fieldId);
    if (!currentField) fail(`${currentStep?.workItemType} missing ${fieldId}.`);
    if (currentField?.userSubmitted !== false || currentField?.readonly !== true) {
      fail(`${currentStep?.workItemType}.${fieldId} must be readonly and not user-submitted.`);
    }
  }
}
for (const marker of [
  "capability-projection.generated.json",
  "dormitory-surface-input-model.generated.json",
  "generatedCapabilityFieldForCard",
  "isSystemDerivedCapabilityField",
  "draftableCapabilityFieldIds"
]) {
  if (!capabilityProjectionSource.includes(marker)) fail(`capabilityProjection.js missing ${marker}.`);
}
if (!operationValidation.includes("isBedSetupCardId")) fail("operationValidation must use generated bed setup card identity.");
if (!optionSetContract.includes("generatedOptionLabels(\"readinessState\")")) {
  fail("optionSetContract must read readiness labels from generated projection.");
}
for (const value of ["roomNo", "bedNo", "readinessState"]) {
  if (!(projection?.businessUi?.completionBusinessValueFields ?? []).includes(value)) {
    fail(`completion business values must include ${value}.`);
  }
}

writeJson(resultPath, {
  version: "oam.surface-consumes-generated-invariants-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  closedReadinessValues,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
}, root);

if (failures.length) {
  console.error("Surface consumes generated invariants check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Surface consumes generated invariants check: PASS");

function step(workItemType) {
  return (projection?.steps ?? []).find((item) => item.workItemType === workItemType);
}

function field(currentStep, fieldId) {
  return (currentStep?.fields ?? []).find((item) => item.fieldId === fieldId);
}

function checkGeneratedRefs(label, document) {
  if (document?.capabilityId !== CAPABILITY_ID) fail(`${label} must bind ${CAPABILITY_ID}.`);
  if (document?.businessInvariantsRef !== "docs/contracts/generated/dormitory/business-invariants.generated.json") {
    fail(`${label} must reference generated business invariants.`);
  }
  const refs = document?.generatedBusinessRuleRefs?.businessInvariants;
  if (refs?.digest !== businessInvariants?.outputContentDigest) fail(`${label} must bind generated business invariant digest.`);
  if (!Array.isArray(refs?.ruleIds) || refs.ruleIds.length === 0) fail(`${label} must carry business invariant rule ids.`);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fail(message) {
  failures.push(message);
}
