import { execFileSync } from "node:child_process";
import {
  GENERATED_CANDIDATE_ACCEPTANCE_PATH,
  GENERATED_CANDIDATE_ACCEPTANCE_RESULT_PATH,
  readJsonIfExists,
  validateGeneratedCandidateAcceptanceAuthority,
  writeJson
} from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
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
