import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const releaseEvidenceObjectPath = "artifacts/oam/evidence/current-oam-release-evidence-object.json";
const releaseAttestationPath = "artifacts/oam/evidence/current-oam-release-attestation.json";
const evidenceGraphPath = "artifacts/oam/evidence/evidence-graph.json";
const finalReportPath = "artifacts/oam/final-report.json";
const resultPath = "artifacts/oam/checks/current-oam-release-attestation-result.json";
const pendingExternalAttestation = "pending_external_attestation";
const sha256DigestPattern = /^sha256:[a-f0-9]{64}$/;
const ciRunId = env("GITHUB_RUN_ID") || "local";
const expectedArtifactName = artifactNameForRun(ciRunId);

const violations = [];
const releaseObject = readJson(releaseEvidenceObjectPath);
const attestation = readJson(releaseAttestationPath);
const graph = readJson(evidenceGraphPath);
const finalReport = readJson(finalReportPath);

checkRequiredFields(attestation, "release attestation", [
  "schemaVersion",
  "kind",
  "artifactName",
  "artifactDigest",
  "evidenceRootDigest",
  "githubArtifactMetadataDigest",
  "githubArtifactDigestStatus",
  "zipArtifactDigest",
  "releaseAuthority",
  "finalGoNoGo",
  "nextStageAllowed"
]);
checkRequiredFields(releaseObject, "release evidence object", [
  "artifactName",
  "artifactDigest",
  "evidenceRootDigest",
  "githubArtifactMetadataDigest",
  "githubArtifactDigestStatus",
  "zipArtifactDigest",
  "releaseAuthority",
  "finalGoNoGo",
  "nextStageAllowed"
]);

if (attestation?.artifactName !== expectedArtifactName) {
  violations.push(`release attestation artifactName must be ${expectedArtifactName}.`);
}
if (releaseObject?.artifactName !== expectedArtifactName) {
  violations.push(`release evidence object artifactName must be ${expectedArtifactName}.`);
}

const graphArtifactDigest = graph?.binding?.artifactDigest ?? graph?.artifactDigest;
const finalReportArtifactDigest = finalReport?.binding?.artifactDigest ?? finalReport?.artifactDigest;
for (const [label, digest] of [
  ["attestation artifactDigest", attestation?.artifactDigest],
  ["release object artifactDigest", releaseObject?.artifactDigest],
  ["evidence graph artifactDigest", graphArtifactDigest],
  ["final report artifactDigest", finalReportArtifactDigest],
  ["attestation evidenceRootDigest", attestation?.evidenceRootDigest],
  ["release object evidenceRootDigest", releaseObject?.evidenceRootDigest]
]) {
  if (!sha256DigestPattern.test(String(digest ?? ""))) {
    violations.push(`${label} must be a sha256 digest.`);
  }
}

if (attestation?.artifactDigest !== releaseObject?.artifactDigest ||
  attestation?.artifactDigest !== graphArtifactDigest ||
  attestation?.artifactDigest !== finalReportArtifactDigest) {
  violations.push("release attestation, release object, evidence graph, and final report must share the internal artifactDigest.");
}
if (attestation?.evidenceRootDigest !== releaseObject?.evidenceRootDigest) {
  violations.push("release attestation evidenceRootDigest must match release evidence object.");
}
if (attestation?.githubArtifactMetadataDigest !== releaseObject?.githubArtifactMetadataDigest) {
  violations.push("release attestation githubArtifactMetadataDigest must match release evidence object.");
}
if (attestation?.githubArtifactDigestStatus !== releaseObject?.githubArtifactDigestStatus) {
  violations.push("release attestation githubArtifactDigestStatus must match release evidence object.");
}
if (attestation?.zipArtifactDigest !== releaseObject?.zipArtifactDigest) {
  violations.push("release attestation zipArtifactDigest must match release evidence object.");
}

checkExternalDigestSeparation("attestation githubArtifactMetadataDigest", attestation?.githubArtifactMetadataDigest, attestation?.artifactDigest, attestation?.evidenceRootDigest);
checkExternalDigestSeparation("release object githubArtifactMetadataDigest", releaseObject?.githubArtifactMetadataDigest, releaseObject?.artifactDigest, releaseObject?.evidenceRootDigest);
checkExternalDigestSeparation("attestation zipArtifactDigest", attestation?.zipArtifactDigest, attestation?.artifactDigest, attestation?.evidenceRootDigest);
checkExternalDigestSeparation("release object zipArtifactDigest", releaseObject?.zipArtifactDigest, releaseObject?.artifactDigest, releaseObject?.evidenceRootDigest);
if (releaseObject?.githubArtifactDigest && releaseObject.githubArtifactDigest !== pendingExternalAttestation) {
  checkExternalDigestSeparation("release object githubArtifactDigest", releaseObject.githubArtifactDigest, releaseObject?.artifactDigest, releaseObject?.evidenceRootDigest);
}

