import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = "docs/oam/current-authority-index.json";
const reportPath = "artifacts/oam/checks/current-authority-index-result.json";
const allowedEvidencePrefixes = [
  "artifacts/oam/evidence/",
  "artifacts/oam/checks/",
  "artifacts/oam/test-results/",
  "artifacts/oam/final-report.json"
];
const requiredCore = {
  currentArchitecture: "docs/oam/current-architecture.md",
  machineContract: "docs/contracts/oam.current.json",
  manifest: "docs/oam/current-architecture.manifest.json",
  systemMap: "docs/system/current-system-map.md"
};

const violations = [];
const index = readJson(indexPath);

if (index.version !== "oam.current-authority-index.v1") {
  fail("authority_index_version", "current-authority-index 必须声明 oam.current-authority-index.v1。");
}
if (index.status !== "authoritative" || index.architecture !== "oam.current") {
  fail("authority_index_identity", "current-authority-index 必须绑定 oam.current authoritative。");
}

for (const [key, expected] of Object.entries(requiredCore)) {
  if (index.coreAuthorities?.[key] !== expected) {
    fail("authority_core_mismatch", `核心权威 ${key} 必须指向 ${expected}。`);
  }
  requirePath(expected, `核心权威 ${key}`);
}

const entries = index.entries ?? [];
const entryPaths = new Set(entries.map((entry) => entry.path));
for (const expected of Object.values(requiredCore)) {
  if (!entryPaths.has(expected)) {
    fail("authority_core_entry_missing", `核心权威未登记为 entry: ${expected}`);
  }
}

for (const entry of entries) {
  for (const field of ["path", "identity", "owner", "checker", "evidence", "currentTruthAllowed", "notesZh"]) {
    if (!(field in entry) || entry[field] === "") {
      fail("authority_entry_field_missing", `${entry.path ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  requirePath(entry.path, `权威登记 ${entry.path}`);
  requirePath(entry.checker, `权威登记检查器 ${entry.checker}`);
  if (!allowedEvidencePrefixes.some((prefix) => entry.evidence?.startsWith(prefix))) {
    fail("authority_evidence_path_invalid", `${entry.path} 的 evidence 必须位于 OAM 证据目录: ${entry.evidence}`);
  }
}

for (const input of index.historicalDesignInputs ?? []) {
  requirePath(input.path, `历史设计输入 ${input.path}`);
  if (input.currentTruthAllowed !== false) {
    fail("historical_input_truth_allowed", `${input.path} 不得允许作为当前真值。`);
  }
  if (entryPaths.has(input.path)) {
    const currentEntry = entries.find((entry) => entry.path === input.path);
    if (currentEntry?.currentTruthAllowed) {
      fail("historical_input_current_authority", `${input.path} 不得同时登记为当前真值权威。`);
    }
  }
}

for (const item of index.readSideAllowedTerms ?? []) {
  for (const field of ["term", "allowedUseZh", "forbiddenUseZh"]) {
    if (!item[field]) {
      fail("read_side_term_incomplete", `读侧兼容术语缺少 ${field}。`);
    }
  }
}

writeReport();

if (violations.length) {
  for (const item of violations) {
    console.error(`${item.id}: ${item.message}`);
  }
  process.exit(1);
}

console.log("Current authority index check: PASS");

function readJson(file) {
  requirePath(file, file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function requirePath(file, label) {
  if (!file || !fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function writeReport() {
  const full = abs(reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify({
    checkedAt: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "fail" : "pass",
    violations
  }, null, 2));
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function abs(file) {
  return path.join(root, file);
}
