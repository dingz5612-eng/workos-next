import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  buildDormitoryGeneratedFieldBindingClosure,
  digestObject
} from "./lib/dormitory-generated-field-binding-closure.mjs";
import {
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  readJsonIfExists
} from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/s5-semantic-digest-idempotency-result.json";
const volatileKeys = new Set([
  "checkedAtUtc",
  "generatedAtUtc",
  "recordedAtUtc",
  "startedAtUtc",
  "endedAtUtc",
  "finishedAtUtc",
  "generatedAt",
  "currentHead",
  "currentRepositoryHead",
  "resultDigest",
  "snapshotDigest",
  "proofDigest",
  "inputSnapshotDigest",
  "approvalObjectHash",
  "gitDiffNames",
  "gitUntrackedNames"
]);
const semanticFiles = [
  "docs/contracts/generated/dormitory/field-bindings.generated.json",
  GENERATED_CANDIDATE_ACCEPTANCE_PATH
];
const commands = [
  { command: "node", args: ["scripts/oam/compile-current-kernel-graph.mjs"] },
  { command: "node", args: ["scripts/oam/check-generated-field-binding-closure.mjs"] },
  { command: "node", args: ["scripts/oam/check-generated-candidate-acceptance.mjs"] },
  { command: "node", args: ["scripts/oam/generate-current-evidence-root.mjs"] },
  {
    command: "node",
    args: ["scripts/oam/check-current-evidence-root.mjs"],
    allowFailureWhileControlPlaneRunning: true
  }
];

const failures = [];
const warnings = [];
const commandResults = [];
const before = captureState("before");

for (const item of commands) {
  run(item);
}

const afterFirstRun = captureState("after_first_run");

for (const item of commands) {
  run(item);
}

const afterSecondRun = captureState("after_second_run");

compareState(before, afterFirstRun, "first run");
compareState(afterFirstRun, afterSecondRun, "second run");
checkNegativeAuthorities(afterSecondRun);

const result = {
  version: "oam.s5-semantic-digest-idempotency-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "FAIL",
  semanticFiles,
  before,
  afterFirstRun,
  afterSecondRun,
  commandResults,
  runEvidenceCanRefreshWithoutSemanticAuthorityRewrite: failures.length === 0,
  generatedCandidateAcceptedBy00: afterSecondRun.generatedCandidateAcceptedBy00,
  runtimeConsumptionReady: false,
  releaseAuthority: false,
  finalGoNoGo: afterSecondRun.finalGoNoGo,
  warnings,
  failures
};

writeJson(resultPath, result);

const afterResultWrite = captureState("after_result_write");
compareState(afterSecondRun, afterResultWrite, "checker result write");
if (!["PASS", "DEFERRED_CONTROL_PLANE_RUNNING"].includes(afterResultWrite.evidenceRootStatus)) {
  failures.push("Evidence Root must remain PASS after idempotency checker result write.");
}

