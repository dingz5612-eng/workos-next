import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const writeProof = process.argv.includes("--write-proof") || process.env.OAM_WRITE_PROOF === "1";
const failures = [];
const kernel = readJson("docs/read-intelligence/read-intelligence-kernel.json");
const readModel = readJson("docs/contracts/generated/dormitory/read-model.generated.json");
const surface = readJson("docs/contracts/generated/dormitory/surface-input-model.generated.json");
const mobileSurface = readJson("apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json");
const readOwnerRegistry = readJson("docs/contracts/read/read-model-owner-registry.json");
const readSchemas = [
  readJson("docs/contracts/read/oam-object-envelope.schema.json"),
  readJson("docs/contracts/read/search-index-record.schema.json"),
  readJson("docs/contracts/read/search-result-envelope.schema.json"),
  readJson("docs/contracts/read/lens-read-model.schema.json"),
  readJson("docs/contracts/read/permission-envelope.schema.json"),
  readJson("docs/contracts/read/lineage-envelope.schema.json"),
  readJson("docs/contracts/read/freshness-envelope.schema.json")
];

if (kernel.version !== "oam.read-intelligence-kernel.v1") fail("read intelligence kernel version mismatch.");
if (kernel.status !== "authoritative-current-no-go") fail("read intelligence kernel must remain current NO_GO.");
if (kernel.writeFactsAllowed !== false) fail("read intelligence must not write facts.");
for (const input of ["generatedReadModel", "SearchIndexRecord", "OamObjectEnvelope", "LensReadModel", "authorizedProjectionReadModel"]) {
  if (!(kernel.readSourcePolicy?.allowedInputs ?? []).includes(input)) fail(`readSourcePolicy.allowedInputs missing ${input}.`);
}
if (!(kernel.readSourcePolicy?.forbiddenInputs ?? []).includes("operationsRuntimeFactInput")) {
  fail("readSourcePolicy must forbid operationsRuntimeFactInput as Search direct input.");
}
if (kernel.readSourcePolicy?.operationsReadStoreSearchOperations?.allowedOnlyAs !== "upstreamProjectionBuilderSource" ||
  kernel.readSourcePolicy?.operationsReadStoreSearchOperations?.searchKernelDirectQueryAllowed !== false) {
  fail("OperationsReadStore.SearchOperations must be allowed only as upstream projection builder source.");
}

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
if (JSON.stringify(surface) !== JSON.stringify(mobileSurface) && !mobileConsumesGeneratedSurfaceModel(surface, mobileSurface)) {
  fail("mobile surface model must consume the generated surface model without local divergence.");
}

