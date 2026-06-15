import { execFileSync } from "node:child_process";

const validators = [
  "scripts/validate-capability-contracts.mjs",
  "scripts/validate-production-slice-contracts.mjs",
  "scripts/validate-compatibility-contracts.mjs",
  "scripts/validate-release-contracts.mjs"
];

for (const validator of validators) {
  execFileSync(process.execPath, [validator], { stdio: "inherit" });
}

console.log("Contract files: PASS");
