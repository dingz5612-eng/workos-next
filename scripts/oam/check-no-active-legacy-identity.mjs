import {
  NO_ACTIVE_LEGACY_RESULT_PATH,
  loadCapabilityDocuments,
  validateNoActiveLegacyIdentity,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const { registry, ledger, projection } = loadCapabilityDocuments(root);
const state = validateNoActiveLegacyIdentity({ registry, ledger, projection });
const result = {
  version: "oam.no-active-legacy-identity-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: state.status,
  capabilityId: projection?.capabilityId ?? ledger?.capabilityId ?? registry?.capabilityId ?? "MISSING",
  activeAuthorityLegacyIdentityAllowed: false,
  failures: state.failures
};

writeJson(NO_ACTIVE_LEGACY_RESULT_PATH, result, root);

if (state.status !== "PASS") {
  console.error("No active legacy identity check: FAIL");
  for (const failure of state.failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`No active legacy identity check: PASS (${result.capabilityId})`);
