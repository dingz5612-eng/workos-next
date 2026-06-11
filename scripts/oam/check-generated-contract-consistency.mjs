import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const root = process.cwd();
const failures = [];
const p0 = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
];
const requiredGeneratedFiles = [
  "docs/oam/kernel/oam-kernel-source.schema.json",
  "docs/oam/kernel/oam-kernel-generated.schema.json",
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json"
];
const requiredClassifications = [
  "clientSubmitted",
  "selectedStableRef",
  "contextReadonly",
  "systemGenerated",
  "derived",
  "forbidden"
];
const financeBlockedPattern = /Payment|Deposit|Refund|Expense/i;

for (const file of requiredGeneratedFiles) {
  if (!exists(file)) fail(`${file} is missing.`);
}

const source = readJson("docs/business/domains/dormitory/dormitory-operating-kernel.json");
const graph = readJson("docs/oam/kernel/oam-kernel-graph.generated.json");
const manifest = readJson("docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json");
const fields = readJson("docs/contracts/generated/dormitory/fields.generated.json");
const workitems = readJson("docs/contracts/generated/dormitory/workitems.generated.json");
const surface = readJson("docs/contracts/generated/dormitory/surface-input-model.generated.json");
const mobileSurface = readJson("apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json");
const readModel = readJson("docs/contracts/generated/dormitory/read-model.generated.json");

for (const [file, document] of [
  ["docs/oam/kernel/oam-kernel-graph.generated.json", graph],
  ["docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json", manifest],
  ["docs/contracts/generated/dormitory/fields.generated.json", fields],
  ["docs/contracts/generated/dormitory/workitems.generated.json", workitems],
  ["docs/contracts/generated/dormitory/surface-input-model.generated.json", surface],
  ["docs/contracts/generated/dormitory/read-model.generated.json", readModel],
  ["apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json", mobileSurface]
]) {
  checkGeneratedMetadata(file, document);
}

if ((graph.nodes ?? []).length === 0 || (graph.edges ?? []).length === 0 || graph.nodeCount <= 0 || graph.edgeCount <= 0) {
  fail("generated kernel graph must not be empty.");
}

const sourceP0 = source.p0GeneratedCandidates ?? [];
const sourceP0Types = sourceP0.map((item) => item.workItemType).sort();
if (JSON.stringify(sourceP0Types) !== JSON.stringify([...p0].sort())) {
  fail(`source p0GeneratedCandidates must be exactly ${p0.join(", ")}.`);
}

for (const item of source.workItems ?? []) {
  if (p0.includes(item.workItemType)) {
    if (item.p0GeneratedCandidate !== true || item.generatedStage !== "P0_ACTIVE") {
      fail(`${item.workItemType} must be P0_ACTIVE generated candidate.`);
    }
    if (item.ledgerEffect?.mode !== "none" || item.ledgerEffect?.financeKernelEffectType !== null) {
      fail(`${item.workItemType} must have ledgerEffect.mode=none and financeKernelEffectType=null.`);
    }
    for (const classification of requiredClassifications) {
      if (!Array.isArray(item.fieldClassification?.[classification])) {
        fail(`${item.workItemType} missing fieldClassification.${classification}.`);
      }
    }
    continue;
  }

  if (/RatePlan|Lead|Checkin|Payment|Deposit|Expense/i.test(item.workItemType) && item.generatedStage !== "P1_BLOCKED") {
    fail(`${item.workItemType} must be P1_BLOCKED and excluded from P0 generated contracts.`);
  }
  if (financeBlockedPattern.test(item.workItemType) && item.p0GeneratedCandidate === true) {
    fail(`${item.workItemType} must not enter P0 generated contracts; finance truth belongs to Finance / Ledger Kernel.`);
  }
}

const generatedTypes = (workitems.workItems ?? []).map((item) => item.workItemType).sort();
if (JSON.stringify(generatedTypes) !== JSON.stringify([...p0].sort())) {
  fail(`generated workitems must contain only ${p0.join(", ")}.`);
}

const mobileSurfaceText = JSON.stringify(mobileSurface);
const generatedSurfaceText = JSON.stringify(surface);
if (mobileSurfaceText !== generatedSurfaceText) {
  fail("mobile generated surface input model must be byte-equivalent JSON content to generated surface contract.");
}

if (failures.length > 0) {
  console.error("Generated contract consistency check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Generated contract consistency check: PASS");

function checkGeneratedMetadata(file, document) {
  if (document.generated !== true) fail(`${file} must include generated=true.`);
  if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
  if (document.deterministicSort !== true) fail(`${file} must include deterministicSort=true.`);
  for (const field of ["kernelGraphHash", "sourceNodeRefs", "sourceRefs", "sourceHash", "sourceContentDigest", "compilerInputDigest", "outputContentDigest", "generatorVersion", "generatedFrom"]) {
    if (!document[field] || (Array.isArray(document[field]) && document[field].length === 0)) {
      fail(`${file} missing generated metadata ${field}.`);
    }
  }
  const expectedOutputDigest = digest({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedOutputDigest) {
    fail(`${file} outputContentDigest does not match content.`);
  }
}

function readJson(file) {
  if (!exists(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function fail(message) {
  failures.push(message);
}

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
