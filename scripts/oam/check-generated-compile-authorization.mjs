import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const allowGeneratedCompile = process.env.ALLOW_GENERATED_COMPILE_CANDIDATE === "true";
const sourcePath = "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
const sourceResultPath = "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json";
const finalReportPath = "artifacts/oam/final-report.json";
const pendingApprovalPath = "docs/oam/generated-compile-approval.current.json";
const candidateApprovalPath = "docs/oam/generated-compile-candidate-approval.current.json";
const controlPlanePath = "scripts/oam/run-control-plane-checks.ps1";
const ciWorkflowPath = ".github/workflows/ci.yml";
const expectedCandidateSourceRef = "fd60390e678f9d6934137f0480a183701b01de8f";
const expectedExecutionHead = "9db58da1ebc2a02349436833747307ac78c4c2fd";
const expectedExecutionBranch = "codex/dormitory-source-p0-s2-closure";
const generatedPaths = [
  "docs/contracts/generated/dormitory",
  "apps/mobile/src/generated/oam"
];
const generatedMarkerFiles = [
  "docs/oam/domain-derived-contracts.json",
  "docs/oam/generated-contracts-manifest.json",
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json"
];
const forbiddenCandidateActions = [
  "generated release",
  "business feature development",
  "runtime rollout",
  "Lead implementation",
  "Reservation implementation",
  "Checkin implementation",
  "Payment implementation",
  "Deposit implementation",
  "Business Production",
  "Dormitory L2",
  "production_confirm",
  "releaseAuthority=true",
  "finalGoNoGo=GO"
];
const candidateAllowedActions = [
  "run scripts/oam/check-generated-compile-authorization.mjs with ALLOW_GENERATED_COMPILE_CANDIDATE=true",
  "run scripts/business/generate-dormitory-derived-contracts.mjs as generated compile candidate only",
  "run scripts/oam/compile-current-kernel-graph.mjs for candidate consistency",
  "write candidate proof artifacts that remain finalGoNoGo=NO_GO and releaseAuthority=false"
];

const failures = [];
const sourceText = readText(sourcePath);
const sourceResult = readJsonIfExists(sourceResultPath);
const finalReport = readJsonIfExists(finalReportPath);
const pendingApproval = readJsonIfExists(pendingApprovalPath);
const candidateApproval = readJsonIfExists(candidateApprovalPath);
const controlPlaneText = readText(controlPlanePath);
const ciWorkflowText = readText(ciWorkflowPath);
const sourceHash = digestText(sourceText);
const candidateSourceHash = digestText(gitShow(`${expectedCandidateSourceRef}:${sourcePath}`));
const currentHead = runGit(["rev-parse", "HEAD"]).trim();
const currentBranch = resolveCurrentBranch();

requireText(sourceText, "sourceFinalizationStatus: SOURCE_FINALIZED_BY_00", "Source package must be finalized by 00 before compile candidate authorization.");
requireText(sourceText, "sourceScenarioPackageReviewStatus: SOURCE_FINALIZED_BY_00", "Source package review status must be finalized by 00.");
requireText(sourceText, "sourceFieldGapsDecisionStatus: DECIDED_AND_BOUND", "Source field gaps must be decided and bound before compile candidate authorization.");
requireText(sourceText, "sourceReadyForCompileDecision: true", "Source package must be ready only for 00 compile decision.");
requireText(sourceText, "compileDecisionStatus: READY_FOR_00_COMPILE_DECISION", "Source package may only be ready for 00 compile decision.");
requireText(sourceText, "generatedCompileAuthorized: false", "Formal generated compile authorization must remain false.");
requireText(sourceText, "generatedCompilationAllowed: false_until_00_explicit_generated_compile_approval", "Formal generated compilation must remain unauthorized.");
requireText(sourceText, "generatedContractStatus10B: PENDING_GENERATED_CONTRACT", "Generated contract status must remain pending.");
requireText(sourceText, "generatedCompileCompleted: false", "Generated compile must remain incomplete.");
requireText(sourceText, "generatedCompilationCompleted: false", "Generated compilation must remain incomplete.");
requireText(sourceText, "runtimeConsumptionReady: false", "Runtime consumption must remain blocked until candidate acceptance by 00.");
requireText(sourceText, "businessFeatureDevelopmentAllowed: false", "Business feature development must remain blocked.");
requireText(controlPlaneText, "scripts/oam/check-generated-compile-authorization.mjs", "Control Plane must include the generated compile authorization gate.");
requireText(ciWorkflowText, "scripts/oam/check-generated-compile-authorization.mjs", "CI must include the generated compile authorization gate.");

