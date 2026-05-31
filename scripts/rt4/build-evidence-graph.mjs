import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const matrixPath = path.join(root, "docs", "program", "rt4", "six-file-requirement-matrix.yml");
const ledgerPath = path.join(root, "docs", "closure", "problem-ledger.yml");
const branchPath = path.join(root, "docs", "program", "rt4", "stacked-branch-matrix.yml");
const outPath = path.join(root, "artifacts", "rt4", "evidence-graph.json");

function readJsonLike(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const matrix = readJsonLike(matrixPath);
const ledger = readJsonLike(ledgerPath);
const branchMatrix = readJsonLike(branchPath);
const headSha = git(["rev-parse", "HEAD"]);
const branch = git(["branch", "--show-current"]);

const nodes = [
  ...matrix.requirements.map((req) => ({
    id: req.id,
    type: "requirement",
    priority: req.priority,
    status: req.status,
    gate: req.releaseTrainGate,
    refs: [...req.implementationRefs, ...req.testRefs, ...req.evidenceRefs]
  })),
  ...ledger.problems.map((problem) => ({
    id: problem.problemId,
    type: "problem",
    severity: problem.severity,
    status: problem.status,
    gate: problem.affectedGate,
    refs: [problem.evidenceRequired, problem.acceptanceTest]
  })),
  ...branchMatrix.branches.map((item) => ({
    id: item.taskId,
    type: "branch",
    status: item.localCiStatus,
    branch: item.branch,
    headSha: item.headSha,
    refs: item.evidenceRefs
  }))
];

const edges = matrix.requirements.map((req) => ({
  from: req.id,
  to: req.releaseTrainGate,
  relation: "validated_by_gate"
}));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({
  version: "rt4.evidence-graph.v1",
  mode: "STACKED_PRECONSTRUCTION",
  branch,
  headSha,
  generatedAtUtc: new Date().toISOString(),
  nodes,
  edges,
  generatedBy: "scripts/rt4/build-evidence-graph.mjs"
}, null, 2)}\n`);

console.log(`RT4 evidence graph: wrote ${path.relative(root, outPath)} nodes=${nodes.length}`);
