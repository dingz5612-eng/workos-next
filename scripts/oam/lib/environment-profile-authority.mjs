import fs from "node:fs";
import path from "node:path";

export const ENVIRONMENT_PROFILE_PATH =
  "docs/oam/environment-profiles/current-runtime-evidence.environment-profile.json";
export const ENVIRONMENT_PROFILE_RESULT_PATH =
  "artifacts/oam/checks/environment-profile-authority-result.json";
export const ENVIRONMENT_PROFILE_ID = "local.in_memory.browser_evidence";

const allowedRuntimeStorageModes = new Set(["in_memory", "postgres", "production_like"]);
const requiredForbiddenInterpretations = [
  "local in-memory browser PASS is not CI evidence",
  "local in-memory browser PASS is not Postgres evidence",
  "local in-memory browser PASS is not production-like evidence",
  "test-only runtime admission is not business landing",
  "browser evidence is not production confirmation",
  "Environment Profile PASS is not release authority",
  "Environment Profile PASS is not final GO"
];

export function validateEnvironmentProfileAuthority({
  profile,
  runtimeAuthority = null,
  runtimeProof = null
} = {}) {
  const failures = [];
  if (!profile || typeof profile !== "object") {
    return { status: "NO_GO", failures: [`${ENVIRONMENT_PROFILE_PATH} is missing or invalid.`] };
  }
  requireEqual(profile.version, "oam.environment-profile.v1", "version", failures);
  requireEqual(profile.authorityType, "runtime_browser_ci_evidence_environment_profile", "authorityType", failures);
  requireEqual(profile.environmentProfileId, ENVIRONMENT_PROFILE_ID, "environmentProfileId", failures);
  requireEqual(profile.environmentKind, "local", "environmentKind", failures);
  if (!allowedRuntimeStorageModes.has(profile.runtimeStorageMode)) {
    failures.push(`runtimeStorageMode invalid: ${format(profile.runtimeStorageMode)}.`);
  }
  for (const field of [
    "backgroundWorkerMode",
    "browserMode",
    "apiBaseUrl",
    "mobileBaseUrl",
    "artifactDigest",
    "workspaceDirtyStatus"
  ]) {
    if (!profile[field] || typeof profile[field] !== "string") failures.push(`${field} is required.`);
  }
  if (!profile.ciRunId && !profile.localRunId) {
    failures.push("ciRunId or localRunId is required.");
  }
  if (profile.runtimeStorageMode === "in_memory") {
    requireEqual(profile.evidenceSemantics?.localTestOnlyEvidence, true, "evidenceSemantics.localTestOnlyEvidence", failures);
    requireEqual(profile.evidenceSemantics?.ciEvidence, false, "evidenceSemantics.ciEvidence", failures);
    requireEqual(profile.evidenceSemantics?.postgresEvidence, false, "evidenceSemantics.postgresEvidence", failures);
    requireEqual(profile.evidenceSemantics?.productionLikeEvidence, false, "evidenceSemantics.productionLikeEvidence", failures);
  }
  for (const item of requiredForbiddenInterpretations) {
    if (!(profile.forbiddenInterpretations ?? []).includes(item)) {
      failures.push(`forbiddenInterpretations must include ${format(item)}.`);
    }
  }
  if (runtimeAuthority) {
    requireEqual(runtimeAuthority.environmentProfileId, profile.environmentProfileId, "runtimeAuthority.environmentProfileId", failures);
    requireEqual(runtimeAuthority.environmentProfileRef, ENVIRONMENT_PROFILE_PATH, "runtimeAuthority.environmentProfileRef", failures);
    requireEqual(
      runtimeAuthority.environmentProfile?.runtimeStorageMode,
      profile.runtimeStorageMode,
      "runtimeAuthority.environmentProfile.runtimeStorageMode",
      failures
    );
  }
  if (runtimeProof) {
    requireEqual(runtimeProof.environmentProfileId, profile.environmentProfileId, "runtimeProof.environmentProfileId", failures);
    requireEqual(runtimeProof.environmentProfileRef, ENVIRONMENT_PROFILE_PATH, "runtimeProof.environmentProfileRef", failures);
    requireEqual(
      runtimeProof.environmentProfile?.runtimeStorageMode,
      profile.runtimeStorageMode,
      "runtimeProof.environmentProfile.runtimeStorageMode",
      failures
    );
    requireEqual(runtimeProof.environmentProfile?.environmentKind, "local", "runtimeProof.environmentProfile.environmentKind", failures);
  }
  return { status: failures.length === 0 ? "PASS" : "NO_GO", failures };
}

export function readJsonIfExists(file, root = process.cwd()) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
}

export function writeJson(file, data, root = process.cwd()) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (data && typeof data === "object" && data.checkedAtUtc && fs.existsSync(full)) {
    try {
      const previous = JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
      if (previous?.checkedAtUtc &&
        stableStringify(normalizeForStableResultWrite(previous)) ===
          stableStringify(normalizeForStableResultWrite(data))) {
        data = { ...data, checkedAtUtc: previous.checkedAtUtc };
      }
    } catch {
      // Fall through and write the fresh result.
    }
  }
  fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function normalizeForStableResultWrite(value) {
  if (Array.isArray(value)) return value.map(normalizeForStableResultWrite);
  if (value && typeof value === "object") {
    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "checkedAtUtc") continue;
      normalized[key] = normalizeForStableResultWrite(child);
    }
    return normalized;
  }
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function format(value) {
  return JSON.stringify(value);
}
