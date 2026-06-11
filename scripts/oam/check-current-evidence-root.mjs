import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const digestPlaceholder = "__CURRENT_OAM_EVIDENCE_DIGEST__";
const ciRunId = env("GITHUB_RUN_ID") || "local";
const ciRunAttempt = env("GITHUB_RUN_ATTEMPT") || "local";
const expectedRepository = env("GITHUB_REPOSITORY") || "";
const expectedWorkflow = env("GITHUB_WORKFLOW") || "CI";
const expectedArtifactName = artifactNameForRun(ciRunId);
const releaseEvidenceObjectPath = "artifacts/oam/evidence/current-oam-release-evidence-object.json";
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
    "githubSha",
    "githubRunId",
    "githubRunAttempt",
    "githubRefName",
    "generatedAtUtc",
    "artifactName",
    "githubArtifactDigest",
    "evidenceRootDigest",
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
  if (releaseObject.githubRefName !== graph?.binding?.branch) {
    failures.push("release evidence object githubRefName must match evidence graph binding branch.");
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

  const expectedEvidenceGraphHash = digestFor(new Map([["artifacts/oam/evidence/evidence-graph.json", graph]]));
  if (releaseObject.evidenceGraphHash !== expectedEvidenceGraphHash) {
    failures.push(`release evidence object evidenceGraphHash mismatch: expected ${expectedEvidenceGraphHash}, actual ${releaseObject.evidenceGraphHash || "missing"}`);
  }

  const expectedFinalReportDigest = digestFor(new Map([["artifacts/oam/final-report.json", finalReport]]));
  if (releaseObject.finalReportDigest !== expectedFinalReportDigest) {
    failures.push(`release evidence object finalReportDigest mismatch: expected ${expectedFinalReportDigest}, actual ${releaseObject.finalReportDigest || "missing"}`);
  }
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
    workflow.includes("node scripts/oam/compile-current-kernel-graph.mjs") &&
    workflow.includes("node scripts/oam/check-generated-contract-consistency.mjs") &&
    workflow.includes("node scripts/oam/check-generated-files-not-manually-edited.mjs") &&
    workflow.includes("node scripts/oam/check-read-intelligence-kernel.mjs") &&
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
    gate.includes("node scripts/oam/compile-current-kernel-graph.mjs") &&
    gate.includes("node scripts/oam/check-generated-contract-consistency.mjs") &&
    gate.includes("node scripts/oam/check-generated-files-not-manually-edited.mjs") &&
    gate.includes("node scripts/oam/check-read-intelligence-kernel.mjs") &&
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
    for (const field of ["workstreamId", "proofType", "source", "hash", "dependsOn", "gateResult", "negativeTestResult", "goNoGo"]) {
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
    for (const field of workstream.finalReportFields ?? []) {
      if (finalReport[field] !== proof.goNoGo) {
        failures.push(`final report field ${field} does not match proof node ${workstream.id}.`);
      }
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
    for (const key of ["commitSha", "branch", "ciRunId", "generatedAt"]) {
      if (!entry[key]) {
        failures.push(`execution log event ${entry.event || "unknown"} missing ${key}.`);
      }
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

function artifactNameForRun(runId) {
  const normalized = String(runId || "").trim();
  if (!normalized || normalized.includes("${{")) {
    failures.push("GITHUB_RUN_ID must resolve before current OAM evidence artifactName is checked.");
    return "workosnext-current-oam-evidence-invalid";
  }
  return `workosnext-current-oam-evidence-${normalized}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
