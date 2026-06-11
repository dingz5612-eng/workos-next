import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const digestPlaceholder = "__CURRENT_OAM_EVIDENCE_DIGEST__";
const ciRunId = env("GITHUB_RUN_ID") || "local";
const ciRunAttempt = env("GITHUB_RUN_ATTEMPT") || "local";
const expectedRepository = env("GITHUB_REPOSITORY") || "";
const expectedWorkflow = env("GITHUB_WORKFLOW") || "CI";
const expectedArtifactName = artifactNameForRun(ciRunId);
const currentRepositoryHead = env("GITHUB_SHA") || git("rev-parse HEAD") || "local";
const releaseEvidenceObjectPath = "artifacts/oam/evidence/current-oam-release-evidence-object.json";
const sha256DigestPattern = /^sha256:[a-f0-9]{64}$/;
const bareSha256Pattern = /^[a-f0-9]{64}$/;
const allowedNodeStatuses = new Set(["passed", "blocked", "failed", "missing_or_failed", "bound", "required", "missing"]);
const requiredFiles = [
  "artifacts/oam/evidence/evidence-graph.json",
  releaseEvidenceObjectPath,
  "artifacts/oam/evidence/execution-log.jsonl",
  "artifacts/oam/evidence/current-oam-final-report.json",
  "artifacts/oam/evidence/runtime-proof.json",
  "artifacts/oam/evidence/truth-ownership-proof.json",
  "artifacts/oam/evidence/search-readonly-proof.json",
  "artifacts/oam/evidence/surface-language-proof.json",
  "artifacts/oam/evidence/high-risk-trust-proof.json",
  "artifacts/oam/evidence/master-design-proof.json",
  "artifacts/oam/evidence/master-outline-proof.json",
  "docs/oam/current-oam-kernel-responsibility-map.json",
  "docs/oam/current-oam-cross-domain-conflict-rules.json",
  "docs/oam/professional-ai-review-seats.json",
  "docs/oam/codex-execution-channel-policy.json",
  "docs/finance/finance-ledger-kernel.json",
  "docs/oam/compiler-generated-contract-kernel.json",
  "docs/identity/identity-permission-kernel.json",
  "docs/oam/kernel/oam-kernel-source.schema.json",
  "docs/oam/kernel/oam-kernel-generated.schema.json",
  "docs/oam/system-derived-contracts.json",
  "docs/oam/domain-derived-contracts.json",
  "docs/oam/generated-contracts-manifest.json",
  "artifacts/oam/authority-cleanup/source-layer-audit.json",
  "artifacts/oam/authority-cleanup/mutation-tests-result.json",
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
  "docs/read-intelligence/read-intelligence-kernel.json",
  "docs/read-intelligence/read-intelligence-kernel.schema.json",
  "docs/oam/db-no-side-effects-proof.json",
  "artifacts/oam/checks/kernel-responsibility-map-result.json",
  "artifacts/oam/checks/professional-ai-review-seats-result.json",
  "artifacts/oam/checks/codex-execution-channel-policy-result.json",
  "artifacts/oam/checks/cross-domain-conflict-rules-result.json",
  "artifacts/oam/checks/dashboard-readonly-report.json",
  "docs/oam/mobile-branch-risk-policy.json",
  "docs/oam/mobile-branch-risk-ledger.json",
  "docs/oam/mobile-critical-branch-scenarios.json",
  "artifacts/oam/test-results/mobile/coverage/coverage-summary.json",
  "artifacts/oam/checks/mobile-coverage-policy-result.json",
  "artifacts/oam/checks/mobile-critical-branch-scenarios-result.json",
  "artifacts/oam/checks/control-plane-gate-results.json",
  "artifacts/oam/final-report.json"
];

const failures = [];
const documents = new Map();

for (const file of requiredFiles) {
  if (!exists(file)) {
    failures.push(`missing evidence file: ${file}`);
    continue;
  }
  documents.set(file, file.endsWith(".jsonl") ? readJsonl(file) : readJson(file));
}

