import {
  COMPATIBILITY_BOX_RESULT_PATH,
  loadCapabilityDocuments,
  validateCompatibilityBox,
  validateNoActiveLegacyIdentity,
  validateNoStageNumberAuthorityLeak,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const { registry, ledger, projection, compatibilityBox } = loadCapabilityDocuments(root);
const compatibilityState = validateCompatibilityBox({ compatibilityBox });
const legacyState = validateNoActiveLegacyIdentity({ registry, ledger, projection });
const stageState = validateNoStageNumberAuthorityLeak({ registry, ledger, projection });
const failures = [
  ...compatibilityState.failures,
  ...legacyState.failures,
  ...stageState.failures
];
const result = {
  version: "oam.compatibility-box-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: compatibilityBox?.capabilityId ?? projection?.capabilityId ?? "MISSING",
  runtimeIdentityPolicy: compatibilityBox?.runtimeIdentityPolicy ?? "MISSING",
  activeAuthorityLegacyIdentityAllowed: false,
  stageNumberAuthorityAllowed: false,
  failures
};

writeJson(COMPATIBILITY_BOX_RESULT_PATH, result, root);

if (failures.length > 0) {
  console.error("Compatibility Box boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Compatibility Box boundary check: PASS (${result.capabilityId})`);
