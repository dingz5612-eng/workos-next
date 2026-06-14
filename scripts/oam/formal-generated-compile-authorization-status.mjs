import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  FORMAL_GENERATED_COMPILE_APPROVAL_PATH,
  GENERATED_COMPILE_CANDIDATE_APPROVAL_PATH,
  validateFormalGeneratedCompileAuthorization
} from "./lib/formal-generated-compile-authorization.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const mode = args.includes("--json")
  ? "json"
  : args.includes("--assert")
    ? "assert"
    : "print-authorized";
const currentHeadArg = valueAfter("--current-head");
const currentHead = currentHeadArg || git(["rev-parse", "HEAD"]);
const approvalPath = valueAfter("--approval") || FORMAL_GENERATED_COMPILE_APPROVAL_PATH;
const candidateApprovalPath = valueAfter("--candidate-approval") || GENERATED_COMPILE_CANDIDATE_APPROVAL_PATH;
const approval = readJsonIfExists(approvalPath);
const candidateApproval = readJsonIfExists(candidateApprovalPath);
const result = validateFormalGeneratedCompileAuthorization({
  approval,
  candidateApproval,
  currentHead,
  approvalPath,
  candidateApprovalPath
});

if (mode === "json") {
  console.log(JSON.stringify(result, null, 2));
} else if (mode === "assert") {
  if (!result.authorized) {
    console.error("Formal generated compile authorization predicate: FAIL");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("Formal generated compile authorization predicate: PASS");
} else {
  process.stdout.write(result.authorized ? "true" : "false");
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : "";
}

function readJsonIfExists(file) {
  const target = path.join(root, file);
  return fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : null;
}

function git(arguments_) {
  return execFileSync("git", arguments_, { cwd: root, encoding: "utf8" }).trim();
}
