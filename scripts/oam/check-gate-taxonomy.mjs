import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const taxonomyPath = "docs/oam/control-plane/gate-lane-taxonomy.current.json";
const resultPath = "artifacts/oam/checks/gate-taxonomy-result.json";
const requiredLanes = [
  "authority-hard",
  "generated-hard",
  "runtime-test-hard",
  "business-landing-hard",
  "runtime-stability-hard",
  "browser-hardening",
  "release-hard",
  "nightly-advisory",
  "evidence-projection"
];
const currentRequiredLanes = [
  "authority-hard",
  "generated-hard",
  "runtime-test-hard",
  "evidence-projection"
];
const requiredLaneDisplayNames = [
  "Authority Lane",
  "Generated Bundle Lane",
  "Runtime Test Lane",
  "Business Landing Lane",
  "Evidence Projection Lane",
  "Browser Hardening Lane",
  "Release Lane"
];
const currentRequiredLaneDisplayNames = [
  "Authority Lane",
  "Generated Bundle Lane",
  "Runtime Test Lane",
  "Evidence Projection Lane"
];

const taxonomy = readJson(taxonomyPath);
const failures = [];
requireEqual(taxonomy?.version, "oam.gate-lane-taxonomy.v1", "version", failures);
requireEqual(taxonomy?.orchestratorMode, "capability_state_machine_with_gate_lanes", "orchestratorMode", failures);
requireJsonEqual(taxonomy?.currentPreInternalRequiredLanes, currentRequiredLanes, "currentPreInternalRequiredLanes", failures);
requireJsonEqual(
  taxonomy?.currentPreInternalRequiredLaneDisplayNames,
  currentRequiredLaneDisplayNames,
  "currentPreInternalRequiredLaneDisplayNames",
  failures
);
for (const lane of requiredLanes) {
  if (!Array.isArray(taxonomy?.lanes?.[lane]) || taxonomy.lanes[lane].length === 0) {
    failures.push(`lane ${lane} must exist and contain gates.`);
  }
}
const laneDisplayNames = Object.values(taxonomy?.laneDisplayNames ?? {});
for (const laneName of requiredLaneDisplayNames) {
  if (!laneDisplayNames.includes(laneName)) failures.push(`laneDisplayNames must include ${laneName}.`);
}
if (!(taxonomy?.lanes?.["evidence-projection"] ?? []).includes("node scripts/oam/check-evidence-writer-boundary.mjs")) {
  failures.push("Evidence Projection Lane must include check-evidence-writer-boundary.mjs.");
}
for (const lane of currentRequiredLanes) {
  for (const gate of taxonomy?.lanes?.[lane] ?? []) {
    if (/browser|real-browser|coverage|mobile-critical/i.test(gate)) {
      failures.push(`current hard lane ${lane} must not contain browser/mobile hardening gate: ${gate}.`);
    }
  }
}
for (const [lane, gates] of Object.entries(taxonomy?.lanes ?? {})) {
  for (const gate of gates) {
    const script = scriptPathForGate(gate);
    if (script && shouldExistNow(lane) && !fs.existsSync(path.join(root, script))) {
      failures.push(`gate script missing for ${lane}: ${script}.`);
    }
  }
}

const result = {
  version: "oam.gate-taxonomy-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  requiredLanes,
  currentPreInternalRequiredLanes: taxonomy?.currentPreInternalRequiredLanes ?? [],
  laneStatuses: Object.fromEntries(requiredLanes.map((lane) => [lane, failures.some((f) => f.includes(lane)) ? "NO_GO" : "PASS"])),
  browserHardeningRequiredForGeneratedOrRuntime: false,
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Gate taxonomy check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Gate taxonomy check: PASS");

function scriptPathForGate(gate) {
  const match = String(gate).match(/(?:node|pwsh).*?(scripts\/[^\s]+?\.(?:mjs|ps1))/);
  return match?.[1] ?? null;
}

function shouldExistNow(lane) {
  return ["authority-hard", "generated-hard", "runtime-test-hard", "browser-hardening"].includes(lane);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}

function requireJsonEqual(actual, expected, label, failures) {
  if (stableStringify(actual) !== stableStringify(expected)) {
    failures.push(`${label} must equal ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
