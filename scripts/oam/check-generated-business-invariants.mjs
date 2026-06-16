import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-invariants.authority.json";
const generatedPath = "docs/contracts/generated/dormitory/business-invariants.generated.json";
const commandContractsPath = "docs/contracts/generated/dormitory/command-contracts.generated.json";
const scenario1RuntimeRulesPath = "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json";
const resultPath = "artifacts/oam/checks/generated-business-invariants-result.json";
const failures = [];
const authority = readJson(authorityPath);
const generated = readJson(generatedPath);
const commandContracts = readJson(commandContractsPath);
const scenario1RuntimeRules = readJson(scenario1RuntimeRulesPath);

if (authority && generated) {
  checkGeneratedMetadata(generatedPath, generated);
  requireEqual(generated.sourceAuthorityRefs?.invariantAuthority, authorityPath, "sourceAuthorityRefs.invariantAuthority");
  requireEqual(generated.sourceAuthorityRefs?.scenario1RuntimeRules, scenario1RuntimeRulesPath, "sourceAuthorityRefs.scenario1RuntimeRules");
  const expectedReadinessState = (scenario1RuntimeRules?.readinessConclusionOptions ?? []).map((item) => item.value);
  requireArrayExact(generated.closedOptionSets?.readinessState, expectedReadinessState, "closedOptionSets.readinessState");
  const obsoleteInvariantIds = new Set([
    "not_saleable_requires_reason",
    "maintenance_requires_service_verification"
  ]);
  const expectedIds = (authority.invariants ?? [])
    .map((item) => item.invariantId)
    .filter((id) => !obsoleteInvariantIds.has(id));
  const generatedIds = (generated.invariants ?? []).map((item) => item.sourceRuleId);
  requireArrayExact(generatedIds, expectedIds, "generated invariant sourceRuleId");
  const generatedById = new Map((generated.invariants ?? []).map((item) => [item.sourceRuleId, item]));
  for (const sourceRule of authority.invariants ?? []) {
    if (obsoleteInvariantIds.has(sourceRule.invariantId)) continue;
    const item = generatedById.get(sourceRule.invariantId);
    if (!item) continue;
    requireEqual(item.generatedRuleId, `dormitory.business_invariant.${safeRuleToken(sourceRule.invariantId)}`, `${sourceRule.invariantId}.generatedRuleId`);
    requireEqual(item.sourceAuthorityRef, authorityPath, `${sourceRule.invariantId}.sourceAuthorityRef`);
    requireEqual(item.rule, sourceRule.rule, `${sourceRule.invariantId}.rule`);
    if ("failureCode" in sourceRule) requireEqual(item.failureCode, sourceRule.failureCode, `${sourceRule.invariantId}.failureCode`);
  }
  const knownGeneratedIds = new Set((generated.invariants ?? []).map((item) => item.generatedRuleId));
  for (const command of commandContracts?.commands ?? []) {
    for (const generatedRuleId of command.invariantRuleIds ?? []) {
      if (!knownGeneratedIds.has(generatedRuleId)) fail(`${command.command} references missing invariant ${generatedRuleId}.`);
    }
  }
}

writeResult({
  version: "oam.generated-business-invariants-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  generatedPath,
  invariantIds: generated?.invariants?.map((item) => item.generatedRuleId) ?? [],
  failures
});

if (failures.length) {
  console.error("Generated business invariants check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Generated business invariants check: PASS");

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
