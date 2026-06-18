import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import {
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH,
  FIRST_GOLDEN_CHAIN_BUSINESS_LANDING_REVIEW_ATTESTATION_PATH,
  FIRST_GOLDEN_CHAIN_DB_PROJECTION_PROOF_RESULT_PATH,
  FIRST_GOLDEN_CHAIN_ENVIRONMENT_PROFILE_PROOF_RESULT_PATH,
  FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH,
  FIRST_GOLDEN_CHAIN_NO_SIDE_EFFECTS_PROOF_RESULT_PATH,
  FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH,
  FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_RESULT_PATH,
  digestObject,
  fileDigest,
  isSha256Digest
} from "./lib/capability-projection-digests.mjs";

const root = process.cwd();
const writeAttestation = process.argv.includes("--write-attestation");
const chain = readJsonIfExists(FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH, root);
const positive = readJsonIfExists(FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH, root);
const negative = readJsonIfExists(FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH, root);
const noSideEffects = readJsonIfExists(FIRST_GOLDEN_CHAIN_NO_SIDE_EFFECTS_PROOF_RESULT_PATH, root);
const dbProof = readJsonIfExists(FIRST_GOLDEN_CHAIN_DB_PROJECTION_PROOF_RESULT_PATH, root);
const environment = readJsonIfExists(FIRST_GOLDEN_CHAIN_ENVIRONMENT_PROFILE_PROOF_RESULT_PATH, root);
let attestation = readJsonIfExists(FIRST_GOLDEN_CHAIN_BUSINESS_LANDING_REVIEW_ATTESTATION_PATH, root);
const failures = [];
const requiredFields = [
  "authorityLedgerDigest",
  "capabilityDecisionDigest",
  "objectGraphDigest",
  "bedCardinalityDigest",
  "invariantAuthorityDigest",
  "commandContractDigest",
  "failureSemanticsDigest",
  "acceptedGeneratedBundleDigest",
  "objectIdentityGeneratedDigest",
  "bedCardinalityGeneratedDigest",
  "businessInvariantsGeneratedDigest",
  "commandContractsGeneratedDigest",
  "failureSemanticsGeneratedDigest",
  "ruleSourceMapGeneratedDigest",
  "runtimeProjectionDigest",
  "surfaceProjectionDigest",
  "searchProjectionDigest",
  "dbProjectionPolicyDigest",
  "environmentProfileDigest",
  "positiveBrowserAuditDigest",
  "negativeBrowserAuditDigest",
  "noSideEffectsProofDigest",
  "dbProjectionProofDigest"
];
const digestExpectations = {
  authorityLedgerDigest: fileDigest("docs/oam/capabilities/dormitory-first-golden-chain.authority-ledger.json", root),
  capabilityDecisionDigest: fileDigest("docs/business/domains/dormitory/dormitory-first-golden-chain.capability-decision.authority.json", root),
  objectGraphDigest: fileDigest("docs/business/domains/dormitory/dormitory-object-graph.authority.json", root),
  bedCardinalityDigest: fileDigest("docs/business/domains/dormitory/dormitory-bed-cardinality.authority.json", root),
  invariantAuthorityDigest: fileDigest("docs/business/domains/dormitory/dormitory-invariants.authority.json", root),
  commandContractDigest: fileDigest("docs/business/domains/dormitory/dormitory-command-contracts.authority.json", root),
  failureSemanticsDigest: fileDigest("docs/business/domains/dormitory/dormitory-failure-semantics.authority.json", root),
  objectIdentityGeneratedDigest: generatedDigest("docs/contracts/generated/dormitory/object-identity.generated.json"),
  bedCardinalityGeneratedDigest: generatedDigest("docs/contracts/generated/dormitory/bed-cardinality.generated.json"),
  businessInvariantsGeneratedDigest: generatedDigest("docs/contracts/generated/dormitory/business-invariants.generated.json"),
  commandContractsGeneratedDigest: generatedDigest("docs/contracts/generated/dormitory/command-contracts.generated.json"),
  failureSemanticsGeneratedDigest: generatedDigest("docs/contracts/generated/dormitory/failure-semantics.generated.json"),
  ruleSourceMapGeneratedDigest: generatedDigest("docs/contracts/generated/dormitory/rule-source-map.generated.json"),
  runtimeProjectionDigest: readJsonIfExists("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json", root)?.runtimeProjectionDigest,
  surfaceProjectionDigest: readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root)?.surfaceProjectionDigest,
  searchProjectionDigest: readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root)?.searchProjectionDigest,
  dbProjectionPolicyDigest: generatedDigest("docs/contracts/generated/dormitory/db-projection-policy.generated.json"),
  environmentProfileDigest: environment?.environmentProfileDigest,
  positiveBrowserAuditDigest: positive?.browserAuditDigest,
  negativeBrowserAuditDigest: negative?.negativeBrowserAuditDigest,
  noSideEffectsProofDigest: noSideEffects?.noSideEffectsProofDigest,
  dbProjectionProofDigest: dbProof?.dbProjectionProofDigest
};

