import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-field-authority-model-result.json";
const controlPath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const scenario1Path = "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json";
const scenario2Path = "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json";
const generatedRefs = [
  "docs/contracts/generated/dormitory/13-scenario-field-source-matrix.generated.json",
  "docs/contracts/generated/dormitory/scenario1-steps-fields.generated.json",
  "docs/contracts/generated/dormitory/scenario2-steps-fields.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json",
  "apps/mobile/src/generated/oam/dormitory-scenario2-resource-operation-status.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario1ResourceBasicReadiness.generated.json",
  "services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json"
];
const requiredClasses = [
  "businessInput",
  "businessSelect",
  "systemDerived",
  "readOnlySummary",
  "evidenceBinding",
  "actionControl",
  "conditionalInput",
  "auditInternal"
];
const actionFields = ["saveDraft", "backToEdit", "continueEdit", "submit"];
const internalFieldPattern = /(^|[.[_-])(roomId|bedId|workItemId|stableRef|projectionVersion|digest|domainEventId)(\]|$|[._-])/i;
const failures = [];

const control = readJson(controlPath);
const scenario1 = readJson(scenario1Path);
const scenario2 = readJson(scenario2Path);

checkControlModel();
checkScenarioFieldAuthority("scenario1", scenario1, {
  path: scenario1Path,
  selectMustContain: [
    "buildingContextRef",
    "bedType",
    "bedEnabledStatus",
    "bedTypeBatchSetting",
    "basicCheckResult",
    "cleaningBasicCheckResult",
    "facilityBasicCheckResult",
    "safetyBasicCheckResult",
    "basicReadinessConclusion"
  ],
  conditionalMustContain: ["bedRemark", "specialNotes", "basicReadinessRemark"],
  specialChecks: checkScenario1Regression
});
checkScenarioFieldAuthority("scenario2", scenario2, {
  path: scenario2Path,
  selectMustContain: [
    "roomOrBedScope",
    "targetRoomOrBed",
    "cleaningInspectionResult",
    "maintenanceInspectionResult",
    "safetyInspectionResult",
    "facilityInspectionResult",
    "exceptionFlag",
    "inspectionConclusion",
    "newOperationStatus",
    "statusReasonCode",
    "impactScope",
    "statusOwner",
    "submitImpactConfirmation",
    "blockerStatus",
    "followUpOwner",
    "recheckResult",
    "restoreConclusion"
  ],
  conditionalMustContain: [
    "exceptionDescription",
    "operationInspectionNotes",
    "expectedRestoreAt",
    "operationStatusNotes",
    "impactConfirmationNotes",
    "blockerNotes",
    "restoreNotes"
  ],
  specialChecks: checkScenario2Regression
});
checkGeneratedProjection();

const result = {
  version: "oam.dormitory-field-authority-model-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  sourceAuthorities: [
    { path: controlPath, digest: digestFile(controlPath) },
    { path: scenario1Path, digest: digestFile(scenario1Path) },
    { path: scenario2Path, digest: digestFile(scenario2Path) }
  ],
  generatedRefs,
  requiredClasses,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory field authority model check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory field authority model check: PASS");

function checkControlModel() {
  const model = control.fieldAuthorityModel ?? {};
  requireEqual(model.version, "oam.dormitory.field-authority-model.v1", "control.fieldAuthorityModel.version");
  requireEqual(model.languageContractRef, "docs/oam/visible-business-copy-contract.json", "control.fieldAuthorityModel.languageContractRef");
  const classIds = (model.classes ?? []).map((item) => item.classId);
  assertArrayContainsAll(classIds, requiredClasses, "control.fieldAuthorityModel.classes");
  for (const key of [
    "actionControlNeverInForm",
    "auditInternalNeverOnBusinessPage",
    "systemDerivedReadonlyOnly",
    "conditionalInputRequiresDisplayAndRequiredConditions",
    "businessSelectRequiresOptionSet",
    "visibleCopyMustUseLanguageContract"
  ]) {
    if (model.generatorEnforcement?.[key] !== true) fail(`control.fieldAuthorityModel.generatorEnforcement.${key} must be true.`);
  }
  if (!JSON.stringify(model.regressionGuards ?? {}).includes("预计恢复时间")) {
    fail("control.fieldAuthorityModel.regressionGuards must include scenario2 expected restore time guard.");
  }
  if (!JSON.stringify(model.regressionGuards ?? {}).includes("材料名称中英俄")) {
    fail("control.fieldAuthorityModel.regressionGuards must include multilingual evidence guard.");
  }
}

