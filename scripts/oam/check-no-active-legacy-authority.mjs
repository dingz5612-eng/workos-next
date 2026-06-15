import {
  CAPABILITY_ID,
  CAPABILITY_PROJECTION_PATH,
  CAPABILITY_REGISTRY_PATH,
  NO_ACTIVE_LEGACY_AUTHORITY_RESULT_PATH,
  loadCapabilityDocuments,
  readJsonIfExists,
  stableStringify,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const legacyTerms = [
  "executionHead",
  "executionHeadCompatibilityAliasOf",
  "previousAuthorizedCandidateExecutionHead",
  "currentHeadDescendantPolicy"
];
const allowedActiveAuthorityFields = [
  "capabilityId",
  "sourceClosureDigest",
  "generatedBundleDigest",
  "acceptedGeneratedBundleDigest",
  "runtimeConsumedBundleDigest",
  "runtimeAdmissionDigest",
  "businessLandingDigest",
  "releaseAuthorityDigest"
];
const files = [
  {
    label: "registry.activeAuthority",
    path: CAPABILITY_REGISTRY_PATH,
    select: (doc) => doc?.activeAuthority
  },
  {
    label: "projection.activeAuthority",
    path: CAPABILITY_PROJECTION_PATH,
    select: (doc) => doc?.activeAuthority
  },
  {
    label: "architectureManifest.currentEvidenceRoot.binding",
    path: "docs/oam/current-architecture.manifest.json",
    select: (doc) => doc?.currentEvidenceRoot?.binding
  },
  {
    label: "evidenceGraph.binding",
    path: "artifacts/oam/evidence/evidence-graph.json",
    select: (doc) => doc?.binding
  },
  {
    label: "releaseEvidenceObject",
    path: "artifacts/oam/evidence/current-oam-release-evidence-object.json",
    select: (doc) => doc
  },
  {
    label: "generatedCandidateAcceptance",
    path: "docs/oam/generated-candidate-acceptance.current.json",
    select: (doc) => stripHistorical(doc)
  },
  {
    label: "dormitoryRuntimeAdmission",
    path: "docs/oam/dormitory-runtime-admission.current.json",
    select: (doc) => stripHistorical(doc)
  }
];

const { registry, projection } = loadCapabilityDocuments(root);
const failures = [];
checkActiveAuthority("registry.activeAuthority", registry?.activeAuthority);
checkActiveAuthority("projection.activeAuthority", projection?.activeAuthority);

for (const entry of files) {
  const doc = readJsonIfExists(entry.path, root);
  if (!doc) {
    failures.push(`${entry.label} source missing: ${entry.path}.`);
    continue;
  }
  const active = entry.select(doc);
  const text = stableStringify(stripHistorical(active ?? {}));
  for (const term of legacyTerms) {
    if (text.includes(term)) failures.push(`${entry.label} contains active legacy authority term: ${term}.`);
  }
}

const result = {
  version: "oam.no-active-legacy-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: projection?.capabilityId ?? registry?.capabilityId ?? CAPABILITY_ID,
  activeAuthorityLegacyTermsAllowed: false,
  scannedLegacyTerms: legacyTerms,
  allowedActiveAuthorityFields,
  failures
};

writeJson(NO_ACTIVE_LEGACY_AUTHORITY_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("No active legacy authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`No active legacy authority check: PASS (${result.capabilityId})`);

function checkActiveAuthority(label, authority) {
  if (!authority || typeof authority !== "object" || Array.isArray(authority)) {
    failures.push(`${label} must be an object.`);
    return;
  }
  const keys = Object.keys(authority).sort();
  const expected = [...allowedActiveAuthorityFields].sort();
  if (stableStringify(keys) !== stableStringify(expected)) {
    failures.push(`${label} fields must be exactly ${expected.join(", ")}.`);
  }
  if (authority.capabilityId !== CAPABILITY_ID) failures.push(`${label}.capabilityId must be ${CAPABILITY_ID}.`);
}

function stripHistorical(value) {
  if (Array.isArray(value)) return value.map(stripHistorical);
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if ([
        "historicalAppendix",
        "compatibilityBox",
        "compatibilityBoxRef",
        "referenceOnlyAuditPackage",
        "deprecatedAliasReferences"
      ].includes(key)) continue;
      result[key] = stripHistorical(child);
    }
    return result;
  }
  return value;
}