checkGenerationGuards();
checkPendingApprovalObject();
const candidateApprovalOk = checkCandidateApprovalObject();
checkExecutionFrame(candidateApprovalOk);
checkCandidateSourceRange();
checkGeneratedMarkers();

for (const [id, text] of [
  ["source", sourceText],
  ["source-result", JSON.stringify(sourceResult ?? {})],
  ["final-report", JSON.stringify(finalReport ?? {})]
]) {
  if (/generatedCompilationCompleted"\s*:\s*true|generatedCompilationCompleted:\s*true/.test(text)) {
    failures.push(`${id} must not set generatedCompilationCompleted=true.`);
  }
  if (/generatedCompileCompleted"\s*:\s*true|generatedCompileCompleted:\s*true/.test(text)) {
    failures.push(`${id} must not set generatedCompileCompleted=true.`);
  }
  if (/generatedCompileAuthorized"\s*:\s*true|generatedCompileAuthorized:\s*true/.test(text)) {
    failures.push(`${id} must not set formal generatedCompileAuthorized=true.`);
  }
  if (/runtimeConsumptionReady"\s*:\s*true|runtimeConsumptionReady:\s*true/.test(text)) {
    failures.push(`${id} must not set runtimeConsumptionReady=true.`);
  }
  if (/generatedContractStatus10B"\s*:\s*"COMPLETED"|generatedContractStatus10B:\s*COMPLETED/.test(text)) {
    failures.push(`${id} must not set generatedContractStatus10B=COMPLETED.`);
  }
  if (/businessFeatureDevelopmentAllowed"\s*:\s*true|businessFeatureDevelopmentAllowed:\s*true/.test(text)) {
    failures.push(`${id} must not set businessFeatureDevelopmentAllowed=true.`);
  }
}

if (finalReport) {
  if (finalReport.finalGoNoGo !== "NO_GO") failures.push("Final Report finalGoNoGo must remain NO_GO.");
  if (finalReport.releaseAuthority !== false) failures.push("Final Report releaseAuthority must remain false.");
  if (finalReport.businessProductionGoNoGo !== "NO_GO" || finalReport.dormitoryL2GoNoGo !== "NO_GO") {
    failures.push("Final Report businessProductionGoNoGo and dormitoryL2GoNoGo must remain NO_GO.");
  }
  if (finalReport.productionConfirmAllowed !== false) failures.push("Final Report productionConfirmAllowed must remain false.");
}

const generatedSemanticAllowed = allowGeneratedCompile || candidateApprovalOk;
if (!generatedSemanticAllowed) {
  const diffScopes = generatedDiffScopes();
  const generatedDiffs = diffScopes.flatMap((scope) =>
    generatedPaths.flatMap((target) => gitDiffNames(target, scope)));
  const semanticDiffs = diffScopes.flatMap((scope) =>
    generatedPaths.flatMap((target) => semanticGeneratedDiffLines(target, scope)));
  if (semanticDiffs.length) {
    failures.push(`Generated business contract files changed without candidate authorization: ${generatedDiffs.join(", ")}; semantic diff lines: ${semanticDiffs.slice(0, 12).join(" | ")}`);
  }
}

