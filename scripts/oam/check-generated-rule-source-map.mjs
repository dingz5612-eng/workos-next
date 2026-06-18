import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/generated-rule-source-map-result.json";
const ruleSourceMapPath = "docs/contracts/generated/dormitory/rule-source-map.generated.json";
const generatedSources = [
  ["object_identity", "docs/contracts/generated/dormitory/object-identity.generated.json", "objectRules"],
  ["bed_cardinality", "docs/contracts/generated/dormitory/bed-cardinality.generated.json", "rules"],
  ["business_invariant", "docs/contracts/generated/dormitory/business-invariants.generated.json", "invariants"],
  ["command_contract", "docs/contracts/generated/dormitory/command-contracts.generated.json", "commands"],
  ["failure_semantics", "docs/contracts/generated/dormitory/failure-semantics.generated.json", "failureSemantics"]
];
const requiredAuthorityRefs = [
  "docs/business/domains/dormitory/dormitory-first-golden-chain.capability-decision.authority.json",
  "docs/business/domains/dormitory/dormitory-object-graph.authority.json",
  "docs/business/domains/dormitory/dormitory-bed-cardinality.authority.json",
  "docs/business/domains/dormitory/dormitory-invariants.authority.json",
  "docs/business/domains/dormitory/dormitory-command-contracts.authority.json",
  "docs/business/domains/dormitory/dormitory-failure-semantics.authority.json"
];
const failures = [];
const ruleSourceMap = readJson(ruleSourceMapPath);
const sourceDocuments = generatedSources.map(([type, file, listKey]) => ({ type, file, listKey, document: readJson(file) }));

if (ruleSourceMap) {
  checkGeneratedMetadata(ruleSourceMapPath, ruleSourceMap);
  const authorityRefs = new Set(Object.values(ruleSourceMap.sourceAuthorityRefs ?? {}));
  for (const ref of requiredAuthorityRefs) {
    if (!authorityRefs.has(ref)) fail(`rule source map missing authority ref ${ref}.`);
  }
  const expectedEntries = [];
  for (const source of sourceDocuments) {
    for (const rule of source.document?.[source.listKey] ?? []) {
      expectedEntries.push({
        generatedRuleId: rule.generatedRuleId,
        ruleType: source.type,
        sourceAuthorityRef: rule.sourceAuthorityRef,
        sourceRuleId: rule.sourceRuleId,
        generatedOutputRef: source.file
      });
    }
  }
  const actualEntries = ruleSourceMap.sourceMapEntries ?? [];
  const actualByRuleId = new Map(actualEntries.map((item) => [item.generatedRuleId, item]));
  requireArrayExact(
    [...actualByRuleId.keys()].sort(),
    expectedEntries.map((item) => item.generatedRuleId).sort(),
    "sourceMapEntries.generatedRuleId"
  );
  for (const expected of expectedEntries) {
    const actual = actualByRuleId.get(expected.generatedRuleId);
    if (!actual) continue;
    for (const [key, value] of Object.entries(expected)) {
      if (actual[key] !== value) fail(`${expected.generatedRuleId}.${key} must be ${value}, actual ${actual[key]}.`);
    }
    if (actual.acceptedGeneratedBundleDigest !== ruleSourceMap.acceptedGeneratedBundleDigest) {
      fail(`${expected.generatedRuleId}.acceptedGeneratedBundleDigest must match rule source map.`);
    }
  }
  const expectedTotal = expectedEntries.length;
  if (ruleSourceMap.ruleCounts?.total !== expectedTotal) fail(`ruleCounts.total must be ${expectedTotal}.`);
  if (actualEntries.length !== new Set(actualEntries.map((item) => item.generatedRuleId)).size) fail("sourceMapEntries must not contain duplicate generatedRuleId.");
}

writeResult({
  version: "oam.generated-rule-source-map-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  ruleSourceMapPath,
  generatedSources: generatedSources.map(([, file]) => file),
  sourceMapEntryCount: ruleSourceMap?.sourceMapEntries?.length ?? 0,
  failures
});

if (failures.length) {
  console.error("Generated rule source map check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Generated rule source map check: PASS");

function checkGeneratedMetadata(file, document) {
  if (document.generated !== true) fail(`${file} must include generated=true.`);
  if (document.doNotEdit !== true) fail(`${file} must include doNotEdit=true.`);
  if (document.generatedBy !== "scripts/oam/compile-current-capability.mjs") fail(`${file} must be compiler generated.`);
  if (document.capabilityId !== "Dormitory.FirstGoldenChain") fail(`${file} must bind Dormitory.FirstGoldenChain.`);
  const expectedDigest = stableDigest({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedDigest) fail(`${file} outputContentDigest mismatch.`);
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

function fail(message) {
  failures.push(message);
}
