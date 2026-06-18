import { fileDigest, readJson, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const ledgerPath = "docs/oam/dormitory-defect-closure-ledger.json";
const resultPath = "artifacts/oam/checks/dormitory-defect-closure-ledger-result.json";
const requiredTypes = [
  "legacy_active_path_failure",
  "business_ui_copy_check_failure",
  "ui_check_script_protects_legacy_buttons",
  "scenario_2_to_12_browser_digest_mismatch",
  "ci_browser_continue_on_error",
  "evidence_root_biased_to_first_golden_chain",
  "legacy_terms_and_entries_residue",
  "consumer_graph_uncovered_items",
  "legacy_unclassified_items",
  "correction_automation_insufficient"
];
const allowedStatuses = new Set(["open", "fixing", "verified", "closed"]);
const failures = [];
const ledger = readJson(ledgerPath, root);
const defects = ledger.defects ?? [];

if (ledger.version !== "oam.dormitory-defect-closure-ledger.v1") fail("ledger.version mismatch.");
if (ledger.status !== "authoritative") fail("ledger.status must be authoritative.");
if (ledger.rules?.p0p1MustHaveOwner !== true) fail("p0p1MustHaveOwner rule must be true.");
if (ledger.rules?.closedRequiresVerificationEvidence !== true) fail("closedRequiresVerificationEvidence rule must be true.");
if (ledger.rules?.recurrenceReopensAutomatically !== true) fail("recurrenceReopensAutomatically rule must be true.");
if (ledger.rules?.specializedFailureWithEvidenceRootPassIsP0 !== true) fail("specializedFailureWithEvidenceRootPassIsP0 rule must be true.");

const typeSet = new Set(defects.map((item) => item.defectType));
for (const requiredType of requiredTypes) {
  if (!typeSet.has(requiredType)) fail(`required defect type missing: ${requiredType}.`);
}

const seenIds = new Set();
for (const defect of defects) {
  const label = defect.defectId ?? "<missing>";
  if (!defect.defectId) fail("defectId is required.");
  if (seenIds.has(defect.defectId)) fail(`duplicate defectId: ${defect.defectId}.`);
  seenIds.add(defect.defectId);
  if (!["P0", "P1", "P2", "P3"].includes(defect.severity)) fail(`${label}.severity invalid.`);
  if (["P0", "P1"].includes(defect.severity) && !defect.owner) fail(`${label} P0/P1 must have owner.`);
  if (!defect.discoveredBy) fail(`${label}.discoveredBy is required.`);
  if (!Array.isArray(defect.fileLocations) || defect.fileLocations.length === 0) fail(`${label}.fileLocations required.`);
  if (!Array.isArray(defect.impactLayers) || defect.impactLayers.length === 0) fail(`${label}.impactLayers required.`);
  if (!defect.rootCauseZh) fail(`${label}.rootCauseZh is required.`);
  if (!Array.isArray(defect.fixActionsZh) || defect.fixActionsZh.length === 0) fail(`${label}.fixActionsZh required.`);
  if (!Array.isArray(defect.verificationScripts) || defect.verificationScripts.length === 0) fail(`${label}.verificationScripts required.`);
  if (typeof defect.blocksEvidenceRoot !== "boolean") fail(`${label}.blocksEvidenceRoot must be boolean.`);
  if (typeof defect.blocksCI !== "boolean") fail(`${label}.blocksCI must be boolean.`);
  if (!allowedStatuses.has(defect.status)) fail(`${label}.status invalid.`);
  if (defect.status === "closed" && (!Array.isArray(defect.closingEvidence) || defect.closingEvidence.length === 0)) {
    fail(`${label} cannot be closed without closingEvidence.`);
  }
  if (["P0", "P1"].includes(defect.severity) && ["open", "fixing"].includes(defect.status)) {
    fail(`${label} ${defect.severity} cannot remain ${defect.status}.`);
  }
}

const result = {
  version: "oam.dormitory-defect-closure-ledger-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  ledgerPath,
  ledgerDigest: fileDigest(ledgerPath, root),
  defectCount: defects.length,
  openOrFixingCount: defects.filter((item) => ["open", "fixing"].includes(item.status)).length,
  p0Count: defects.filter((item) => item.severity === "P0").length,
  p1Count: defects.filter((item) => item.severity === "P1").length,
  evidenceRootBlockingOpenCount: defects.filter((item) => ["open", "fixing"].includes(item.status) && item.blocksEvidenceRoot).length,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory defect closure ledger check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory defect closure ledger check: PASS (${defects.length} defects registered)`);

function fail(message) {
  failures.push(message);
}
