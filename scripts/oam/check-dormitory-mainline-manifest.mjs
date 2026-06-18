import fs from "node:fs";
import path from "node:path";
import { fileDigest, readJson, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const manifestPath = "docs/oam/dormitory-mainline-manifest.json";
const resultPath = "artifacts/oam/checks/dormitory-mainline-manifest-result.json";
const expectedCurrent = {
  id: "Dormitory.13ScenarioMainline",
  nameZh: "住宿经营 13 场景总控",
  sourceAuthorityRef: "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json"
};
const failures = [];
const manifest = readJson(manifestPath, root);
const forbiddenActive = manifest.forbiddenActiveMainlineIdentities ?? [];

if (manifest.version !== "oam.dormitory-mainline-manifest.v1") fail("manifest.version mismatch.");
if (manifest.status !== "authoritative") fail("manifest.status must be authoritative.");

const active = (manifest.activeMainlines ?? []).filter((item) => item.current === true);
if (active.length !== 1) fail(`active mainline count must be 1, actual ${active.length}.`);
const current = active[0] ?? {};
for (const [key, expected] of Object.entries(expectedCurrent)) {
  if (current[key] !== expected) fail(`activeMainline.${key} must be ${expected}.`);
}
if (current.productionConfirmAllowed !== false || current.releaseAuthority !== false || current.finalGoNoGo !== "NO_GO") {
  fail("active mainline must keep production/release/final GO closed.");
}

for (const identity of forbiddenActive) {
  const currentText = JSON.stringify({
    id: current.id,
    nameZh: current.nameZh,
    sourceAuthorityRef: current.sourceAuthorityRef
  });
  if (currentText.includes(identity)) fail(`${identity} must not be active current mainline identity.`);
}

const requiredLegacy = [
  "Dormitory.FirstGoldenChain",
  "W-STAY-RESOURCE",
  "resource-saleability",
  "lead-reservation"
];
for (const identity of requiredLegacy) {
  const entry = (manifest.legacyIdentities ?? []).find((item) => item.identity === identity);
  if (!entry) {
    fail(`legacy identity missing: ${identity}.`);
    continue;
  }
  if (entry.activeMainlineAllowed !== false) fail(`${identity} activeMainlineAllowed must be false.`);
  if (!Array.isArray(entry.allowedCategories) || entry.allowedCategories.length === 0) {
    fail(`${identity} requires allowed legacy categories.`);
  }
}

if (manifest.activePathForbidden?.mobileSurfaceCurrentBusinessEntry !== true) fail("mobile surface old current entry must be forbidden.");
if (manifest.activePathForbidden?.searchCurrentBusinessEntry !== true) fail("search old current entry must be forbidden.");
if (manifest.activePathForbidden?.runtimeBusinessFactWrite !== true) fail("runtime old fact write must be forbidden.");
if (manifest.activePathForbidden?.browserCurrentMainAudit !== true) fail("browser old current main audit must be forbidden.");
if (manifest.activePathForbidden?.evidenceRootCurrentProofOnlyOldChain !== true) fail("Evidence Root old-only current proof must be forbidden.");

for (const file of [
  current.sourceAuthorityRef,
  ...(current.generatedContractRefs ?? []),
  ...(manifest.currentMainlineConsumerFiles ?? [])
]) {
  if (!file || !fs.existsSync(path.join(root, file))) fail(`referenced current mainline file missing: ${file}.`);
}

for (const gate of manifest.gates ?? []) {
  if (gate.blocking !== true) fail(`gate ${gate.gateId ?? "<missing>"} must be blocking.`);
}

const result = {
  version: "oam.dormitory-mainline-manifest-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  manifestPath,
  manifestDigest: fileDigest(manifestPath, root),
  activeMainlineId: current.id ?? null,
  activeMainlineNameZh: current.nameZh ?? null,
  sourceAuthorityRef: current.sourceAuthorityRef ?? null,
  generatedContractCount: current.generatedContractRefs?.length ?? 0,
  forbiddenActiveMainlineIdentities: forbiddenActive,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory mainline manifest check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory mainline manifest check: PASS");

function fail(message) {
  failures.push(message);
}
