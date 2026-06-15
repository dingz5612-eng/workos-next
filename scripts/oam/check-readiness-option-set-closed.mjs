import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/readiness-option-set-closed-result.json";
const projection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const runtimeProjection = readJsonIfExists("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json", root);
const failures = [];
const requiredLabels = ["可分配", "待清洁", "待维修", "待补材料", "暂不可用"];
const requiredBranches = {
  available: "complete",
  cleaningRequired: "cleaningRequired",
  maintenanceRequired: "serviceVerificationRef",
  notSaleable: "notSaleableReason"
};

checkProjection("mobile", projection);
checkProjection("runtime", runtimeProjection);

const labels = (projection?.optionSets?.readinessState ?? []).map((item) => item.label?.["zh-CN"] || "");
for (const label of requiredLabels) {
  if (!labels.includes(label)) failures.push(`readinessState option set missing ${label}.`);
}
if ((projection?.optionSets?.readinessState ?? []).some((item) => item.value === "ready")) {
  failures.push("readinessState must not keep plain ready value.");
}
const branchBindings = projection?.readinessBranchBindings ?? {};
for (const [value, branchOutput] of Object.entries(requiredBranches)) {
  if (branchBindings[value]?.branchOutput !== branchOutput) {
    failures.push(`readinessState ${value} must bind branchOutput=${branchOutput}.`);
  }
}
if (!(branchBindings.maintenanceRequired?.requiredFields ?? []).includes("serviceVerificationRef")) {
  failures.push("待维修 branch must require serviceVerificationRef.");
}
if (!(branchBindings.notSaleable?.requiredFields ?? []).includes("notSaleableReason")) {
  failures.push("暂不可用 branch must require notSaleableReason.");
}

const result = {
  version: "oam.readiness-option-set-closed-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  optionSet: "readinessState",
  closedOptionLabels: requiredLabels,
  freeTextReadyAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Readiness option set closed check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Readiness option set closed check: PASS");

function checkProjection(name, candidate) {
  const step = (candidate?.steps ?? []).find((item) => item.workItemType === "Dorm.ResourceReadinessConfirm");
  const field = (step?.fields ?? []).find((item) => item.fieldId === "readinessState");
  if (!field) {
    failures.push(`${name} projection missing readinessState field.`);
    return;
  }
  if (field.optionSet !== "readinessState") failures.push(`${name} readinessState must use readinessState option set.`);
  if (field.controlType !== "select") failures.push(`${name} readinessState must render as select.`);
  if (field.userSubmitted !== true) failures.push(`${name} readinessState must remain the user-submitted field.`);
}
