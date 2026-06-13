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
const staleEvidenceStatuses = new Set(["STALE_BUT_NO_GO", "STALE_REFERENCE"]);

const failures = [];
const sourceText = readText(sourcePath);
const sourceResult = readJsonIfExists(sourceResultPath);
const finalReport = readJsonIfExists(finalReportPath);
const pendingApproval = readJsonIfExists(pendingApprovalPath);
const candidateApproval = readJsonIfExists(candidateApprovalPath);
const controlPlaneText = readText(controlPlanePath);
const ciWorkflowText = readText(ciWorkflowPath);
const controlPlaneResult = readJsonIfExists("artifacts/oam/checks/control-plane-gate-results.json");
const sourceHash = digestText(sourceText);
const currentHead = runGit(["rev-parse", "HEAD"]).trim();
const currentBranch = resolveCurrentBranch();
const authorization = resolveCandidateAuthorization(candidateApproval);

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
const candidateApprovalFailures = collectCandidateApprovalFailures(candidateApproval);
failures.push(...candidateApprovalFailures);
const candidateApprovalOk = candidateApprovalFailures.length === 0;
checkExecutionFrame(candidateApprovalOk);
checkCandidateSourceRange();
checkGeneratedMarkers();
checkNoForbiddenStateEscapes();
checkFinalReportEvidenceBinding();
runNegativeFixtures();

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

console.log("Generated compile authorization check: PASS (candidate authorization, formal generated compile blocking, runtime consumption blocking, evidence current/stale binding)");

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