if (documents.size === requiredFiles.length) {
  const graph = documents.get("artifacts/oam/evidence/evidence-graph.json");
  const finalReport = documents.get("artifacts/oam/final-report.json");
  const releaseObject = documents.get(releaseEvidenceObjectPath);
  const responsibilityMap = documents.get("docs/oam/current-oam-kernel-responsibility-map.json");
  const expectedDigest = graph?.binding?.artifactDigest;
  const actualDigest = digestFor(documents);

  if (!expectedDigest || expectedDigest !== actualDigest) {
    failures.push(`artifact digest mismatch: expected ${expectedDigest || "missing"}, actual ${actualDigest}`);
  }

  for (const [file, document] of documents) {
    if (!requiresEvidenceBinding(file)) continue;
    checkBinding(file, document, expectedDigest);
    checkSummaries(file, document);
  }
  checkExecutionLog(readJsonl("artifacts/oam/evidence/execution-log.jsonl"), expectedDigest);

  for (const file of requiredFiles) {
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing required file ref: ${file}`);
    }
  }

  if (!["GO", "NO_GO"].includes(finalReport.finalGoNoGo)) {
    failures.push(`final report must be GO or NO_GO, actual: ${finalReport.finalGoNoGo}`);
  }

  checkArtifactName("final report", finalReport.artifactName);
  checkReleaseEvidenceObject(releaseObject, graph, finalReport, documents);
  checkEvidenceBindingConsistency(graph, releaseObject, finalReport, expectedDigest);
  checkEvidenceGraphNodes(graph, finalReport);

  if (Array.isArray(finalReport.unresolvedP0) && finalReport.unresolvedP0.length > 0) {
    failures.push(`final report has unresolved P0: ${finalReport.unresolvedP0.map((item) => item.ruleId).join(", ")}`);
  }

  checkFinalDecision(finalReport);
  checkFinalReportGoNoGoFields(finalReport, responsibilityMap);
  checkWorkstreamProofNodes(graph, responsibilityMap, finalReport);
  checkRealBrowserEvidence(graph, finalReport);

  if (finalReport.businessProductionStatus !== "BLOCKED") {
    failures.push("Business Production must remain BLOCKED.");
  }

  if (finalReport.dormitoryL2Status !== "BLOCKED") {
    failures.push("Dormitory L2 must remain BLOCKED.");
  }

  if (finalReport.productionConfirmAllowed !== false) {
    failures.push("production_confirm must remain false.");
  }

  if (finalReport.businessProductionGoNoGo !== "NO_GO") {
    failures.push("businessProductionGoNoGo must remain NO_GO.");
  }

  if (finalReport.dormitoryL2GoNoGo !== "NO_GO") {
    failures.push("dormitoryL2GoNoGo must remain NO_GO.");
  }

  if (finalReport.productionConfirmGoNoGo !== "NO_GO") {
    failures.push("productionConfirmGoNoGo must remain NO_GO.");
  }

  if (finalReport.finalGoNoGo !== "NO_GO") {
    failures.push("finalGoNoGo must remain NO_GO for the current stage.");
  }

  if (finalReport.nextStageAllowed !== false) {
    failures.push("final report nextStageAllowed must be boolean false.");
  }

  if (graph.nextStageAllowed !== false) {
    failures.push("evidence graph nextStageAllowed must be boolean false.");
  }

  if (!workflowContainsEvidenceUpload()) {
    failures.push("CI workflow must generate, check, and upload current OAM evidence root.");
  }

  if (!controlPlaneContainsEvidenceRoot()) {
    failures.push("Control plane gate must generate and check current OAM evidence root.");
  }

  checkMobileBranchRiskKernel(graph, finalReport);
}

if (failures.length > 0) {
  console.error("Current OAM evidence root check: FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Current OAM evidence root check: PASS");

function checkArtifactName(label, artifactName) {
  if (artifactName !== expectedArtifactName) {
    failures.push(`${label} artifactName must be ${expectedArtifactName}, actual: ${artifactName || "missing"}`);
  }
  if (artifactName === "current-oam-evidence") {
    failures.push(`${label} artifactName must not be current-oam-evidence.`);
  }
  if (String(artifactName ?? "").includes("${{")) {
    failures.push(`${label} artifactName must be concrete and must not contain a GitHub expression literal.`);
  }
}

function checkReleaseEvidenceObject(releaseObject, graph, finalReport, allDocuments) {
  if (!releaseObject || typeof releaseObject !== "object") {
    failures.push("release evidence object is missing or invalid.");
    return;
  }

  checkArtifactName("release evidence object", releaseObject.artifactName);
  for (const field of [
    "repository",
    "workflow",
    "sourceCommitSha",
    "evidenceRunSha",
    "currentRepositoryHead",
    "stale",
    "referenceOnly",
    "bindingStatus",
    "githubSha",
    "githubRunId",
    "githubRunAttempt",
    "githubRefName",
    "generatedAtUtc",
    "artifactName",
    "artifactDigest",
    "githubArtifactDigest",
    "evidenceRootDigest",
    "generatedContractsHash",
    "kernelGraphHash",
    "evidenceGraphHash",
    "finalReportDigest",
    "businessProduction",
    "dormitoryL2",
    "productionConfirmAllowed",
    "finalGoNoGo",
    "nextStageAllowed"
  ]) {
    if (releaseObject[field] === undefined || releaseObject[field] === null || releaseObject[field] === "") {
      failures.push(`release evidence object missing ${field}.`);
    }
  }

  if (releaseObject.githubRunId !== ciRunId) {
    failures.push(`release evidence object githubRunId must be ${ciRunId}, actual: ${releaseObject.githubRunId || "missing"}`);
  }
  if (releaseObject.githubRunAttempt !== ciRunAttempt) {
    failures.push(`release evidence object githubRunAttempt must be ${ciRunAttempt}, actual: ${releaseObject.githubRunAttempt || "missing"}`);
  }
  if (expectedRepository && releaseObject.repository !== expectedRepository) {
    failures.push(`release evidence object repository must be ${expectedRepository}, actual: ${releaseObject.repository || "missing"}`);
  }
  if (releaseObject.workflow !== expectedWorkflow) {
    failures.push(`release evidence object workflow must be ${expectedWorkflow}, actual: ${releaseObject.workflow || "missing"}`);
  }
  if (releaseObject.githubSha !== graph?.binding?.commitSha) {
    failures.push("release evidence object githubSha must match evidence graph binding commitSha.");
  }
  if (releaseObject.sourceCommitSha !== graph?.binding?.sourceCommitSha || releaseObject.sourceCommitSha !== finalReport?.binding?.sourceCommitSha) {
    failures.push("release evidence object sourceCommitSha must match evidence graph and final report.");
  }
  if (releaseObject.evidenceRunSha !== graph?.binding?.evidenceRunSha || releaseObject.evidenceRunSha !== finalReport?.binding?.evidenceRunSha) {
    failures.push("release evidence object evidenceRunSha must match evidence graph and final report.");
  }
  if (releaseObject.githubRefName !== graph?.binding?.branch) {
    failures.push("release evidence object githubRefName must match evidence graph binding branch.");
  }
  if (releaseObject.artifactDigest !== graph?.binding?.artifactDigest) {
    failures.push("release evidence object artifactDigest must match evidence graph artifactDigest.");
  }
  if (releaseObject.githubArtifactDigest !== graph?.binding?.artifactDigest) {
    failures.push("release evidence object githubArtifactDigest must match evidence graph artifactDigest.");
  }
  if (releaseObject.githubArtifactDigest === releaseObject.evidenceRootDigest) {
    failures.push("release evidence object must distinguish githubArtifactDigest from evidenceRootDigest.");
  }
  if (releaseObject.finalGoNoGo !== "NO_GO") {
    failures.push("release evidence object finalGoNoGo must remain NO_GO.");
  }
  if (releaseObject.nextStageAllowed !== false) {
    failures.push("release evidence object nextStageAllowed must remain false.");
  }
  if (releaseObject.businessProduction !== "BLOCKED") {
    failures.push("release evidence object businessProduction must remain BLOCKED.");
  }
  if (releaseObject.dormitoryL2 !== "BLOCKED") {
    failures.push("release evidence object dormitoryL2 must remain BLOCKED.");
  }
  if (releaseObject.productionConfirmAllowed !== false) {
    failures.push("release evidence object productionConfirmAllowed must remain false.");
  }

  const expectedEvidenceRootDigest = digestFor(new Map([...allDocuments.entries()].filter(([file]) => file !== releaseEvidenceObjectPath)));
  if (releaseObject.evidenceRootDigest !== expectedEvidenceRootDigest) {
    failures.push(`release evidence object evidenceRootDigest mismatch: expected ${expectedEvidenceRootDigest}, actual ${releaseObject.evidenceRootDigest || "missing"}`);
  }

  const expectedKernelGraphHash = `sha256:${sha256(readText("docs/oam/oam-kernel-graph.json"))}`;
  if (releaseObject.kernelGraphHash !== expectedKernelGraphHash) {
    failures.push(`release evidence object kernelGraphHash mismatch: expected ${expectedKernelGraphHash}, actual ${releaseObject.kernelGraphHash || "missing"}`);
  }

  const expectedGeneratedContractsHash = digestFor(new Map(generatedContractFiles().map((file) => [file, readJson(file)])));
  if (releaseObject.generatedContractsHash !== expectedGeneratedContractsHash) {
    failures.push(`release evidence object generatedContractsHash mismatch: expected ${expectedGeneratedContractsHash}, actual ${releaseObject.generatedContractsHash || "missing"}`);
  }

  const expectedEvidenceGraphHash = digestFor(new Map([["artifacts/oam/evidence/evidence-graph.json", graph]]));
  if (releaseObject.evidenceGraphHash !== expectedEvidenceGraphHash) {
    failures.push(`release evidence object evidenceGraphHash mismatch: expected ${expectedEvidenceGraphHash}, actual ${releaseObject.evidenceGraphHash || "missing"}`);
  }

  const expectedFinalReportDigest = digestFor(new Map([["artifacts/oam/final-report.json", finalReport]]));
  if (releaseObject.finalReportDigest !== expectedFinalReportDigest) {
    failures.push(`release evidence object finalReportDigest mismatch: expected ${expectedFinalReportDigest}, actual ${releaseObject.finalReportDigest || "missing"}`);
  }
}

function checkEvidenceBindingConsistency(graph, releaseObject, finalReport, expectedDigest) {
  const graphBinding = graph?.binding ?? {};
  const finalBinding = finalReport?.binding ?? {};
  const releaseBinding = releaseObject?.binding ?? {};
  const graphSourceSha = graphBinding.sourceCommitSha ?? graph.sourceCommitSha ?? graphBinding.commitSha;
  const finalSourceSha = finalBinding.sourceCommitSha ?? finalReport.sourceCommitSha ?? finalReport.latestCommit;
  const releaseSourceSha = releaseObject?.sourceCommitSha ?? releaseBinding.sourceCommitSha ?? releaseObject?.githubSha;
  const graphRunSha = graphBinding.evidenceRunSha ?? graph.evidenceRunSha ?? graphBinding.githubSha;
  const finalRunSha = finalBinding.evidenceRunSha ?? finalReport.evidenceRunSha ?? finalBinding.githubSha;
  const releaseRunSha = releaseObject?.evidenceRunSha ?? releaseBinding.evidenceRunSha ?? releaseObject?.githubSha;

  for (const [label, value] of [
    ["evidence graph sourceCommitSha", graphSourceSha],
    ["final report sourceCommitSha", finalSourceSha],
    ["release evidence sourceCommitSha", releaseSourceSha],
    ["evidence graph evidenceRunSha", graphRunSha],
    ["final report evidenceRunSha", finalRunSha],
    ["release evidence evidenceRunSha", releaseRunSha]
  ]) {
    if (!isGitSha(value)) failures.push(`${label} must be a concrete git SHA, actual: ${value || "missing"}`);
  }

  if (graphSourceSha !== finalSourceSha || graphSourceSha !== releaseSourceSha) {
    failures.push("Release Evidence Object, Evidence Graph, and Final Report sourceCommitSha must match.");
  }
  if (graphRunSha !== finalRunSha || graphRunSha !== releaseRunSha) {
    failures.push("Release Evidence Object, Evidence Graph, and Final Report evidenceRunSha must match.");
  }
  if (finalReport.latestCommit !== graphSourceSha) {
    failures.push("Final Report latestCommit must match sourceCommitSha.");
  }

  for (const [label, digest] of [
    ["evidence graph artifactDigest", graphBinding.artifactDigest ?? graph.artifactDigest],
    ["final report artifactDigest", finalBinding.artifactDigest ?? finalReport.artifactDigest],
    ["release evidence artifactDigest", releaseObject?.artifactDigest ?? releaseBinding.artifactDigest],
    ["release evidence githubArtifactDigest", releaseObject?.githubArtifactDigest]
  ]) {
    if (digest !== expectedDigest) {
      failures.push(`${label} must match current artifact digest ${expectedDigest}, actual: ${digest || "missing"}`);
    }
  }

  const graphGeneratedHash = graphBinding.generatedContractsHash ?? graph.generatedContractsHash;
  const finalGeneratedHash = finalBinding.generatedContractsHash ?? finalReport.generatedContractsHash;
  const releaseGeneratedHash = releaseObject?.generatedContractsHash ?? releaseBinding.generatedContractsHash;
  if (graphGeneratedHash !== finalGeneratedHash || graphGeneratedHash !== releaseGeneratedHash) {
    failures.push("Release Evidence Object, Evidence Graph, and Final Report generatedContractsHash must match.");
  }
  if (!sha256DigestPattern.test(String(graphGeneratedHash ?? ""))) {
    failures.push("generatedContractsHash must be sha256.");
  }

  const graphHash = graphBinding.evidenceGraphHash ?? graph.evidenceGraphHash;
  const finalGraphHash = finalBinding.evidenceGraphHash ?? finalReport.evidenceGraphHash;
  const releaseGraphHash = releaseObject?.evidenceGraphHash ?? releaseBinding.evidenceGraphHash;
  if (graphHash !== finalGraphHash || graphHash !== releaseGraphHash) {
    failures.push("Release Evidence Object, Evidence Graph, and Final Report evidenceGraphHash must match.");
  }
  if (!sha256DigestPattern.test(String(graphHash ?? ""))) {
    failures.push("evidenceGraphHash must be sha256.");
  }

  const graphFinalDigest = graphBinding.finalReportDigest ?? graph.finalReportDigest;
  const finalDigest = finalBinding.finalReportDigest ?? finalReport.finalReportDigest;
  const releaseFinalDigest = releaseObject?.finalReportDigest ?? releaseBinding.finalReportDigest;
  if (graphFinalDigest !== finalDigest || graphFinalDigest !== releaseFinalDigest) {
    failures.push("Release Evidence Object, Evidence Graph, and Final Report finalReportDigest must match.");
  }
  if (!sha256DigestPattern.test(String(finalDigest ?? ""))) {
    failures.push("finalReportDigest must be sha256.");
  }

  const stale = graphSourceSha !== currentRepositoryHead || graphRunSha !== currentRepositoryHead;
  for (const [label, state] of [
    ["evidence graph binding", graphBinding],
    ["final report binding", finalBinding],
    ["release evidence object", releaseObject],
    ["release evidence binding", releaseBinding],
    ["evidence graph evidenceBinding", graph.evidenceBinding],
    ["final report evidenceBinding", finalReport.evidenceBinding]
  ]) {
    if (!state || typeof state !== "object") {
      failures.push(`${label} missing stale/referenceOnly binding state.`);
      continue;
    }
    if (state.stale !== stale) failures.push(`${label} stale must be ${stale}.`);
    if (state.referenceOnly !== stale) failures.push(`${label} referenceOnly must be ${stale}.`);
    if (state.bindingStatus !== (stale ? "stale" : "current")) {
      failures.push(`${label} bindingStatus must be ${stale ? "stale" : "current"}.`);
    }
  }
  if (stale && finalReport.finalGoNoGo === "GO") {
    failures.push("stale/referenceOnly evidence must never support Final Report GO.");
  }
}

function checkEvidenceGraphNodes(graph, finalReport) {
  const nodes = graph?.nodes ?? [];
  if (!Array.isArray(nodes) || nodes.length === 0) {
    failures.push("Evidence Graph must contain proof DAG nodes.");
    return;
  }
  for (const node of nodes) {
    const id = node.id ?? "<missing>";
    for (const field of ["proofType", "source", "hash", "dependsOn", "status", "goNoGo"]) {
      const value = node[field];
      if (isEmptyProofField(value)) {
        failures.push(`evidence graph node ${id} missing ${field}.`);
      }
    }
    if (!sha256DigestPattern.test(String(node.hash ?? ""))) {
      failures.push(`evidence graph node ${id} hash must be sha256.`);
    }
    if (!Array.isArray(node.dependsOn) || node.dependsOn.length === 0) {
      failures.push(`evidence graph node ${id} dependsOn must be a non-empty array.`);
    }
    if (!isNonEmptySource(node.source)) {
      failures.push(`evidence graph node ${id} source must be non-empty.`);
    }
    if (!allowedNodeStatuses.has(node.status)) {
      failures.push(`evidence graph node ${id} status is not controlled: ${node.status || "missing"}`);
    }
    if (!["GO", "NO_GO"].includes(node.goNoGo)) {
      failures.push(`evidence graph node ${id} goNoGo must be GO or NO_GO.`);
    }
    if (node.type === "browser_e2e_evidence") {
      checkBrowserEvidenceNode(node, finalReport);
    }
  }
}

function checkBrowserEvidenceNode(node, finalReport) {
  const id = node.id ?? "<missing>";
  const sourceCommitSha = finalReport.binding?.sourceCommitSha ?? finalReport.sourceCommitSha ?? finalReport.latestCommit;
  if (node.proofType !== "current-oam-browser-e2e-proof") {
    failures.push(`browser evidence node ${id} proofType must distinguish browser E2E proof.`);
  }
  if (!node.reportRef || !exists(node.reportRef)) {
    failures.push(`browser evidence node ${id} must bind an existing report ref.`);
  }
  if (!Array.isArray(node.refs) || !node.refs.includes(node.reportRef)) {
    failures.push(`browser evidence node ${id} refs must include reportRef.`);
  }
  if (!Array.isArray(node.screenshotHashes) || node.screenshotHashes.length === 0) {
    failures.push(`browser evidence node ${id} must bind screenshot hashes.`);
  }
  for (const hash of node.screenshotHashes ?? []) {
    const normalized = String(hash).replace(/^sha256:/, "");
    if (!bareSha256Pattern.test(normalized)) {
      failures.push(`browser evidence node ${id} screenshot hash must be sha256: ${hash}`);
    }
  }
  if (node.headSha !== sourceCommitSha) {
    failures.push(`browser evidence node ${id} headSha must match current verified sourceCommitSha.`);
  }
  if (node.sourceCommitSha !== sourceCommitSha) {
    failures.push(`browser evidence node ${id} sourceCommitSha must match Final Report.`);
  }
  if (!node.refs?.some((ref) => String(ref).includes("screenshot-index"))) {
    failures.push(`browser evidence node ${id} must bind screenshot index ref.`);
  }
  if (!node.checker || !String(node.checker).includes("check-")) {
    failures.push(`browser evidence node ${id} must bind checker ref.`);
  }
}

function generatedContractFiles() {
  return [
    "docs/oam/system-derived-contracts.json",
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
}

function checkBinding(file, document, expectedDigest) {
  if (typeof document === "string") return;
  if (Array.isArray(document)) {
    if (document.length === 0) {
      failures.push(`${file} must contain at least one execution event.`);
    }
    for (const [index, item] of document.entries()) {
      checkBinding(`${file}#${index + 1}`, item, expectedDigest);
    }
    return;
  }
  if (document.artifactDigest && document.commitSha) {
    for (const key of ["commitSha", "branch", "ciRunId", "generatedAt", "artifactDigest"]) {
      if (document[key] === undefined || document[key] === null || document[key] === "") {
        failures.push(`${file} missing ${key}.`);
      }
    }
    if (document.artifactDigest !== expectedDigest) {
      failures.push(`${file} digest does not match evidence graph.`);
    }
    return;
  }
  const binding = document.binding;
  if (!binding) {
    failures.push(`${file} missing binding.`);
    return;
  }
  for (const key of [
    "repository",
    "workflow",
    "sourceCommitSha",
    "evidenceRunSha",
    "currentRepositoryHead",
    "stale",
    "referenceOnly",
    "bindingStatus",
    "commitSha",
    "githubSha",
    "branch",
    "githubRefName",
    "ciRunId",
    "githubRunId",
    "githubRunAttempt",
    "artifactName",
    "generatedAt",
    "generatedAtUtc",
    "artifactDigest",
    "githubArtifactDigest",
    "evidenceRootDigest",
    "generatedContractsHash",
    "kernelGraphHash",
    "evidenceGraphHash",
    "finalReportDigest"
  ]) {
    if (binding[key] === undefined || binding[key] === null || binding[key] === "") {
      failures.push(`${file} binding missing ${key}.`);
    }
  }
  if (binding.githubSha !== binding.commitSha) {
    failures.push(`${file} binding githubSha must match commitSha.`);
  }
  if (binding.commitSha !== binding.sourceCommitSha) {
    failures.push(`${file} binding commitSha must match sourceCommitSha.`);
  }
  if (binding.evidenceRunSha !== binding.sourceCommitSha) {
    failures.push(`${file} binding evidenceRunSha must match sourceCommitSha for current single-commit evidence runs.`);
  }
  if (!isGitSha(binding.sourceCommitSha)) {
    failures.push(`${file} binding sourceCommitSha must be a concrete git SHA.`);
  }
  const stale = binding.sourceCommitSha !== currentRepositoryHead || binding.evidenceRunSha !== currentRepositoryHead;
  if (binding.stale !== stale) {
    failures.push(`${file} binding stale must be ${stale}.`);
  }
  if (binding.referenceOnly !== stale) {
    failures.push(`${file} binding referenceOnly must be ${stale}.`);
  }
  if (binding.bindingStatus !== (stale ? "stale" : "current")) {
    failures.push(`${file} bindingStatus must be ${stale ? "stale" : "current"}.`);
  }
  if (binding.githubRefName !== binding.branch) {
    failures.push(`${file} binding githubRefName must match branch.`);
  }
  if (binding.githubRunId !== binding.ciRunId) {
    failures.push(`${file} binding githubRunId must match ciRunId.`);
  }
  if (binding.githubRunAttempt !== ciRunAttempt) {
    failures.push(`${file} binding githubRunAttempt must be ${ciRunAttempt}.`);
  }
  if (binding.artifactName !== expectedArtifactName) {
    failures.push(`${file} binding artifactName must be ${expectedArtifactName}.`);
  }
  if (binding.githubArtifactDigest !== binding.artifactDigest) {
    failures.push(`${file} binding githubArtifactDigest must match artifactDigest.`);
  }
  if (binding.artifactDigest !== expectedDigest) {
    failures.push(`${file} binding digest does not match evidence graph.`);
  }
}

