import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/evidence-writer-boundary-result.json";
const formalEvidenceFiles = [
  "artifacts/oam/evidence/evidence-graph.json",
  "artifacts/oam/evidence/current-oam-final-report.json",
  "artifacts/oam/evidence/current-oam-release-evidence-object.json",
  "artifacts/oam/evidence/current-oam-release-attestation.json",
  "artifacts/oam/final-report.json"
];
const failures = [];

const generatorPath = "scripts/oam/generate-current-evidence-root.mjs";
const generatorText = readText(generatorPath);
for (const file of formalEvidenceFiles) {
  if (!generatorText.includes(file)) failures.push(`formal evidence generator must write/project ${file}.`);
}
if (!generatorText.includes('singleWriter: "scripts/oam/generate-current-evidence-root.mjs"')) {
  failures.push("formal evidence generator must declare itself as singleWriter.");
}

for (const file of listMjs("scripts/oam").filter((item) => path.basename(item).startsWith("check-"))) {
  if (file === "scripts/oam/check-evidence-writer-boundary.mjs") continue;
  const text = readText(file);
  for (const line of text.split(/\r?\n/)) {
    if (!/(writeJson|writeFileSync)\s*\(/.test(line)) continue;
    for (const evidenceFile of formalEvidenceFiles) {
      if (line.includes(evidenceFile)) {
        failures.push(`${file} must not write formal evidence artifact ${evidenceFile}.`);
      }
    }
  }
}

for (const file of [
  "scripts/oam/lib/dormitory-runtime-admission.mjs",
  "scripts/oam/lib/dormitory-first-golden-chain-landing.mjs"
]) {
  const text = readText(file);
  if (!/writeProof\s*=\s*false/.test(text)) {
    failures.push(`${file} must default writeProof=false.`);
  }
}

for (const file of [
  "scripts/oam/check-dormitory-runtime-admission.mjs",
  "scripts/oam/check-dormitory-first-golden-chain-landing.mjs"
]) {
  const text = readText(file);
  if (!/process\.argv\.includes\("--write-proof"\)/.test(text) || !/OAM_WRITE_PROOF/.test(text)) {
    failures.push(`${file} proof writes must require --write-proof or OAM_WRITE_PROOF=1.`);
  }
}

const runtimeConsumesText = readText("scripts/oam/check-runtime-consumes-accepted-bundle.mjs");
if (!/writeProof:\s*false/.test(runtimeConsumesText)) {
  failures.push("check-runtime-consumes-accepted-bundle.mjs must validate runtime admission with writeProof=false.");
}

const controlPlaneText = readText("scripts/oam/run-control-plane-checks.ps1");
const ciText = readText(".github/workflows/ci.yml");
if (!controlPlaneText.includes("check-dormitory-runtime-admission.mjs --write-proof")) {
  failures.push("control-plane must make runtime proof writing explicit with --write-proof.");
}
if (!ciText.includes("check-dormitory-runtime-admission.mjs --write-proof")) {
  failures.push("CI must make runtime proof writing explicit with --write-proof.");
}
if (/--write-initial/.test(controlPlaneText) || /--write-initial/.test(ciText)) {
  failures.push("control-plane/CI must not use --write-initial during validation.");
}
if (!controlPlaneText.includes("Invoke-Gate node scripts/oam/generate-current-evidence-root.mjs -RecordResult $false")) {
  failures.push("control-plane formal evidence generation must be isolated from gate result counting.");
}

const result = {
  version: "oam.evidence-writer-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  formalEvidenceSingleWriter: generatorPath,
  checkerResultWriteScope: "artifacts/oam/checks/*",
  proofWriteRequiresExplicitFlag: true,
  checkerMayWriteFormalEvidenceRoot: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Evidence writer boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Evidence writer boundary check: PASS");

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function listMjs(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => `${dir}/${entry.name}`.replace(/\\/g, "/"));
}
