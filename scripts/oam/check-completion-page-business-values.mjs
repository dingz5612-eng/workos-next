import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/completion-page-business-values-result.json";
const projection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const workspaceView = read("apps/mobile/src/views/workspaceView.js");
const failures = [];

for (const fieldId of ["roomNo", "bedNo", "readinessState"]) {
  if (!(projection?.businessUi?.completionBusinessValueFields ?? []).includes(fieldId)) {
    failures.push(`businessUi.completionBusinessValueFields missing ${fieldId}.`);
  }
}
if (!workspaceView.includes("firstGoldenChainCompletionValues")) {
  failures.push("completion page must aggregate first golden chain business values.");
}
if (!workspaceView.includes("isUserSubmittedCapabilityField")) {
  failures.push("completion page must filter system-derived raw ids from completed business fields.");
}
if (!workspaceView.includes("readinessDisplayValue")) {
  failures.push("completion page must display readinessState with business label.");
}
if (/roomId|bedId/.test(String(projection?.businessUi?.completionBusinessValueFields ?? []))) {
  failures.push("completion business values must not include raw roomId/bedId.");
}

const result = {
  version: "oam.completion-page-business-values-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  expectedBusinessValues: ["D01", "D01-01", "可分配"],
  rawStableIdsDisplayed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Completion page business values check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Completion page business values check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}
