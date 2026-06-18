import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runDecisionWritebackPolicySelfTest } from "./lib/decision-writeback-policy.mjs";
import {
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  GENERATED_CANDIDATE_ACCEPTANCE_RESULT_PATH,
  readJsonIfExists,
  validateGeneratedCandidateAcceptanceAuthority,
  writeJson
} from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();

if (process.argv.includes("--self-test")) {
  const result = runSelfTest();
  if (result.status !== "PASS") {
    console.error("Generated candidate acceptance self-test: FAIL");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("Generated candidate acceptance self-test: PASS");
  process.exit(0);
}

const currentHead = gitHead();
const acceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);
const result = {
  ...validateGeneratedCandidateAcceptanceAuthority({
    acceptance,
    root,
    currentHead
  })
};

writeJson(GENERATED_CANDIDATE_ACCEPTANCE_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Generated candidate acceptance check: FAIL");
  for (const failure of result.failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Generated candidate acceptance check: PASS (${result.decisionStatus}, generatedCandidateAcceptedBy00=${result.generatedCandidateAcceptedBy00}, subjectStatus=${result.subjectStatus})`
);

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

function runSelfTest() {
  const failures = [];
  const decisionWritebackPolicy = runDecisionWritebackPolicySelfTest();
  if (decisionWritebackPolicy.status !== "PASS") {
    failures.push(...decisionWritebackPolicy.failures);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workosnext-acceptance-self-test-"));
  try {
    const fakeHead = "1".repeat(40);
    const digest = `sha256:${"a".repeat(64)}`;
    const notReadyAccepted = validateGeneratedCandidateAcceptanceAuthority({
      root: tempRoot,
      currentHead: fakeHead,
      acceptance: {
        version: "oam.generated-candidate-acceptance.v1",
        decisionType: "generated_candidate_acceptance",
        decisionStatus: "ACCEPTED_BY_00",
        generatedCandidateAcceptedBy00: true,
        generatedCandidateSubject: { subjectDigest: digest },
        subjectStatusAtWrite: "INCOMPLETE",
        reviewedExecutionHead: fakeHead,
        decisionRecordHead: null,
        decisionWritebackBaseHead: fakeHead,
        evidenceArtifactDigest: digest,
        generatedFieldBindingClosureDigest: digest,
        sourceFieldGapsDecisionDigest: digest,
        executionProofDigest: digest,
        evidenceRootDigest: digest,
        blockingReasons: [],
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
        acceptanceRecord: {
          decision: "ACCEPTED_BY_00",
          acceptedBy: "00",
          acceptedAtUtc: "2026-06-15T00:00:00.000Z",
          acceptedSubjectDigest: digest,
          scope: "generated_candidate_acceptance_only",
          runtimeConsumptionGranted: false,
          businessGoGranted: false,
          releaseGranted: false,
          finalGoNoGoGranted: false
        }
      }
    });

    if (notReadyAccepted.status !== "NO_GO" ||
      !notReadyAccepted.failures.some((failure) => failure.includes("ACCEPTED_BY_00 requires subject READY_FOR_00_ACCEPTANCE_REVIEW"))) {
      failures.push("ACCEPTED_BY_00 must fail when the generated candidate subject is not READY_FOR_00_ACCEPTANCE_REVIEW.");
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  return {
    version: "oam.generated-candidate-acceptance-self-test.v1",
    status: failures.length === 0 ? "PASS" : "FAIL",
    decisionWritebackPolicy,
    failures
  };
}
