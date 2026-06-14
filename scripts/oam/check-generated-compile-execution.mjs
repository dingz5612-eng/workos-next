import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateFormalGeneratedCompileAuthorization } from "./lib/formal-generated-compile-authorization.mjs";

const root = process.cwd();
const snapshotPath = "artifacts/oam/checks/generated-compile-execution-input-snapshot.json";
const resultPath = "artifacts/oam/checks/generated-compile-execution-result.json";
const proofPath = "artifacts/oam/evidence/generated-compile-execution-proof.json";
const formalApprovalPath = "docs/oam/generated-compile-approval.current.json";
const candidateApprovalPath = "docs/oam/generated-compile-candidate-approval.current.json";
const sourcePackagePath = "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
const allowedRuntimeGeneratedDiffs = new Set([
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json"
]);
const generatedOutputFiles = [
  "docs/oam/system-derived-contracts.json",
  "docs/oam/domain-derived-contracts.json",
  "docs/oam/generated-contracts-manifest.json",
  "docs/contracts/admission/admission-contract.json",
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json"
];
const sourceAuthorityFiles = [
  sourcePackagePath,
  "docs/business/domains/dormitory/dormitory-operating-kernel.json",
  "docs/oam/system-operating-kernel.json",
  "docs/oam/oam-kernel-graph.json"
];
const generatorAndCheckerFiles = [
  "scripts/business/generate-dormitory-derived-contracts.mjs",
  "scripts/oam/compile-current-kernel-graph.mjs",
  "scripts/oam/generate-system-derived-contracts.mjs",
  "scripts/oam/check-generated-files-not-manually-edited.mjs",
  "scripts/oam/check-generated-contract-consistency.mjs",
  "scripts/oam/check-derived-contract-consistency.mjs",
  "scripts/oam/check-oam-kernel-graph.mjs",
  "scripts/oam/check-generated-compile-authorization.mjs",
  "scripts/oam/check-generated-compile-execution.mjs",
  "scripts/oam/lib/formal-generated-compile-authorization.mjs"
];
const compileCommands = [
  ["node", ["scripts/business/generate-dormitory-derived-contracts.mjs"]],
  ["node", ["scripts/oam/compile-current-kernel-graph.mjs"]],
  ["node", ["scripts/oam/generate-system-derived-contracts.mjs"]]
];
const requiredPreGateResults = [
  ["generatedFilesNotManuallyEdited", "artifacts/oam/checks/generated-files-not-manually-edited-result.json"],
  ["generatedContractConsistency", "artifacts/oam/checks/generated-contract-consistency-result.json"],
  ["derivedContractConsistency", "artifacts/oam/checks/derived-contract-consistency-result.json"],
  ["oamKernelGraph", "artifacts/oam/checks/oam-kernel-graph-result.json"]
];

const snapshotOnly = process.argv.includes("--snapshot-only");
const failures = [];
const currentHead = git(["rev-parse", "HEAD"]);
const currentBranch = git(["branch", "--show-current"]);
const formalApproval = readJson(formalApprovalPath);
const candidateApproval = readJson(candidateApprovalPath);
const formalAuthorization = validateFormalGeneratedCompileAuthorization({
  approval: formalApproval,
  candidateApproval,
  currentHead,
  approvalPath: formalApprovalPath,
  candidateApprovalPath
});

failures.push(...formalAuthorization.failures);
if (!formalAuthorization.authorized) {
  failures.push("formal generated compile execution requires exact-head 00 formal authorization.");
}

