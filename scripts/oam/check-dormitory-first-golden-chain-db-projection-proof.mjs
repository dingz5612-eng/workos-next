import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-first-golden-chain-db-projection-proof-result.json";
const capability = readJsonIfExists("docs/oam/capabilities/dormitory-first-golden-chain.current.json", root);
const landing = readJsonIfExists("docs/oam/dormitory-first-golden-chain-landing.current.json", root);
const policy = readJsonIfExists("docs/contracts/generated/dormitory/db-projection-policy.generated.json", root);
const failures = [];
const expectedMappings = [
  {
    workItemType: "Dorm.RoomSetupConfirm",
    domainEvent: "Accommodation.RoomConfigured",
    target: "accommodation_rooms"
  },
  {
    workItemType: "Dorm.BedSetupConfirm",
    domainEvent: "Accommodation.BedConfigured",
    target: "accommodation_beds"
  },
  {
    workItemType: "Dorm.ResourceReadinessConfirm",
    domainEvent: "Accommodation.RoomReadinessChanged",
    target: "readiness/read model"
  }
];

const lifecycle = capability?.lifecycleAchieved ?? [];
const businessLandingAdmitted = lifecycle.includes("BUSINESS_LANDING_ADMITTED");
const landingGo = landing?.dormitoryFirstGoldenChainLandingGoNoGo === "GO" ||
  landing?.businessFeatureDevelopmentAllowed === true;

if (policy?.capabilityId !== CAPABILITY_ID) {
  failures.push(`db projection policy must bind capabilityId=${CAPABILITY_ID}.`);
}
if (policy?.productionConfirmAllowed !== false ||
  policy?.releaseAuthority !== false ||
  policy?.finalGoNoGo !== "NO_GO") {
  failures.push("db projection policy must keep production/release/final GO closed.");
}

if (!businessLandingAdmitted) {
  if (policy?.policyMode !== "null_if_runtime_test_only") {
    failures.push("RUNTIME_TEST_ADMITTED DB policy must be null_if_runtime_test_only.");
  }
  if ((policy?.activeDbProjectionMappings ?? []).length !== 0) {
    failures.push("RUNTIME_TEST_ADMITTED DB policy must not expose active DB projection mappings.");
  }
  checkMappings("inactiveBusinessLandingMappings", policy?.inactiveBusinessLandingMappings ?? []);
  if (landingGo) {
    failures.push("landing current must not GO before BUSINESS_LANDING_ADMITTED exists in capability current.");
  }
} else {
  if (policy?.policyMode !== "business_landing_projection_required") {
    failures.push("BUSINESS_LANDING_ADMITTED DB policy must be business_landing_projection_required.");
  }
  checkMappings("activeDbProjectionMappings", policy?.activeDbProjectionMappings ?? []);
  if (!landingGo) {
    failures.push("BUSINESS_LANDING_ADMITTED requires landing current GO projection.");
  }
}

const result = {
  version: "oam.dormitory-first-golden-chain-db-projection-proof-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  lifecycleState: capability?.lifecycleAchieved?.at?.(-1) ?? "UNKNOWN",
  businessLandingAdmitted,
  policyMode: policy?.policyMode ?? null,
  businessLandingBlockedBecause: businessLandingAdmitted
    ? null
    : "db_projection_not_active",
  reviewPackageStatus: businessLandingAdmitted
    ? "READY_FOR_00_BUSINESS_LANDING_REVIEW"
    : "BUSINESS_LANDING_NOT_READY_REVIEW_PACKAGE",
  dbProjectionProofDigest: businessLandingAdmitted
    ? policy?.dbProjectionProofDigest ?? null
    : "null_if_runtime_test_only",
  mappings: businessLandingAdmitted
    ? policy?.activeDbProjectionMappings ?? []
    : policy?.inactiveBusinessLandingMappings ?? [],
  businessFeatureDevelopmentAllowed: businessLandingAdmitted && landing?.businessFeatureDevelopmentAllowed === true,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory first golden chain DB projection proof check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory first golden chain DB projection proof check: PASS (${result.dbProjectionProofDigest})`);

function checkMappings(label, mappings) {
  for (const expected of expectedMappings) {
    const found = mappings.find((item) =>
      item.workItemType === expected.workItemType &&
      item.domainEvent === expected.domainEvent &&
      item.target === expected.target);
    if (!found) {
      failures.push(`${label} missing ${expected.workItemType} -> ${expected.domainEvent} -> ${expected.target}.`);
    }
  }
}