function resolveCandidateAuthorization(approval) {
  const candidateSourceRef = approval?.authorizedSourceRef ?? approval?.candidateSourceRef ?? "";
  const authorizedCandidateExecutionHead = approval?.authorizedCandidateExecutionHead ?? approval?.executionHead ?? "";
  return {
    candidateSourceRef,
    authorizedCandidateExecutionHead,
    executionBranch: approval?.executionBranch ?? "",
    candidateSourceHash: candidateSourceRef && isCommit(candidateSourceRef)
      ? digestText(gitShow(`${candidateSourceRef}:${sourcePath}`))
      : ""
  };
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

function collectCandidateApprovalFailures(approval) {
  const items = [];
  const requireField = (condition, message) => {
    if (!condition) items.push(message);
  };
  if (!approval) {
    requireField(!allowGeneratedCompile, `${candidateApprovalPath} is required before ALLOW_GENERATED_COMPILE_CANDIDATE=true.`);
    return items;
  }
  const state = resolveCandidateAuthorization(approval);
  requireField(approval.version === "oam.generated-compile-candidate-approval.v1", `${candidateApprovalPath} version must be oam.generated-compile-candidate-approval.v1.`);
  requireField(approval.currentAuthorityArchitecture === "oam.current", `${candidateApprovalPath} must bind currentAuthorityArchitecture=oam.current.`);
  requireField(approval.approvalType === "generated_compile_candidate_only", `${candidateApprovalPath} approvalType must be generated_compile_candidate_only.`);
  requireField(approval.approvedBy === "00｜OAM 总控", `${candidateApprovalPath} approvedBy must be 00｜OAM 总控.`);
  requireField(approval.approvalStatus === "approved_for_generated_compile_candidate_only", `${candidateApprovalPath} approvalStatus must be approved_for_generated_compile_candidate_only.`);
  requireField(approval.scope === "generated_compile_candidate_only", `${candidateApprovalPath} scope must be generated_compile_candidate_only.`);
  requireField(approval.sourceScenarioRef === sourcePath, `${candidateApprovalPath} sourceScenarioRef must bind ${sourcePath}.`);
  requireField(approval.sourceHash === sourceHash, `${candidateApprovalPath} sourceHash must match current Source package hash ${sourceHash}.`);
  requireField(Boolean(state.candidateSourceRef), `${candidateApprovalPath} authorizedSourceRef/candidateSourceRef is required.`);
  requireField(approval.authorizedSourceRef === approval.candidateSourceRef, `${candidateApprovalPath} authorizedSourceRef must equal candidateSourceRef.`);
  requireField(approval.candidateSourceHash === state.candidateSourceHash, `${candidateApprovalPath} candidateSourceHash must be ${state.candidateSourceHash || "a resolvable source hash"}.`);
  requireField(approval.candidateSourceRefIsAncestorOfExecutionHead === true, `${candidateApprovalPath} must prove candidateSourceRef is ancestor of authorizedCandidateExecutionHead.`);
  requireField(Boolean(state.authorizedCandidateExecutionHead), `${candidateApprovalPath} authorizedCandidateExecutionHead is required.`);
  requireField(approval.executionHead === state.authorizedCandidateExecutionHead, `${candidateApprovalPath} executionHead may only remain as a historical alias of authorizedCandidateExecutionHead.`);
  requireField(approval.executionHeadCompatibilityAliasOf === "authorizedCandidateExecutionHead", `${candidateApprovalPath} must declare executionHeadCompatibilityAliasOf=authorizedCandidateExecutionHead.`);
  requireField(Boolean(state.executionBranch), `${candidateApprovalPath} executionBranch is required.`);
  requireField(approval.allowEnv?.ALLOW_GENERATED_COMPILE_CANDIDATE === "true", `${candidateApprovalPath} allowEnv.ALLOW_GENERATED_COMPILE_CANDIDATE must be true.`);
  requireField(approval.generatedCompileCandidateAuthorized === true, `${candidateApprovalPath} must set generatedCompileCandidateAuthorized=true.`);
  requireField(approval.generatedCompileAuthorized === false, `${candidateApprovalPath} must keep formal generatedCompileAuthorized=false.`);
  requireField(approval.generatedCompileCompleted === false && approval.generatedCompilationCompleted === false, `${candidateApprovalPath} must keep generated compile completion false.`);
  requireField(approval.generatedCandidateAcceptedBy00 === false, `${candidateApprovalPath} must keep generatedCandidateAcceptedBy00=false.`);
  requireField(approval.generatedReleaseAllowed === false, `${candidateApprovalPath} must keep generatedReleaseAllowed=false.`);
  requireField(approval.runtimeConsumptionAllowed === "false_until_candidate_accepted_by_00", `${candidateApprovalPath} runtimeConsumptionAllowed must be false_until_candidate_accepted_by_00.`);
  requireField(approval.runtimeConsumptionReady === false, `${candidateApprovalPath} must keep runtimeConsumptionReady=false.`);
  requireField(approval.businessFeatureDevelopmentAllowed === false, `${candidateApprovalPath} must keep businessFeatureDevelopmentAllowed=false.`);
  requireField(approval.productionConfirmAllowed === false, `${candidateApprovalPath} must keep productionConfirmAllowed=false.`);
  requireField(approval.releaseAuthority === false, `${candidateApprovalPath} must keep releaseAuthority=false.`);
  requireField(approval.finalGoNoGo === "NO_GO", `${candidateApprovalPath} must keep finalGoNoGo=NO_GO.`);
  requireField(Array.isArray(approval.allowedActions) && arraysEqualAsSets(approval.allowedActions, candidateAllowedActions), `${candidateApprovalPath} allowedActions must contain only the candidate compile actions.`);
  requireField(Array.isArray(approval.forbiddenActions), `${candidateApprovalPath} forbiddenActions must be an array.`);
  for (const action of forbiddenCandidateActions) {
    requireField(approval.forbiddenActions?.includes(action), `${candidateApprovalPath} forbiddenActions missing ${action}.`);
  }
  requireField(approval.executionHeadDiffPolicy?.range === `${state.candidateSourceRef}..${state.authorizedCandidateExecutionHead}`, `${candidateApprovalPath} executionHeadDiffPolicy.range must bind authorizedSourceRef..authorizedCandidateExecutionHead.`);
  requireField(approval.executionHeadDiffPolicy?.noSourceBusinessFactChanges === true, `${candidateApprovalPath} must prove no Source business fact changes in executionHead diff.`);
  requireField(approval.executionHeadDiffPolicy?.descendantHeadPolicy === "stale_but_no_go_until_00_updates_authorizedCandidateExecutionHead", `${candidateApprovalPath} must state descendant HEADs are stale-but-no-go until 00 updates authorizedCandidateExecutionHead.`);
  if (state.candidateSourceRef && !isCommit(state.candidateSourceRef)) {
    items.push(`candidateSourceRef does not resolve to a commit: ${state.candidateSourceRef}.`);
  }
  if (state.authorizedCandidateExecutionHead && !isCommit(state.authorizedCandidateExecutionHead)) {
    items.push(`authorizedCandidateExecutionHead does not resolve to a commit: ${state.authorizedCandidateExecutionHead}.`);
  }
  if (isCommit(state.candidateSourceRef) && isCommit(state.authorizedCandidateExecutionHead) &&
    !isAncestor(state.candidateSourceRef, state.authorizedCandidateExecutionHead)) {
    items.push(`candidateSourceRef ${state.candidateSourceRef} must be an ancestor of authorizedCandidateExecutionHead ${state.authorizedCandidateExecutionHead}.`);
  }
  return items;
}

function checkExecutionFrame(candidateApprovalOk) {
  const { candidateSourceRef, authorizedCandidateExecutionHead, executionBranch } = authorization;
  if (!candidateSourceRef || !authorizedCandidateExecutionHead) return;
  if (allowGeneratedCompile) {
    if (!candidateApprovalOk) failures.push("ALLOW_GENERATED_COMPILE_CANDIDATE=true requires valid candidate-only approval.");
    if (currentBranch !== executionBranch) {
      failures.push(`Candidate compile env may only run on ${executionBranch}; current branch is ${currentBranch}.`);
    }
  }
  if (currentHead !== authorizedCandidateExecutionHead && !isAncestor(authorizedCandidateExecutionHead, currentHead)) {
    failures.push(`Current HEAD must equal or descend from authorizedCandidateExecutionHead ${authorizedCandidateExecutionHead}; actual ${currentHead}.`);
  }
}

function checkCandidateSourceRange() {
  const { candidateSourceRef, authorizedCandidateExecutionHead } = authorization;
  if (!candidateSourceRef || !authorizedCandidateExecutionHead || !isCommit(candidateSourceRef) || !isCommit(authorizedCandidateExecutionHead)) return;
  const range = `${candidateSourceRef}..${authorizedCandidateExecutionHead}`;
  const changed = runGit(["diff", "--name-only", range]).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const allowed = new Set([
    "docs/oam/current-engineering-ledger.json",
    "scripts/oam/generate-current-evidence-root.mjs"
  ]);
  for (const file of changed) {
    if (!allowed.has(file)) {
      failures.push(`authorizedSourceRef..authorizedCandidateExecutionHead may only change evidence/compile/proof files; unexpected ${file}.`);
    }
  }
}

function checkNoForbiddenStateEscapes() {
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
    if (finalReport.generatedCompileAuthorized !== false) failures.push("Final Report formal generatedCompileAuthorized must remain false.");
    if (finalReport.generatedCompileCompleted !== false) failures.push("Final Report generatedCompileCompleted must remain false.");
    if (finalReport.runtimeConsumptionReady !== false) failures.push("Final Report runtimeConsumptionReady must remain false.");
    if (finalReport.businessProductionGoNoGo !== "NO_GO" || finalReport.dormitoryL2GoNoGo !== "NO_GO") {
      failures.push("Final Report businessProductionGoNoGo and dormitoryL2GoNoGo must remain NO_GO.");
    }
    if (finalReport.productionConfirmAllowed !== false) failures.push("Final Report productionConfirmAllowed must remain false.");
  }
}

