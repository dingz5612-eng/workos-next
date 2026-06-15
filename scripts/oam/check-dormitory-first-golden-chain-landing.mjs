import { execFileSync } from "node:child_process";
import {
  DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH,
  DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_RESULT_PATH,
  validateDormitoryFirstGoldenChainLandingAuthority
} from "./lib/dormitory-first-golden-chain-landing.mjs";
import { readJsonIfExists, writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const authority = readJsonIfExists(DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_PATH, root);
const result = validateDormitoryFirstGoldenChainLandingAuthority({
  authority,
  root,
  currentHead: gitHead()
});

writeJson(DORMITORY_FIRST_GOLDEN_CHAIN_LANDING_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory first golden chain landing check: FAIL");
  for (const failure of result.failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Dormitory first golden chain landing check: PASS (${result.landingStatus}, businessFeatureDevelopmentAllowed=${result.businessFeatureDevelopmentAllowed}, finalGoNoGo=${result.finalGoNoGo})`
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
