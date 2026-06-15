import { execFileSync } from "node:child_process";
import {
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  buildInitialGeneratedCandidateAcceptance,
  readJsonIfExists,
  validateGeneratedCandidateAcceptanceAuthority,
  writeJson
} from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const currentHead = gitHead();
const existingAcceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);

if (existingAcceptance?.decisionStatus === "ACCEPTED_BY_00") {
  const validation = validateGeneratedCandidateAcceptanceAuthority({
    acceptance: existingAcceptance,
    root,
    currentHead
  });
  if (validation.status !== "PASS") {
    console.error("Existing ACCEPTED_BY_00 generated candidate acceptance authority is stale or invalid; refusing to overwrite.");
    for (const failure of validation.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(
    `Generated candidate acceptance authority preserved: ${GENERATED_CANDIDATE_ACCEPTANCE_PATH} (${existingAcceptance.decisionStatus}, generatedCandidateAcceptedBy00=${existingAcceptance.generatedCandidateAcceptedBy00}, subjectStatus=${validation.subjectStatus})`
  );
  process.exit(0);
}

const authority = buildInitialGeneratedCandidateAcceptance({ root, currentHead });
const preservedAuthority = preserveExistingDecision(existingAcceptance, authority);
writeJson(GENERATED_CANDIDATE_ACCEPTANCE_PATH, preservedAuthority, root);

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