function requiresEvidenceBinding(file) {
  return file.startsWith("artifacts/oam/evidence/") || file === "artifacts/oam/final-report.json";
}

function checkSummaries(file, document) {
  if (typeof document === "string") return;
  if (Array.isArray(document)) return;
  if (!document.gateSummary?.commands?.length) {
    failures.push(`${file} missing gate summary.`);
  }
  if (!document.testSummary?.commands?.length) {
    failures.push(`${file} missing test summary.`);
  }
  if (!document.coverageSummary?.targets) {
    failures.push(`${file} missing coverage summary.`);
  }
  if (!document.summary?.goNoGo && !document.finalGoNoGo) {
    failures.push(`${file} missing go/no-go.`);
  }
}

function digestFor(fileMap) {
  const normalized = {};
  for (const [file, document] of [...fileMap.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    normalized[file] = normalizeForDigest(document);
  }
  return `sha256:${sha256(JSON.stringify(normalized))}`;
}

function normalizeForDigest(value) {
  if (typeof value === "string") return value.replaceAll(/sha256:[a-f0-9]{64}|__CURRENT_OAM_EVIDENCE_DIGEST__|__CURRENT_OAM_EVIDENCE_ROOT_DIGEST__/g, digestPlaceholder);
  if (Array.isArray(value)) return value.map(normalizeForDigest);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = isDigestOrHashKey(key) ? digestPlaceholder : normalizeForDigest(value[key]);
  }
  return output;
}

