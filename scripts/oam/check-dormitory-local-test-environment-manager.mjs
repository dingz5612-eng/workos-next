import fs from "node:fs";
import path from "node:path";
import { fileDigest, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const scriptPath = "scripts/dev/manage-local-test-environment.ps1";
const resultPath = "artifacts/oam/checks/dormitory-local-test-environment-manager-result.json";
const failures = [];
const source = readText(scriptPath);

for (const required of [
  "Get-NetTCPConnection",
  "Stop-Process",
  "dotnet",
  "build",
  "npm",
  "apps/mobile",
  "Start-Process",
  "-WindowStyle Hidden",
  "check-dormitory-active-path-gate.mjs",
  "check-dormitory-operation-execution-contract.mjs",
  "check-dormitory-ci-hard-gates.mjs"
]) {
  if (!source.includes(required)) fail(`local environment manager missing ${required}.`);
}
if (source.includes("production") || source.includes("final GO")) fail("local environment manager must not imply production or final GO.");

const result = {
  version: "oam.dormitory-local-test-environment-manager-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  scriptPath,
  scriptDigest: fileDigest(scriptPath, root),
  stopsExistingPorts: true,
  buildsBeforeStart: true,
  hiddenBackgroundServices: true,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory local test environment manager check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory local test environment manager check: PASS");

function readText(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    fail(`required file missing: ${file}.`);
    return "";
  }
  return fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "");
}

function fail(message) {
  failures.push(message);
}
