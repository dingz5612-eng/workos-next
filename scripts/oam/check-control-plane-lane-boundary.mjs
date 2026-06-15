import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const taxonomyPath = "docs/oam/control-plane/gate-lane-taxonomy.current.json";
const resultPath = "artifacts/oam/checks/control-plane-lane-boundary-result.json";
const taxonomy = readJson(taxonomyPath);
const failures = [];
const lanes = taxonomy?.lanes ?? {};
const browserHardening = new Set(lanes["browser-hardening"] ?? []);
const generatedRuntimeHard = [
  ...(lanes["generated-hard"] ?? []),
  ...(lanes["runtime-test-hard"] ?? [])
];
const requiredDisplayNames = [
  "Authority Lane",
  "Generated Bundle Lane",
  "Runtime Test Lane",
  "Business Landing Lane",
  "Evidence Projection Lane",
  "Browser Hardening Lane",
  "Release Lane"
];

for (const gate of generatedRuntimeHard) {
  if (/browser|real-browser|coverage|mobile-critical/i.test(gate)) {
    failures.push(`generated/runtime hard lane must not contain browser hardening gate: ${gate}.`);
  }
}
for (const gate of browserHardening) {
  if (!/browser|real-browser|surface\/check-dormitory|surface\/run-dormitory/i.test(gate)) {
    failures.push(`browser-hardening lane contains non-browser gate: ${gate}.`);
  }
}
const laneDisplayNames = Object.values(taxonomy?.laneDisplayNames ?? {});
for (const name of requiredDisplayNames) {
  if (!laneDisplayNames.includes(name)) failures.push(`laneDisplayNames must include ${name}.`);
}
requireEqual(taxonomy?.laneBoundaryRules?.browserHardeningMayNotBlockGeneratedAcceptance, true, "browserHardeningMayNotBlockGeneratedAcceptance", failures);
requireEqual(taxonomy?.laneBoundaryRules?.browserHardeningMayNotBlockRuntimeTestAdmission, true, "browserHardeningMayNotBlockRuntimeTestAdmission", failures);
requireEqual(taxonomy?.laneBoundaryRules?.runtimeImplementationPatchMayNotEnterGeneratedAcceptance, true, "runtimeImplementationPatchMayNotEnterGeneratedAcceptance", failures);
requireEqual(taxonomy?.laneBoundaryRules?.evidenceProjectionHasNoDecisionAuthority, true, "evidenceProjectionHasNoDecisionAuthority", failures);

const controlPlaneText = readText("scripts/oam/run-control-plane-checks.ps1");
const ciText = readText(".github/workflows/ci.yml");
for (const gate of [
  "scripts/oam/check-capability-state-machine-transition.mjs",
  "scripts/oam/check-capability-authority-state-consistency.mjs",
  "scripts/oam/check-control-plane-lane-boundary.mjs",
  "scripts/oam/check-gate-taxonomy.mjs",
  "scripts/oam/check-no-active-path-legacy-identity.mjs",
  "scripts/oam/check-no-current-capability-uses-legacy-seed.mjs",
  "scripts/oam/check-no-stage-number-active-authority.mjs",
  "scripts/oam/check-single-capability-bundle-digest.mjs",
  "scripts/oam/check-runtime-consumes-accepted-capability-bundle.mjs",
  "scripts/oam/check-test-plan-generated-from-capability.mjs",
  "scripts/oam/check-evidence-digest-chain-single-source.mjs"
]) {
  if (!controlPlaneText.includes(gate)) failures.push(`control-plane must invoke ${gate}.`);
  if (!ciText.includes(gate)) failures.push(`CI must invoke ${gate}.`);
}
for (const gate of [
  "scripts/surface/run-dormitory-real-browser-audits.ps1",
  "scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs",
  "scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs"
]) {
  if (!controlPlaneText.includes(`Invoke-AdvisoryGate`) || !controlPlaneText.includes(gate)) {
    failures.push(`Browser Hardening Lane gate must be advisory in control-plane: ${gate}.`);
  }
}
if (!controlPlaneText.includes("Invoke-Gate node scripts/surface/check-dormitory-first-golden-chain-real-browser-audit.mjs")) {
  failures.push("current first golden chain browser audit checker must be a required evidence gate in control-plane.");
}
if (!ciText.includes("node scripts/surface/check-dormitory-first-golden-chain-real-browser-audit.mjs")) {
  failures.push("CI must check current first golden chain browser audit evidence.");
}
if (!/Generate dormitory real-browser evidence[\s\S]*continue-on-error:\s*true/.test(ciText)) {
  failures.push("CI Browser Hardening Lane must be continue-on-error advisory.");
}
if (!ciText.includes("node scripts/oam/check-dormitory-runtime-admission.mjs --write-proof")) {
  failures.push("CI Runtime Test Lane must write proof only through explicit --write-proof.");
}
if (!controlPlaneText.includes("Invoke-Gate node scripts/oam/check-dormitory-runtime-admission.mjs --write-proof")) {
  failures.push("control-plane Runtime Test Lane must write proof only through explicit --write-proof.");
}
if (!controlPlaneText.includes("Invoke-Gate node scripts/oam/check-evidence-writer-boundary.mjs") ||
  !ciText.includes("node scripts/oam/check-evidence-writer-boundary.mjs")) {
  failures.push("Evidence Projection Lane must run check-evidence-writer-boundary in control-plane and CI.");
}

const generatedAcceptanceIndex = controlPlaneText.indexOf("Invoke-Gate node scripts/oam/check-generated-candidate-acceptance.mjs");
const singleBundleDigestIndex = controlPlaneText.indexOf("Invoke-Gate node scripts/oam/check-single-capability-bundle-digest.mjs");
const runtimeAdmissionIndex = controlPlaneText.indexOf("Invoke-Gate node scripts/oam/check-dormitory-runtime-admission.mjs --write-proof");
const browserIndex = controlPlaneText.indexOf("Invoke-AdvisoryGate pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1");
if (generatedAcceptanceIndex < 0 || runtimeAdmissionIndex < 0 || browserIndex < 0 ||
  !(generatedAcceptanceIndex < runtimeAdmissionIndex && runtimeAdmissionIndex < browserIndex)) {
  failures.push("control-plane must run Browser Hardening Lane after generated acceptance and runtime test admission.");
}
if (singleBundleDigestIndex < 0 || runtimeAdmissionIndex < 0 || !(singleBundleDigestIndex < runtimeAdmissionIndex)) {
  failures.push("control-plane must run single capability bundle digest gate before runtime test admission.");
}

const result = {
  version: "oam.control-plane-lane-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  browserHardeningExitedGeneratedRuntimePreHardGate: failures.every((f) => !f.includes("generated/runtime hard lane")),
  runtimeImplementationPatchSeparatedFromGeneratedAcceptance: true,
  requiredLaneDisplayNames: requiredDisplayNames,
  currentPreInternalRequiredLanes: taxonomy?.currentPreInternalRequiredLaneDisplayNames ?? [],
  laneBoundaryRules: taxonomy?.laneBoundaryRules ?? {},
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Control-plane lane boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Control-plane lane boundary check: PASS");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}
