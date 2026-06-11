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
const allowedLayers = new Set(["source", "generated", "runtime", "evidence", "manual"]);
const allowedAuthorityRoles = new Set([
  "architectureRoot",
  "sourceKernel",
  "policySource",
  "generatedContract",
  "validationSchema",
  "runtimeImplementation",
  "databaseAsset",
  "evidenceProof",
  "humanManual"
]);
const requiredClassificationFields = [
  "layer",
  "authorityRole",
  "businessFactAuthorityAllowed",
  "contractAuthorityAllowed",
  "runtimeWriteAllowed",
  "financeLedgerTruthAllowed",
  "readModelTruthAllowed",
  "manualEditAllowed",
  "generated",
  "doNotEdit",
  "checkerRef",
  "evidenceRef",
  "responsibilityZh"
];
const businessFactForbiddenPrefixes = [
  "apps/",
  "artifacts/oam/",
  "docs/contracts/admission/",
  "docs/contracts/bi-kpi/",
  "docs/contracts/business/",
  "docs/contracts/definition/",
  "docs/contracts/evidence/",
  "docs/contracts/generated/",
  "docs/contracts/read/",
  "docs/contracts/search/",
  "infra/db/migrations",
  "schemas/",
  "scripts/",
  "services/",
  "tests/"
];

const violations = [];
const index = readJson(indexPath);

if (index.version !== "oam.current-authority-index.v1") {
  fail("authority_index_version", "current-authority-index 必须声明 oam.current-authority-index.v1。");
}
if (index.status !== "authoritative" || index.architecture !== "oam.current") {
  fail("authority_index_identity", "current-authority-index 必须绑定 oam.current authoritative。");
}
checkClassificationModel();
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
const sourceWhitelist = new Set((index.classificationModel?.sourceLayerWhitelist ?? []).map((item) => slash(item)));
const declaredSourceWhitelist = new Set((index.sourceLayerWhitelist ?? []).map((item) => slash(item.path)));
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
  checkEntryClassification(entry);
  if (!allowedEvidencePrefixes.some((prefix) => entry.evidence?.startsWith(prefix))) {
    fail("authority_evidence_path_invalid", `${entry.path} 的 evidence 必须位于 OAM 证据目录: ${entry.evidence}`);
  }
}

