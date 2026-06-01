import fs from "node:fs";
import path from "node:path";

export const root = process.cwd();
export const artifactPath = "artifacts/business/dormitory/business-semantic-contract-result.json";
export const requiredScenarioIds = Array.from({ length: 10 }, (_, index) => `dorm-cert-${String(index + 1).padStart(3, "0")}`);
export const allCheckIds = [
  "scenario-field-contract",
  "canonical-scenario-map",
  "evidence-coverage-contract",
  "ledger-posting-contract",
  "metric-formula-contract"
];

export function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing required file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

export function asSet(items) {
  return new Set(Array.isArray(items) ? items : []);
}

export function includesAll(container, expected) {
  const set = asSet(container);
  return expected.filter((item) => !set.has(item));
}

export function indexBy(items, key) {
  const map = new Map();
  for (const item of items ?? []) {
    if (item?.[key]) map.set(item[key], item);
  }
  return map;
}

export function validateSchemaFile(relativePath, requiredTopLevelKeys) {
  const schema = readJson(relativePath);
  const missing = requiredTopLevelKeys.filter((key) => !(key in schema));
  return missing.map((key) => violation("schema_key_missing", `${relativePath} 缺少 schema 顶层字段 ${key}。`, { file: relativePath, key }));
}

export function writeCheckResult(checkId, violations, scannedFiles) {
  const fullPath = path.join(root, artifactPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  let existing = {
    version: "oam-02.business-semantic-contract-result.v1",
    domain: "dormitory",
    productionAllowed: false,
    checks: {}
  };
  if (fs.existsSync(fullPath)) {
    existing = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  }

  existing.generated_at_utc = new Date().toISOString();
  existing.generated_by = "OAM-02 business semantic contract checkers";
  existing.productionAllowed = false;
  existing.checks ??= {};
  existing.checks[checkId] = {
    status: violations.length === 0 ? "passed" : "failed",
    violationCount: violations.length,
    scannedFiles,
    violations
  };
  existing.requiredChecks = allCheckIds;
  existing.missingChecks = allCheckIds.filter((id) => !existing.checks[id]);
  existing.status = existing.missingChecks.length === 0 && allCheckIds.every((id) => existing.checks[id]?.status === "passed")
    ? "passed"
    : violations.length === 0
      ? "partial"
      : "failed";

  fs.writeFileSync(fullPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
}

export function failIfViolations(checkId, violations, scannedFiles) {
  writeCheckResult(checkId, violations, scannedFiles);
  if (violations.length > 0) {
    for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
    throw new Error(`${checkId} failed.`);
  }
  console.log(`${checkId}: PASS`);
}

export function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

export function requireValue(condition, violations, id, message, extra = {}) {
  if (!condition) violations.push(violation(id, message, extra));
}
