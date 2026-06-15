import {
  CAPABILITY_LEDGER_PATH,
  CAPABILITY_PROJECTION_PATH,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import { DORMITORY_RUNTIME_ADMISSION_PATH } from "./lib/dormitory-runtime-admission.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/release-authority-is-only-final-go-source-result.json";
const ledger = readJsonIfExists(CAPABILITY_LEDGER_PATH, root);
const projection = readJsonIfExists(CAPABILITY_PROJECTION_PATH, root);
const runtimeAdmission = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const releaseEvent = (ledger?.events ?? []).find((event) => event.eventType === "RELEASE_AUTHORIZED");
const failures = [];

if (releaseEvent) {
  if (!releaseEvent.subjectDigest && !releaseEvent.outputDigests?.releaseAuthorityDigest) {
    failures.push("RELEASE_AUTHORIZED event must contain release authority digest.");
  }
} else {
  requireEqual(projection?.activeAuthority?.releaseAuthorityDigest, null, "projection.activeAuthority.releaseAuthorityDigest", failures);
  requireEqual(projection?.releaseAuthority, false, "projection.releaseAuthority", failures);
  requireEqual(projection?.finalGoNoGo, "NO_GO", "projection.finalGoNoGo", failures);
  requireEqual(runtimeAdmission?.releaseAuthority, false, "runtimeAdmission.releaseAuthority", failures);
  requireEqual(runtimeAdmission?.finalGoNoGo, "NO_GO", "runtimeAdmission.finalGoNoGo", failures);
}

const result = {
  version: "oam.release-authority-final-go-source-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  releaseAuthorizedEventPresent: Boolean(releaseEvent),
  finalGoOnlySource: "RELEASE_AUTHORIZED ledger event",
  releaseAuthority: Boolean(releaseEvent),
  finalGoNoGo: releaseEvent ? "GO_ALLOWED_BY_RELEASE_AUTHORIZED_EVENT_ONLY" : "NO_GO",
  productionConfirmAllowed: false,
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Release authority final-GO source check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release authority final-GO source check: PASS (releaseAuthorizedEventPresent=${result.releaseAuthorizedEventPresent})`);

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}
