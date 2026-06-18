import { execFileSync } from "node:child_process";
import {
  DORMITORY_RUNTIME_ADMISSION_PATH,
  RUNTIME_ADMISSION_APPROVED_STATUS,
  buildDormitoryRuntimeAdmissionAuthority,
  validateDormitoryRuntimeAdmissionAuthority
} from "./lib/dormitory-runtime-admission.mjs";
import { readJsonIfExists, writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const existing = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const status = process.argv.includes("--approved-test-only")
  ? RUNTIME_ADMISSION_APPROVED_STATUS
  : existing?.runtimeAdmissionStatus ?? RUNTIME_ADMISSION_APPROVED_STATUS;

const authority = buildDormitoryRuntimeAdmissionAuthority({
  root,
  currentHead: gitHead(),
  status
});
writeJson(DORMITORY_RUNTIME_ADMISSION_PATH, authority, root);

const result = validateDormitoryRuntimeAdmissionAuthority({
  authority,
  root,
  currentHead: gitHead(),
  writeProof: process.argv.includes("--write-proof") || process.env.OAM_WRITE_PROOF === "1"
});
writeJson("artifacts/oam/checks/dormitory-runtime-admission-result.json", result, root);

if (result.status !== "PASS") {
  console.error("Dormitory runtime admission refresh: FAIL");
  for (const failure of result.failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Dormitory runtime admission refresh: PASS (${result.runtimeAdmissionStatus}, runtimeConsumptionReady=${result.runtimeConsumptionReady}, finalGoNoGo=${result.finalGoNoGo})`
);

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8"
    }).trim();
  } catch {
    return null;
  }
}
