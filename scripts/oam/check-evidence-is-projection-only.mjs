import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const policyPath = "docs/oam/evidence-projection-policy.current.json";
const resultPath = "artifacts/oam/checks/evidence-is-projection-only-result.json";
const policy = readJson(policyPath);
const failures = [];

requireEqual(policy.version, "oam.evidence-projection-policy.v1", "version", failures);
requireEqual(policy.capabilityId, "Dormitory.FirstGoldenChain", "capabilityId", failures);
for (const artifact of policy.projectionOnlyArtifacts ?? []) {
  if (!projectionArtifactAllowed(artifact)) failures.push(`projection artifact not allowed: ${artifact}.`);
}
for (const forbidden of ["generated accepted", "runtime ready", "business landing", "production confirmation", "release GO"]) {
  if (!(policy.forbiddenDecisionAuthority ?? []).includes(forbidden)) {
    failures.push(`forbiddenDecisionAuthority must include ${forbidden}.`);
  }
}
requireEqual(policy.finalGoAuthority?.onlySource, "RELEASE_AUTHORIZED ledger event", "finalGoAuthority.onlySource", failures);
requireEqual(policy.finalGoAuthority?.releaseAuthorizedEventPresent, false, "finalGoAuthority.releaseAuthorizedEventPresent", failures);
requireEqual(policy.finalGoAuthority?.releaseAuthority, false, "finalGoAuthority.releaseAuthority", failures);
requireEqual(policy.finalGoAuthority?.finalGoNoGo, "NO_GO", "finalGoAuthority.finalGoNoGo", failures);

const evidenceFiles = [
  "artifacts/oam/evidence/evidence-graph.json",
  "artifacts/oam/final-report.json",
  "artifacts/oam/evidence/current-oam-release-evidence-object.json",
  "artifacts/oam/evidence/current-oam-release-attestation.json"
];
for (const file of evidenceFiles) {
  const doc = readJsonIfExists(file);
  if (!doc) continue;
  if (doc.releaseAuthority === true || doc.binding?.releaseAuthority === true) {
    failures.push(`${file} must not set releaseAuthority=true.`);
  }
  if (doc.finalGoNoGo === "GO" || doc.binding?.finalGoNoGo === "GO") {
    failures.push(`${file} must not set finalGoNoGo=GO.`);
  }
  if (doc.productionConfirmAllowed === true || doc.binding?.productionConfirmAllowed === true) {
    failures.push(`${file} must not set productionConfirmAllowed=true.`);
  }
}

const result = {
  version: "oam.evidence-is-projection-only-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  projectionOnlyArtifacts: policy.projectionOnlyArtifacts ?? [],
  allowedProjectionInputs: policy.allowedProjectionInputs ?? [],
  forbiddenDecisionAuthority: policy.forbiddenDecisionAuthority ?? [],
  generatedAcceptedDecisionSource: "docs/oam/generated-candidate-acceptance.current.json",
  runtimeReadyDecisionSource: "docs/oam/dormitory-runtime-admission.current.json",
  businessLandingDecisionSource: "capability ledger BUSINESS_LANDING_ADMITTED event only",
  productionConfirmationDecisionSource: "capability ledger PRODUCTION_CONFIRMED event only",
  releaseGoDecisionSource: "capability ledger RELEASE_AUTHORIZED event only",
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Evidence projection-only check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Evidence projection-only check: PASS");

function projectionArtifactAllowed(file) {
  return [
    "artifacts/oam/evidence/evidence-graph.json",
    "artifacts/oam/final-report.json",
    "artifacts/oam/evidence/current-oam-release-evidence-object.json",
    "artifacts/oam/evidence/current-oam-release-attestation.json"
  ].includes(file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}