if (failures.length) {
  console.error("Generated compile authorization check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Generated compile authorization check: PASS");

function requireText(text, snippet, message) {
  if (!text.includes(snippet)) failures.push(message);
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8")) : null;
}

function checkPendingApprovalObject() {
  if (!pendingApproval) return;
  if (pendingApproval.version !== "oam.generated-compile-approval.v1") {
    failures.push(`${pendingApprovalPath} version must be oam.generated-compile-approval.v1.`);
  }
  if (pendingApproval.currentAuthorityArchitecture !== "oam.current") {
    failures.push(`${pendingApprovalPath} must bind currentAuthorityArchitecture=oam.current.`);
  }
  if (pendingApproval.sourceScenarioRef !== sourcePath) {
    failures.push(`${pendingApprovalPath} sourceScenarioRef must bind ${sourcePath}.`);
  }
  if (pendingApproval.sourceHash !== sourceHash) {
    failures.push(`${pendingApprovalPath} sourceHash must match current Source package hash ${sourceHash}.`);
  }
  if (pendingApproval.approvalStatus !== "pending_00_generated_compile_authorization") {
    failures.push(`${pendingApprovalPath} must remain pending; candidate authorization belongs in ${candidateApprovalPath}.`);
  }
  if (pendingApproval.generatedCompileAuthorized !== false || pendingApproval.generatedCompilationAllowed !== false) {
    failures.push(`${pendingApprovalPath} must keep generatedCompileAuthorized=false and generatedCompilationAllowed=false.`);
  }
}

function checkCandidateApprovalObject() {
  if (!candidateApproval) {
    if (allowGeneratedCompile) {
      failures.push(`${candidateApprovalPath} is required before ALLOW_GENERATED_COMPILE_CANDIDATE=true.`);
    }
    return false;
  }
  let ok = true;
  const requireField = (condition, message) => {
    if (!condition) {
      failures.push(message);
      ok = false;
    }
  };
  requireField(candidateApproval.version === "oam.generated-compile-candidate-approval.v1", `${candidateApprovalPath} version must be oam.generated-compile-candidate-approval.v1.`);
  requireField(candidateApproval.currentAuthorityArchitecture === "oam.current", `${candidateApprovalPath} must bind currentAuthorityArchitecture=oam.current.`);
  requireField(candidateApproval.approvalType === "generated_compile_candidate_only", `${candidateApprovalPath} approvalType must be generated_compile_candidate_only.`);
  requireField(candidateApproval.approvedBy === "00｜OAM 总控", `${candidateApprovalPath} approvedBy must be 00｜OAM 总控.`);
  requireField(candidateApproval.approvalStatus === "approved_for_generated_compile_candidate_only", `${candidateApprovalPath} approvalStatus must be approved_for_generated_compile_candidate_only.`);
  requireField(candidateApproval.scope === "generated_compile_candidate_only", `${candidateApprovalPath} scope must be generated_compile_candidate_only.`);
  requireField(candidateApproval.sourceScenarioRef === sourcePath, `${candidateApprovalPath} sourceScenarioRef must bind ${sourcePath}.`);
  requireField(candidateApproval.sourceHash === sourceHash, `${candidateApprovalPath} sourceHash must match current Source package hash ${sourceHash}.`);
  requireField(candidateApproval.candidateSourceRef === expectedCandidateSourceRef, `${candidateApprovalPath} candidateSourceRef must be ${expectedCandidateSourceRef}.`);
  requireField(candidateApproval.candidateSourceHash === candidateSourceHash, `${candidateApprovalPath} candidateSourceHash must be ${candidateSourceHash}.`);
  requireField(candidateApproval.candidateSourceRefIsAncestorOfExecutionHead === true, `${candidateApprovalPath} must prove candidateSourceRef is ancestor of executionHead.`);
  requireField(candidateApproval.executionBranch === expectedExecutionBranch, `${candidateApprovalPath} executionBranch must be ${expectedExecutionBranch}.`);
  requireField(candidateApproval.executionHead === expectedExecutionHead, `${candidateApprovalPath} executionHead must be ${expectedExecutionHead}.`);
  requireField(candidateApproval.allowEnv?.ALLOW_GENERATED_COMPILE_CANDIDATE === "true", `${candidateApprovalPath} allowEnv.ALLOW_GENERATED_COMPILE_CANDIDATE must be true.`);
  requireField(candidateApproval.generatedCompileCandidateAuthorized === true, `${candidateApprovalPath} must set generatedCompileCandidateAuthorized=true.`);
  requireField(candidateApproval.generatedCompileAuthorized === false, `${candidateApprovalPath} must keep formal generatedCompileAuthorized=false.`);
  requireField(candidateApproval.generatedCompileCompleted === false && candidateApproval.generatedCompilationCompleted === false, `${candidateApprovalPath} must keep generated compile completion false.`);
  requireField(candidateApproval.generatedCandidateAcceptedBy00 === false, `${candidateApprovalPath} must keep generatedCandidateAcceptedBy00=false.`);
  requireField(candidateApproval.generatedReleaseAllowed === false, `${candidateApprovalPath} must keep generatedReleaseAllowed=false.`);
  requireField(candidateApproval.runtimeConsumptionAllowed === "false_until_candidate_accepted_by_00", `${candidateApprovalPath} runtimeConsumptionAllowed must be false_until_candidate_accepted_by_00.`);
  requireField(candidateApproval.runtimeConsumptionReady === false, `${candidateApprovalPath} must keep runtimeConsumptionReady=false.`);
  requireField(candidateApproval.businessFeatureDevelopmentAllowed === false, `${candidateApprovalPath} must keep businessFeatureDevelopmentAllowed=false.`);
  requireField(candidateApproval.productionConfirmAllowed === false, `${candidateApprovalPath} must keep productionConfirmAllowed=false.`);
  requireField(candidateApproval.releaseAuthority === false, `${candidateApprovalPath} must keep releaseAuthority=false.`);
  requireField(candidateApproval.finalGoNoGo === "NO_GO", `${candidateApprovalPath} must keep finalGoNoGo=NO_GO.`);
  requireField(Array.isArray(candidateApproval.allowedActions) && arraysEqualAsSets(candidateApproval.allowedActions, candidateAllowedActions), `${candidateApprovalPath} allowedActions must contain only the candidate compile actions.`);
  requireField(Array.isArray(candidateApproval.forbiddenActions), `${candidateApprovalPath} forbiddenActions must be an array.`);
  for (const action of forbiddenCandidateActions) {
    requireField(candidateApproval.forbiddenActions?.includes(action), `${candidateApprovalPath} forbiddenActions missing ${action}.`);
  }
  requireField(candidateApproval.executionHeadDiffPolicy?.range === `${expectedCandidateSourceRef}..${expectedExecutionHead}`, `${candidateApprovalPath} executionHeadDiffPolicy.range must bind candidateSourceRef..executionHead.`);
  requireField(candidateApproval.executionHeadDiffPolicy?.noSourceBusinessFactChanges === true, `${candidateApprovalPath} must prove no Source business fact changes in executionHead diff.`);
  return ok;
}

function checkExecutionFrame(candidateApprovalOk) {
  if (!isCommit(expectedCandidateSourceRef)) failures.push(`candidateSourceRef does not resolve to a commit: ${expectedCandidateSourceRef}.`);
  if (!isCommit(expectedExecutionHead)) failures.push(`executionHead does not resolve to a commit: ${expectedExecutionHead}.`);
  if (isCommit(expectedCandidateSourceRef) && isCommit(expectedExecutionHead) &&
    !isAncestor(expectedCandidateSourceRef, expectedExecutionHead)) {
    failures.push(`candidateSourceRef ${expectedCandidateSourceRef} must be an ancestor of executionHead ${expectedExecutionHead}.`);
  }
  if (allowGeneratedCompile) {
    if (!candidateApprovalOk) failures.push("ALLOW_GENERATED_COMPILE_CANDIDATE=true requires valid candidate-only approval.");
    if (currentBranch !== expectedExecutionBranch) {
      failures.push(`Candidate compile env may only run on ${expectedExecutionBranch}; current branch is ${currentBranch}.`);
    }
    if (currentHead !== expectedExecutionHead) {
      failures.push(`Candidate compile env must run at executionHead ${expectedExecutionHead}; current HEAD is ${currentHead}.`);
    }
  } else if (candidateApproval && currentHead !== expectedExecutionHead && !isAncestor(expectedExecutionHead, currentHead)) {
    failures.push(`Current HEAD must equal or descend from candidate executionHead ${expectedExecutionHead}; actual ${currentHead}.`);
  }
}

function checkCandidateSourceRange() {
  const range = `${expectedCandidateSourceRef}..${expectedExecutionHead}`;
  const changed = runGit(["diff", "--name-only", range]).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const allowed = new Set([
    "docs/oam/current-engineering-ledger.json",
    "scripts/oam/generate-current-evidence-root.mjs"
  ]);
  for (const file of changed) {
    if (!allowed.has(file)) {
      failures.push(`candidateSourceRef..executionHead may only change evidence/compile/proof files; unexpected ${file}.`);
    }
  }
}

function checkGenerationGuards() {
  if (!controlPlaneText.includes("scripts/business/generate-dormitory-derived-contracts.mjs")) return;
  if (!/\$env:ALLOW_GENERATED_COMPILE_CANDIDATE\s+-eq\s+["']true["']/.test(controlPlaneText)) {
    failures.push("Control Plane must guard Dormitory generated contract generation behind ALLOW_GENERATED_COMPILE_CANDIDATE=true.");
  }
  if (ciWorkflowText.includes("scripts/business/generate-dormitory-derived-contracts.mjs") &&
    !/ALLOW_GENERATED_COMPILE_CANDIDATE:-\}"\s*=\s*"true"/.test(ciWorkflowText)) {
    failures.push("CI must guard Dormitory generated contract generation behind ALLOW_GENERATED_COMPILE_CANDIDATE=true.");
  }
}

function checkGeneratedMarkers() {
  for (const file of generatedMarkerFiles) {
    const document = readJsonIfExists(file);
    if (!document) {
      failures.push(`${file} is missing.`);
      continue;
    }
    if (document.generated !== true || document.doNotEdit !== true) {
      failures.push(`${file} must contain generated=true and doNotEdit=true.`);
    }
  }
}

function gitDiffNames(target, scope) {
  try {
    return runGit([...scope.nameArgs, "--", target])
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function semanticGeneratedDiffLines(target, scope) {
  let diff = "";
  try {
    diff = runGit([...scope.diffArgs, "--", target]);
  } catch {
    return [`${scope.id}:${target}: unable to inspect generated diff`];
  }
  const semanticLines = [];
  for (const rawLine of diff.split(/\r?\n/)) {
    if (!/^[+-]/.test(rawLine) || rawLine.startsWith("+++") || rawLine.startsWith("---")) continue;
    const line = rawLine.slice(1).trim();
    if (!line) continue;
    if (/^"(kernelGraphHash|compilerInputDigest|outputContentDigest)":\s*"sha256:[a-f0-9]+",?$/.test(line)) continue;
    semanticLines.push(`${scope.id}:${target}: ${rawLine}`);
  }
  return semanticLines;
}

function generatedDiffScopes() {
  const scopes = [{
    id: "working-tree",
    nameArgs: ["diff", "--name-only"],
    diffArgs: ["diff", "--unified=0"]
  }];
  const base = diffBase();
  if (base) {
    const range = `${base}...HEAD`;
    scopes.push({
      id: `base..HEAD:${base}`,
      nameArgs: ["diff", "--name-only", range],
      diffArgs: ["diff", "--unified=0", range]
    });
  } else {
    failures.push("Unable to resolve PR/base diff for generated compile authorization gate.");
  }
  if (isCommit(expectedCandidateSourceRef)) {
    const candidateRange = `${expectedCandidateSourceRef}..HEAD`;
    scopes.push({
      id: `candidateSourceRef..HEAD:${expectedCandidateSourceRef}`,
      nameArgs: ["diff", "--name-only", candidateRange],
      diffArgs: ["diff", "--unified=0", candidateRange]
    });
  }
  return scopes;
}

function diffBase() {
  const configured = process.env.OAM_GENERATED_DIFF_BASE ||
    (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main");
  const baseRef = gitRefExists(configured) ? configured : gitRefExists("origin/main") ? "origin/main" : "";
  if (!baseRef) return "";
  try {
    return runGit(["merge-base", "HEAD", baseRef]).trim() || baseRef;
  } catch {
    return baseRef;
  }
}

function gitRefExists(ref) {
  try {
    runGit(["rev-parse", "--verify", ref]);
    return true;
  } catch {
    return false;
  }
}

function isCommit(ref) {
  try {
    runGit(["rev-parse", "--verify", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function isAncestor(ancestor, descendant) {
  try {
    runGit(["merge-base", "--is-ancestor", ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
}

function arraysEqualAsSets(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const actualSet = new Set(actual);
  return expected.every((item) => actualSet.has(item));
}

function resolveCurrentBranch() {
  return process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    runGit(["branch", "--show-current"]).trim() ||
    "detached";
}

function gitShow(ref) {
  return runGit(["show", ref]);
}

function runGit(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function digestText(text) {
  return `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
}
