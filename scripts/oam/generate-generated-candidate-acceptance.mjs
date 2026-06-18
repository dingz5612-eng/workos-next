import { execFileSync } from "node:child_process";
import {
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  buildGeneratedCandidateSubject,
  buildInitialGeneratedCandidateAcceptance,
  readJsonIfExists,
  validateGeneratedCandidateAcceptanceAuthority,
  writeJson
} from "./lib/generated-candidate-subject.mjs";
import {
  buildGeneratedContractBundle,
  validateGeneratedContractBundle
} from "./lib/generated-contract-bundle.mjs";

const root = process.cwd();
const currentHead = gitHead();
const existingAcceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
const acceptCurrentBy00 = process.argv.includes("--accept-current-by-00") ||
  process.env.OAM_ACCEPT_CURRENT_GENERATED_CANDIDATE_BY_00 === "1";

if (existingAcceptance?.decisionStatus === "ACCEPTED_BY_00" && !acceptCurrentBy00) {
  const refreshedAcceptance = refreshAcceptedDecisionDivergence(existingAcceptance);
  const validation = validateGeneratedCandidateAcceptanceAuthority({
    acceptance: refreshedAcceptance,
    root,
    currentHead
  });
  if (validation.status !== "PASS") {
    console.error("Existing ACCEPTED_BY_00 generated candidate acceptance authority is stale or invalid; refusing to overwrite.");
    for (const failure of validation.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  if (stableStringify(refreshedAcceptance) !== stableStringify(existingAcceptance)) {
    writeJson(GENERATED_CANDIDATE_ACCEPTANCE_PATH, refreshedAcceptance, root);
  }
  console.log(
    `Generated candidate acceptance authority preserved: ${GENERATED_CANDIDATE_ACCEPTANCE_PATH} (${refreshedAcceptance.decisionStatus}, generatedCandidateAcceptedBy00=${refreshedAcceptance.generatedCandidateAcceptedBy00}, subjectStatus=${validation.subjectStatus})`
  );
  process.exit(0);
}

const authority = buildInitialGeneratedCandidateAcceptance({ root, currentHead });
const preservedAuthority = acceptCurrentBy00
  ? buildAcceptedCurrentDecision(authority, existingAcceptance)
  : preserveExistingDecision(existingAcceptance, authority);
writeJson(GENERATED_CANDIDATE_ACCEPTANCE_PATH, preservedAuthority, root);

const validation = validateGeneratedCandidateAcceptanceAuthority({
  acceptance: preservedAuthority,
  root,
  currentHead
});
if (validation.status !== "PASS") {
  console.error("Generated candidate acceptance authority write produced invalid authority.");
  for (const failure of validation.failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Generated candidate acceptance authority written: ${GENERATED_CANDIDATE_ACCEPTANCE_PATH} (${preservedAuthority.decisionStatus}, generatedCandidateAcceptedBy00=${preservedAuthority.generatedCandidateAcceptedBy00}, subjectStatus=${preservedAuthority.subjectStatusAtWrite})`
);

function preserveExistingDecision(existing, fresh) {
  if (existing?.decisionStatus !== "NOT_ACCEPTED_BY_00") return fresh;
  return {
    ...fresh,
    decisionStatus: "NOT_ACCEPTED_BY_00",
    generatedCandidateAcceptedBy00: false,
    subjectStatusAtWrite: existing.subjectStatusAtWrite ?? "NOT_READY_FOR_00_ACCEPTANCE_REVIEW",
    blockingReasons: Array.isArray(existing.blockingReasons) && existing.blockingReasons.length > 0
      ? existing.blockingReasons
      : [
          "generated_candidate_not_accepted_by_00",
          "explicit_future_00_acceptance_required_before_generatedCandidateAcceptedBy00_true"
        ],
    acceptanceRecord: null,
    explicitNegativeAuthorities: {
      runtimeConsumptionReady: false,
      businessFeatureDevelopmentAllowed: false,
      businessProductionGoNoGo: "NO_GO",
      dormitoryL2GoNoGo: "NO_GO",
      productionConfirmAllowed: false,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO"
    },
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    businessProductionGoNoGo: "NO_GO",
    dormitoryL2GoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    nextDecisionRequired: existing.nextDecisionRequired ?? fresh.nextDecisionRequired,
    forbiddenInterpretations: Array.from(new Set([
      ...(fresh.forbiddenInterpretations ?? []),
      ...(existing.forbiddenInterpretations ?? [])
    ])),
    historicalAppendix: existing.historicalAppendix ?? fresh.historicalAppendix
  };
}

function buildAcceptedCurrentDecision(fresh, existing) {
  if (fresh.subjectStatusAtWrite !== "READY_FOR_00_ACCEPTANCE_REVIEW") {
    console.error(`Current generated candidate subject is not ready for 00 acceptance: ${fresh.subjectStatusAtWrite}`);
    for (const reason of fresh.blockingReasons ?? []) console.error(`- ${reason}`);
    process.exit(1);
  }

  const subject = fresh.generatedCandidateSubject;
  const acceptedBundle = buildGeneratedContractBundle({
    root,
    subject,
    bundleRole: "accepted_generated_contract_bundle"
  });
  const currentBundle = buildGeneratedContractBundle({
    root,
    subject,
    bundleRole: "current_generated_contract_bundle"
  });
  const bundleValidation = validateGeneratedContractBundle({
    bundle: acceptedBundle,
    subject,
    root
  });
  if (bundleValidation.status !== "PASS") {
    console.error("Current generated candidate bundle is not valid for 00 acceptance.");
    for (const failure of bundleValidation.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  const acceptedGeneratedFiles = acceptedBundle.generatedFileDigests;
  const acceptedRuntimeConsumableDigests = acceptedBundle.runtimeConsumableDigests;
  const sameAcceptedSubject = existing?.decisionStatus === "ACCEPTED_BY_00" &&
    existing.generatedCandidateSubject?.subjectDigest === subject.subjectDigest &&
    existing.acceptedGeneratedBundleDigest === acceptedBundle.generatedBundleDigest;
  const acceptedAtUtc = sameAcceptedSubject && existing.acceptanceRecord?.acceptedAtUtc
    ? existing.acceptanceRecord.acceptedAtUtc
    : new Date().toISOString();
  const requiredForbiddenInterpretations = [
    "runtime ready is not implied",
    "business landing is not implied",
    "production confirm is not implied",
    "release authority is not implied",
    "final GO is not implied"
  ];
  const forbiddenInterpretations = Array.from(new Set([
    ...(fresh.forbiddenInterpretations ?? []),
    ...requiredForbiddenInterpretations
  ]));
  const historicalAppendix = sameAcceptedSubject
    ? existing.historicalAppendix ?? fresh.historicalAppendix
    : {
        ...(fresh.historicalAppendix ?? {}),
        previousAcceptedSubjectDigest: existing?.decisionStatus === "ACCEPTED_BY_00"
          ? existing.generatedCandidateSubject?.subjectDigest ?? null
          : null,
        replacementDecision: existing?.decisionStatus === "ACCEPTED_BY_00"
          ? "current_generated_candidate_subject_replaces_previous_accepted_subject"
          : "current_generated_candidate_subject_initial_acceptance"
      };

  return {
    ...fresh,
    decisionStatus: "ACCEPTED_BY_00",
    generatedCandidateAcceptedBy00: true,
    blockingReasons: [],
    historicalAppendix,
    acceptanceRecord: {
      decision: "ACCEPTED_BY_00",
      acceptedBy: "00_OAM_CONTROL",
      acceptedAtUtc,
      acceptedSubjectDigest: subject.subjectDigest,
      reviewedExecutionHead: subject.reviewedExecutionHead,
      currentRepositoryHead: fresh.decisionWritebackBaseHead,
      evidenceArtifactDigest: subject.evidenceArtifactDigest,
      generatedFieldBindingClosureDigest: subject.generatedFieldBindingClosureDigest,
      sourceFieldGapsDecisionDigest: subject.sourceFieldGapsDecisionDigest,
      executionProofDigest: subject.executionProofDigest,
      evidenceRootDigest: subject.evidenceRootDigest,
      scope: "generated_candidate_acceptance_only",
      runtimeConsumptionGranted: false,
      businessGoGranted: false,
      releaseGranted: false,
      finalGoNoGoGranted: false,
      explicitExclusions: [
        "runtimeConsumptionReady",
        "businessFeatureDevelopmentAllowed",
        "releaseAuthority",
        "finalGoNoGo",
        "productionConfirmAllowed",
        "Dormitory L2 GO",
        "business production GO"
      ],
      acceptedGeneratedBundleDigest: acceptedBundle.generatedBundleDigest,
      acceptedRuntimeConsumableDigests,
      forbiddenInterpretations: requiredForbiddenInterpretations
    },
    nextDecisionRequired: "runtime_admission_requires_separate_authority",
    forbiddenInterpretations,
    acceptedGeneratedBundleDigest: acceptedBundle.generatedBundleDigest,
    acceptedGeneratedFiles,
    acceptedRuntimeConsumableDigests,
    currentGeneratedCandidateDivergence: {
      acceptedBundleRemainsImmutable: true,
      currentGeneratedOutputIsDifferentCandidate: currentBundle.generatedBundleDigest !== acceptedBundle.generatedBundleDigest,
      runtimeMustNotAutoConsumeCurrentGeneratedFiles: true,
      acceptedSubjectDigest: subject.subjectDigest,
      currentSubjectDigest: subject.subjectDigest,
      acceptedGeneratedBundleDigest: acceptedBundle.generatedBundleDigest,
      currentGeneratedBundleDigest: currentBundle.generatedBundleDigest,
      acceptedGeneratedOutputDigest: subject.generatedOutputDigest,
      currentGeneratedOutputDigest: subject.generatedOutputDigest,
      reason: currentBundle.generatedBundleDigest !== acceptedBundle.generatedBundleDigest
        ? "accepted_generated_contract_bundle_is_immutable_runtime_consumption_identity; current_generated_contract_bundle_requires_explicit_00_acceptance_before_runtime_rebind"
        : "accepted_generated_candidate_subject_is_current_at_write"
    },
    runtimeConsumptionReady: false,
    businessFeatureDevelopmentAllowed: false,
    businessProductionGoNoGo: "NO_GO",
    dormitoryL2GoNoGo: "NO_GO",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function refreshAcceptedDecisionDivergence(existing) {
  const currentSubjectState = buildGeneratedCandidateSubject({ root, currentHead });
  const acceptedSubject = existing.generatedCandidateSubject;
  const acceptedBundle = buildGeneratedContractBundle({
    root,
    subject: acceptedSubject,
    bundleRole: "accepted_generated_contract_bundle"
  });
  const currentBundle = buildGeneratedContractBundle({
    root,
    subject: currentSubjectState.subject,
    bundleRole: "current_generated_contract_bundle"
  });
  const currentIsDifferent =
    currentSubjectState.subject.subjectDigest !== acceptedSubject?.subjectDigest ||
    currentBundle.generatedBundleDigest !== acceptedBundle.generatedBundleDigest;
  const decisionRecordHead = existing.decisionRecordHead ??
    existing.acceptanceRecord?.currentRepositoryHead ??
    existing.decisionWritebackBaseHead ??
    null;
  return {
    ...existing,
    decisionRecordHead,
    currentGeneratedCandidateDivergence: {
      ...(existing.currentGeneratedCandidateDivergence ?? {}),
      acceptedBundleRemainsImmutable: true,
      currentGeneratedOutputIsDifferentCandidate: currentIsDifferent,
      runtimeMustNotAutoConsumeCurrentGeneratedFiles: true,
      acceptedSubjectDigest: acceptedSubject?.subjectDigest ?? null,
      currentSubjectDigest: currentSubjectState.subject.subjectDigest,
      acceptedGeneratedBundleDigest: acceptedBundle.generatedBundleDigest,
      currentGeneratedBundleDigest: currentBundle.generatedBundleDigest,
      acceptedGeneratedOutputDigest: acceptedSubject?.generatedOutputDigest ?? null,
      currentGeneratedOutputDigest: currentSubjectState.subject.generatedOutputDigest,
      reason: currentIsDifferent
        ? "accepted_generated_contract_bundle_is_immutable_runtime_consumption_identity; current_generated_contract_bundle_requires_explicit_00_acceptance_before_runtime_rebind"
        : "accepted_generated_candidate_subject_is_current_at_write"
    }
  };
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
