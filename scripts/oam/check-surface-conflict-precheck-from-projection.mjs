import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/surface-conflict-precheck-from-projection-result.json";
const projection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const bedCardinality = readJsonIfExists("docs/contracts/generated/dormitory/bed-cardinality.generated.json", root);
const businessInvariants = readJsonIfExists("docs/contracts/generated/dormitory/business-invariants.generated.json", root);
const operationValidation = read("apps/mobile/src/operationValidation.js");
const fieldSourceRenderer = read("apps/mobile/src/fieldSourceRenderer.js");
const workspaceView = read("apps/mobile/src/views/workspaceView.js");
const failures = [];
const bedLabels = await import(pathToFileURL(path.join(root, "apps/mobile/src/controls/bedLabelControls.js")).href);

if (projection?.bedCardinalityRef !== "docs/contracts/generated/dormitory/bed-cardinality.generated.json") {
  fail("surface projection must reference generated bed cardinality.");
}
if (projection?.generatedBusinessRuleRefs?.bedCardinality?.digest !== bedCardinality?.outputContentDigest) {
  fail("surface projection must bind bed cardinality digest.");
}
for (const ruleId of [
  "dormitory.bed_cardinality.generated_bed_count_matches_room_bed_count",
  "dormitory.bed_cardinality.resource_readiness_blocked_until_complete_bed_set",
  "dormitory.business_invariant.room_unique_within_building_context",
  "dormitory.business_invariant.bed_unique_within_room"
]) {
  const allRuleIds = [
    ...(projection?.generatedBusinessRuleRefs?.bedCardinality?.ruleIds ?? []),
    ...(projection?.generatedBusinessRuleRefs?.businessInvariants?.ruleIds ?? [])
  ];
  if (!allRuleIds.includes(ruleId)) fail(`surface projection missing conflict/precheck rule ${ruleId}.`);
}
for (const marker of [
  "isBedSetupCardId",
  "bedSetupCardinalityViolations",
  "bedLabelsMustMatchBedCount",
  "bedLabelsMustBeUnique"
]) {
  if (!operationValidation.includes(marker)) fail(`operationValidation missing projection-driven precheck marker ${marker}.`);
}
if (!fieldSourceRenderer.includes("generatedBedLabelsForCount") || !workspaceView.includes("generatedBedLabelsForCount")) {
  fail("surface must display generated BedSet labels from projected bed count.");
}
if (bedLabels.generatedBedLabelsForCount(1) !== "01") fail("capacity=1 must generate bed label 01.");
if (bedLabels.generatedBedLabelsForCount(4) !== "01, 02, 03, 04") fail("capacity=N must generate bed label 01..N.");
const roomSetup = (projection?.steps ?? []).find((item) => item.workItemType === "Dorm.RoomSetupConfirm");
const bedSetup = (projection?.steps ?? []).find((item) => item.workItemType === "Dorm.BedSetupConfirm");
if (!(roomSetup?.fields ?? []).some((item) => item.fieldId === "capacity" && item.userSubmitted === true)) {
  fail("RoomSetupConfirm must be the source of bed count through capacity.");
}
if ((bedSetup?.fields ?? []).some((item) => ["capacity", "bedCount"].includes(item.fieldId) && item.userSubmitted === true)) {
  fail("BedSetupConfirm must not user-submit bed count.");
}
if ((businessInvariants?.invariants ?? []).length === 0) fail("business invariants must not be empty.");

writeJson(resultPath, {
  version: "oam.surface-conflict-precheck-from-projection-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  bedCardinalityRuleCount: bedCardinality?.rules?.length ?? 0,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
}, root);

if (failures.length) {
  console.error("Surface conflict precheck from projection check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Surface conflict precheck from projection check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fail(message) {
  failures.push(message);
}