function isDigestOrHashKey(key) {
  return [
    "artifactDigest",
    "githubArtifactDigest",
    "evidenceRootDigest",
    "generatedContractsHash",
    "kernelGraphHash",
    "evidenceGraphHash",
    "finalReportDigest"
  ].includes(key);
}

function workflowContainsEvidenceUpload() {
  const workflow = readText(".github/workflows/ci.yml");
  return workflow.includes("node scripts/oam/generate-current-evidence-root.mjs") &&
    workflow.includes("node scripts/oam/check-current-evidence-root.mjs") &&
    workflow.includes("node scripts/oam/generate-mobile-branch-risk-ledger.mjs") &&
    workflow.includes("node scripts/oam/check-mobile-coverage-policy.mjs") &&
    workflow.includes("node scripts/oam/check-mobile-critical-branch-scenarios.mjs") &&
    workflow.includes("node scripts/oam/check-kernel-responsibility-map.mjs") &&
    workflow.includes("node scripts/oam/check-professional-ai-review-seats.mjs") &&
    workflow.includes("node scripts/oam/check-codex-execution-channel-policy.mjs") &&
    workflow.includes("node scripts/oam/check-cross-domain-conflict-rules.mjs") &&
    workflow.includes("node scripts/oam/check-system-operating-kernel.mjs") &&
    workflow.includes("node scripts/oam/generate-authority-source-layer-audit.mjs") &&
    workflow.includes("node scripts/oam/check-authority-source-layer-audit.mjs") &&
    workflow.includes("node scripts/oam/check-authority-cleanup-mutation-tests.mjs") &&
    workflow.includes("node scripts/oam/compile-current-kernel-graph.mjs") &&
    workflow.includes("node scripts/oam/check-generated-contract-consistency.mjs") &&
    workflow.includes("node scripts/oam/check-generated-files-not-manually-edited.mjs") &&
    workflow.includes("node scripts/oam/check-read-intelligence-kernel.mjs") &&
    workflow.includes("node scripts/oam/check-dashboard-readonly.mjs") &&
    workflow.includes("node scripts/oam/check-db-no-side-effects-proof.mjs") &&
    workflow.includes("node scripts/oam/check-oam-kernel-graph.mjs") &&
    workflow.includes("node scripts/oam/check-file-lifecycle-policy.mjs") &&
    workflow.includes("node scripts/oam/check-retired-reference-blocker.mjs") &&
    workflow.includes("node scripts/oam/generate-system-derived-contracts.mjs") &&
    workflow.includes("node scripts/oam/check-derived-contract-consistency.mjs") &&
    workflow.includes("node scripts/oam/check-system-handoff-contract.mjs") &&
    workflow.includes("node scripts/oam/check-system-failure-routing-contract.mjs") &&
    workflow.includes("pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1") &&
    workflow.includes("node scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs") &&
    workflow.includes("node scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs") &&
    workflow.includes("actions/upload-artifact") &&
    workflow.includes("artifacts/oam/evidence/**") &&
    workflow.includes("artifacts/oam/checks/**") &&
    workflow.includes("artifacts/oam/test-results/**") &&
    workflow.includes("artifacts/oam/final-report.json");
}

