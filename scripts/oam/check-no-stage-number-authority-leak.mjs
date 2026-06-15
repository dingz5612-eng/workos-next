import {
  NO_STAGE_AUTHORITY_RESULT_PATH,
  loadCapabilityDocuments,
  readJsonIfExists,
  stableStringify,
  validateNoStageNumberAuthorityLeak,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const { registry, ledger, projection } = loadCapabilityDocuments(root);
const state = validateNoStageNumberAuthorityLeak({ registry, ledger, projection });
const failures = [...state.failures];
const stagePattern = /(^|[^0-9A-Za-z])S[4-7](?:[_\-.][0-9A-Za-z]+)?($|[^0-9A-Za-z])/;
for (const entry of [
  {
    label: "architectureManifest.currentEvidenceRoot.binding",
    path: "docs/oam/current-architecture.manifest.json",
    select: (doc) => doc?.currentEvidenceRoot?.binding
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
  },
  {
    label: "evidenceGraph.binding",
    path: "artifacts/oam/evidence/evidence-graph.json",
    select: (doc) => doc?.binding
  },
  {
    label: "releaseEvidenceObject",
    path: "artifacts/oam/evidence/current-oam-release-evidence-object.json",
    select: (doc) => stripHistorical(doc)
  },
  {
    label: "finalReport",
    path: "artifacts/oam/final-report.json",
    select: (doc) => stripHistorical(doc)
  }
]) {
  const doc = readJsonIfExists(entry.path, root);
  if (!doc) {
    failures.push(`${entry.label} source missing: ${entry.path}.`);
    continue;
  }
  if (stagePattern.test(stableStringify(entry.select(doc) ?? {}))) {
    failures.push(`${entry.label} contains active stage-number authority term.`);
  }
}
const result = {
  version: "oam.no-stage-number-authority-leak-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: projection?.capabilityId ?? ledger?.capabilityId ?? registry?.capabilityId ?? "MISSING",
  stageNumberAuthorityAllowed: false,
  failures
};

writeJson(NO_STAGE_AUTHORITY_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("No stage-number authority leak check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`No stage-number authority leak check: PASS (${result.capabilityId})`);

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