function checkScenarioFieldAuthority(label, source, spec) {
  const authority = source.fields?.fieldAuthority ?? {};
  requireEqual(authority.modelRef, `${controlPath}#fieldAuthorityModel`, `${label}.fields.fieldAuthority.modelRef`);
  requireEqual(authority.languageContractRef, "docs/oam/visible-business-copy-contract.json", `${label}.fields.fieldAuthority.languageContractRef`);
  for (const classId of requiredClasses) {
    if (!Array.isArray(authority[classId]) || authority[classId].length === 0) {
      fail(`${label}.fields.fieldAuthority.${classId} must be a non-empty array.`);
    }
  }

  const userFilled = new Set(source.fields?.userFilled ?? []);
  const userSelected = new Set(source.fields?.userSelected ?? []);
  const formFields = new Set([...userFilled, ...userSelected, ...stepsFields(source)]);
  const selectIds = new Set((authority.businessSelect ?? []).map((item) => item.fieldId));
  const conditionalIds = new Set((authority.conditionalInput ?? []).map((item) => item.fieldId));
  const businessInputIds = new Set((authority.businessInput ?? []).map((item) => item.fieldId));

  for (const field of spec.selectMustContain) {
    if (!selectIds.has(field)) fail(`${label}.${field} must be businessSelect.`);
    if (userFilled.has(field)) fail(`${label}.${field} must not be userFilled.`);
  }
  for (const field of spec.conditionalMustContain) {
    if (!conditionalIds.has(field)) fail(`${label}.${field} must be conditionalInput.`);
  }
  for (const field of userSelected) {
    if (!selectIds.has(field)) fail(`${label}.${field} is userSelected but missing businessSelect authority.`);
  }
  for (const field of userFilled) {
    if (!businessInputIds.has(field) && !conditionalIds.has(field)) {
      fail(`${label}.${field} is userFilled but is neither businessInput nor conditionalInput.`);
    }
  }

  for (const item of authority.businessSelect ?? []) {
    requireFieldKeys(item, `${label}.businessSelect.${item.fieldId}`, ["labelKey", "helpKey", "errorKey", "control", "optionSet"]);
    if (!String(item.control ?? "").includes("select")) fail(`${label}.${item.fieldId} businessSelect control must be select/searchable-select.`);
  }
  for (const item of authority.conditionalInput ?? []) {
    requireFieldKeys(item, `${label}.conditionalInput.${item.fieldId}`, ["labelKey", "helpKey", "errorKey", "control", "displayCondition", "requiredCondition"]);
  }
  for (const item of authority.systemDerived ?? []) {
    requireFieldKeys(item, `${label}.systemDerived.${item.fieldId}`, ["labelKey", "helpKey", "derivedFrom"]);
    if (item.readonly !== true) fail(`${label}.${item.fieldId} systemDerived must be readonly.`);
    if (formFields.has(item.fieldId)) fail(`${label}.${item.fieldId} systemDerived must not be a user form field.`);
  }
  for (const item of authority.readOnlySummary ?? []) {
    requireFieldKeys(item, `${label}.readOnlySummary.${item.fieldId}`, ["labelKey", "helpKey", "sourceScenario"]);
    if (formFields.has(item.fieldId)) fail(`${label}.${item.fieldId} readOnlySummary must not be a user form field.`);
  }
  for (const item of authority.evidenceBinding ?? []) {
    requireFieldKeys(item, `${label}.evidenceBinding.${item.fieldId}`, ["labelKey", "helpKey", "evidenceType"]);
    if (String(item.fieldId).toLowerCase().includes("digest")) fail(`${label}.${item.fieldId} evidenceBinding must not expose digest.`);
  }
  for (const item of authority.actionControl ?? []) {
    requireFieldKeys(item, `${label}.actionControl.${item.fieldId}`, ["labelKey", "legalActionRef"]);
    if (formFields.has(item.fieldId)) fail(`${label}.${item.fieldId} actionControl must not enter the form.`);
  }
  for (const item of authority.auditInternal ?? []) {
    if (item.internalOnly !== true) fail(`${label}.${item.fieldId} auditInternal must set internalOnly=true.`);
    if (formFields.has(item.fieldId)) fail(`${label}.${item.fieldId} auditInternal must not enter the form.`);
  }
  for (const action of actionFields) {
    if (formFields.has(action)) fail(`${label}.${action} must be an actionControl only, not a generated field.`);
  }
  for (const field of formFields) {
    if (internalFieldPattern.test(field)) fail(`${label}.${field} looks internal and must not be a business page field.`);
  }
  spec.specialChecks(source, authority, label);
}

