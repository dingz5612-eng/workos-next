import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const lanePath = "docs/oam/runtime-stability-lane.current.json";
const resultPath = "artifacts/oam/checks/runtime-stability-lane-result.json";
const lane = readJson(lanePath);
const failures = [];

requireEqual(lane.version, "oam.runtime-stability-lane.v1", "version", failures);
requireEqual(lane.capabilityId, "Dormitory.FirstGoldenChain", "capabilityId", failures);
requireEqual(lane.lane, "runtime-stability-hard", "lane", failures);
requireEqual(lane.driftPolicy?.generatedContractsMayChange, false, "driftPolicy.generatedContractsMayChange", failures);
requireEqual(lane.driftPolicy?.generatedBundleDigestMayChange, false, "driftPolicy.generatedBundleDigestMayChange", failures);
requireEqual(lane.driftPolicy?.businessSemanticsMayChange, false, "driftPolicy.businessSemanticsMayChange", failures);
requireEqual(lane.driftPolicy?.browserHarnessWorkaroundAllowed, false, "driftPolicy.browserHarnessWorkaroundAllowed", failures);
requireEqual(lane.driftPolicy?.runtimeReadProjectionStabilityOnly, true, "driftPolicy.runtimeReadProjectionStabilityOnly", failures);
requireEqual(lane.negativeAuthorities?.businessFeatureDevelopmentAllowed, false, "negativeAuthorities.businessFeatureDevelopmentAllowed", failures);
requireEqual(lane.negativeAuthorities?.productionConfirmAllowed, false, "negativeAuthorities.productionConfirmAllowed", failures);
requireEqual(lane.negativeAuthorities?.releaseAuthority, false, "negativeAuthorities.releaseAuthority", failures);
requireEqual(lane.negativeAuthorities?.finalGoNoGo, "NO_GO", "negativeAuthorities.finalGoNoGo", failures);

const diffNames = gitDiffNames();
const singleBundleResult = readOptionalJson("artifacts/oam/checks/single-capability-bundle-digest-result.json");
const generatedBundleDigestIsStable =
  singleBundleResult?.status === "PASS" &&
  singleBundleResult?.generatedBundleDigestIsSingleAuthority === true;
const generatedContractDiffs = diffNames.filter((file) =>
  file.startsWith("docs/contracts/generated/") ||
  file.startsWith("apps/mobile/src/generated/") ||
  file === "docs/oam/generated-contracts-manifest.json" ||
  file === "docs/oam/kernel/oam-kernel-graph.generated.json"
);
const browserHarnessOnlyDiffs = diffNames.filter((file) => file.startsWith("scripts/surface/") || file.includes("browser"));
if (generatedContractDiffs.length > 0 && !generatedBundleDigestIsStable) {
  failures.push(
    `runtime stability lane generated contracts changed without stable single bundle digest authority: ${generatedContractDiffs.join(", ")}.`
  );
}
if (lane.currentKnownRuntimeStabilityIssue?.activePatchInThisChange === true && browserHarnessOnlyDiffs.length > 0) {
  failures.push(`active runtime stability patch must not be only a browser harness workaround: ${browserHarnessOnlyDiffs.join(", ")}.`);
}

const result = {
  version: "oam.runtime-stability-lane-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  lane: lane.lane,
  laneStatus: lane.status,
  activePatchInThisChange: lane.currentKnownRuntimeStabilityIssue?.activePatchInThisChange === true,
  handwrittenRuntimeImplementationDiffs: diffNames.filter((file) =>
    file.startsWith("services/core-api/") ||
    (file.startsWith("apps/mobile/src/") && !file.startsWith("apps/mobile/src/generated/"))
  ),
  generatedContractDiffs,
  generatedContractDiffsAllowedAsReproducibleOutputs: generatedContractDiffs.length > 0 && generatedBundleDigestIsStable,
  singleCapabilityBundleDigestStatus: singleBundleResult?.status ?? "MISSING",
  canonicalGeneratedBundleDigest: singleBundleResult?.canonicalGeneratedBundleDigest ?? null,
  browserHarnessOnlyDiffs,
  runtimeReadProjectionStabilityOnly: lane.driftPolicy?.runtimeReadProjectionStabilityOnly === true,
  businessFeatureDevelopmentAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Runtime stability lane check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Runtime stability lane check: PASS (${result.laneStatus})`);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function readOptionalJson(file) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) return null;
  return readJson(file);
}

function gitDiffNames() {
  try {
    return execFileSync("git", ["diff", "--name-only"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .map((item) => item.trim().replace(/\\/g, "/"))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}