if (attestation?.githubArtifactDigestStatus === pendingExternalAttestation) {
  if (attestation.githubArtifactMetadataDigest !== pendingExternalAttestation) {
    violations.push("pending external attestation must keep githubArtifactMetadataDigest=pending_external_attestation.");
  }
  if (releaseObject?.githubArtifactMetadataDigest !== pendingExternalAttestation) {
    violations.push("pending release object must keep githubArtifactMetadataDigest=pending_external_attestation.");
  }
} else if (attestation?.githubArtifactDigestStatus === "attested") {
  if (!sha256DigestPattern.test(String(attestation.githubArtifactMetadataDigest ?? ""))) {
    violations.push("attested release attestation must carry sha256 githubArtifactMetadataDigest.");
  }
} else {
  violations.push(`release attestation githubArtifactDigestStatus invalid: ${attestation?.githubArtifactDigestStatus ?? "missing"}.`);
}

if (attestation?.releaseAuthority !== false || releaseObject?.releaseAuthority !== false) {
  violations.push("current OAM release attestation must keep releaseAuthority=false.");
}
if (attestation?.finalGoNoGo !== "NO_GO" || releaseObject?.finalGoNoGo !== "NO_GO" || finalReport?.finalGoNoGo !== "NO_GO") {
  violations.push("release attestation must not convert CI/artifact/final report evidence into GO.");
}
if (attestation?.nextStageAllowed !== false || releaseObject?.nextStageAllowed !== false || finalReport?.nextStageAllowed !== false) {
  violations.push("release attestation must keep nextStageAllowed=false.");
}
if (attestation?.details?.ciGreenDoesNotEqualGo !== true ||
  attestation?.details?.finalReportExistsDoesNotEqualGo !== true) {
  violations.push("release attestation must explicitly prove CI green and Final Report exists do not equal GO.");
}

writeResult(violations);
if (violations.length > 0) {
  console.error("Current OAM release attestation check: FAIL");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Current OAM release attestation check: PASS");

function checkRequiredFields(document, label, fields) {
  if (!document || typeof document !== "object") {
    violations.push(`${label} is missing or invalid.`);
    return;
  }
  for (const field of fields) {
    if (document[field] === undefined || document[field] === null || document[field] === "") {
      violations.push(`${label} missing ${field}.`);
    }
  }
}

function checkExternalDigestSeparation(label, digest, artifactDigest, evidenceRootDigest) {
  if (!digest) return;
  if (digest === pendingExternalAttestation) return;
  if (!sha256DigestPattern.test(String(digest))) {
    violations.push(`${label} must be sha256 or pending_external_attestation.`);
    return;
  }
  if (digest === artifactDigest) {
    violations.push(`${label} must not equal internal artifactDigest.`);
  }
  if (digest === evidenceRootDigest) {
    violations.push(`${label} must not equal evidenceRootDigest.`);
  }
}

function writeResult(currentViolations) {
  const result = {
    schemaVersion: "current-oam.release-attestation-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: currentViolations.length === 0 ? "passed" : "failed",
    checkedArtifacts: [
      releaseEvidenceObjectPath,
      releaseAttestationPath,
      evidenceGraphPath,
      finalReportPath
    ],
    proves: [
      "artifactDigest is the internal evidence package digest.",
      "evidenceRootDigest is the evidence root digest.",
      "githubArtifactMetadataDigest is external GitHub artifact metadata evidence and is not reused as internal digest.",
      "zipArtifactDigest is external zip content evidence and is not reused as internal digest.",
      "CI green, artifact exists, browser evidence, and Final Report exists do not equal GO."
    ],
    violations: currentViolations
  };
  fs.mkdirSync(path.dirname(path.join(root, resultPath)), { recursive: true });
  fs.writeFileSync(path.join(root, resultPath), `${JSON.stringify(result, null, 2)}\n`);
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    violations.push(`missing required file: ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    violations.push(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function artifactNameForRun(runId) {
  return runId === "local" ? "workosnext-current-oam-evidence-local" : `workosnext-current-oam-evidence-${runId}`;
}

function env(name) {
  return process.env[name] || "";
}
