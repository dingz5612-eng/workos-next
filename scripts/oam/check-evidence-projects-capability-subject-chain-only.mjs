import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import {
  FIRST_GOLDEN_CHAIN_CAPABILITY_DIGEST_CHAIN_PATH,
  FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH,
  FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PROJECTION_RESULT_PATH,
  isSha256Digest
} from "./lib/capability-projection-digests.mjs";

const root = process.cwd();
const subjectChain = readJsonIfExists(FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH, root);
const digestChain = readJsonIfExists(FIRST_GOLDEN_CHAIN_CAPABILITY_DIGEST_CHAIN_PATH, root);
const evidenceGraph = readJsonIfExists("artifacts/oam/evidence/evidence-graph.json", root);
const finalReport = readJsonIfExists("artifacts/oam/final-report.json", root);
const failures = [];

if (subjectChain?.capabilityId !== CAPABILITY_ID) fail(`subject chain must bind ${CAPABILITY_ID}.`);
if (!isSha256Digest(subjectChain?.outputContentDigest)) fail("subject chain digest must be sha256.");
if (containsKey(subjectChain, "evidenceRootDigest")) fail("subject chain must not contain evidenceRootDigest.");
if (containsValue(subjectChain, evidenceGraph?.evidenceRootDigest)) fail("subject chain must not contain current evidence root digest value.");
if (digestChain?.subjectChainRef !== FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH) {
  fail("capability digest chain must project the subject chain ref.");
}
if (digestChain?.subjectChainDigest !== subjectChain?.outputContentDigest) {
  fail("capability digest chain subjectChainDigest must match subject chain outputContentDigest.");
}
if (containsKey(digestChain, "evidenceRootDigest")) {
  fail("compiler-owned capability digest chain file must not carry evidenceRootDigest.");
}
if (finalReport?.capabilityDigestChain?.subjectChainDigest &&
  finalReport.capabilityDigestChain.subjectChainDigest !== subjectChain?.outputContentDigest) {
  fail("final report capabilityDigestChain.subjectChainDigest must match subject chain.");
}
if (subjectChain?.productionConfirmAllowed !== false ||
  subjectChain?.releaseAuthority !== false ||
  subjectChain?.finalGoNoGo !== "NO_GO") {
  fail("subject chain must keep production/release/final GO closed.");
}

const result = {
  version: "oam.evidence-projects-capability-subject-chain-only-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  subjectChainRef: FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH,
  subjectChainDigest: subjectChain?.outputContentDigest ?? null,
  evidenceRootProjectionAllowedOnlyOutsideSubjectChain: true,
  digestChainSubjectChainDigest: digestChain?.subjectChainDigest ?? null,
  evidenceRootDigestObserved: evidenceGraph?.evidenceRootDigest ?? finalReport?.evidenceRootDigest ?? null,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PROJECTION_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Evidence projects capability subject chain only check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Evidence projects capability subject chain only check: PASS (${result.subjectChainDigest})`);

function containsKey(value, key) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsKey(item, key));
  return Object.entries(value).some(([entryKey, entryValue]) => entryKey === key || containsKey(entryValue, key));
}

function containsValue(value, expected) {
  if (!expected) return false;
  if (value === expected) return true;
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsValue(item, expected));
  return Object.values(value).some((entryValue) => containsValue(entryValue, expected));
}

function fail(message) {
  failures.push(message);
}
