import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/surface-consumes-generated-surface-model-result.json";
const generatedModelPath = "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json";
const generatedCapabilityProjectionPath = "apps/mobile/src/generated/oam/capability-projection.generated.json";
const generatedModel = readJsonIfExists(generatedModelPath, root);
const generatedCapabilityProjection = readJsonIfExists(generatedCapabilityProjectionPath, root);
const capabilityProjection = read("apps/mobile/src/capabilityProjection.js");
const operationFieldKernel = read("apps/mobile/src/operationFieldKernel.js");
const workspaceView = read("apps/mobile/src/views/workspaceView.js");
const experienceComponents = read("apps/mobile/src/views/experienceComponents.js");
const systemContextContract = read("apps/mobile/src/systemContextContract.js");
const failures = [];
const expectedWorkItems = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
];
const forbiddenCurrentTerms = ["rateSetup", "roomBlock", "roomRelease"];

if (generatedModel?.surfaceOnlyConsumesGeneratedSurfaceModel !== true) {
  failures.push("generated surface model must declare surfaceOnlyConsumesGeneratedSurfaceModel=true.");
}
if (!capabilityProjection.includes(`import generatedSurfaceModel from "./generated/oam/dormitory-surface-input-model.generated.json"`)) {
  failures.push("capabilityProjection must import the generated surface input model.");
}
if (!capabilityProjection.includes(`import capabilityProjection from "./generated/oam/capability-projection.generated.json"`)) {
  failures.push("capabilityProjection must import the compiler generated capability projection.");
}
if (!operationFieldKernel.includes("generatedFieldOrderForCard")) {
  failures.push("operationFieldKernel must use generatedFieldOrderForCard for current capability field order.");
}
if (!operationFieldKernel.includes("generatedFieldLabel")) {
  failures.push("operationFieldKernel must use generated field labels for current capability fields.");
}
if (!workspaceView.includes("runtimeWorkItemMatchesCapabilityCard")) {
  failures.push("workspaceView must use capability runtime work item matching.");
}
if (/sourceCardId\s*===|workspaceCardId\s*===/.test(workspaceView)) {
  failures.push("workspaceView must not use sourceCardId/workspaceCardId active matching.");
}
if (!experienceComponents.includes("isBedSetupCardId")) {
  failures.push("experienceComponents must recognize generated bed setup card id.");
}
for (const workItem of expectedWorkItems) {
  if (!(generatedCapabilityProjection?.steps ?? []).some((step) => step.workItemType === workItem && step.cardId === workItem)) {
    failures.push(`generated capability projection missing current work item ${workItem}.`);
  }
  if (capabilityProjection.includes(`"${workItem}"`)) {
    failures.push(`capabilityProjection adapter must not handwrite current work item ${workItem}.`);
  }
  const controls = (generatedModel?.controls ?? []).filter((item) => item.workItemType === workItem);
  if (!controls.length) failures.push(`generated surface model missing controls for ${workItem}.`);
  if (!systemContextContract.includes(`"${workItem}"`)) {
    failures.push(`systemContextContract must include current generated work item ${workItem}.`);
  }
}
const currentCapabilityBlock = capabilityProjection.slice(
  capabilityProjection.indexOf("FIRST_GOLDEN_CHAIN_STEPS"),
  capabilityProjection.indexOf("const generatedControlsByWorkItem")
);
for (const term of forbiddenCurrentTerms) {
  if (currentCapabilityBlock.includes(term)) failures.push(`current capability projection must not contain ${term}.`);
}
if (!capabilityProjection.includes("defaultBedTypeForCount(count)") ||
  !operationFieldKernel.includes("defaultBedTypeForCount(parsed)") ||
  !workspaceView.includes("defaultBedTypeForCount(bedCount)")) {
  failures.push("surface must derive bed type default from current bed count so one-bed rooms do not default to bunk_pair.");
}

const result = {
  version: "oam.surface-consumes-generated-surface-model-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  generatedSurfaceModelPath: generatedModelPath,
  generatedCapabilityProjectionPath,
  generatedSurfaceModelDigest: generatedModel?.outputContentDigest ?? null,
  currentWorkItems: expectedWorkItems,
  surfaceUsesGeneratedModelForCurrentCapability: failures.length === 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Surface consumes generated surface model check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Surface consumes generated surface model check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}
