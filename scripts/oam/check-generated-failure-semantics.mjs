import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-failure-semantics.authority.json";
const generatedPath = "docs/contracts/generated/dormitory/failure-semantics.generated.json";
const scenario1RuntimeRulesPath = "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json";
const resultPath = "artifacts/oam/checks/generated-failure-semantics-result.json";
const failures = [];
const authority = readJson(authorityPath);
const generated = readJson(generatedPath);
const scenario1RuntimeRules = readJson(scenario1RuntimeRulesPath);

if (authority && generated) {
  checkGeneratedMetadata(generatedPath, generated);
  requireEqual(generated.sourceAuthorityRefs?.failureSemanticsAuthority, authorityPath, "sourceAuthorityRefs.failureSemanticsAuthority");
  requireEqual(generated.sourceAuthorityRefs?.scenario1RuntimeRules, scenario1RuntimeRulesPath, "sourceAuthorityRefs.scenario1RuntimeRules");
  requireEqual(JSON.stringify(generated.globalFailurePolicy), JSON.stringify(authority.globalFailurePolicy), "globalFailurePolicy");
  const obsoleteFailureCaseIds = new Set([
    "not_saleable_missing_reason",
    "maintenance_missing_service_verification"
  ]);
  const expectedScenario1Ids = [
    ...((scenario1RuntimeRules?.failureSemantics ?? [])
      .map((item) => item.failureCode)
      .filter((code) => code === "bedset_incomplete" || code === "missing_required_evidence")),
    "needs_supplement_requires_remark"
  ];
  const expectedIds = [
    ...(authority.failureSemantics ?? [])
      .map((item) => item.caseId)
      .filter((id) => !obsoleteFailureCaseIds.has(id)),
    ...expectedScenario1Ids
  ];
  const generatedIds = (generated.failureSemantics ?? []).map((item) => item.sourceRuleId);
  requireArrayExact(generatedIds, expectedIds, "generated failure sourceRuleId");
  const generatedById = new Map((generated.failureSemantics ?? []).map((item) => [item.sourceRuleId, item]));
  for (const sourceRule of authority.failureSemantics ?? []) {
    if (obsoleteFailureCaseIds.has(sourceRule.caseId)) continue;
    const item = generatedById.get(sourceRule.caseId);
    if (!item) continue;
    requireEqual(item.generatedRuleId, `dormitory.failure_semantics.${safeRuleToken(sourceRule.caseId)}`, `${sourceRule.caseId}.generatedRuleId`);
    requireEqual(item.sourceAuthorityRef, authorityPath, `${sourceRule.caseId}.sourceAuthorityRef`);
    requireEqual(item.httpStatus, sourceRule.httpStatus, `${sourceRule.caseId}.httpStatus`);
    requireEqual(item.code, sourceRule.code, `${sourceRule.caseId}.code`);
    requireArrayExact(item.appliesTo, sourceRule.appliesTo, `${sourceRule.caseId}.appliesTo`);
    for (const key of [
      "sideEffectsAllowedOnFailure",
      "domainEventsAllowedOnFailure",
      "projectionMutationsAllowedOnFailure",
      "workItemStateChangeAllowedOnFailure",
      "ledgerEffectAllowedOnFailure"
    ]) {
      requireEqual(item[key], false, `${sourceRule.caseId}.${key}`);
    }
  }
  for (const scenarioRuleId of expectedScenario1Ids) {
    const item = generatedById.get(scenarioRuleId);
    if (!item) continue;
    requireEqual(item.sourceAuthorityRef, scenario1RuntimeRulesPath, `${scenarioRuleId}.sourceAuthorityRef`);
    for (const key of [
      "sideEffectsAllowedOnFailure",
      "domainEventsAllowedOnFailure",
      "projectionMutationsAllowedOnFailure",
      "workItemStateChangeAllowedOnFailure",
      "ledgerEffectAllowedOnFailure"
    ]) {
      requireEqual(item[key], false, `${scenarioRuleId}.${key}`);
    }
  }
}

writeResult({
  version: "oam.generated-failure-semantics-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  generatedPath,
  caseIds: generated?.failureSemantics?.map((item) => item.generatedRuleId) ?? [],
  failures
});

if (failures.length) {
  console.error("Generated failure semantics check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Generated failure semantics check: PASS");

function checkGeneratedMetadata(file, document) {
  if (document.generated !== true) fail(`${file} must include generated=true.`);
  if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
  if (document.generatedBy !== "scripts/oam/compile-current-capability.mjs") fail(`${file} must be compiler generated.`);
  if (document.capabilityId !== "Dormitory.FirstGoldenChain") fail(`${file} must bind Dormitory.FirstGoldenChain.`);
  const expectedDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedDigest) fail(`${file} outputContentDigest mismatch.`);
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}

function requireArrayExact(actual, expected, label) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    fail(`${label} must compare arrays.`);
    return;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} must equal ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}

function readJson(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    fail(`${file} is missing.`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

function writeResult(result) {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({ ...result, checkedAtUtc: new Date().toISOString() }, null, 2)}\n`, "utf8");
}

function stableDigest(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeRuleToken(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function fail(message) {
  failures.push(message);
}
