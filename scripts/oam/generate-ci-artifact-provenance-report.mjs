import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const reportPath = "artifacts/oam/checks/ci-artifact-provenance-report.json";
const sourcePath = "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
const checkerResultPath = "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json";
const evidenceGraphPath = "artifacts/oam/evidence/evidence-graph.json";
const finalReportPath = "artifacts/oam/final-report.json";
const artifactDir = argValue("--artifact-dir") || process.env.WORKOS_PROVENANCE_ARTIFACT_DIR || "";

git("fetch --all --prune");

const localHead = git("rev-parse HEAD");
const originMainHead = git("rev-parse origin/main");
const currentBranch = git("branch --show-current");
const workingTreeStatus = git("status --short");
const originSource = gitShow(`origin/main:${sourcePath}`);
const evidenceGraph = readJsonIfExists(evidenceGraphPath);
const sourceNode = (evidenceGraph?.nodes ?? []).find((node) => node.id === "OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE");
const runs = ghJson(`run list --branch main --commit ${originMainHead} --json databaseId,headSha,status,conclusion,workflowName,url,createdAt,updatedAt -L 10`);
const selectedRun = Array.isArray(runs)
  ? runs.find((run) => run.headSha === originMainHead && run.status === "completed")
  : null;
const artifactMetadata = selectedRun
  ? ghJson(`api repos/${repositorySlug()}/actions/runs/${selectedRun.databaseId}/artifacts`)
  : null;
const artifact = artifactMetadata?.artifacts?.find((item) => item.name?.startsWith("workosnext-current-oam-evidence-")) ?? null;
const artifactVerification = artifactDir ? verifyDownloadedArtifact(artifactDir, originMainHead, artifact) : {
  status: "not_downloaded",
  reason: "Set --artifact-dir or WORKOS_PROVENANCE_ARTIFACT_DIR to verify unpacked artifact contents."
};

const report = {
  version: "workosnext.ci-artifact-provenance-report.v1",
  generatedAtUtc: new Date().toISOString(),
  evidenceSourcePolicy: {
    webRawAsEvidenceAllowed: false,
    commitSpecificRawAsEvidenceAllowed: false,
    githubArtifactMetadataDigestRequiredForReleaseAuthority: true,
    localCandidateCannotUseMainArtifactAsReleaseAuthority: true
  },
  repository: repositorySlug(),
  currentBranch,
  localHead,
  originMainHead,
  workingTreeDirty: workingTreeStatus.trim().length > 0,
  workingTreeStatus: workingTreeStatus.split(/\r?\n/).filter(Boolean),
  hashes: {
    originMainSourceFileHash: sha256Text(originSource),
    workingTreeSourceFileHash: hashFileIfExists(sourcePath),
    checkerResultHash: hashFileIfExists(checkerResultPath),
    evidenceGraphSourceNodeHash: sourceNode?.hash ?? "missing",
    finalReportDigest: hashFileIfExists(finalReportPath)
  },
  sourceComparison: {
    workingTreeMatchesOriginMainSource: sha256Text(originSource) === hashFileIfExists(sourcePath),
    currentCandidateIsExternallyAttested: false
  },
  githubActions: {
    sameHeadRunFound: Boolean(selectedRun),
    selectedRun: selectedRun ?? null,
    artifactMetadataDigest: artifact?.digest ?? "pending_external_attestation",
    artifactName: artifact?.name ?? "missing",
    artifactExpired: artifact?.expired ?? null,
    artifactContentVerification: artifactVerification
  },
  releaseDecision: {
    externalArtifactAttestation: artifact?.digest ? "CONTENT_VERIFIED_METADATA_SEPARATE" : "PENDING_EXTERNAL_ATTESTATION",
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    reason: "This report verifies provenance evidence only. Dirty/local candidate source changes and/or missing candidate-specific CI artifact metadata keep releaseAuthority=false."
  }
};

fs.mkdirSync(path.dirname(path.join(root, reportPath)), { recursive: true });
fs.writeFileSync(path.join(root, reportPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`CI artifact provenance report generated: ${reportPath}`);
console.log(`releaseAuthority=${report.releaseDecision.releaseAuthority}`);
console.log(`finalGoNoGo=${report.releaseDecision.finalGoNoGo}`);

function verifyDownloadedArtifact(dir, expectedHead, artifact) {
  const checks = [
    ["current-oam-release-evidence-object", "evidence/current-oam-release-evidence-object.json"],
    ["current-oam-release-attestation", "evidence/current-oam-release-attestation.json"],
    ["evidence-graph", "evidence/evidence-graph.json"],
    ["final-report", "final-report.json"],
    ["dormitory-golden-chain-source-package-result", "checks/dormitory-golden-chain-source-package-result.json"],
    ["mutation-tests-result", "authority-cleanup/mutation-tests-result.json"],
    ["no-side-effects-proof", "docs/oam/db-no-side-effects-proof.json"]
  ];
  const results = checks.map(([id, relativePath]) => {
    const full = path.join(dir, relativePath);
    const exists = fs.existsSync(full);
    const document = exists && full.endsWith(".json") ? readJsonIfExists(full, true) : null;
    return {
      id,
      relativePath,
      exists,
      hash: exists ? sha256Buffer(fs.readFileSync(full)) : "missing",
      bindsExpectedHead: document
        ? [
            document.sourceCommitSha,
            document.evidenceRunSha,
            document.currentRepositoryHead,
            document.binding?.sourceCommitSha,
            document.binding?.evidenceRunSha,
            document.binding?.currentRepositoryHead
          ].filter(Boolean).every((value) => value === expectedHead)
        : null
    };
  });
  const missing = results.filter((item) => !item.exists).map((item) => item.relativePath);
  const headMismatches = results.filter((item) => item.bindsExpectedHead === false).map((item) => item.relativePath);
  return {
    status: missing.length === 0 && headMismatches.length === 0 ? "content_verified" : "content_verification_incomplete",
    artifactMetadataDigest: artifact?.digest ?? "pending_external_attestation",
    checkedFiles: results,
    missing,
    headMismatches,
    releaseAuthority: false
  };
}

function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function gitShow(ref) {
  try {
    return execSync(`git show ${ref}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

function ghJson(command) {
  try {
    return JSON.parse(execSync(`gh ${command}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch {
    return null;
  }
}

function repositorySlug() {
  const remote = git("remote get-url origin");
  const match = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote);
  return match?.[1] ?? process.env.GITHUB_REPOSITORY ?? "dingz5612-eng/workos-next";
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function hashFileIfExists(file) {
  const full = path.isAbsolute(file) ? file : path.join(root, file);
  return fs.existsSync(full) ? sha256Buffer(fs.readFileSync(full)) : "missing";
}

function sha256Text(value) {
  return sha256Buffer(Buffer.from(value ?? "", "utf8"));
}

function sha256Buffer(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function readJsonIfExists(file, absolute = false) {
  const full = absolute ? file : path.join(root, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}
