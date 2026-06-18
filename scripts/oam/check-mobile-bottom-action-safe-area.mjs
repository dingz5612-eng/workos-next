import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/mobile-bottom-action-safe-area-result.json";
const operationCss = read("apps/mobile/src/styles/operation.css");
const shellCss = read("apps/mobile/src/styles/shell.css");
const workspaceView = read("apps/mobile/src/views/workspaceView.js");
const failures = [];

if (!shellCss.includes("--sticky-action-height")) failures.push("shell CSS must define --sticky-action-height.");
if (!shellCss.includes("var(--bottom-nav-height) + var(--sticky-action-height) + var(--safe-bottom)")) {
  failures.push("app shell bottom padding must reserve bottom nav + sticky action + safe area.");
}
if (!operationCss.includes(".sticky-action") || !operationCss.includes("var(--safe-bottom)")) {
  failures.push("sticky action must be positioned above safe area.");
}
if (!workspaceView.includes('<div class="sticky-action">')) {
  failures.push("workspace view must use the sticky action wrapper for the bottom submit button.");
}

const result = {
  version: "oam.mobile-bottom-action-safe-area-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  bottomButtonCoversLastField: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Mobile bottom action safe area check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Mobile bottom action safe area check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}
