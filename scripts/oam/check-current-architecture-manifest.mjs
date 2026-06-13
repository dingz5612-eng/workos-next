import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = "docs/oam/current-architecture.manifest.json";
const reportPath = "artifacts/oam/checks/current-architecture-manifest-result.json";

const requiredEvidenceFiles = [
  "artifacts/oam/evidence/current-oam-release-evidence-object.json",
  "artifacts/oam/evidence/current-oam-release-attestation.json",
  "artifacts/oam/evidence/evidence-graph.json",
  "artifacts/oam/evidence/current-oam-final-report.json",
  "artifacts/oam/evidence/evidence-lifecycle-proof.json",
  "artifacts/oam/final-report.json",
  "artifacts/oam/evidence/runtime-proof.json",
  "artifacts/oam/evidence/search-readonly-proof.json",
  "artifacts/oam/evidence/surface-language-proof.json",
  "artifacts/oam/evidence/high-risk-trust-proof.json",
  "artifacts/oam/evidence/master-outline-proof.json",
  "artifacts/oam/evidence/master-design-proof.json",
  "artifacts/oam/evidence/truth-ownership-proof.json",
  "artifacts/oam/proofs/search/search-derived-readmodel-only-proof.json",
  "artifacts/oam/proofs/search/search-no-kernel-direct-read-proof.json",
  "artifacts/oam/proofs/search/search-permission-filter-proof.json",
  "artifacts/oam/proofs/search/search-hidden-result-ranking-proof.json",
  "artifacts/oam/proofs/search/search-sensitive-redaction-proof.json",
  "artifacts/oam/proofs/search/search-lineage-freshness-proof.json",
  "artifacts/oam/proofs/read-intelligence/oam-object-envelope-proof.json",
  "artifacts/oam/proofs/bi-kpi/metric-definition-registry-proof.json",
  "artifacts/oam/proofs/dashboard/dashboard-widget-sourcefacts-proof.json",
  "artifacts/oam/proofs/report/report-dataset-permission-lineage-freshness-proof.json",
  "artifacts/oam/proofs/language/language-glossary-generated-proof.json",
  "docs/oam/generated-compile-candidate-approval.current.json"
];

const requiredBindingFields = [
  "githubSha",
  "githubRunId",
  "githubRunAttempt",
  "githubRefName",
  "artifactName",
  "githubArtifactMetadataDigest",
  "githubArtifactDigestStatus",
  "externalArtifactAttestation",
  "evidenceLifecycleType",
  "releaseEvidenceReferenceOnly",
  "workspaceDirtyAtGeneration",
  "zipArtifactDigest",
  "releaseAuthority",
  "evidenceRootDigest",
  "kernelGraphHash",
  "evidenceGraphHash",
  "finalReportDigest",
  "generatedContractsHash",
  "sourceReadyForCompileDecision",
  "generatedCompileAuthorized",
  "generatedCompileCandidateAuthorized",
  "authorizedSourceRef",
  "authorizedCandidateExecutionHead",
  "candidateSourceRef",
  "executionHead",
  "evidenceGeneratedAtHead",
  "currentRepositoryHead",
  "candidateCompileEvidenceStatus",
  "candidateCompileClosureForCurrentHead",
  "candidateCompileNextAction",
  "generatedCompileCandidateStatus",
  "generatedCandidateAcceptedBy00",
  "generatedReleaseAllowed",
  "runtimeConsumptionAllowed",
  "generatedCompileCompleted",
  "runtimeConsumptionReady",
  "finalGoNoGo",
  "nextStageAllowed"
];

const violations = [];
const manifest = readJson(manifestPath);

checkManifest(manifest);
checkNegativeFixtures(manifest);
writeReport();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("Current architecture manifest check: PASS");

