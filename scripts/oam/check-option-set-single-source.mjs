import {
  CAPABILITY_ID,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/option-set-single-source-result.json";
const failures = [];
const optionSet = await import("../../apps/mobile/src/controls/optionSetContract.js");
const capabilityProjectionSource = fs.readFileSync(path.join(root, "apps/mobile/src/capabilityProjection.js"), "utf8");
const checkedOptionSets = ["technicalState", "bunkType"];

for (const name of checkedOptionSets) {
  const labels = optionSet.canonicalOptionLabels(name) ?? {};
  const valuesByLabel = new Map();
  for (const [value, label] of Object.entries(labels)) {
    const list = valuesByLabel.get(label) || [];
    list.push(value);
    valuesByLabel.set(label, list);
  }
  for (const [label, values] of valuesByLabel) {
    if (values.length > 1) {
      failures.push(`optionSet ${name} duplicates label ${label}: ${values.join(", ")}.`);
    }
  }
}
if (optionSet.canonicalLabelForOptionValue("technicalState", "repair_required") !== "需维修") {
  failures.push("technicalState repair_required must be the single source for 需维修.");
}
if (optionSet.canonicalLabelForOptionValue("technicalState", "repair") === "需维修") {
  failures.push("technicalState must not keep duplicate repair value for 需维修.");
}
if (optionSet.preferredOptionSetDefault("bunkType") !== "whole") {
  failures.push("bunkType preferred default must be whole; current one-bed rooms must not default to bunk_pair.");
}
if (!capabilityProjectionSource.includes('return Number.isFinite(value) && value <= 1 ? "whole" : "bunk_pair";')) {
  failures.push("defaultBedTypeForCount must map one-bed rooms to whole and multi-bed rooms to bunk_pair.");
}

const result = {
  version: "oam.option-set-single-source-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  checkedOptionSets,
  duplicateLabelAllowed: false,
  oneBedRoomDefaultsToBunkPair: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Option set single source check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Option set single source check: PASS");