function controlPlaneContainsEvidenceRoot() {
  const gate = readText("scripts/oam/run-control-plane-checks.ps1");
  return gate.includes("node scripts/oam/generate-current-evidence-root.mjs") &&
    gate.includes("node scripts/oam/check-current-evidence-root.mjs") &&
    gate.includes("node scripts/oam/generate-mobile-branch-risk-ledger.mjs") &&
    gate.includes("node scripts/oam/check-mobile-coverage-policy.mjs") &&
    gate.includes("node scripts/oam/check-mobile-critical-branch-scenarios.mjs") &&
    gate.includes("node scripts/oam/check-kernel-responsibility-map.mjs") &&
    gate.includes("node scripts/oam/check-professional-ai-review-seats.mjs") &&
    gate.includes("node scripts/oam/check-codex-execution-channel-policy.mjs") &&
    gate.includes("node scripts/oam/check-cross-domain-conflict-rules.mjs") &&
    gate.includes("node scripts/oam/check-system-operating-kernel.mjs") &&
    gate.includes("node scripts/oam/generate-authority-source-layer-audit.mjs") &&
    gate.includes("node scripts/oam/check-authority-source-layer-audit.mjs") &&
    gate.includes("node scripts/oam/check-authority-cleanup-mutation-tests.mjs") &&
    gate.includes("node scripts/oam/compile-current-kernel-graph.mjs") &&
    gate.includes("node scripts/oam/check-generated-contract-consistency.mjs") &&
    gate.includes("node scripts/oam/check-generated-files-not-manually-edited.mjs") &&
    gate.includes("node scripts/oam/check-read-intelligence-kernel.mjs") &&
    gate.includes("node scripts/oam/check-dashboard-readonly.mjs") &&
    gate.includes("node scripts/oam/check-db-no-side-effects-proof.mjs") &&
    gate.includes("node scripts/oam/check-oam-kernel-graph.mjs") &&
    gate.includes("node scripts/oam/check-file-lifecycle-policy.mjs") &&
    gate.includes("node scripts/oam/check-retired-reference-blocker.mjs") &&
    gate.includes("node scripts/oam/generate-system-derived-contracts.mjs") &&
    gate.includes("node scripts/oam/check-derived-contract-consistency.mjs") &&
    gate.includes("node scripts/oam/check-system-handoff-contract.mjs") &&
    gate.includes("node scripts/oam/check-system-failure-routing-contract.mjs") &&
    gate.includes("pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1") &&
    gate.includes("node scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs") &&
    gate.includes("node scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs");
}

