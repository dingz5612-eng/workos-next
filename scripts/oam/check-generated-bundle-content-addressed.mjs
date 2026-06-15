import { execFileSync } from "node:child_process";
import {
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  buildGeneratedCandidateSubject,
  readJsonIfExists
} from "./lib/generated-candidate-subject.mjs";
import {
  GENERATED_BUNDLE_CONTENT_ADDRESSED_RESULT_PATH,
  buildGeneratedContractBundle,
  validateGeneratedContractBundle,
  writeJson
} from "./lib/generated-contract-bundle.mjs";

const root = process.cwd();
const currentSubjectState = buildGeneratedCandidateSubject({ root, currentHead: gitHead() });
const acceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
const acceptedSubject = acceptance?.generatedCandidateSubject ?? null;
const currentBundle = buildGeneratedContractBundle({
  root,
  subject: currentSubjectState.subject,
  bundleRole: "current_generated_contract_bundle"
});
const acceptedBundle = acceptedSubject
  ? buildGeneratedContractBundle({
      root,
      subject: acceptedSubject,
      bundleRole: "accepted_generated_contract_bundle"
    })
  : null;
const failures = [];
const currentValidation = validateGeneratedContractBundle({
  bundle: currentBundle,
  subject: currentSubjectState.subject,
  root
});
failures.push(...currentValidation.failures.map((failure) => `current bundle: ${failure}`));
let acceptedValidation = null;
if (!acceptedBundle) {
  failures.push("accepted generated candidate subject is required for generated bundle authority.");
} else {
  acceptedValidation = validateGeneratedContractBundle({
    bundle: acceptedBundle,
    subject: acceptedSubject,
    root
  });
  failures.push(...acceptedValidation.failures.map((failure) => `accepted bundle: ${failure}`));
}

if (acceptance?.decisionStatus === "ACCEPTED_BY_00") {
  requireEqual(
    acceptance.acceptedGeneratedBundleDigest,
    acceptedBundle?.generatedBundleDigest,
    "acceptedGeneratedBundleDigest",
    failures
  );
  requireEqual(
    acceptance.acceptanceRecord?.acceptedGeneratedBundleDigest,
    acceptedBundle?.generatedBundleDigest,
    "acceptanceRecord.acceptedGeneratedBundleDigest",
    failures
  );
  requireJsonEqual(
    acceptance.acceptedGeneratedFiles,
    acceptedBundle?.generatedFileDigests,
    "acceptedGeneratedFiles",
    failures
  );
  requireJsonEqual(
    acceptance.acceptedRuntimeConsumableDigests,
    acceptedBundle?.runtimeConsumableDigests,
    "acceptedRuntimeConsumableDigests",
    failures
  );
  requireForbiddenInterpretations(acceptance, failures);
  if (currentSubjectState.subject.subjectDigest !== acceptedSubject?.subjectDigest) {
    requireEqual(
      acceptance.currentGeneratedCandidateDivergence?.acceptedBundleRemainsImmutable,
      true,
      "currentGeneratedCandidateDivergence.acceptedBundleRemainsImmutable",
      failures
    );
    requireEqual(
      acceptance.currentGeneratedCandidateDivergence?.currentGeneratedOutputIsDifferentCandidate,
      true,
      "currentGeneratedCandidateDivergence.currentGeneratedOutputIsDifferentCandidate",
      failures
    );
    requireEqual(
      acceptance.currentGeneratedCandidateDivergence?.runtimeMustNotAutoConsumeCurrentGeneratedFiles,
      true,
      "currentGeneratedCandidateDivergence.runtimeMustNotAutoConsumeCurrentGeneratedFiles",
      failures
    );
  }
}

const result = {
  version: "oam.generated-bundle-content-addressed-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: currentBundle.capabilityId,
  currentSubjectDigest: currentSubjectState.subject.subjectDigest,
  acceptedSubjectDigest: acceptedSubject?.subjectDigest ?? null,
  currentGeneratedBundleDigest: currentBundle.generatedBundleDigest,
  acceptedGeneratedBundleDigest: acceptedBundle?.generatedBundleDigest ?? null,
  currentSubjectDiffersFromAcceptedSubject: currentSubjectState.subject.subjectDigest !== acceptedSubject?.subjectDigest,
  digestSeparation: {
    generatedBundleDigestIsNotGitHubArtifactDigest: acceptedBundle?.generatedBundleDigest !== acceptedSubject?.evidenceArtifactDigest,
    generatedBundleDigestIsNotEvidenceRootDigest: acceptedBundle?.generatedBundleDigest !== acceptedSubject?.evidenceRootDigest,
    generatedBundleDigestIsNotSubjectDigest: acceptedBundle?.generatedBundleDigest !== acceptedSubject?.subjectDigest,
    generatedBundleDigestIsNotControlPlaneResultDigest: true
  },
  currentBundle,
  acceptedBundle,
  failures
};

writeJson(GENERATED_BUNDLE_CONTENT_ADDRESSED_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Generated bundle content-addressed check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Generated bundle content-addressed check: PASS (acceptedGeneratedBundleDigest=${result.acceptedGeneratedBundleDigest})`
);

function requireForbiddenInterpretations(acceptanceAuthority, foundFailures) {
  const required = [
    "runtime ready is not implied",
    "business landing is not implied",
    "production confirm is not implied",
    "release authority is not implied",
    "final GO is not implied"
  ];
  const all = [
    ...(acceptanceAuthority?.forbiddenInterpretations ?? []),
    ...(acceptanceAuthority?.acceptanceRecord?.forbiddenInterpretations ?? [])
  ];
  for (const item of required) {
    if (!all.includes(item)) {
      foundFailures.push(`forbiddenInterpretations must include ${JSON.stringify(item)}.`);
    }
  }
}

function requireEqual(actual, expected, label, foundFailures) {
  if (actual !== expected) foundFailures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}

function requireJsonEqual(actual, expected, label, foundFailures) {
  if (stableStringify(actual) !== stableStringify(expected)) {
    foundFailures.push(`${label} must equal GeneratedContractBundle ${label}.`);
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8"
    }).trim();
  } catch {
    return null;
  }
}
