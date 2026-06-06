import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const digestPlaceholder = "__CURRENT_OAM_EVIDENCE_DIGEST__";
const requiredFiles = [
  "artifacts/oam/evidence/evidence-graph.json",
  "artifacts/oam/evidence/current-oam-final-report.json",
  "artifacts/oam/evidence/runtime-proof.json",
  "artifacts/oam/evidence/truth-ownership-proof.json",
  "artifacts/oam/evidence/search-readonly-proof.json",
  "artifacts/oam/evidence/surface-language-proof.json",
  "artifacts/oam/evidence/high-risk-trust-proof.json",
  "artifacts/oam/evidence/master-design-proof.json",
  "artifacts/oam/evidence/master-outline-proof.json",
  "artifacts/oam/final-report.json"
];

const failures = [];
const documents = new Map();

for (const file of requiredFiles) {
  if (!exists(file)) {
    failures.push(`missing evidence file: ${file}`);
    continue;
  }
  documents.set(file, readJson(file));
}

if (documents.size === requiredFiles.length) {
  const graph = documents.get("artifacts/oam/evidence/evidence-graph.json");
  const finalReport = documents.get("artifacts/oam/final-report.json");
  const expectedDigest = graph?.binding?.artifactDigest;
  const actualDigest = digestFor(documents);

  if (!expectedDigest || expectedDigest !== actualDigest) {
    failures.push(`artifact digest mismatch: expected ${expectedDigest || "missing"}, actual ${actualDigest}`);
  }

  for (const [file, document] of documents) {
    checkBinding(file, document, expectedDigest);
    checkSummaries(file, document);
  }

  for (const file of requiredFiles) {
    if (!graph.requiredFiles?.includes(file)) {
      failures.push(`evidence graph missing required file ref: ${file}`);
    }
  }

  if (finalReport.finalGoNoGo !== "GO") {
    failures.push(`final report must be GO after P0 closure, actual: ${finalReport.finalGoNoGo}`);
  }

  if (Array.isArray(finalReport.unresolvedP0) && finalReport.unresolvedP0.length > 0) {
    failures.push(`final report has unresolved P0: ${finalReport.unresolvedP0.map((item) => item.ruleId).join(", ")}`);
  }

  if (finalReport.businessProductionStatus !== "BLOCKED") {
    failures.push("Business Production must remain BLOCKED.");
  }

  if (finalReport.dormitoryL2Status !== "BLOCKED") {
    failures.push("Dormitory L2 must remain BLOCKED.");
  }

  if (finalReport.productionConfirmAllowed !== false) {
    failures.push("production_confirm must remain false.");
  }

  if (!workflowContainsEvidenceUpload()) {
    failures.push("CI workflow must generate, check, and upload current OAM evidence root.");
  }

  if (!controlPlaneContainsEvidenceRoot()) {
    failures.push("Control plane gate must generate and check current OAM evidence root.");
  }
}

if (failures.length > 0) {
  console.error("Current OAM evidence root check: FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Current OAM evidence root check: PASS");

function checkBinding(file, document, expectedDigest) {
  const binding = document.binding;
  if (!binding) {
    failures.push(`${file} missing binding.`);
    return;
  }
  for (const key of ["commitSha", "branch", "ciRunId", "generatedAt", "artifactDigest"]) {
    if (binding[key] === undefined || binding[key] === null || binding[key] === "") {
      failures.push(`${file} binding missing ${key}.`);
    }
  }
  if (binding.artifactDigest !== expectedDigest) {
    failures.push(`${file} binding digest does not match evidence graph.`);
  }
}

function checkSummaries(file, document) {
  if (!document.gateSummary?.commands?.length) {
    failures.push(`${file} missing gate summary.`);
  }
  if (!document.testSummary?.commands?.length) {
    failures.push(`${file} missing test summary.`);
  }
  if (!document.coverageSummary?.targets) {
    failures.push(`${file} missing coverage summary.`);
  }
  if (!document.summary?.goNoGo && !document.finalGoNoGo) {
    failures.push(`${file} missing go/no-go.`);
  }
}

function digestFor(fileMap) {
  const normalized = {};
  for (const [file, document] of [...fileMap.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    normalized[file] = normalizeForDigest(document);
  }
  return `sha256:${sha256(JSON.stringify(normalized))}`;
}

function normalizeForDigest(value) {
  if (Array.isArray(value)) return value.map(normalizeForDigest);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = key === "artifactDigest" ? digestPlaceholder : normalizeForDigest(value[key]);
  }
  return output;
}

function workflowContainsEvidenceUpload() {
  const workflow = readText(".github/workflows/ci.yml");
  return workflow.includes("node scripts/oam/generate-current-evidence-root.mjs") &&
    workflow.includes("node scripts/oam/check-current-evidence-root.mjs") &&
    workflow.includes("actions/upload-artifact") &&
    workflow.includes("artifacts/oam/evidence/**") &&
    workflow.includes("artifacts/oam/checks/**") &&
    workflow.includes("artifacts/oam/test-results/**") &&
    workflow.includes("artifacts/oam/final-report.json");
}

function controlPlaneContainsEvidenceRoot() {
  const gate = readText("scripts/oam/run-control-plane-checks.ps1");
  return gate.includes("node scripts/oam/generate-current-evidence-root.mjs") &&
    gate.includes("node scripts/oam/check-current-evidence-root.mjs");
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    failures.push(`${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