for (const field of ["generatedReadModelsOnly", "searchLensProjectionReadonly"]) {
  if (readModel[field] !== true) fail(`read model missing ${field}=true.`);
}
const requiredTargetFields = readModel.searchResultTargetContract?.requiredFields ?? [];
for (const required of ["view", "kind", "targetId", "runtimeOwner", "compatibility", "writeThroughSearchAllowed"]) {
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
for (const proofRef of kernel.proofRefs ?? []) {
  if (!fs.existsSync(path.join(root, proofRef))) fail(`Read Intelligence proofRef missing ${proofRef}.`);
}
if (readOwnerRegistry.writeFactsAllowed !== false) {
  fail("read-model-owner-registry must forbid fact writes.");
}
for (const owner of readOwnerRegistry.owners ?? []) {
  if (owner.sourceTruthAllowed !== false) fail(`read model ${owner.readModel} must not be source truth.`);
}
for (const schema of readSchemas) {
  if (schema.type !== "object" || !Array.isArray(schema.required) || schema.required.length === 0) {
    fail(`read schema ${schema.$id ?? "<missing id>"} must be an object with required fields.`);
  }
}
const permissionRequired = readSchemas.find((schema) => schema.$id === "workosnext.read.permission-envelope.schema.v1")?.required ?? [];
for (const field of ["visibility", "redaction", "dataClassification", "requiredPermissions", "checkedAt", "policyVersion", "decisionSource", "actorScope"]) {
  if (!permissionRequired.includes(field)) fail(`permission envelope missing ${field}.`);
}
const lineageRequired = readSchemas.find((schema) => schema.$id === "workosnext.read.lineage-envelope.schema.v1")?.required ?? [];
for (const field of ["sourceSystem", "sourceType", "sourceId", "sourceUpdatedAt", "definitionVersion", "sourceNodeRefs", "sourceVersion", "factRefs", "evidenceRefs", "transformRefs", "outboxRefs", "readModelVersion"]) {
  if (!lineageRequired.includes(field)) fail(`lineage envelope missing ${field}.`);
}
const freshnessRequired = readSchemas.find((schema) => schema.$id === "workosnext.read.freshness-envelope.schema.v1")?.required ?? [];
for (const field of ["indexedAt", "indexLagMs", "stale", "maxStalenessMs", "checkedAt", "sourceUpdatedAt", "computedAt", "lastDisplayedAt", "computeLagMs", "staleReason", "freshnessPolicyVersion"]) {
  if (!freshnessRequired.includes(field)) fail(`freshness envelope missing ${field}.`);
}

if (failures.length > 0) {
  if (writeProof) writeOamObjectEnvelopeProof("failed");
  console.error("Read Intelligence kernel check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (writeProof) writeOamObjectEnvelopeProof("passed");
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

function mobileConsumesGeneratedSurfaceModel(surfaceDocument, mobileDocument) {
  if (mobileDocument.generatedBy !== "scripts/oam/compile-current-capability.mjs") return false;
  if (mobileDocument.sourceContentDigest !== surfaceDocument.outputContentDigest) return false;
  if (mobileDocument.sourceControlCount !== (surfaceDocument.controls ?? []).length) return false;
  const mobileControlKeys = new Set((mobileDocument.controls ?? [])
    .map((control) => `${control.workItemType}:${control.fieldId}`));
  return (surfaceDocument.controls ?? [])
    .every((control) => mobileControlKeys.has(`${control.workItemType}:${control.fieldId}`));
}

function writeOamObjectEnvelopeProof(status) {
  const proofPath = path.join(root, "artifacts/oam/proofs/read-intelligence/oam-object-envelope-proof.json");
  fs.mkdirSync(path.dirname(proofPath), { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify({
    schemaVersion: "workosnext.read-intelligence-proof.v1",
    proofId: "oam-object-envelope-proof",
    status,
    checkedAtUtc: new Date().toISOString(),
    proves: [
      "Read Intelligence only consumes generated read models and authorized read envelopes.",
      "OamObjectEnvelope, SearchIndexRecord, SearchResultEnvelope, and LensReadModel carry permission, lineage, and freshness requirements.",
      "Read Intelligence, Search, Lens, Dashboard, Report, and Metric surfaces are readonly and cannot write business facts.",
      "operationsRuntimeFactInput is forbidden as direct Search input."
    ],
    allowedInputs: kernel.readSourcePolicy?.allowedInputs ?? [],
    forbiddenInputs: kernel.readSourcePolicy?.forbiddenInputs ?? [],
    envelopeSchemas: readSchemas.map((schema) => ({
      id: schema.$id,
      required: schema.required ?? []
    })),
    readModelCollectionsChecked: ["metrics", "dashboards", "reportDatasets"],
    sourceRefs: [
      "docs/read-intelligence/read-intelligence-kernel.json",
      "docs/contracts/read/oam-object-envelope.schema.json",
      "docs/contracts/read/permission-envelope.schema.json",
      "docs/contracts/read/lineage-envelope.schema.json",
      "docs/contracts/read/freshness-envelope.schema.json",
      "docs/contracts/generated/dormitory/read-model.generated.json"
    ],
    failures
  }, null, 2)}\n`);
}