if (failures.length > 0) {
  const failedResult = {
    ...result,
    status: "FAIL",
    afterResultWrite,
    runEvidenceCanRefreshWithoutSemanticAuthorityRewrite: false,
    failures
  };
  writeJson(resultPath, failedResult);
  console.error("S5 semantic digest idempotency check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

writeJson(resultPath, {
  ...result,
  afterResultWrite,
  status: "PASS",
  runEvidenceCanRefreshWithoutSemanticAuthorityRewrite: true,
  failures: []
});

console.log(
  `S5 semantic digest idempotency check: PASS (generatedFieldBindingClosureDigest=${afterSecondRun.generatedFieldBindingClosureDigest}, subjectDigest=${afterSecondRun.subjectDigest})`
);

function captureState(label) {
  const closure = buildDormitoryGeneratedFieldBindingClosure({ root });
  const fieldBindings = readJsonIfExists(semanticFiles[0], root);
  const acceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
  const evidenceRootStatus = checkEvidenceRootStatus();
  return {
    label,
    semanticFileDigests: Object.fromEntries(semanticFiles.map((file) => [file, stableFileDigest(file)])),
    generatedFieldBindingClosureDigest: closure.closureDigest,
    sourceFieldGapsDecisionDigest: closure.sourceFieldGapsDecisionDigest,
    fieldBindingContractDigest: fieldBindings ? digestObject(normalizeForStableDigest(fieldBindings)) : "missing",
    subjectDigest: acceptance?.generatedCandidateSubject?.subjectDigest ?? null,
    acceptanceAuthorityDigest: acceptance ? digestObject(normalizeForStableDigest(acceptance)) : "missing",
    decisionStatus: acceptance?.decisionStatus ?? "MISSING",
    generatedCandidateAcceptedBy00: acceptance?.generatedCandidateAcceptedBy00 === true,
    runtimeConsumptionReady: acceptance?.explicitNegativeAuthorities?.runtimeConsumptionReady ?? false,
    releaseAuthority: acceptance?.explicitNegativeAuthorities?.releaseAuthority ?? false,
    finalGoNoGo: acceptance?.explicitNegativeAuthorities?.finalGoNoGo ?? "NO_GO",
    evidenceRootStatus
  };
}

function compareState(left, right, label) {
  for (const file of semanticFiles) {
    if (left.semanticFileDigests[file] !== right.semanticFileDigests[file]) {
      failures.push(`${file} changed during ${label}.`);
    }
  }
  for (const field of [
    "generatedFieldBindingClosureDigest",
    "sourceFieldGapsDecisionDigest",
    "fieldBindingContractDigest",
    "subjectDigest",
    "acceptanceAuthorityDigest"
  ]) {
    if (left[field] !== right[field]) {
      failures.push(`${field} changed during ${label}: ${left[field]} -> ${right[field]}.`);
    }
  }
}

function checkNegativeAuthorities(state) {
  if (state.generatedCandidateAcceptedBy00 !== false) {
    failures.push("generatedCandidateAcceptedBy00 must remain false.");
  }
  if (state.runtimeConsumptionReady !== false) {
    failures.push("runtimeConsumptionReady must remain false.");
  }
  if (state.releaseAuthority !== false) {
    failures.push("releaseAuthority must remain false.");
  }
  if (state.finalGoNoGo !== "NO_GO") {
    failures.push("finalGoNoGo must remain NO_GO.");
  }
}

function run({ command, args, allowFailureWhileControlPlaneRunning = false }) {
  const printable = [command, ...args].join(" ");
  try {
    execFileSync(command, args, {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      env: process.env
    });
    commandResults.push({ command: printable, status: "PASS" });
  } catch (error) {
    if (allowFailureWhileControlPlaneRunning && isControlPlaneRunning()) {
      commandResults.push({
        command: printable,
        status: "DEFERRED_CONTROL_PLANE_RUNNING",
        stderr: String(error.stderr ?? "").slice(0, 4000),
        stdout: String(error.stdout ?? "").slice(0, 4000)
      });
      return;
    }
    commandResults.push({
      command: printable,
      status: "FAIL",
      exitCode: error.status ?? null,
      stderr: String(error.stderr ?? "").slice(0, 4000),
      stdout: String(error.stdout ?? "").slice(0, 4000)
    });
    failures.push(`${printable} failed.`);
  }
}

function checkEvidenceRootStatus() {
  try {
    execFileSync("node", ["scripts/oam/check-current-evidence-root.mjs"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe"
    });
    return "PASS";
  } catch {
    if (isControlPlaneRunning()) return "DEFERRED_CONTROL_PLANE_RUNNING";
    return "FAIL";
  }
}

function isControlPlaneRunning() {
  const controlPlanePath = abs("artifacts/oam/checks/control-plane-gate-results.json");
  if (!fs.existsSync(controlPlanePath)) return false;
  try {
    const controlPlane = JSON.parse(fs.readFileSync(controlPlanePath, "utf8").replace(/^\uFEFF/, ""));
    return controlPlane.runStatus === "running";
  } catch {
    return false;
  }
}

function stableFileDigest(file) {
  if (!fs.existsSync(abs(file))) return "missing";
  if (!file.endsWith(".json")) return hashFile(file);
  const value = JSON.parse(fs.readFileSync(abs(file), "utf8").replace(/^\uFEFF/, ""));
  return digestObject(normalizeForStableDigest(value));
}

function hashFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(abs(file))).digest("hex")}`;
}

function normalizeForStableDigest(value) {
  if (Array.isArray(value)) return value.map(normalizeForStableDigest);
  if (value && typeof value === "object") {
    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      if (volatileKeys.has(key)) continue;
      normalized[key] = normalizeForStableDigest(child);
    }
    return normalized;
  }
  return value;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
  fs.writeFileSync(abs(file), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function abs(file) {
  return path.join(root, file);
}
