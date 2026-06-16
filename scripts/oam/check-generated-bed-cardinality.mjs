import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authorityPath = "docs/business/domains/dormitory/dormitory-bed-cardinality.authority.json";
const generatedPath = "docs/contracts/generated/dormitory/bed-cardinality.generated.json";
const resultPath = "artifacts/oam/checks/generated-bed-cardinality-result.json";
const failures = [];
const authority = readJson(authorityPath);
const generated = readJson(generatedPath);

if (authority && generated) {
  checkGeneratedMetadata(generatedPath, generated);
  requireEqual(generated.sourceAuthorityRefs?.bedCardinalityAuthority, authorityPath, "sourceAuthorityRefs.bedCardinalityAuthority");
  requireEqual(generated.canonicalBedQuantity, authority.canonicalBedQuantity, "canonicalBedQuantity");
  requireArrayExact(generated.acceptedInputAliases, authority.acceptedInputAliases, "acceptedInputAliases");
  requireEqual(JSON.stringify(generated.authorityBoundaries), JSON.stringify(authority.authorityBoundaries), "authorityBoundaries");
  const expectedIds = (authority.cardinalityRules ?? []).map((item) => item.ruleId);
  const generatedIds = (generated.rules ?? []).map((item) => item.sourceRuleId);
  requireArrayExact(generatedIds, expectedIds, "generated cardinality sourceRuleId");
  const generatedById = new Map((generated.rules ?? []).map((item) => [item.sourceRuleId, item]));
  for (const sourceRule of authority.cardinalityRules ?? []) {
    const item = generatedById.get(sourceRule.ruleId);
    if (!item) continue;
    requireEqual(item.generatedRuleId, `dormitory.bed_cardinality.${safeRuleToken(sourceRule.ruleId)}`, `${sourceRule.ruleId}.generatedRuleId`);
    requireEqual(item.sourceAuthorityRef, authorityPath, `${sourceRule.ruleId}.sourceAuthorityRef`);
    for (const [key, value] of Object.entries(sourceRule)) {
      requireEqual(JSON.stringify(item[key]), JSON.stringify(value), `${sourceRule.ruleId}.${key}`);
    }
  }
  const blockedRule = generatedById.get("resource_readiness_blocked_until_complete_bed_set");
  requireEqual(blockedRule?.blockedCommand, "Dorm.ResourceReadinessConfirm", "resource_readiness_blocked_until_complete_bed_set.blockedCommand");
  requireEqual(blockedRule?.failureCode, "bed_count_not_satisfied", "resource_readiness_blocked_until_complete_bed_set.failureCode");
}

writeResult({
  version: "oam.generated-bed-cardinality-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityPath,
  generatedPath,
  ruleIds: generated?.rules?.map((item) => item.generatedRuleId) ?? [],
  failures
});

if (failures.length) {
  console.error("Generated bed cardinality check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Generated bed cardinality check: PASS");

function checkGeneratedMetadata(file, document) {
  if (document.generated !== true) fail(`${file} must include generated=true.`);
  if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
  if (document.generatedBy !== "scripts/oam/compile-current-capability.mjs") fail(`${file} must be compiler generated.`);
  if (document.capabilityId !== "Dormitory.FirstGoldenChain") fail(`${file} must bind Dormitory.FirstGoldenChain.`);
  const expectedDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedDigest) fail(`${file} outputContentDigest mismatch.`);
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label} must be ${expected}, actual ${actual}.`);
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