function checkMobileBranchRiskKernel(graph, finalReport) {
  const kernel = finalReport.mobileBranchRiskKernel;
  if (!kernel) {
    failures.push("final report missing mobile branch risk kernel.");
    return;
  }
  if (kernel.status !== "passed") {
    failures.push(`mobile branch risk kernel must be passed, actual: ${kernel.status}`);
  }
  if (kernel.branchRiskLedgerGenerated !== true) {
    failures.push("mobile branch risk ledger must be generated.");
  }
  if (kernel.checks?.coveragePolicy !== "passed") {
    failures.push("mobile coverage policy result must be passed.");
  }
  if (kernel.checks?.criticalScenarios !== "passed") {
    failures.push("mobile critical scenario result must be passed.");
  }
  if (kernel.p0ScenariosCovered !== true) {
    failures.push("mobile P0 critical scenarios must be covered.");
  }
  if (!graph.mobileBranchRiskKernel) {
    failures.push("evidence graph missing mobile branch risk kernel.");
  }
}

function checkRealBrowserEvidence(graph, finalReport) {
  const summary = graph.realBrowserEvidence;
  if (!summary) {
    failures.push("evidence graph missing real browser evidence summary.");
    return;
  }
  const requirePassed = finalReport.finalGoNoGo === "GO";
  const reasons = finalReport.finalDecision?.noGoReasons ?? finalReport.noGoReasons ?? [];
  if (summary.status !== "passed" && requirePassed) {
    failures.push(`real browser evidence summary must be passed, actual: ${summary.status}`);
  }
  if (summary.status !== "passed" && !reasons.some((reason) => /真实浏览器|real browser/i.test(reason))) {
    failures.push("real browser evidence is not passed but Final Report does not record a NO_GO reason.");
  }
  if (summary.singleWriter !== "scripts/oam/generate-current-evidence-root.mjs") {
    failures.push("real browser evidence must be written by the current evidence root generator.");
  }
  for (const [key, gate] of [
    ["l1", "DORM-L1-BROWSER-E2E"],
    ["tenScenario", "DORMITORY-TEN-SCENARIO-REAL-BROWSER"]
  ]) {
    const item = summary[key];
    if (!item) {
      failures.push(`real browser evidence missing ${key}.`);
      continue;
    }
    if (item.status !== "passed" && requirePassed) failures.push(`${key} browser evidence must be passed.`);
    if (!item.report || !exists(item.report)) failures.push(`${key} browser evidence report is missing: ${item.report || "(empty)"}`);
    if ((item.scenarioCount ?? 0) <= 0) failures.push(`${key} browser evidence has no scenarios.`);
    if ((item.screenshotHashCount ?? 0) <= 0) failures.push(`${key} browser evidence has no screenshot hashes.`);
    const node = (graph.nodes || []).find((candidate) => candidate.gate === gate);
    if (!node) {
      failures.push(`evidence graph missing node for ${gate}.`);
      continue;
    }
    if (node.status !== "passed" && requirePassed) failures.push(`${gate} node must be passed.`);
    if (node.headSha !== finalReport.latestCommit && requirePassed) failures.push(`${gate} node commit does not match final report.`);
    if (!node.screenshotHashes?.length) failures.push(`${gate} node missing screenshot hashes.`);
    if (!node.refs?.includes(item.report)) failures.push(`${gate} node missing report ref.`);
  }
}