function checkFinalReportEvidenceBinding() {
  if (!finalReport || !authorization.authorizedCandidateExecutionHead) return;
  const expectedStatus = expectedCandidateCompileEvidenceStatus(finalReport);
  if (finalReport.candidateCompileEvidenceStatus !== expectedStatus) {
    failures.push(`Final Report candidateCompileEvidenceStatus must be ${expectedStatus}, actual ${finalReport.candidateCompileEvidenceStatus ?? "missing"}.`);
  }
  const expectedClosure = expectedStatus === "CURRENT";
  if (finalReport.candidateCompileClosureForCurrentHead !== expectedClosure) {
    failures.push(`Final Report candidateCompileClosureForCurrentHead must be ${expectedClosure}.`);
  }
  if (expectedStatus !== "CURRENT") {
    if (!staleEvidenceStatuses.has(finalReport.candidateCompileEvidenceStatus)) {
      failures.push("Descendant or stale evidence must be marked STALE_BUT_NO_GO or STALE_REFERENCE.");
    }
    if (finalReport.finalGoNoGo !== "NO_GO" || finalReport.releaseAuthority !== false) {
      failures.push("Stale candidate evidence must force finalGoNoGo=NO_GO and releaseAuthority=false.");
    }
  }
}

function expectedCandidateCompileEvidenceStatus(report) {
  const reportCurrentHead = report.currentRepositoryHead ?? report.binding?.currentRepositoryHead ?? currentHead;
  const evidenceGeneratedAtHead = report.evidenceGeneratedAtHead ?? report.evidenceRunSha ?? report.binding?.evidenceRunSha ?? "";
  const cp = report.controlPlaneGateResult ?? controlPlaneResult;
  const controlPlaneCurrent = cp?.commitSha === reportCurrentHead &&
    cp?.status === "passed" &&
    cp?.runStatus === "completed" &&
    cp?.finalizable === true;
  if (evidenceGeneratedAtHead !== reportCurrentHead || !controlPlaneCurrent) return "STALE_REFERENCE";
  if (reportCurrentHead !== authorization.authorizedCandidateExecutionHead) return "STALE_BUT_NO_GO";
  return "CURRENT";
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

function runNegativeFixtures() {
  if (!candidateApproval || !authorization.candidateSourceRef || !authorization.authorizedCandidateExecutionHead) return;
  const fixtures = [
    ["generatedCompileAuthorized=true", { generatedCompileAuthorized: true }],
    ["runtimeConsumptionReady=true", { runtimeConsumptionReady: true }],
    ["finalGoNoGo=GO", { finalGoNoGo: "GO" }]
  ];
  for (const [name, patch] of fixtures) {
    const mutated = { ...candidateApproval, ...patch };
    if (collectCandidateApprovalFailures(mutated).length === 0) {
      failures.push(`negative fixture did not fail: ${name}.`);
    }
  }
  const nonAncestor = {
    ...candidateApproval,
    authorizedSourceRef: currentHead,
    candidateSourceRef: currentHead,
    candidateSourceHash: digestText(gitShow(`${currentHead}:${sourcePath}`)),
    authorizedCandidateExecutionHead: authorization.candidateSourceRef,
    executionHead: authorization.candidateSourceRef,
    executionHeadDiffPolicy: {
      ...candidateApproval.executionHeadDiffPolicy,
      range: `${currentHead}..${authorization.candidateSourceRef}`
    }
  };
  if (collectCandidateApprovalFailures(nonAncestor).length === 0) {
    failures.push("negative fixture did not fail: candidateSourceRef is not ancestor of authorizedCandidateExecutionHead.");
  }
  const staleCurrentReport = {
    ...finalReport,
    finalGoNoGo: "NO_GO",
    releaseAuthority: false,
    evidenceGeneratedAtHead: authorization.authorizedCandidateExecutionHead,
    currentRepositoryHead: currentHead,
    candidateCompileEvidenceStatus: "CURRENT",
    candidateCompileClosureForCurrentHead: true,
    controlPlaneGateResult: {
      commitSha: authorization.authorizedCandidateExecutionHead,
      status: "passed",
      runStatus: "completed",
      finalizable: true
    }
  };
  const expectedStatus = expectedCandidateCompileEvidenceStatus(staleCurrentReport);
  if (expectedStatus === "CURRENT") {
    failures.push("negative fixture did not fail: stale executionHead report was accepted as current.");
  }
  if (allowGeneratedCompile === false && candidateApprovalOkForNegativeFixture() === false) {
    failures.push("negative fixture setup invalid: current candidate approval must authorize generated semantic diffs.");
  }
}

function candidateApprovalOkForNegativeFixture() {
  return collectCandidateApprovalFailures(candidateApproval).length === 0;
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
  if (isCommit(authorization.candidateSourceRef)) {
    const candidateRange = `${authorization.candidateSourceRef}..HEAD`;
    scopes.push({
      id: `authorizedSourceRef..HEAD:${authorization.candidateSourceRef}`,
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
  if (!ref) return false;
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
  return `sha256:${crypto.createHash("sha256").update(normalizeTextForDigest(text)).digest("hex")}`;
}

function normalizeTextForDigest(text) {
  return String(text).replace(/\r\n/g, "\n");
}