function checkScenario1Regression(source, authority, label) {
  const step3 = (source.steps ?? []).find((step) => step.stepId === "basic-readiness-confirmation") ?? {};
  for (const field of ["basicCheckResult", "cleaningBasicCheckResult", "facilityBasicCheckResult", "safetyBasicCheckResult", "basicReadinessConclusion"]) {
    if (!(step3.userSelectedFields ?? []).includes(field)) fail(`${label}.${field} must be selected in step 3.`);
    if ((step3.userFilledFields ?? []).includes(field)) fail(`${label}.${field} must not be handwritten in step 3.`);
  }
  if (!new Set(authority.businessSelect.map((item) => item.fieldId)).has("bedType")) {
    fail(`${label}.bedType must be selectable so users do not handwrite bed types.`);
  }
}

function checkScenario2Regression(source, authority, label) {
  const expectedRestoreAt = (authority.conditionalInput ?? []).find((item) => item.fieldId === "expectedRestoreAt");
  if (!expectedRestoreAt) {
    fail(`${label}.expectedRestoreAt conditionalInput missing.`);
  } else {
    if (/\boperable\b/.test(expectedRestoreAt.requiredCondition ?? "")) {
      fail(`${label}.expectedRestoreAt must not be required when the new status is operable.`);
    }
    if (!String(expectedRestoreAt.displayCondition ?? "").includes("maintenance")) {
      fail(`${label}.expectedRestoreAt displayCondition must cover maintenance-like blocking statuses.`);
    }
  }
  for (const field of ["buildingArea", "roomNo", "bedList", "basicReadinessConfirmedAt", "scenario1EvidenceSummary"]) {
    const item = (authority.readOnlySummary ?? []).find((summary) => summary.fieldId === field);
    if (item?.sourceScenario !== "lodging.resource-basic-readiness") {
      fail(`${label}.${field} must reuse scenario 1 as readOnlySummary.`);
    }
  }
}

function checkGeneratedProjection() {
  const generatedControl = readJsonIfExists(generatedRefs[0]);
  if (!generatedControl?.fieldAuthorityModel) fail(`${generatedRefs[0]} must contain fieldAuthorityModel from Source.`);
  for (const file of generatedRefs.slice(1)) {
    const document = readJsonIfExists(file);
    if (!document) {
      fail(`${file} missing.`);
      continue;
    }
    if (!document.fields?.fieldAuthority) fail(`${file} must project fields.fieldAuthority.`);
  }
}

function stepsFields(source) {
  return new Set((source.steps ?? []).flatMap((step) => [
    ...(step.userFilledFields ?? []),
    ...(step.userSelectedFields ?? [])
  ]));
}

function requireFieldKeys(item, label, keys) {
  for (const key of keys) {
    if (item?.[key] === undefined || item?.[key] === "") fail(`${label}.${key} is required.`);
  }
}

function assertArrayContainsAll(actual, expected, label) {
  const values = new Set(actual ?? []);
  for (const item of expected) {
    if (!values.has(item)) fail(`${label} missing ${item}.`);
  }
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}

function fail(message) {
  failures.push(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}