if (chain?.version !== "oam.capability-evidence-subject-chain.v1") fail("subject chain version invalid.");
if (chain?.capabilityId !== CAPABILITY_ID) fail(`subject chain must bind ${CAPABILITY_ID}.`);
if (!isSha256Digest(chain?.outputContentDigest)) fail("subject chain outputContentDigest must be sha256.");
if (chain?.outputContentDigest !== digestObject({ ...chain, outputContentDigest: "sha256:pending" })) {
  fail("subject chain outputContentDigest mismatch.");
}
for (const field of requiredFields) {
  if (chain?.[field] === undefined || chain?.[field] === null || chain?.[field] === "") {
    fail(`subject chain missing ${field}.`);
    continue;
  }
  const expected = digestExpectations[field];
  if (expected && chain[field] !== expected) {
    fail(`subject chain ${field} mismatch: expected ${expected}, actual ${chain[field]}.`);
  }
}
if (containsKey(chain, "evidenceRootDigest")) fail("subject chain must not contain evidenceRootDigest.");
if (JSON.stringify(chain ?? {}).includes("BUSINESS_LANDING_ADMITTED")) fail("subject chain must not contain BUSINESS_LANDING_ADMITTED.");
if (chain?.releaseAuthority === true) fail("subject chain must not contain releaseAuthority=true.");
if (chain?.finalGoNoGo === "GO") fail("subject chain must not contain finalGoNoGo=GO.");
if (dbProof?.policyMode === "null_if_runtime_test_only" &&
  chain?.businessLandingReviewStatus !== "BUSINESS_LANDING_NOT_READY_REVIEW_PACKAGE") {
  fail("runtime-test-only DB projection can only generate BUSINESS_LANDING_NOT_READY_REVIEW_PACKAGE.");
}
if (dbProof?.policyMode !== "null_if_runtime_test_only" &&
  dbProof?.status === "PASS" &&
  chain?.businessLandingReviewStatus !== "READY_FOR_00_BUSINESS_LANDING_REVIEW") {
  fail("real DB projection proof can only generate READY_FOR_00_BUSINESS_LANDING_REVIEW.");
}
if (writeAttestation && chain) {
  attestation = buildBusinessLandingReviewAttestation();
  writeJson(FIRST_GOLDEN_CHAIN_BUSINESS_LANDING_REVIEW_ATTESTATION_PATH, attestation, root);
}
if (attestation) {
  if (attestation.subjectChainDigest !== chain?.outputContentDigest) fail("business landing review attestation subjectChainDigest must match subject chain.");
  if (attestation.businessLandingReviewStatus !== chain?.businessLandingReviewStatus) fail("business landing review attestation status must match subject chain.");
}

const result = {
  version: "oam.capability-evidence-subject-chain-complete-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  subjectChainRef: FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH,
  subjectChainDigest: chain?.outputContentDigest ?? null,
  businessLandingReviewStatus: chain?.businessLandingReviewStatus ?? null,
  requiredFields,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Capability evidence subject chain complete check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Capability evidence subject chain complete check: PASS (${result.subjectChainDigest})`);

function generatedDigest(file) {
  const document = readJsonIfExists(file, root);
  return document?.outputContentDigest ?? fileDigest(file, root);
}

function containsKey(value, key) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsKey(item, key));
  return Object.entries(value).some(([entryKey, entryValue]) => entryKey === key || containsKey(entryValue, key));
}

function buildBusinessLandingReviewAttestation() {
  return {
    version: "oam.dormitory-first-golden-chain-business-landing-review.attestation.v1",
    status: "attested",
    capabilityId: CAPABILITY_ID,
    reviewPackageType: "00_business_landing_review",
    businessLandingReviewStatus: chain.businessLandingReviewStatus,
    subjectChainRef: FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH,
    subjectChainDigest: chain.outputContentDigest,
    dbProjectionProofRef: FIRST_GOLDEN_CHAIN_DB_PROJECTION_PROOF_RESULT_PATH,
    dbProjectionProofStatus: dbProof?.status ?? "missing",
    policyMode: dbProof?.policyMode ?? null,
    businessLandingBlockedBecause: dbProof?.businessLandingBlockedBecause ?? null,
    environmentProfileDigest: environment?.environmentProfileDigest ?? null,
    codexMayAdmitBusinessLanding: false,
    businessFeatureDevelopmentAllowed: false,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    forbiddenInterpretations: [
      "00 review package is not business landing admission",
      "browser PASS is not production confirmation",
      "Evidence Root PASS is not release authority",
      "Control Plane PASS is not final GO"
    ]
  };
}

function fail(message) {
  failures.push(message);
}
