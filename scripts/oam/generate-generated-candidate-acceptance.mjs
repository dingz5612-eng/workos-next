import { execFileSync } from "node:child_process";
import {
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  buildInitialGeneratedCandidateAcceptance,
  readJsonIfExists,
  writeJson
} from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const currentHead = gitHead();
const existingAcceptance = readJsonIfExists(GENERATED_CANDIDATE_ACCEPTANCE_PATH, root);

if (existingAcceptance?.decisionStatus === "ACCEPTED_BY_00") {
  console.error("Refused to overwrite existing ACCEPTED_BY_00 generated candidate acceptance authority.");
  process.exit(1);
}

const authority = buildInitialGeneratedCandidateAcceptance({ root, currentHead });
writeJson(GENERATED_CANDIDATE_ACCEPTANCE_PATH, authority, root);

console.log(
  `Generated candidate acceptance authority written: ${GENERATED_CANDIDATE_ACCEPTANCE_PATH} (${authority.decisionStatus}, generatedCandidateAcceptedBy00=${authority.generatedCandidateAcceptedBy00}, subjectStatus=${authority.subjectStatusAtWrite})`
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
