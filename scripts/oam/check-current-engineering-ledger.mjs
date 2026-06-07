import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const ledgerPath = "docs/oam/current-engineering-ledger.json";
const reportPath = "artifacts/oam/checks/current-engineering-ledger-result.json";
const allowedIdentities = new Set([
  "authority_file",
  "implementation_file",
  "validation_file",
  "human_manual",
  "generated_evidence"
]);
const forbiddenPathPrefixes = [
  ["docs", "product"].join("/") + "/",
  ["docs", "review"].join("/") + "/",
  ["apps", "mobile", "artifacts"].join("/") + "/"
];
const requiredFields = [
  "path",
  "currentIdentity",
  "responsibilityScopeZh",
  "forbiddenScopeZh",
  "currentFactAuthorityAllowed",
  "upstreamSource",
  "downstreamConsumers",
  "owner",
  "gates",
  "evidence",
  "deletionConditionZh"
];

const violations = [];
const ledger = readJson(ledgerPath);
const currentFiles = listCurrentFiles();
const entries = ledger.files ?? [];
const entryByPath = new Map();

if (ledger.version !== "oam.current-engineering-ledger.v1") {
  fail("ledger_version_invalid", "工程总账必须声明 oam.current-engineering-ledger.v1。");
}
if (ledger.status !== "authoritative" || ledger.architecture !== "oam.current") {
  fail("ledger_identity_invalid", "工程总账必须绑定 authoritative + oam.current。");
}
if (ledger.authorityEntry !== "docs/oam/current-authority-index.json") {
  fail("ledger_authority_entry_invalid", "工程总账必须作为 current-authority-index 的下级入口。");
}
if (ledger.defaultPolicy !== "unregistered_files_are_not_allowed") {
  fail("ledger_default_policy_invalid", "工程总账必须声明未登记文件不允许存在。");
}

for (const entry of entries) {
  const normalized = slash(entry.path ?? "");
  if (!normalized) {
    fail("ledger_entry_path_missing", "工程总账存在空路径。");
    continue;
  }
  if (entryByPath.has(normalized)) {
    fail("ledger_entry_duplicate", `工程总账重复登记：${normalized}`);
  }
  entryByPath.set(normalized, entry);

  for (const field of requiredFields) {
    const value = entry[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      fail("ledger_entry_field_missing", `${normalized} 缺少 ${field}。`);
    }
  }
  if (!allowedIdentities.has(entry.currentIdentity)) {
    fail("ledger_identity_unknown", `${normalized} 使用未知身份：${entry.currentIdentity}`);
  }
  if (typeof entry.currentFactAuthorityAllowed !== "boolean") {
    fail("ledger_fact_authority_flag_invalid", `${normalized} 的 currentFactAuthorityAllowed 必须为布尔值。`);
  }
  if (!Array.isArray(entry.downstreamConsumers) || entry.downstreamConsumers.length === 0) {
    fail("ledger_consumers_missing", `${normalized} 必须绑定下游消费者。`);
  }
  if (!Array.isArray(entry.gates) || entry.gates.length === 0) {
    fail("ledger_gates_missing", `${normalized} 必须绑定门禁。`);
  }
  if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
    fail("ledger_evidence_missing", `${normalized} 必须绑定证据。`);
  }
  if (!fs.existsSync(abs(normalized))) {
    fail("ledger_path_missing", `工程总账登记文件不存在：${normalized}`);
  }
  for (const prefix of forbiddenPathPrefixes) {
    if (normalized.startsWith(prefix)) {
      fail("ledger_forbidden_path", `工程总账不得登记灰色路径：${normalized}`);
    }
  }
}

for (const file of currentFiles) {
  if (!entryByPath.has(file)) {
    fail("current_file_unregistered", `当前保留文件未进入工程总账：${file}`);
  }
}
for (const file of entryByPath.keys()) {
  if (!currentFiles.includes(file)) {
    fail("ledger_file_not_current", `工程总账登记了当前不存在或未保留的文件：${file}`);
  }
}

const factAuthorityFiles = entries.filter((entry) => entry.currentFactAuthorityAllowed === true);
for (const entry of factAuthorityFiles) {
  if (!entry.path.startsWith("docs/") && !entry.path.startsWith("infra/db/") && !entry.path.startsWith("schemas/") && !entry.path.startsWith("modules/")) {
    fail("fact_authority_outside_contract_area", `${entry.path} 不得定义当前事实。`);
  }
}

writeReport();

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`${violation.id}: ${violation.message}`);
  }
  process.exit(1);
}

console.log(`Current engineering ledger check: PASS (${currentFiles.length} files)`);

function listCurrentFiles() {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .map((item) => slash(item.trim()))
    .filter(Boolean)
    .filter((item) => !item.startsWith("artifacts/oam/checks/"))
    .filter((item) => !item.startsWith("artifacts/oam/evidence/"))
    .filter((item) => !item.startsWith("artifacts/oam/test-results/"))
    .filter((item) => item !== "artifacts/oam/final-report.json")
    .sort((a, b) => a.localeCompare(b));
}

function readJson(file) {
  if (!fs.existsSync(abs(file))) {
    fail("ledger_missing", `工程总账不存在：${file}`);
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("ledger_json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function writeReport() {
  const full = abs(reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.current-engineering-ledger-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length === 0 ? "passed" : "failed",
    currentFileCount: currentFiles.length,
    ledgerFileCount: entries.length,
    violationCount: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function abs(file) {
  return path.join(root, file);
}

function slash(value) {
  return value.replace(/\\/g, "/");
}
