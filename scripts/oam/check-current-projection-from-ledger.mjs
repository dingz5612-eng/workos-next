import {
  CURRENT_PROJECTION_RESULT_PATH,
  loadCapabilityDocuments,
  validateCurrentProjection,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const { registry, ledger, projection } = loadCapabilityDocuments(root);
const state = validateCurrentProjection({ registry, ledger, projection, root });
const result = {
  version: "oam.current-projection-from-ledger-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: state.status,
  capabilityId: projection?.capabilityId ?? ledger?.capabilityId ?? "MISSING",
  currentFilesMode: projection?.currentFilesMode ?? "MISSING",
  activeAuthority: projection?.activeAuthority ?? null,
  runtimeConsumptionReady: projection?.runtimeConsumptionReady ?? null,
  runtimeGoNoGo: projection?.runtimeGoNoGo ?? "MISSING",
  businessFeatureDevelopmentAllowed: projection?.businessFeatureDevelopmentAllowed ?? null,
  businessLandingGoNoGo: projection?.businessLandingGoNoGo ?? "MISSING",
  productionConfirmAllowed: projection?.productionConfirmAllowed ?? null,
  releaseAuthority: projection?.releaseAuthority ?? null,
  finalGoNoGo: projection?.finalGoNoGo ?? "MISSING",
  failures: state.failures
};

writeJson(CURRENT_PROJECTION_RESULT_PATH, result, root);

if (state.status !== "PASS") {
  console.error("Current projection from ledger check: FAIL");
  for (const failure of state.failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Current projection from ledger check: PASS (${result.capabilityId}, currentFilesMode=${result.currentFilesMode}, finalGoNoGo=${result.finalGoNoGo})`
);
