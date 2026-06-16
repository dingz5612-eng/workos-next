import { readJsonIfExists, writeJson } from "./lib/capability-delivery-control-plane.mjs";
import {
  CAPABILITY_ID,
  FIRST_GOLDEN_CHAIN_CAPABILITY_DIGEST_CHAIN_PATH,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH,
  FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH,
  FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH,
  buildProjectionDigestChain,
  digestBrowserAuditReport,
  isSha256Digest
} from "./lib/capability-projection-digests.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/evidence-digest-chain-single-source-result.json";
const evidenceGraphPath = "artifacts/oam/evidence/evidence-graph.json";
const finalReportPath = "artifacts/oam/final-report.json";
const currentFinalReportPath = "artifacts/oam/evidence/current-oam-final-report.json";
const releaseEvidenceObjectPath = "artifacts/oam/evidence/current-oam-release-evidence-object.json";

const projectionChain = buildProjectionDigestChain(root);
const testPlan = readJsonIfExists(FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH, root);
const browserReport = readJsonIfExists(FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH, root);
const browserResult = readJsonIfExists(FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH, root);
const capabilityDigestChain = readJsonIfExists(FIRST_GOLDEN_CHAIN_CAPABILITY_DIGEST_CHAIN_PATH, root);
const evidenceGraph = readJsonIfExists(evidenceGraphPath, root);
const finalReport = readJsonIfExists(finalReportPath, root);
const currentFinalReport = readJsonIfExists(currentFinalReportPath, root);
const releaseEvidenceObject = readJsonIfExists(releaseEvidenceObjectPath, root);
const previousResult = readJsonIfExists(resultPath, root);
const failures = [];

if (!testPlan) failures.push(`${FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH} is missing.`);
if (!browserReport) failures.push(`${FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH} is missing.`);
if (!browserResult) failures.push(`${FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH} is missing.`);
if (!capabilityDigestChain) failures.push(`${FIRST_GOLDEN_CHAIN_CAPABILITY_DIGEST_CHAIN_PATH} is missing.`);
if (!evidenceGraph) failures.push(`${evidenceGraphPath} is missing.`);
if (!finalReport) failures.push(`${finalReportPath} is missing.`);
if (!currentFinalReport) failures.push(`${currentFinalReportPath} is missing.`);
if (!releaseEvidenceObject) failures.push(`${releaseEvidenceObjectPath} is missing.`);

const expectedBrowserAuditDigest = browserReport ? digestBrowserAuditReport(browserReport) : null;
const expectedChain = {
  version: "oam.capability-evidence-digest-chain.v1",
  capabilityId: CAPABILITY_ID,
  authorityLedgerDigest: projectionChain.authorityLedgerDigest,
  acceptedGeneratedBundleDigest: projectionChain.acceptedGeneratedBundleDigest,
  runtimeProjectionDigest: projectionChain.runtimeProjectionDigest,
  surfaceProjectionDigest: projectionChain.surfaceProjectionDigest,
  searchProjectionDigest: projectionChain.searchProjectionDigest,
  environmentProfileDigest: projectionChain.environmentProfileDigest,
  positiveBrowserAuditDigest: projectionChain.positiveBrowserAuditDigest,
  negativeBrowserAuditDigest: projectionChain.negativeBrowserAuditDigest,
  noSideEffectsProofDigest: projectionChain.noSideEffectsProofDigest,
  subjectChainDigest: projectionChain.subjectChainDigest,
  testPlanDigest: testPlan?.testPlanDigest ?? null,
  browserAuditDigest: browserReport?.browserAuditDigest ?? browserResult?.browserAuditDigest ?? null,
  dbProjectionProofDigest: projectionChain.dbProjectionProofDigest,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO"
};

for (const [field, value] of Object.entries(expectedChain)) {
  if (field === "version" || field === "capabilityId" || field === "productionConfirmAllowed" ||
    field === "releaseAuthority" || field === "finalGoNoGo") {
    continue;
  }
  if (field === "dbProjectionProofDigest" && value === "null_if_runtime_test_only") continue;
  if (!isSha256Digest(value)) failures.push(`${field} must be a sha256 digest.`);
}

if (testPlan?.capabilityId !== CAPABILITY_ID) failures.push(`test plan capabilityId must be ${CAPABILITY_ID}.`);
for (const field of [
  "acceptedGeneratedBundleDigest",
  "runtimeProjectionDigest",
  "surfaceProjectionDigest",
  "searchProjectionDigest"
]) {
  if (testPlan?.[field] !== projectionChain[field]) {
    failures.push(`test plan ${field} mismatch: expected ${projectionChain[field]}, actual ${testPlan?.[field] ?? "missing"}.`);
  }
}