for (const item of sourceWhitelist) {
  if (!declaredSourceWhitelist.has(item)) {
    fail("source_whitelist_mirror_missing", `sourceLayerWhitelist 缺少镜像登记：${item}`);
  }
  const entry = entries.find((candidate) => candidate.path === item);
  if (!entry) {
    fail("source_whitelist_entry_missing", `Source 白名单未登记 entry：${item}`);
  } else if (entry.layer !== "source") {
    fail("source_whitelist_layer_mismatch", `Source 白名单文件必须归入 source：${item}`);
  }
}
for (const entry of entries.filter((item) => item.layer === "source")) {
  if (!sourceWhitelist.has(entry.path)) {
    fail("source_layer_not_whitelisted", `Source Layer 只能来自唯一白名单：${entry.path}`);
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

function checkClassificationModel() {
  const model = index.classificationModel ?? {};
  if (model.version !== "oam.authority-classification.v1" || model.status !== "authoritative") {
    fail("classification_model_missing", "current-authority-index 必须声明 oam.authority-classification.v1 分类模型。");
  }
  if (!String(model.decisionRuleZh ?? "").includes("currentTruthAllowed 仅作为兼容派生字段")) {
    fail("classification_model_rule_missing", "分类模型必须声明 currentTruthAllowed 仅作为兼容派生字段。");
  }
  for (const layer of ["source", "generated", "runtime", "evidence", "manual"]) {
    if (!(model.layers ?? []).includes(layer)) fail("classification_model_layer_missing", `分类模型缺少 layer：${layer}`);
  }
  for (const role of allowedAuthorityRoles) {
    if (!(model.authorityRoles ?? []).includes(role)) fail("classification_model_role_missing", `分类模型缺少 authorityRole：${role}`);
  }
  if (!Array.isArray(model.sourceLayerWhitelist) || model.sourceLayerWhitelist.length === 0) {
    fail("source_whitelist_missing", "分类模型必须声明 Source Layer 唯一白名单。");
  }
}

function checkEntryClassification(entry) {
  for (const field of requiredClassificationFields) {
    if (!(field in entry) || entry[field] === "" || entry[field] === null || entry[field] === undefined) {
      fail("authority_classification_field_missing", `${entry.path} 缺少分类字段 ${field}。`);
    }
  }
  if (!allowedLayers.has(entry.layer)) {
    fail("authority_layer_invalid", `${entry.path} 使用未知 layer：${entry.layer}`);
  }
  if (!allowedAuthorityRoles.has(entry.authorityRole)) {
    fail("authority_role_invalid", `${entry.path} 使用未知 authorityRole：${entry.authorityRole}`);
  }
  for (const field of [
    "businessFactAuthorityAllowed",
    "contractAuthorityAllowed",
    "runtimeWriteAllowed",
    "financeLedgerTruthAllowed",
    "readModelTruthAllowed",
    "manualEditAllowed",
    "generated",
    "doNotEdit"
  ]) {
    if (typeof entry[field] !== "boolean") {
      fail("authority_classification_boolean_invalid", `${entry.path} 的 ${field} 必须是布尔值。`);
    }
  }
  if (!hasChinese(entry.responsibilityZh) || !hasChinese(entry.notesZh)) {
    fail("authority_chinese_note_missing", `${entry.path} 必须提供中文职责说明和说明字段。`);
  }
  if (entry.generated === true || entry.layer === "generated") {
    if (entry.layer !== "generated" || entry.doNotEdit !== true || entry.manualEditAllowed !== false) {
      fail("generated_classification_invalid", `${entry.path} 作为 generated 文件必须 layer=generated、doNotEdit=true、manualEditAllowed=false。`);
    }
    if (!Array.isArray(entry.generatedFrom) || entry.generatedFrom.length === 0) {
      fail("generated_source_missing", `${entry.path} 作为 generated 文件必须声明 generatedFrom。`);
    }
    if (entry.businessFactAuthorityAllowed !== false || entry.currentTruthAllowed !== false) {
      fail("generated_truth_forbidden", `${entry.path} 是 generated/derived 文件，不能拥有业务事实权威或 currentTruthAllowed=true。`);
    }
  } else if (!Array.isArray(entry.sourceRefs) || entry.sourceRefs.length === 0) {
    fail("source_refs_missing", `${entry.path} 必须声明 sourceRefs 或 generatedFrom。`);
  }
  if (entry.layer === "source") {
    if (entry.generated === true || entry.doNotEdit === true || "generatedFrom" in entry) {
      fail("source_generated_marker_forbidden", `${entry.path} 是 Source 文件，不得声明 generated/doNotEdit/generatedFrom。`);
    }
    if (entry.currentTruthAllowed !== true) {
      fail("source_compat_truth_invalid", `${entry.path} 是 Source 文件，兼容 currentTruthAllowed 必须为 true。`);
    }
    checkSourceTopLevelGeneratedMarkers(entry.path);
  } else if (entry.currentTruthAllowed !== false) {
    fail("non_source_compat_truth_invalid", `${entry.path} 非 Source 文件，兼容 currentTruthAllowed 必须为 false。`);
  }
  if (entry.businessFactAuthorityAllowed === true && businessFactForbiddenPrefixes.some((prefix) => entry.path.startsWith(prefix))) {
    fail("business_fact_authority_forbidden_path", `${entry.path} 不得拥有 businessFactAuthorityAllowed=true。`);
  }
  if (entry.financeLedgerTruthAllowed === true && entry.path !== "docs/finance/finance-ledger-kernel.json") {
    fail("finance_ledger_truth_owner_invalid", `${entry.path} 不得拥有 financeLedgerTruthAllowed=true。`);
  }
  if (entry.readModelTruthAllowed === true && entry.path !== "docs/read-intelligence/read-intelligence-kernel.json") {
    fail("read_model_truth_owner_invalid", `${entry.path} 不得拥有 readModelTruthAllowed=true。`);
  }
  if (entry.evidenceRef !== entry.evidence || entry.checkerRef !== entry.checker) {
    fail("authority_ref_mismatch", `${entry.path} checkerRef/evidenceRef 必须与 checker/evidence 一致。`);
  }
}

function checkSourceTopLevelGeneratedMarkers(file) {
  if (!fs.existsSync(abs(file)) || !file.endsWith(".json")) return;
  try {
    const doc = JSON.parse(fs.readFileSync(abs(file), "utf8"));
    for (const marker of ["generatedBy", "derivedFrom", "generated", "doNotEdit"]) {
      if (Object.prototype.hasOwnProperty.call(doc, marker)) {
        fail("source_top_level_generated_marker", `${file} 是 Source 文件，顶层不得声明 ${marker}。`);
      }
    }
  } catch {
    return;
  }
}

function hasChinese(value) {
  return /[\u3400-\u9fff]/.test(String(value ?? ""));
}

function slash(value) {
  return String(value ?? "").replace(/\\/g, "/");
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
