import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const allowGeneratedCompile = process.env.ALLOW_GENERATED_COMPILE_CANDIDATE === "true";
const sourcePath = "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
const sourceResultPath = "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json";
const finalReportPath = "artifacts/oam/final-report.json";
const controlPlanePath = "scripts/oam/run-control-plane-checks.ps1";
const ciWorkflowPath = ".github/workflows/ci.yml";
const generatedPaths = [
  "docs/contracts/generated/dormitory",
  "apps/mobile/src/generated/oam"
];

const failures = [];
const sourceText = readText(sourcePath);
const sourceResult = readJsonIfExists(sourceResultPath);
const finalReport = readJsonIfExists(finalReportPath);
const controlPlaneText = readText(controlPlanePath);
const ciWorkflowText = readText(ciWorkflowPath);

requireText(sourceText, "sourceFinalizationStatus: SOURCE_FINALIZED_BY_00", "Source package must be finalized by 00 before compile decision.");
requireText(sourceText, "compileDecisionStatus: READY_FOR_00_COMPILE_DECISION", "Source package may only be ready for 00 compile decision.");
requireText(sourceText, "generatedCompilationAllowed: false_until_00_explicit_generated_compile_approval", "Generated compilation must remain unauthorized.");
requireText(sourceText, "generatedContractStatus10B: PENDING_GENERATED_CONTRACT", "Generated contract status must remain pending.");
requireText(sourceText, "generatedCompilationCompleted: false", "Generated compilation must remain incomplete.");
requireText(sourceText, "businessFeatureDevelopmentAllowed: false", "Business feature development must remain blocked.");
requireText(controlPlaneText, "scripts/oam/check-generated-compile-authorization.mjs", "Control Plane must include the generated compile authorization gate.");
requireText(ciWorkflowText, "scripts/oam/check-generated-compile-authorization.mjs", "CI must include the generated compile authorization gate.");

for (const [id, text] of [
  ["source", sourceText],
  ["source-result", JSON.stringify(sourceResult ?? {})],
  ["final-report", JSON.stringify(finalReport ?? {})]
]) {
  if (/generatedCompilationCompleted"\s*:\s*true|generatedCompilationCompleted:\s*true/.test(text)) {
    failures.push(`${id} must not set generatedCompilationCompleted=true.`);
  }
  if (/generatedCompilationAllowed"\s*:\s*true|generatedCompilationAllowed:\s*true/.test(text)) {
    failures.push(`${id} must not set generatedCompilationAllowed=true.`);
  }
  if (/generatedContractStatus10B"\s*:\s*"COMPLETED"|generatedContractStatus10B:\s*COMPLETED/.test(text)) {
    failures.push(`${id} must not set generatedContractStatus10B=COMPLETED.`);
  }
  if (/businessFeatureDevelopmentAllowed"\s*:\s*true|businessFeatureDevelopmentAllowed:\s*true/.test(text)) {
    failures.push(`${id} must not set businessFeatureDevelopmentAllowed=true.`);
  }
}

if (!allowGeneratedCompile) {
  if (controlPlaneText.includes("scripts/business/generate-dormitory-derived-contracts.mjs") &&
    !controlPlaneText.includes('$env:ALLOW_GENERATED_COMPILE_CANDIDATE -eq "true"')) {
    failures.push("Control Plane must guard Dormitory generated contract generation behind ALLOW_GENERATED_COMPILE_CANDIDATE=true.");
  }
  if (ciWorkflowText.includes("scripts/business/generate-dormitory-derived-contracts.mjs") &&
    !ciWorkflowText.includes('ALLOW_GENERATED_COMPILE_CANDIDATE:-}" = "true"')) {
    failures.push("CI must guard Dormitory generated contract generation behind ALLOW_GENERATED_COMPILE_CANDIDATE=true.");
  }
  const generatedDiffs = generatedPaths.flatMap((target) => gitDiffNames(target));
  const semanticDiffs = generatedPaths.flatMap((target) => semanticGeneratedDiffLines(target));
  if (semanticDiffs.length) {
    failures.push(`Generated business contract files changed without ALLOW_GENERATED_COMPILE_CANDIDATE=true: ${generatedDiffs.join(", ")}; semantic diff lines: ${semanticDiffs.slice(0, 12).join(" | ")}`);
  }
}

if (failures.length) {
  console.error("Generated compile authorization check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Generated compile authorization check: PASS");

function requireText(text, snippet, message) {
  if (!text.includes(snippet)) failures.push(message);
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8")) : null;
}

function gitDiffNames(target) {
  try {
    return execSync(`git diff --name-only -- ${target}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function semanticGeneratedDiffLines(target) {
  let diff = "";
  try {
    diff = execSync(`git diff --unified=0 -- ${target}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return [`${target}: unable to inspect generated diff`];
  }
  const semanticLines = [];
  for (const rawLine of diff.split(/\r?\n/)) {
    if (!/^[+-]/.test(rawLine) || rawLine.startsWith("+++") || rawLine.startsWith("---")) continue;
    const line = rawLine.slice(1).trim();
    if (!line) continue;
    if (/^"(kernelGraphHash|compilerInputDigest|outputContentDigest)":\s*"sha256:[a-f0-9]+",?$/.test(line)) continue;
    semanticLines.push(`${target}: ${rawLine}`);
  }
  return semanticLines;
}
