import fs from "node:fs";
import path from "node:path";
import { fileDigest, readJson, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const ledgerPath = "docs/oam/legacy-retirement-ledger.json";
const resultPath = "artifacts/oam/checks/legacy-retirement-ledger-result.json";
const ledger = readJson(ledgerPath, root);
const failures = [];
const hits = [];
const categoryCounts = new Map();
const skipDirs = new Set([".git", "node_modules", "bin", "obj", "dist", "coverage", ".next"]);

if (ledger.version !== "oam.legacy-retirement-ledger.v1") fail("ledger.version mismatch.");
if (ledger.status !== "authoritative") fail("ledger.status must be authoritative.");
if (!Array.isArray(ledger.scanTerms) || ledger.scanTerms.length === 0) fail("scanTerms must be non-empty.");
if (!Array.isArray(ledger.classificationRules) || ledger.classificationRules.length === 0) fail("classificationRules must be non-empty.");

for (const file of listFiles("")) {
  if (!isTextCandidate(file)) continue;
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const term of ledger.scanTerms ?? []) {
    if (!text.includes(term)) continue;
    const category = classify(file);
    hits.push({ file, term, category });
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
}

const unclassified = hits.filter((hit) => hit.category === "unclassified");
if (ledger.requiredCategoryRules?.unclassifiedMustBeZero === true && unclassified.length > 0) {
  fail(`legacy unclassified hits must be 0, actual ${unclassified.length}.`);
}

for (const rule of ledger.classificationRules ?? []) {
  if (rule.category === "active_forbidden" && ledger.requiredCategoryRules?.activeForbiddenRequiresRemediationTarget === true) {
    if (!rule.remediationTarget) fail("active_forbidden rule requires remediationTarget.");
  }
  if (["legacy_readonly", "generated_legacy_reference"].includes(rule.category) &&
    ledger.requiredCategoryRules?.legacyReadonlyMustProveNoFactWrite === true &&
    rule.writeBusinessFactsAllowed !== false) {
    fail(`${rule.category} must prove no business fact write.`);
  }
  if (rule.category === "test_fixture" && ledger.requiredCategoryRules?.testFixtureMustNotJoinCurrentMainPath === true &&
    rule.currentMainPathAllowed !== false) {
    fail("test_fixture must not join current main path.");
  }
  if (rule.category === "historical_evidence" && ledger.requiredCategoryRules?.historicalEvidenceMustNotBeDeleted === true &&
    rule.deleteToFixAllowed !== false) {
    fail("historical_evidence must forbid delete-to-fix.");
  }
  if (rule.category === "documentation_archive" && ledger.requiredCategoryRules?.documentationArchiveMustNotClaimCurrentEntry === true &&
    rule.currentMainPathAllowed !== false) {
    fail("documentation_archive must not claim current entry.");
  }
}

const activeForbidden = hits.filter((hit) => hit.category === "active_forbidden");
const result = {
  version: "oam.legacy-retirement-ledger-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  ledgerPath,
  ledgerDigest: fileDigest(ledgerPath, root),
  scannedTermCount: ledger.scanTerms?.length ?? 0,
  hitCount: hits.length,
  categoryCounts: Object.fromEntries([...categoryCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
  unclassifiedCount: unclassified.length,
  activeForbiddenCount: activeForbidden.length,
  activeForbiddenExamples: activeForbidden.slice(0, 50),
  unclassifiedExamples: unclassified.slice(0, 50),
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Legacy retirement ledger check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Legacy retirement ledger check: PASS (${hits.length} legacy hits classified, ${activeForbidden.length} active forbidden)`);

function classify(file) {
  const normalized = file.replace(/\\/g, "/");
  for (const rule of ledger.classificationRules ?? []) {
    if ((rule.pathExclusions ?? []).some((prefix) => normalized.startsWith(prefix))) continue;
    if ((rule.pathPrefixes ?? []).some((prefix) => normalized.startsWith(prefix))) return rule.category;
  }
  return "unclassified";
}

function listFiles(relativeDir) {
  const fullDir = path.join(root, relativeDir);
  const output = [];
  for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const child = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...listFiles(child));
    else output.push(child);
  }
  return output;
}

function isTextCandidate(file) {
  return /\.(cjs|cs|css|html|js|json|jsx|md|mjs|ps1|ts|tsx|txt|yml|yaml)$/i.test(file) ||
    file.startsWith(".github/");
}

function fail(message) {
  failures.push(message);
}