if (snapshotOnly) {
  const snapshot = buildSnapshot("phase1_input_snapshot");
  const finalReport = readJsonIfExists("artifacts/oam/final-report.json");
  if (finalReport) {
    if (finalReport.generatedCompileCompleted !== false || finalReport.generatedCompilationCompleted !== false) {
      failures.push("phase1 snapshot must be taken before generated compile completion is recorded.");
    }
    if (finalReport.runtimeConsumptionReady !== false ||
      finalReport.businessFeatureDevelopmentAllowed !== false ||
      finalReport.releaseAuthority !== false ||
      finalReport.finalGoNoGo !== "NO_GO") {
      failures.push("phase1 snapshot observed forbidden runtime/business/release/GO state.");
    }
  }
  writeJson(snapshotPath, {
    version: "oam.generated-compile-execution-input-snapshot.v1",
    recordedAtUtc: new Date().toISOString(),
    status: failures.length === 0 ? "PASS" : "FAIL",
    snapshot,
    formalAuthorization: formalAuthorizationState(),
    failures,
    generatedCompileAuthorized: formalAuthorization.authorized,
    generatedCompilationAllowed: formalAuthorization.authorized,
    generatedCompileCompleted: false,
    generatedCompilationCompleted: false,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
  finish("Generated compile execution input snapshot");
  process.exit(0);
}

const inputSnapshot = readJsonIfExists(snapshotPath)?.snapshot ?? buildSnapshot("phase1_input_snapshot_missing_local_rebuilt");
runCompileRound("round1");
const round1Snapshot = buildSnapshot("round1_after_compile");
runCompileRound("round2");
const round2Snapshot = buildSnapshot("round2_after_compile");

checkSnapshotEquality(round1Snapshot, round2Snapshot);
checkSourceAndRuntimeNoDrift();
checkPreGateResults();
checkGeneratedMarkers();

const status = failures.length === 0 ? "PASS" : "FAIL";
const proof = {
  version: "oam.generated-compile-execution-proof.v1",
  proofType: "generated-compile-execution",
  generatedAtUtc: new Date().toISOString(),
  status,
  currentHead,
  currentBranch,
  formalAuthorization: formalAuthorizationState(),
  inputSnapshot,
  compileRounds: [
    {
      round: 1,
      commands: commandLines(),
      generatedOutputDigest: round1Snapshot.generatedOutputDigest,
      generatedOutputHashes: round1Snapshot.generatedOutputHashes
    },
    {
      round: 2,
      commands: commandLines(),
      generatedOutputDigest: round2Snapshot.generatedOutputDigest,
      generatedOutputHashes: round2Snapshot.generatedOutputHashes
    }
  ],
  reproducibility: {
    status,
    round1GeneratedOutputDigest: round1Snapshot.generatedOutputDigest,
    round2GeneratedOutputDigest: round2Snapshot.generatedOutputDigest,
    sameGeneratedOutputDigest: round1Snapshot.generatedOutputDigest === round2Snapshot.generatedOutputDigest,
    sameDerivedOutputDigest: round1Snapshot.derivedOutputDigest === round2Snapshot.derivedOutputDigest,
    sameKernelGraphDigest: round1Snapshot.kernelGraphGeneratedDigest === round2Snapshot.kernelGraphGeneratedDigest
  },
  noManualEditProof: {
    status: gateResultStatus("artifacts/oam/checks/generated-files-not-manually-edited-result.json"),
    proofRef: "artifacts/oam/checks/generated-files-not-manually-edited-result.json"
  },
  consistencyProof: {
    generatedContracts: gateResultStatus("artifacts/oam/checks/generated-contract-consistency-result.json"),
    derivedContracts: gateResultStatus("artifacts/oam/checks/derived-contract-consistency-result.json"),
    kernelGraph: gateResultStatus("artifacts/oam/checks/oam-kernel-graph-result.json")
  },
  driftProof: buildDriftProof(),
  generatedCompileAuthorized: formalAuthorization.authorized,
  generatedCompilationAllowed: formalAuthorization.authorized,
  generatedCompileCompleted: status === "PASS",
  generatedCompilationCompleted: status === "PASS",
  generatedCandidateAcceptedBy00: false,
  runtimeConsumptionReady: false,
  businessFeatureDevelopmentAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  nextDecisionFor00: "GENERATED_CANDIDATE_ACCEPTANCE_REVIEW",
  forbiddenInterpretations: [
    "generated compile completion is not generated candidate acceptance",
    "generated compile completion is not runtime consumption",
    "generated compile completion is not business feature development",
    "generated compile completion is not release authority",
    "generated compile completion is not final GO"
  ],
  failures
};

writeJson(proofPath, proof);
writeJson(resultPath, {
  version: "oam.generated-compile-execution-result.v1",
  checkedAtUtc: proof.generatedAtUtc,
  status,
  checkerExecutionStatus: status,
  proofPath,
  currentHead,
  currentBranch,
  formalAuthorization: proof.formalAuthorization,
  generatedOutputDigest: round2Snapshot.generatedOutputDigest,
  generatedOutputHashes: round2Snapshot.generatedOutputHashes,
  manifestDigest: hashFile("docs/oam/generated-contracts-manifest.json"),
  generatedKernelGraphDigest: hashFile("docs/oam/kernel/oam-kernel-graph.generated.json"),
  sourcePackageHash: hashFile(sourcePackagePath),
  inputSnapshotPath: snapshotPath,
  inputSnapshotDigest: digestObject(inputSnapshot),
  proofDigest: digestObject(proof),
  reproducibility: proof.reproducibility,
  noManualEditProof: proof.noManualEditProof,
  consistencyProof: proof.consistencyProof,
  driftProof: proof.driftProof,
  generatedCompileAuthorized: proof.generatedCompileAuthorized,
  generatedCompilationAllowed: proof.generatedCompilationAllowed,
  generatedCompileCompleted: proof.generatedCompileCompleted,
  generatedCompilationCompleted: proof.generatedCompilationCompleted,
  generatedCandidateAcceptedBy00: false,
  runtimeConsumptionReady: false,
  businessFeatureDevelopmentAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  nextDecisionFor00: proof.nextDecisionFor00,
  failures
});

finish("Generated compile execution check");

function runCompileRound(round) {
  for (const [command, args] of compileCommands) {
    let passed = false;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        sleep(150 * attempt);
        execFileSync(command, args, {
          cwd: root,
          stdio: "inherit",
          env: { ...process.env, ALLOW_GENERATED_COMPILE_CANDIDATE: "true" }
        });
        passed = true;
        break;
      } catch (error) {
        if (attempt === 3) {
          failures.push(`${round} failed: ${command} ${args.join(" ")} exit=${error.status ?? "unknown"}`);
          return;
        }
        sleep(500 * attempt);
      }
    }
    if (!passed) return;
  }
}

