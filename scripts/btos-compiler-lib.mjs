import fs from "node:fs";
import path from "node:path";

export const repoRoot = process.cwd();
export const positiveFixtureRoot = "tests/fixtures/rt2-btos-compiler/positive";
export const negativeFixtureRoot = "tests/fixtures/rt2-btos-compiler/negative";

export function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const option = arg.slice(2);
    const eq = option.indexOf("=");
    if (eq === -1) {
      flags.add(option);
    } else {
      values.set(option.slice(0, eq), option.slice(eq + 1));
    }
  }
  return {
    has: (name) => flags.has(name),
    value: (name, fallback) => values.get(name) ?? fallback
  };
}

export function readDocument(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(fullPath, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${relativePath} must be JSON-compatible YAML: ${error.message}`);
  }
}

export function listDocuments(relativeDir) {
  const fullDir = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(fullDir)) return [];
  return fs.readdirSync(fullDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(json|ya?ml)$/i.test(entry.name))
    .map((entry) => path.join(relativeDir, entry.name).replace(/\\/g, "/"))
    .sort();
}

export function loadTruthRegistry(relativePath = "docs/business/truth-owner-registry.yml") {
  const registry = readDocument(relativePath);
  const centerTruthFacts = new Set();
  const ownersByFact = new Map();
  for (const entry of registry.truthOwners ?? []) {
    ownersByFact.set(entry.factId, entry);
    if (entry.truthLevel === "centerTruth") centerTruthFacts.add(entry.factId);
  }
  return { registry, centerTruthFacts, ownersByFact };
}

export function validateRequiredObject(value, requiredFields, file) {
  const violations = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [violation("schema.invalid", file, "Document must be an object.")];
  }
  for (const field of requiredFields) {
    if (!(field in value)) {
      violations.push(violation("schema.missing_field", file, `Missing required field: ${field}`));
    }
  }
  return violations;
}

export function violation(id, file, message, extra = {}) {
  return {
    severity: "P0",
    id,
    file,
    message,
    ...extra
  };
}

export function writeReport(outFile, checkName, violations, scannedFiles) {
  const fullPath = path.join(repoRoot, outFile);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const report = {
    generated_at_utc: new Date().toISOString(),
    generated_by: checkName,
    status: violations.length === 0 ? "passed" : "failed",
    scanned_files: scannedFiles,
    violation_count: violations.length,
    violations
  };
  fs.writeFileSync(fullPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function failIfViolations(checkName, violations) {
  if (violations.length === 0) return;
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message} (${item.file})`);
  }
  throw new Error(`${checkName} failed.`);
}

export function assertSelfTest(condition, message) {
  if (!condition) {
    throw new Error(`BTOS compiler self-test failed: ${message}`);
  }
}
