import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const kernel = readJson("docs/read-intelligence/read-intelligence-kernel.json");
const readModel = readJson("docs/contracts/generated/dormitory/read-model.generated.json");
const surface = readJson("docs/contracts/generated/dormitory/surface-input-model.generated.json");
const mobileSurface = readJson("apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json");

if (kernel.version !== "oam.read-intelligence-kernel.v1") fail("read intelligence kernel version mismatch.");
if (kernel.status !== "authoritative-current-no-go") fail("read intelligence kernel must remain current NO_GO.");
if (kernel.writeFactsAllowed !== false) fail("read intelligence must not write facts.");

if (kernel.surfaceProof?.onlyConsumesGeneratedSurfaceModel !== true) fail("surface proof must consume only generated surface model.");
const roomNoControls = (surface.controls ?? []).filter((control) => control.fieldId === "roomNo");
if (roomNoControls.length === 0) fail("generated surface model missing roomNo control.");
for (const control of roomNoControls) {
  if (control.controlType !== "text") fail("roomNo controlType must be text.");
  if (control.fallbackAllowed !== false) fail("roomNo fallbackAllowed must be false.");
  for (const forbidden of ["dropdown", "select", "combobox"]) {
    if (!(control.forbiddenFallbackControls ?? []).includes(forbidden)) {
      fail(`roomNo must forbid ${forbidden} fallback.`);
    }
  }
}
if (surface.labelInferenceAllowed !== false || kernel.surfaceProof?.labelInferenceAllowed !== false) {
  fail("surface label inference must be disabled.");
}
if (surface.visibleAllowed === surface.confirmAllowed || kernel.surfaceProof?.visibleAllowed === kernel.surfaceProof?.confirmAllowed) {
  fail("visibleAllowed must not equal confirmAllowed.");
}
if (surface.searchVisibleAllowed === surface.confirmAllowed || kernel.surfaceProof?.searchVisibleAllowed === kernel.surfaceProof?.confirmAllowed) {
  fail("search visible must not mean confirm allowed.");
}
if (JSON.stringify(surface) !== JSON.stringify(mobileSurface)) {
  fail("mobile surface model must consume the generated surface model without local divergence.");
}

for (const field of ["generatedReadModelsOnly", "searchLensProjectionReadonly"]) {
  if (readModel[field] !== true) fail(`read model missing ${field}=true.`);
}
const requiredTargetFields = readModel.searchResultTargetContract?.requiredFields ?? [];
for (const required of ["targetId", "runtimeOwner", "compatibility"]) {
  if (!requiredTargetFields.includes(required)) fail(`SearchResult target missing ${required}.`);
}
if (readModel.searchResultTargetContract?.permissionFilterOrder !== "before_ranking") {
  fail("permission filter must run before ranking.");
}
if (readModel.searchResultTargetContract?.hiddenResultRanked !== false) {
  fail("hidden result must not be ranked.");
}
if (readModel.searchResultTargetContract?.confirmAllowedRankingBoost !== false) {
  fail("confirmAllowed must not be a ranking boost.");
}
for (const collection of ["metrics", "dashboards", "reportDatasets"]) {
  for (const item of readModel[collection] ?? []) {
    if (!Array.isArray(item.sourceFacts) || item.sourceFacts.length === 0) {
      fail(`${collection} item missing sourceFacts.`);
    }
    if (!Array.isArray(item.lineage) || item.lineage.length === 0) {
      fail(`${collection} item missing lineage.`);
    }
  }
}
for (const term of ["objectKind", "resultType", "metric", "dashboard", "lineage", "readiness"]) {
  if (!(kernel.languageGlossary?.supports ?? []).includes(term) || !(readModel.languageGlossary?.supports ?? []).includes(term)) {
    fail(`LanguageGlossary must support ${term}.`);
  }
}

if (failures.length > 0) {
  console.error("Read Intelligence kernel check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Read Intelligence kernel check: PASS");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function fail(message) {
  failures.push(message);
}
