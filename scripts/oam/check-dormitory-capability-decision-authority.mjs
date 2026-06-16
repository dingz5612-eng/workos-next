import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-first-golden-chain.capability-decision.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-capability-decision-authority-result.json";
const expectedChain = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
];
const failures = [];
const authority = readJson(authorityPath);

if (authority) {
  requireEqual(authority.version, "oam.dormitory.capability-decision-authority.v1", "version");
  requireEqual(authority.status, "authoritative", "status");
  requireEqual(authority.authorityType, "dormitory_first_golden_chain_capability_decision", "authorityType");
  requireEqual(authority.currentCapabilityId, "Dormitory.FirstGoldenChain", "currentCapabilityId");
  requireArrayExact(authority.currentChain, expectedChain, "currentChain");
  requireEqual(authority.currentBedModel, "BedSet", "currentBedModel");

  const boundaries = authority.decisionBoundaries ?? {};
  requireEqual(
    boundaries.priorControlledAccommodationResourceSetupBedSetup,
    "advisory_only_not_current_proof",
    "decisionBoundaries.priorControlledAccommodationResourceSetupBedSetup"
  );
  requireEqual(
    boundaries.singleBedMaintenance,
    "future_separate_capability_not_current_first_golden_chain",
    "decisionBoundaries.singleBedMaintenance"
  );
  requireEqual(boundaries.browserPassIsBusinessGo, false, "decisionBoundaries.browserPassIsBusinessGo");
  requireEqual(boundaries.evidenceRootPassIsReleaseGo, false, "decisionBoundaries.evidenceRootPassIsReleaseGo");
  requireEqual(boundaries.wStayResourceAsCurrentProofAllowed, false, "decisionBoundaries.wStayResourceAsCurrentProofAllowed");

  const modelByCommand = new Map((authority.firstGoldenChainBusinessModel ?? []).map((item) => [item.command, item]));
  requireModel(modelByCommand.get("Dorm.RoomSetupConfirm"), {
    creates: ["Dormitory.Room"],
    declares: ["room.bedCount"]
  }, "Dorm.RoomSetupConfirm");
  requireModel(modelByCommand.get("Dorm.BedSetupConfirm"), {
    configures: ["Dormitory.BedSet"],
    creates: ["Dormitory.Bed[1..room.bedCount]"],
    requires: ["existing Dormitory.Room", "declared room.bedCount"]
  }, "Dorm.BedSetupConfirm");
  requireModel(modelByCommand.get("Dorm.ResourceReadinessConfirm"), {
    createsOrUpdates: ["Dormitory.RoomReadiness"],
    requires: ["existing Dormitory.Room", "complete Dormitory.BedSet"],
    blockedUntil: ["createdBedCount == room.bedCount"]
  }, "Dorm.ResourceReadinessConfirm");

  const locks = authority.landingAndReleaseLocks ?? {};
  requireEqual(locks.capabilityStateCeiling, "RUNTIME_TEST_ADMITTED", "landingAndReleaseLocks.capabilityStateCeiling");
  requireEqual(locks.landingStatusCeiling, "PENDING_BUSINESS_LANDING_REVIEW", "landingAndReleaseLocks.landingStatusCeiling");
  requireEqual(locks.businessFeatureDevelopmentAllowed, false, "landingAndReleaseLocks.businessFeatureDevelopmentAllowed");
  requireEqual(locks.productionConfirmAllowed, false, "landingAndReleaseLocks.productionConfirmAllowed");
  requireEqual(locks.releaseAuthority, false, "landingAndReleaseLocks.releaseAuthority");
  requireEqual(locks.finalGoNoGo, "NO_GO", "landingAndReleaseLocks.finalGoNoGo");
}

writeResult({
  version: "oam.dormitory.capability-decision-authority-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  currentCapabilityId: authority?.currentCapabilityId ?? null,
  currentChain: authority?.currentChain ?? [],
  currentBedModel: authority?.currentBedModel ?? null,
  businessFeatureDevelopmentAllowed: authority?.landingAndReleaseLocks?.businessFeatureDevelopmentAllowed === true,
  productionConfirmAllowed: authority?.landingAndReleaseLocks?.productionConfirmAllowed === true,
  releaseAuthority: authority?.landingAndReleaseLocks?.releaseAuthority === true,
  finalGoNoGo: authority?.landingAndReleaseLocks?.finalGoNoGo ?? "NO_GO",
  failures
});

if (failures.length) {
  console.error("Dormitory capability decision authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory capability decision authority check: PASS");

function requireModel(actual, expected, label) {
  if (!actual) {
    failures.push(`${label} business model is missing.`);
    return;
  }
  for (const [field, value] of Object.entries(expected)) {
    requireArrayExact(actual[field], value, `${label}.${field}`);
  }
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function requireArrayExact(actual, expected, label) {
  if (!Array.isArray(actual)) {
    failures.push(`${label} must be an array.`);
    return;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label} must equal ${format(expected)}, actual ${format(actual)}.`);
  }
}

function readJson(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`${file} is missing.`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

function writeResult(result) {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    ...result,
    checkedAtUtc: new Date().toISOString()
  }, null, 2)}\n`);
}

function format(value) {
  return JSON.stringify(value);
}