function buildSnapshot(label) {
  return {
    label,
    recordedAtUtc: new Date().toISOString(),
    currentHead,
    currentBranch,
    formalApprovalPath,
    formalApprovalHash: hashFile(formalApprovalPath),
    candidateApprovalPath,
    candidateApprovalHash: hashFile(candidateApprovalPath),
    sourcePackagePath,
    sourcePackageHash: hashFile(sourcePackagePath),
    sourceAuthorityDigest: digestForFiles(sourceAuthorityFiles),
    generatorAndCheckerHashes: hashMap(generatorAndCheckerFiles),
    generatedOutputFiles,
    generatedOutputHashes: hashMap(generatedOutputFiles),
    generatedOutputDigest: digestForFiles(generatedOutputFiles),
    derivedOutputDigest: digestForFiles([
      "docs/oam/system-derived-contracts.json",
      "docs/oam/domain-derived-contracts.json",
      "docs/oam/generated-contracts-manifest.json",
      "docs/contracts/admission/admission-contract.json"
    ]),
    kernelGraphSourceDigest: hashFile("docs/oam/oam-kernel-graph.json"),
    kernelGraphGeneratedDigest: hashFile("docs/oam/kernel/oam-kernel-graph.generated.json"),
    gitDiffNames: git(["diff", "--name-only"]).split(/\r?\n/).filter(Boolean),
    gitUntrackedNames: git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/).filter(Boolean)
  };
}

function formalAuthorizationState() {
  return {
    predicateVersion: formalAuthorization.version,
    predicateStatus: formalAuthorization.status,
    predicateHeadBindingStatus: formalAuthorization.headBindingStatus,
    predicateAuthorized: formalAuthorization.authorized,
    predicateFailures: formalAuthorization.failures,
    approvalPath: formalApprovalPath,
    approvalStatus: formalApproval.approvalStatus ?? null,
    approvalDecision: formalApproval.approvalDecision ?? null,
    approvalScope: formalApproval.approvalScope ?? null,
    currentHEAD: formalApproval.currentHEAD ?? null,
    reviewedRef: formalApproval.reviewedRef ?? null,
    candidateSourceRef: formalApproval.candidateSourceRef ?? null,
    authorizedCandidateExecutionHead: formalApproval.authorizedCandidateExecutionHead ?? null,
    generatedCompileAuthorized: formalApproval.generatedCompileAuthorized ?? null,
    generatedCompilationAllowed: formalApproval.generatedCompilationAllowed ?? null,
    generatedCompileCompleted: formalApproval.generatedCompileCompleted ?? null,
    generatedCompilationCompleted: formalApproval.generatedCompilationCompleted ?? null,
    candidateArtifactEvidenceCompleted: formalApproval.candidateArtifactEvidenceCompleted ?? null,
    generatedCandidateAcceptedBy00: formalApproval.generatedCandidateAcceptedBy00 ?? null,
    runtimeConsumptionReady: formalApproval.runtimeConsumptionReady ?? null,
    businessFeatureDevelopmentAllowed: formalApproval.businessFeatureDevelopmentAllowed ?? null,
    productionConfirmAllowed: formalApproval.productionConfirmAllowed ?? null,
    releaseAuthority: formalApproval.releaseAuthority ?? null,
    finalGoNoGo: formalApproval.finalGoNoGo ?? null
  };
}

