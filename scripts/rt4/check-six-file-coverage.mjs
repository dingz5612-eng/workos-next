import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matrixPath = path.join(root, "docs", "program", "rt4", "six-file-requirement-matrix.yml");
const problemLedgerPath = path.join(root, "docs", "closure", "problem-ledger.yml");

function fail(message, details = []) {
  for (const detail of details) console.error(`- ${detail}`);
  throw new Error(message);
}

function readJsonLike(file) {
  if (!fs.existsSync(file)) fail("RT4 six-file coverage check failed.", [`Missing file: ${path.relative(root, file)}`]);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const matrix = readJsonLike(matrixPath);
const ledger = readJsonLike(problemLedgerPath);
const requirements = matrix.requirements ?? [];
const problems = ledger.problems ?? [];
const violations = [];

if (requirements.length === 0) violations.push("Requirement matrix is empty.");
if (problems.length === 0) violations.push("Problem ledger is empty.");

const allowedProblemStatuses = new Set(["not_started", "in_progress", "local_passed", "remote_validated", "merged_green", "accepted", "blocked"]);
for (const problem of problems) {
  if (!allowedProblemStatuses.has(problem.status)) {
    violations.push(`Problem ${problem.problemId} has invalid status ${problem.status}.`);
  }
}

const p0 = requirements.filter((req) => req.priority === "P0");
const p1 = requirements.filter((req) => req.priority === "P1");
const p2 = requirements.filter((req) => req.priority === "P2");

for (const req of p0) {
  for (const field of ["owner", "releaseTrainGate", "implementationRefs", "testRefs", "evidenceRefs"]) {
    const value = req[field];
    if (Array.isArray(value) ? value.length === 0 : !value) {
      violations.push(`${req.id} missing ${field}.`);
    }
  }
}

const coveredP0 = p0.filter((req) => req.implementationRefs?.length > 0 && req.testRefs?.length > 0 && req.evidenceRefs?.length > 0).length;
const p0Coverage = p0.length === 0 ? 0 : Math.round((coveredP0 / p0.length) * 100);
if (p0Coverage !== 100) violations.push(`P0 coverage must be 100%, got ${p0Coverage}%.`);

const coveredP1 = p1.filter((req) => req.status !== "not_started" || req.blockers?.length > 0).length;
const p1Coverage = p1.length === 0 ? 100 : Math.round((coveredP1 / p1.length) * 100);
if (p1Coverage < 90) violations.push(`P1 coverage must be >= 90%, got ${p1Coverage}%.`);

if (p2.length === 0) violations.push("P2 backlog requirements must be tracked.");

if (violations.length > 0) fail("RT4 six-file coverage check failed.", violations);

console.log(`RT4 six-file coverage: PASS (P0=${p0Coverage}%, P1=${p1Coverage}%, P2=${p2.length})`);
