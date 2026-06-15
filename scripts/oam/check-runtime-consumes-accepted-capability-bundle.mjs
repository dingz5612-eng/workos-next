import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import { GENERATED_CANDIDATE_ACCEPTANCE_PATH } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/runtime-consumes-accepted-capability-bundle-result.json";
const acceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
const projectionSource = read("services/core-api/WorkOS.Api/Runtime/AcceptedCapabilityRuntimeProjection.cs");
const projectionSeed = read("services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs");
const projectionRuntime = read("services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs");
const failures = [];
const acceptedDigest = acceptance?.acceptedGeneratedBundleDigest;
const requiredCards = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
];
const forbiddenActiveRuntimeTerms = [
  "rateSetup",
  "roomBlock",
  "roomRelease"
];

if (acceptance?.decisionStatus !== "ACCEPTED_BY_00") {
  failures.push("generated candidate must be ACCEPTED_BY_00 before runtime consumes accepted capability bundle.");
}
if (!isDigest(acceptedDigest)) failures.push("acceptedGeneratedBundleDigest must be a sha256 digest.");
if (!projectionSource.includes(`CapabilityId = "${CAPABILITY_ID}"`)) {
  failures.push("AcceptedCapabilityRuntimeProjection must bind Dormitory.FirstGoldenChain.");
}
if (!projectionSource.includes(`AcceptedGeneratedBundleDigest = "${acceptedDigest}"`)) {
  failures.push("AcceptedCapabilityRuntimeProjection.AcceptedGeneratedBundleDigest must equal acceptedGeneratedBundleDigest.");
}
for (const cardId of requiredCards) {
  if (!projectionSource.includes(cardId)) failures.push(`AcceptedCapabilityRuntimeProjection missing required card ${cardId}.`);
}
for (const term of forbiddenActiveRuntimeTerms) {
  if (projectionSource.includes(term)) failures.push(`accepted runtime projection must not contain ${term}.`);
}
if (!projectionSeed.includes("AcceptedCapabilityRuntimeProjection.Workspace()")) {
  failures.push("ProjectionSeed must seed AcceptedCapabilityRuntimeProjection.Workspace().");
}
if (!projectionSeed.includes("WorkspaceSeedCatalog.All()") ||
  !projectionSeed.includes("AcceptedCapabilityRuntimeProjection.LegacyResourceWorkspaceId")) {
  failures.push("ProjectionSeed must keep WorkspaceSeedCatalog as legacy source and exclude the legacy resource workspace from current first golden chain.");
}
if (!projectionRuntime.includes("StartWorkspace(AcceptedCapabilityRuntimeProjection.WorkspaceId)")) {
  failures.push("ProjectionRuntime.StartResourceSetup must start the accepted capability workspace.");
}

const result = {
  version: "oam.runtime-consumes-accepted-capability-bundle-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  acceptedGeneratedBundleDigest: acceptedDigest ?? null,
  runtimeProjectionDigestSource: "AcceptedCapabilityRuntimeProjection.AcceptedGeneratedBundleDigest",
  runtimeProjectionDigestMatchesAcceptedGeneratedBundleDigest: failures.length === 0,
  activeRuntimeCardIds: requiredCards,
  workspaceSeedCatalogDrivesCurrentFirstGoldenChain: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Runtime consumes accepted capability bundle check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Runtime consumes accepted capability bundle check: PASS (${acceptedDigest})`);

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function isDigest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value ?? ""));
}