function checkFinalReportGoNoGoFields(finalReport, responsibilityMap) {
  const requiredFields = responsibilityMap?.finalReportRequiredFields ?? [];
  if (!Array.isArray(requiredFields) || requiredFields.length === 0) {
    failures.push("responsibility map missing finalReportRequiredFields.");
    return;
  }
  for (const field of requiredFields) {
    if (!["GO", "NO_GO"].includes(finalReport[field])) {
      failures.push(`final report missing or invalid Go/No-Go field ${field}: ${finalReport[field] ?? "missing"}`);
    }
  }
  for (const [field, expected] of Object.entries(responsibilityMap?.forcedCurrentStage ?? {})) {
    if (finalReport[field] !== expected) {
      failures.push(`final report ${field} must be ${expected}, actual ${finalReport[field] ?? "missing"}`);
    }
  }
}

function checkWorkstreamProofNodes(graph, responsibilityMap, finalReport) {
  const workstreams = responsibilityMap?.workstreams ?? [];
  const proofNodes = (graph.nodes ?? []).filter((node) => node.type === "workstream_proof");
  const proofByWorkstream = new Map(proofNodes.map((node) => [node.workstreamId, node]));
  if (proofNodes.length !== workstreams.length) {
    failures.push(`evidence graph must contain one proof node per workstream: expected ${workstreams.length}, actual ${proofNodes.length}`);
  }
  for (const workstream of workstreams) {
    const proof = proofByWorkstream.get(workstream.id);
    if (!proof) {
      failures.push(`missing workstream proof node: ${workstream.id}`);
      continue;
    }
    for (const field of ["workstreamId", "proofType", "source", "hash", "dependsOn", "command", "checker", "inputHashes", "outputHashes", "status", "goNoGoImpact", "notesZh", "gateResult", "negativeTestResult", "goNoGo"]) {
      const value = proof[field];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        failures.push(`workstream proof node ${workstream.id} missing ${field}.`);
      }
    }
    if (!String(proof.hash ?? "").startsWith("sha256:")) {
      failures.push(`workstream proof node ${workstream.id} hash must be sha256.`);
    }
    if (proof.goNoGo !== finalReport.finalGoNoGo) {
      failures.push(`workstream proof node ${workstream.id} goNoGo must match final report.`);
    }
    if (!/[\u3400-\u9fff]/.test(String(proof.notesZh ?? ""))) {
      failures.push(`workstream proof node ${workstream.id} must include Chinese notesZh.`);
    }
    if (!Array.isArray(proof.inputHashes) || proof.inputHashes.some((item) => !item.path || !String(item.hash ?? "").startsWith("sha256:"))) {
      failures.push(`workstream proof node ${workstream.id} inputHashes must bind path and sha256 hash.`);
    }
    if (!Array.isArray(proof.outputHashes) || proof.outputHashes.some((item) => !item.path || !String(item.hash ?? "").startsWith("sha256:"))) {
      failures.push(`workstream proof node ${workstream.id} outputHashes must bind path and sha256 hash.`);
    }
    for (const field of workstream.finalReportFields ?? []) {
      if (finalReport[field] !== proof.goNoGo) {
        failures.push(`final report field ${field} does not match proof node ${workstream.id}.`);
      }
    }
  }
  for (const proof of (graph.nodes ?? []).filter((node) => node.type === "p0_closure_proof")) {
    for (const field of ["proofType", "source", "hash", "dependsOn", "command", "checker", "inputHashes", "outputHashes", "status", "goNoGoImpact", "notesZh", "goNoGo"]) {
      const value = proof[field];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        failures.push(`p0 closure proof node ${proof.id ?? "<missing>"} missing ${field}.`);
      }
    }
    if (!/[\u3400-\u9fff]/.test(String(proof.notesZh ?? ""))) {
      failures.push(`p0 closure proof node ${proof.id ?? "<missing>"} must include Chinese notesZh.`);
    }
  }
}