function checkSnapshotEquality(first, second) {
  for (const [label, left, right] of [
    ["generated output digest", first.generatedOutputDigest, second.generatedOutputDigest],
    ["derived output digest", first.derivedOutputDigest, second.derivedOutputDigest],
    ["generated kernel graph digest", first.kernelGraphGeneratedDigest, second.kernelGraphGeneratedDigest]
  ]) {
    if (left !== right) {
      failures.push(`reproducibility mismatch for ${label}: ${left} != ${right}`);
    }
  }
  for (const file of generatedOutputFiles) {
    if (first.generatedOutputHashes[file] !== second.generatedOutputHashes[file]) {
      failures.push(`generated output hash mismatch after repeated compile: ${file}`);
    }
  }
}

function checkSourceAndRuntimeNoDrift() {
  const sourceDiffs = unique([
    ...gitDiffNames(["docs/business/domains/dormitory"]),
    ...gitDiffNames(["docs/business/dormitory"])
  ]);
  if (sourceDiffs.length > 0) {
    failures.push(`Source business facts changed during formal generated compile: ${sourceDiffs.join(", ")}`);
  }

  const runtimeDiffs = unique([
    ...gitDiffNames(["services"]),
    ...gitDiffNames(["infra/db"]),
    ...gitDiffNames(["tests"]),
    ...gitDiffNames(["apps/mobile/src"])
  ]).filter((file) => !allowedRuntimeGeneratedDiffs.has(file));
  const runtimeUntracked = unique([
    ...gitUntrackedNames(["services"]),
    ...gitUntrackedNames(["infra/db"]),
    ...gitUntrackedNames(["tests"]),
    ...gitUntrackedNames(["apps/mobile/src"])
  ]).filter((file) => !allowedRuntimeGeneratedDiffs.has(file));
  if (runtimeDiffs.length > 0 || runtimeUntracked.length > 0) {
    failures.push(`runtime/business implementation drift is forbidden: changed=${runtimeDiffs.join(", ") || "none"} untracked=${runtimeUntracked.join(", ") || "none"}`);
  }
}

function buildDriftProof() {
  const sourceDiffs = unique([
    ...gitDiffNames(["docs/business/domains/dormitory"]),
    ...gitDiffNames(["docs/business/dormitory"])
  ]);
  const runtimeChanged = unique([
    ...gitDiffNames(["services"]),
    ...gitDiffNames(["infra/db"]),
    ...gitDiffNames(["tests"]),
    ...gitDiffNames(["apps/mobile/src"])
  ]);
  const runtimeUntracked = unique([
    ...gitUntrackedNames(["services"]),
    ...gitUntrackedNames(["infra/db"]),
    ...gitUntrackedNames(["tests"]),
    ...gitUntrackedNames(["apps/mobile/src"])
  ]);
  return {
    noSourceBusinessFactChanges: sourceDiffs.length === 0,
    sourceBusinessFactDiffs: sourceDiffs,
    noRuntimeImplementationChanges: runtimeChanged.filter((file) => !allowedRuntimeGeneratedDiffs.has(file)).length === 0 &&
      runtimeUntracked.filter((file) => !allowedRuntimeGeneratedDiffs.has(file)).length === 0,
    runtimeChanged,
    runtimeUntracked,
    allowedRuntimeGeneratedDiffs: [...allowedRuntimeGeneratedDiffs]
  };
}

function checkPreGateResults() {
  for (const [id, file] of requiredPreGateResults) {
    const status = gateResultStatus(file);
    if (!["PASS", "passed"].includes(status)) {
      failures.push(`${id} pre-gate result must be PASS before S4 execution closure: ${file} status=${status || "missing"}`);
    }
  }
}

function checkGeneratedMarkers() {
  for (const file of generatedOutputFiles) {
    const document = readJsonIfExists(file);
    if (!document || document.generated !== true || document.doNotEdit !== true) {
      failures.push(`${file} must remain generated=true and doNotEdit=true.`);
    }
  }
}

function gateResultStatus(file) {
  const document = readJsonIfExists(file);
  return document?.status ?? document?.checkerExecutionStatus ?? document?.result ?? "";
}

function commandLines() {
  return compileCommands.map(([command, args]) => `${command} ${args.join(" ")}`);
}

function gitDiffNames(paths) {
  return git(["diff", "--name-only", "--", ...paths]).split(/\r?\n/).filter(Boolean);
}

function gitUntrackedNames(paths) {
  return git(["ls-files", "--others", "--exclude-standard", "--", ...paths]).split(/\r?\n/).filter(Boolean);
}

function hashMap(files) {
  return Object.fromEntries(files.map((file) => [file, hashFile(file)]));
}

function digestForFiles(files) {
  return digestObject(hashMap(files));
}

function hashFile(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return "missing";
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex")}`;
}

function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8")) : null;
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean).map((item) => item.replaceAll("\\", "/")))].sort();
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function finish(label) {
  if (failures.length > 0) {
    console.error(`${label}: FAIL`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`${label}: PASS`);
}
