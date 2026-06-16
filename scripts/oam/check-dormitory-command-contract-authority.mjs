import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-command-contracts.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-command-contract-authority-result.json";
const failures = [];
const requiredContractFields = [
  "requiredInputs",
  "derivedInputs",
  "readonlyInputs",
  "normalizedInputs",
  "invariantRefs",
  "successEvents",
  "conflictResponses",
  "validationResponses",
  "sideEffectPolicy",
  "idempotencyPolicy",
  "concurrencyPolicy",
  "searchCommandPolicy",
  "surfaceRenderingPolicy",
  "dbProjectionPolicy",
  "testProofPolicy"
];
const expectedEvents = new Map([
  ["Dorm.RoomSetupConfirm", ["Accommodation.RoomConfigured"]],
  ["Dorm.BedSetupConfirm", ["Accommodation.BedSetConfigured", "Accommodation.BedConfigured[]"]],
  ["Dorm.ResourceReadinessConfirm", ["Accommodation.RoomReadinessChanged"]]
]);
const authority = readJson(authorityPath);

if (authority) {
  requireEqual(authority.version, "oam.dormitory.command-contracts-authority.v1", "version");
  requireEqual(authority.status, "authoritative", "status");
  requireEqual(authority.authorityType, "dormitory_first_golden_chain_command_contracts", "authorityType");
  requireEqual(authority.currentCapabilityId, "Dormitory.FirstGoldenChain", "currentCapabilityId");
  requireEqual(authority.invariantAuthorityRef, "docs/business/domains/dormitory/dormitory-invariants.authority.json", "invariantAuthorityRef");
  requireEqual(authority.failureSemanticsRef, "docs/business/domains/dormitory/dormitory-failure-semantics.authority.json", "failureSemanticsRef");

  const commandByName = new Map((authority.commands ?? []).map((item) => [item.command, item]));
  requireArrayExact([...commandByName.keys()], [...expectedEvents.keys()], "commands.command");
  for (const [command, events] of expectedEvents) {
    const contract = commandByName.get(command);
    if (!contract) {
      failures.push(`${command} contract is missing.`);
      continue;
    }
    for (const field of requiredContractFields) {
      if (Array.isArray(contract[field])) {
        if (contract[field].length === 0) failures.push(`${command}.${field} must not be empty.`);
      } else if (!contract[field]) {
        failures.push(`${command}.${field} is required.`);
      }
    }
    requireArrayExact(contract.successEvents, events, `${command}.successEvents`);
    if (!contract.sideEffectPolicy.includes("no_side_effects_on_failure")) {
      failures.push(`${command}.sideEffectPolicy must forbid failure side effects.`);
    }
    if (contract.searchCommandPolicy !== "search_readonly_no_command_write") {
      failures.push(`${command}.searchCommandPolicy must keep search readonly.`);
    }
  }
}

writeResult({
  version: "oam.dormitory.command-contract-authority-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  commands: authority?.commands?.map((item) => item.command) ?? [],
  failures
});

if (failures.length) {
  console.error("Dormitory command contract authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory command contract authority check: PASS");

function requireEqual(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function requireArrayExact(actual, expected, label) {
  if (!Array.isArray(actual)) {
    failures.push(`${label} must be an array.`);
    return;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label} must equal ${format(expected)}, actual ${format(actual)}.`);
  }
}

function readJson(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`${file} is missing.`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

function writeResult(result) {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({ ...result, checkedAtUtc: new Date().toISOString() }, null, 2)}\n`);
}

function format(value) {
  return JSON.stringify(value);
}