if (browserReport?.capabilityId !== CAPABILITY_ID) failures.push(`browser report capabilityId must be ${CAPABILITY_ID}.`);
if (browserReport?.browserAuditDigest !== expectedBrowserAuditDigest) {
  failures.push("browser report browserAuditDigest does not match canonical report digest.");
}
if (browserResult?.status !== "PASS") failures.push("browser audit checker result must be PASS.");
if (browserResult?.browserAuditDigest !== browserReport?.browserAuditDigest) {
  failures.push("browser audit checker digest must match browser report digest.");
}

for (const [label, chain, requiresRuntimeConsumptionReady] of [
  ["capability digest chain file", capabilityDigestChain, false],
  ["evidence graph", evidenceGraph?.capabilityDigestChain, true],
  ["final report", finalReport?.capabilityDigestChain, true],
  ["current final report", currentFinalReport?.capabilityDigestChain, true],
  ["release evidence object", releaseEvidenceObject?.capabilityDigestChain, true]
]) {
  checkDocumentChain(label, chain, { requiresRuntimeConsumptionReady });
}

const graphEvidenceRootDigest = evidenceGraph?.capabilityDigestChain?.evidenceRootDigest;
if (!isSha256Digest(graphEvidenceRootDigest)) {
  failures.push("evidence graph capabilityDigestChain.evidenceRootDigest must be a sha256 digest.");
}
if (releaseEvidenceObject?.capabilityDigestChain?.evidenceRootDigest !== graphEvidenceRootDigest) {
  failures.push("release evidence object evidenceRootDigest must match evidence graph chain.");
}
if (finalReport?.capabilityDigestChain?.evidenceRootDigest !== graphEvidenceRootDigest) {
  failures.push("final report evidenceRootDigest must match evidence graph chain.");
}

const result = {
  version: "oam.evidence-digest-chain-single-source-check.v1",
  checkedAtUtc: previousResult?.checkedAtUtc ?? new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  authorityLedgerDigest: expectedChain.authorityLedgerDigest,
  acceptedGeneratedBundleDigest: expectedChain.acceptedGeneratedBundleDigest,
  runtimeProjectionDigest: expectedChain.runtimeProjectionDigest,
  surfaceProjectionDigest: expectedChain.surfaceProjectionDigest,
  searchProjectionDigest: expectedChain.searchProjectionDigest,
  environmentProfileDigest: expectedChain.environmentProfileDigest,
  positiveBrowserAuditDigest: expectedChain.positiveBrowserAuditDigest,
  negativeBrowserAuditDigest: expectedChain.negativeBrowserAuditDigest,
  noSideEffectsProofDigest: expectedChain.noSideEffectsProofDigest,
  subjectChainDigest: expectedChain.subjectChainDigest,
  testPlanDigest: expectedChain.testPlanDigest,
  browserAuditDigest: expectedChain.browserAuditDigest,
  dbProjectionProofDigest: expectedChain.dbProjectionProofDigest,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

const output = semanticallyEqualResult(previousResult, result)
  ? previousResult
  : { ...result, checkedAtUtc: new Date().toISOString() };

writeJson(resultPath, output, root);

if (output.status !== "PASS") {
  console.error("Evidence digest chain single-source check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Evidence digest chain single-source check: PASS (${graphEvidenceRootDigest})`);

function checkDocumentChain(label, chain, options = {}) {
  if (!chain) {
    failures.push(`${label} missing capabilityDigestChain.`);
    return;
  }
  for (const [field, expected] of Object.entries(expectedChain)) {
    if (chain[field] !== expected) {
      failures.push(`${label} capabilityDigestChain.${field} mismatch: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(chain[field])}.`);
    }
  }
  if (options.requiresRuntimeConsumptionReady && chain.runtimeConsumptionReady !== false && chain.runtimeConsumptionReady !== "test_only") {
    failures.push(`${label} runtimeConsumptionReady must be false or test_only.`);
  }
  if (chain.productionConfirmAllowed !== false) failures.push(`${label} productionConfirmAllowed must remain false.`);
  if (chain.releaseAuthority !== false) failures.push(`${label} releaseAuthority must remain false.`);
  if (chain.finalGoNoGo !== "NO_GO") failures.push(`${label} finalGoNoGo must remain NO_GO.`);
}

function semanticallyEqualResult(left, right) {
  if (!left || typeof left !== "object") return false;
  const normalize = (value) => {
    const copy = { ...value };
    delete copy.checkedAtUtc;
    return JSON.stringify(copy);
  };
  return normalize(left) === normalize(right);
}
