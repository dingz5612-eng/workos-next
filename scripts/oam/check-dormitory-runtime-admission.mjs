import { execFileSync } from "node:child_process";
import {
  DORMITORY_RUNTIME_ADMISSION_PATH,
  DORMITORY_RUNTIME_ADMISSION_RESULT_PATH,
  validateDormitoryRuntimeAdmissionAuthority
} from "./lib/dormitory-runtime-admission.mjs";
import { readJsonIfExists, writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const authority = readJsonIfExists(DORMITORY_RUNTIME_ADMISSION_PATH, root);
const result = validateDormitoryRuntimeAdmissionAuthority({
  authority,
  root,
  currentHead: gitHead()
});

writeJson(DORMITORY_RUNTIME_ADMISSION_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory runtime admission check: FAIL");
  for (const failure of result.failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Dormitory runtime admission check: PASS (${result.runtimeAdmissionStatus}, runtimeConsumptionReady=${result.runtimeConsumptionReady}, finalGoNoGo=${result.finalGoNoGo})`
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
