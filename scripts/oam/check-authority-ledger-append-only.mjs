import {
  AUTHORITY_LEDGER_RESULT_PATH,
  loadCapabilityDocuments,
  validateAuthorityLedger,
  validateCapabilityRegistry,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const { registry, ledger } = loadCapabilityDocuments(root);
const registryState = validateCapabilityRegistry({ registry, root });
const ledgerState = validateAuthorityLedger({ ledger, root });
const failures = [...registryState.failures, ...ledgerState.failures];
const result = {
  version: "oam.authority-ledger-append-only-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: ledger?.capabilityId ?? registry?.capabilityId ?? "MISSING",
  eventCount: ledger?.events?.length ?? 0,
  finalEventDigest: ledgerState.finalEventDigest ?? null,
  generatedBundleDigest: ledgerState.generatedBundleDigest ?? null,
  failures
};

writeJson(AUTHORITY_LEDGER_RESULT_PATH, result, root);

if (failures.length > 0) {
  console.error("Authority ledger append-only check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Authority ledger append-only check: PASS (${result.capabilityId}, events=${result.eventCount}, finalEventDigest=${result.finalEventDigest})`
);
