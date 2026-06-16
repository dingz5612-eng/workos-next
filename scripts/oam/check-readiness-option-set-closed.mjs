import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/readiness-option-set-closed-result.json";
const projection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const runtimeProjection = readJsonIfExists("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json", root);
const businessInvariants = readJsonIfExists("docs/contracts/generated/dormitory/business-invariants.generated.json", root);
const failures = [];
const requiredLabels = ["通过", "不通过", "需补充"];
const requiredBranches = {
  passed: "basic_readiness_summary",
  failed: "basic_readiness_not_passed",
  needs_supplement: "supplement_required"
};
const requiredValues = businessInvariants?.closedOptionSets?.readinessState ?? [];

checkProjection("mobile", projection);
checkProjection("runtime", runtimeProjection);

const values = (projection?.optionSets?.readinessState ?? []).map((item) => item.value);
if (JSON.stringify(values) !== JSON.stringify(requiredValues)) {
  failures.push(`readinessState values must match generated business invariants: ${requiredValues.join(", ")}.`);
}
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
if (!(branchBindings.needs_supplement?.requiredFields ?? []).includes("basicReadinessRemark")) {
  failures.push("需补充 branch must require basicReadinessRemark.");
}

const result = {
  version: "oam.readiness-option-set-closed-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  optionSet: "readinessState",
  closedOptionValues: requiredValues,
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
