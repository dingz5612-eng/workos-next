import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/no-dormitory-business-rule-outside-generated-result.json";
const generatedDocs = [
  ["objectIdentity", "docs/contracts/generated/dormitory/object-identity.generated.json", "objectRules"],
  ["bedCardinality", "docs/contracts/generated/dormitory/bed-cardinality.generated.json", "rules"],
  ["businessInvariants", "docs/contracts/generated/dormitory/business-invariants.generated.json", "invariants"],
  ["commandContracts", "docs/contracts/generated/dormitory/command-contracts.generated.json", "commands"],
  ["failureSemantics", "docs/contracts/generated/dormitory/failure-semantics.generated.json", "failureSemantics"],
  ["ruleSourceMap", "docs/contracts/generated/dormitory/rule-source-map.generated.json", "sourceMapEntries"]
];
const consumerDocs = [
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
  "apps/mobile/src/generated/oam/capability-projection.generated.json",
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json",
  "docs/contracts/generated/dormitory/db-projection-policy.generated.json",
  "docs/contracts/generated/dormitory/test-plan.generated.json"
];
const scanRoots = [
  "apps/mobile/src",
  "services/core-api/WorkOS.Api/Runtime"
];
const failures = [];
const knownRuleIds = new Set();
const generatedByKey = new Map();

for (const [key, file, listKey] of generatedDocs) {
  const document = readJson(file);
  generatedByKey.set(key, { file, document });
  for (const rule of document?.[listKey] ?? []) {
    if (rule.generatedRuleId) knownRuleIds.add(rule.generatedRuleId);
  }
}
for (const file of consumerDocs) {
  const document = readJson(file);
  if (!document) continue;
  const refs = document.generatedBusinessRuleRefs;
  if (!refs) {
    fail(`${file} must carry generatedBusinessRuleRefs.`);
    continue;
  }
  for (const [key, generated] of generatedByKey) {
    if (refs[key]?.ref !== generated.file) fail(`${file} generatedBusinessRuleRefs.${key}.ref must be ${generated.file}.`);
    for (const ruleId of refs[key]?.ruleIds ?? []) {
      if (!knownRuleIds.has(ruleId)) fail(`${file} references unknown generated business rule ${ruleId}.`);
    }
  }
}
for (const scanRoot of scanRoots) {
  for (const file of listFiles(path.join(root, scanRoot))) {
    const normalized = file.replace(/\\/g, "/");
    if (/\.generated\.(json|ts|tsx|js|cs)$/i.test(normalized)) continue;
    if (!/\.(cs|ts|tsx|js|jsx|json)$/i.test(normalized)) continue;
    const text = fs.readFileSync(file, "utf8");
    const matches = text.match(/dormitory\.(object_identity|bed_cardinality|business_invariant|command_contract|failure_semantics)\.[a-z0-9_]+/g) ?? [];
    for (const match of matches) fail(`${path.relative(root, file)} hardcodes generated business rule ${match}.`);
  }
}

writeResult({
  version: "oam.no-dormitory-business-rule-outside-generated-check.v1",
  status: failures.length === 0 ? "PASS" : "NO_GO",
  knownGeneratedRuleCount: knownRuleIds.size,
  consumerDocs,
  scannedRoots: scanRoots,
  failures
});

if (failures.length) {
  console.error("No dormitory business rule outside generated check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("No dormitory business rule outside generated check: PASS");

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

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return entry.isFile() ? [full] : [];
  });
}

function writeResult(result) {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({ ...result, checkedAtUtc: new Date().toISOString() }, null, 2)}\n`, "utf8");
}

function fail(message) {
  failures.push(message);
}
