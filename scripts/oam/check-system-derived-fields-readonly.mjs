import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/system-derived-fields-readonly-result.json";
const mobileProjection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const runtimeProjection = readJsonIfExists("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json", root);
const failures = [];
const expectedByStep = {
  "Dorm.RoomSetupConfirm": ["roomId"],
  "Dorm.BedSetupConfirm": ["roomId", "bedId"],
  "Dorm.ResourceReadinessConfirm": ["roomId", "bedId"]
};

checkProjection("mobile", mobileProjection);
checkProjection("runtime", runtimeProjection);

const categories = mobileProjection?.fieldCategories ?? {};
const systemDerivedIds = new Set((categories.systemDerivedFields ?? []).map((field) => field.fieldId));
for (const fieldId of ["roomId", "bedId"]) {
  if (!systemDerivedIds.has(fieldId)) failures.push(`fieldCategories.systemDerivedFields missing ${fieldId}.`);
}

const result = {
  version: "oam.system-derived-fields-readonly-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  checkedFields: ["roomId", "bedId"],
  userSubmittedAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("System derived fields readonly check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("System derived fields readonly check: PASS");

function checkProjection(name, projection) {
  if (projection?.capabilityId !== CAPABILITY_ID) {
    failures.push(`${name} projection must bind ${CAPABILITY_ID}.`);
    return;
  }
  for (const [workItemType, fieldIds] of Object.entries(expectedByStep)) {
    const step = (projection.steps ?? []).find((item) => item.workItemType === workItemType);
    if (!step) {
      failures.push(`${name} projection missing ${workItemType}.`);
      continue;
    }
    for (const fieldId of fieldIds) {
      const field = (step.fields ?? []).find((item) => item.fieldId === fieldId);
      if (!field) {
        failures.push(`${name} ${workItemType} missing ${fieldId}.`);
        continue;
      }
      if (field.userSubmitted !== false) failures.push(`${name} ${workItemType}.${fieldId} must be userSubmitted=false.`);
      if (field.readonly !== true) failures.push(`${name} ${workItemType}.${fieldId} must be readonly=true.`);
      if (!["hidden-submit-only", "readonly-hidden-submit"].includes(field.hiddenSubmitOnly ? "hidden-submit-only" : field.ui?.hiddenSubmitOnly ? "hidden-submit-only" : field.fieldCategory === "systemDerivedFields" ? "readonly-hidden-submit" : "")) {
        failures.push(`${name} ${workItemType}.${fieldId} must be readonly or hidden-submit-only.`);
      }
      if (!field.displayValueSource || !field.submitValueSource) {
        failures.push(`${name} ${workItemType}.${fieldId} must separate displayValueSource and submitValueSource.`);
      }
    }
  }
}