function checkManifest(candidate) {
  const currentEvidenceRoot = candidate?.currentEvidenceRoot;
  requireValue(candidate?.version === "oam.current.v1", "manifest.version_invalid", "current-architecture manifest 必须声明 oam.current.v1。");
  requireValue(Boolean(currentEvidenceRoot), "manifest.current_evidence_root_missing", "manifest 必须声明 currentEvidenceRoot。");
  if (!currentEvidenceRoot) return;

  requireValue(currentEvidenceRoot.path === "artifacts/oam/evidence", "manifest.evidence_root_path_invalid", "Evidence Root path 必须是 artifacts/oam/evidence。");
  requireArray(currentEvidenceRoot.requiredFiles, "manifest.required_files_missing", "currentEvidenceRoot.requiredFiles 必须是数组。");
  requireArray(currentEvidenceRoot.binding, "manifest.binding_missing", "currentEvidenceRoot.binding 必须是数组。");
  if (!Array.isArray(currentEvidenceRoot.requiredFiles) || !Array.isArray(currentEvidenceRoot.binding)) return;

  const requiredFiles = new Set(currentEvidenceRoot.requiredFiles);
  const binding = new Set(currentEvidenceRoot.binding);
  for (const file of requiredEvidenceFiles) {
    requireValue(requiredFiles.has(file), "manifest.required_file_missing", `currentEvidenceRoot.requiredFiles 缺少 ${file}。`, { file });
  }
  for (const field of requiredBindingFields) {
    requireValue(binding.has(field), "manifest.binding_field_missing", `currentEvidenceRoot.binding 缺少 ${field}。`, { field });
  }
}

function checkNegativeFixtures(candidate) {
  mutationTest("manifest_missing_release_evidence_object_should_fail", () => {
    const mutated = structuredClone(candidate);
    mutated.currentEvidenceRoot.requiredFiles = mutated.currentEvidenceRoot.requiredFiles
      .filter((item) => item !== "artifacts/oam/evidence/current-oam-release-evidence-object.json");
    return collectViolations(mutated).some((item) => item.id === "manifest.required_file_missing");
  });

  mutationTest("manifest_missing_required_proof_artifact_should_fail", () => {
    const mutated = structuredClone(candidate);
    mutated.currentEvidenceRoot.requiredFiles = mutated.currentEvidenceRoot.requiredFiles
      .filter((item) => item !== "artifacts/oam/proofs/search/search-derived-readmodel-only-proof.json");
    return collectViolations(mutated).some((item) => item.id === "manifest.required_file_missing");
  });

  mutationTest("manifest_missing_evidence_lifecycle_proof_should_fail", () => {
    const mutated = structuredClone(candidate);
    mutated.currentEvidenceRoot.requiredFiles = mutated.currentEvidenceRoot.requiredFiles
      .filter((item) => item !== "artifacts/oam/evidence/evidence-lifecycle-proof.json");
    return collectViolations(mutated).some((item) => item.id === "manifest.required_file_missing");
  });

  mutationTest("manifest_missing_new_binding_field_should_fail", () => {
    const mutated = structuredClone(candidate);
    mutated.currentEvidenceRoot.binding = mutated.currentEvidenceRoot.binding
      .filter((item) => item !== "githubArtifactMetadataDigest");
    return collectViolations(mutated).some((item) => item.id === "manifest.binding_field_missing");
  });
}

function collectViolations(candidate) {
  const before = violations.splice(0, violations.length);
  checkManifest(candidate);
  const found = violations.splice(0, violations.length);
  violations.push(...before);
  return found;
}

function mutationTest(name, fn) {
  let passed = false;
  try {
    passed = fn();
  } catch {
    passed = false;
  }
  requireValue(passed, "manifest.mutation_not_killed", `${name} 未被 manifest checker 捕获。`, { mutation: name });
}

function requireArray(value, id, message) {
  requireValue(Array.isArray(value), id, message);
}

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeReport() {
  const full = path.join(root, reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.current-architecture-manifest-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    requiredEvidenceFileCount: requiredEvidenceFiles.length,
    requiredBindingFieldCount: requiredBindingFields.length,
    violations
  }, null, 2)}\n`, "utf8");
}