function checkFinalDecision(finalReport) {
  const reasons = finalReport.finalDecision?.noGoReasons ?? finalReport.noGoReasons ?? [];
  const controlPlane = finalReport.controlPlaneGateResult;
  const release = finalReport.releaseReadiness;

  if (!controlPlane) {
    failures.push("final report missing control plane gate result.");
  }
  if (!release) {
    failures.push("final report missing release readiness.");
  }

  if (finalReport.finalGoNoGo === "GO") {
    if (reasons.length > 0) {
      failures.push(`final report is GO but has NO_GO reasons: ${reasons.join("; ")}`);
    }
    if (controlPlane?.status !== "passed" || (controlPlane?.failedGateCount ?? 0) > 0) {
      failures.push("final report is GO but control plane gate did not pass.");
    }
    if ((controlPlane?.missingRequiredGates ?? []).length > 0) {
      failures.push("final report is GO but control plane gate is missing required gates.");
    }
    if (controlPlane?.stale === true) {
      failures.push("final report is GO but control plane gate result is stale.");
    }
    if (release?.releaseEligible !== true) {
      failures.push("final report is GO but workspace is not release eligible.");
    }
    if (finalReport.mobileBranchRiskKernel?.status !== "passed") {
      failures.push("final report is GO but mobile branch risk kernel is not passed.");
    }
  }

  if (finalReport.finalGoNoGo === "NO_GO" && reasons.length === 0) {
    failures.push("final report is NO_GO but has no noGoReasons.");
  }
}

function checkExecutionLog(entries, expectedDigest) {
  if (!Array.isArray(entries) || entries.length === 0) {
    failures.push("execution log must contain JSONL entries.");
    return;
  }
  for (const requiredEvent of ["冻结检查", "P0 账本状态", "本地总门禁绑定", "测试验收绑定", "覆盖率绑定", "移动覆盖率治理", "最终裁决"]) {
    if (!entries.some((entry) => entry.event === requiredEvent)) {
      failures.push(`execution log missing event: ${requiredEvent}`);
    }
  }
  for (const entry of entries) {
    if (entry.artifactDigest !== expectedDigest) {
      failures.push(`execution log event ${entry.event || "unknown"} digest does not match evidence graph.`);
    }
    for (const key of ["commitSha", "sourceCommitSha", "evidenceRunSha", "branch", "ciRunId", "generatedAt"]) {
      if (!entry[key]) {
        failures.push(`execution log event ${entry.event || "unknown"} missing ${key}.`);
      }
    }
    if (entry.sourceCommitSha !== entry.commitSha || entry.evidenceRunSha !== entry.commitSha) {
      failures.push(`execution log event ${entry.event || "unknown"} source/evidence SHA must match commitSha for the current evidence run.`);
    }
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function readJsonl(file) {
  try {
    return readText(file)
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          failures.push(`${file}:${index + 1} is not valid JSONL: ${error.message}`);
          return {};
        }
      });
  } catch (error) {
    failures.push(`${file} cannot be read: ${error.message}`);
    return [];
  }
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function env(name) {
  return process.env[name] || "";
}

function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function artifactNameForRun(runId) {
  const normalized = String(runId || "").trim();
  if (!normalized || normalized.includes("${{")) {
    failures.push("GITHUB_RUN_ID must resolve before current OAM evidence artifactName is checked.");
    return "workosnext-current-oam-evidence-invalid";
  }
  return `workosnext-current-oam-evidence-${normalized}`;
}

function isGitSha(value) {
  return /^[a-f0-9]{40}$/i.test(String(value ?? ""));
}

function isEmptyProofField(value) {
  return value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
}

function isNonEmptySource(value) {
  if (Array.isArray(value)) return value.length > 0 && value.every((item) => String(item ?? "").trim().length > 0);
  return String(value ?? "").trim().length > 0;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
