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
const forbiddenIdentityClasses = new Set(["historical_design_input", "deprecated_file"]);
const forbiddenGreyPaths = [
  ["docs", "product"].join("/"),
  ["docs", "review"].join("/"),
  ["docs", "decisions", "ADR-0001-phase-0-1-bootstrap.md"].join("/"),
  ["docs", "oam", "final-acceptance-report.md"].join("/"),
  ["docs", "oam", "review-defect-record.md"].join("/"),
  ["docs", "oam", "mobile-refactor-readiness-plan.md"].join("/"),
  ["docs", "system", "oam-warning-baseline.md"].join("/"),
  ["docs", "oam", "certification-scenarios.json"].join("/"),
  ["docs", "oam", "dormitory-certification-scenarios.json"].join("/"),
  ["docs", "business", "dormitory", "certification-scenarios.json"].join("/")
];

const violations = [];
const index = readJson(indexPath);

if (index.version !== "oam.current-authority-index.v1") {
  fail("authority_index_version", "current-authority-index 必须声明 oam.current-authority-index.v1。");
}
if (index.status !== "authoritative" || index.architecture !== "oam.current") {
  fail("authority_index_identity", "current-authority-index 必须绑定 oam.current authoritative。");
}
for (const identity of index.identityClasses ?? []) {
  if (forbiddenIdentityClasses.has(identity)) {
    fail("grey_identity_class_present", `当前权威索引不得声明灰色身份类别：${identity}。`);
  }
}
if ("historicalDesignInputs" in index) {
  fail("historical_input_bucket_present", "当前权威索引不得保留 historicalDesignInputs；可用内容必须吸收进当前权威后删除原来源。");
}
if ("deprecatedFiles" in index) {
  fail("deprecated_file_bucket_present", "当前权威索引不得保留 deprecatedFiles；不能证明服务当前 OAM 的文件必须直接删除。");
}
for (const item of forbiddenGreyPaths) {
  if (fs.existsSync(abs(item))) {
    fail("grey_path_present", `当前项目不得保留灰色历史/旧报告/重复场景路径：${item}。`);
  }
}

for (const [key, expected] of Object.entries(requiredCore)) {
  if (index.coreAuthorities?.[key] !== expected) {
    fail("authority_core_mismatch", `核心权威 ${key} 必须指向 ${expected}。`);
  }
  requirePath(expected, `核心权威 ${key}`);
}

const entries = index.entries ?? [];
const entryPaths = new Set(entries.map((entry) => entry.path));
const identityClasses = new Set(index.identityClasses ?? []);
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
  requirePath(entry.path, `权威登记 ${entry.path}`, { allowGeneratedEvidence: true });
  requirePath(entry.checker, `权威登记检查器 ${entry.checker}`);
  if (!identityClasses.has(entry.identity)) {
    fail("authority_entry_identity_unknown", `${entry.path} 使用了未登记的身份类别：${entry.identity}。`);
  }
  if (typeof entry.currentTruthAllowed !== "boolean") {
    fail("authority_entry_truth_flag_invalid", `${entry.path} 的 currentTruthAllowed 必须是布尔值。`);
  }
  if (!allowedEvidencePrefixes.some((prefix) => entry.evidence?.startsWith(prefix))) {
    fail("authority_evidence_path_invalid", `${entry.path} 的 evidence 必须位于 OAM 证据目录: ${entry.evidence}`);
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

function requirePath(file, label, options = {}) {
  if (options.allowGeneratedEvidence && isGeneratedEvidencePath(file)) {
    return;
  }
  if (!file || !fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function isGeneratedEvidencePath(file) {
  return typeof file === "string" && (
    file === "artifacts/oam/evidence" ||
    file.startsWith("artifacts/oam/evidence/") ||
    file.startsWith("artifacts/oam/checks/") ||
    file.startsWith("artifacts/oam/test-results/") ||
    file === "artifacts/oam/final-report.json"
  );
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
