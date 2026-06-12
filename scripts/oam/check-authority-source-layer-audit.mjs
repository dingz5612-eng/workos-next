import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const auditPath = "artifacts/oam/authority-cleanup/source-layer-audit.json";
const lifecyclePolicyPath = "docs/oam/file-lifecycle-policy.json";
const lifecyclePolicy = readJson(lifecyclePolicyPath);
const lifecycleRegistry = lifecyclePolicy.fileLifecycleRegistry ?? {};
const allowedLayers = new Set(["source", "generated", "runtime", "evidence", "tooling", "release", "retired", "referenceOnly"]);
const requiredFields = [
  "path",
  "currentIdentity",
  "targetLayer",
  "fileLifecycle",
  "manualEditAllowed",
  "businessFactAuthorityAllowed",
  "contractAuthorityAllowed",
  "derived",
  "upstreamSource",
  "downstreamConsumers",
  "recommendedAction",
  "deletionRisk",
  "notesZh"
];
const failures = [];

if (!fs.existsSync(abs(auditPath))) {
  fail("audit_missing", `缺少权威层审计报告：${auditPath}`);
} else {
  const audit = readJson(auditPath);
  if (audit.version !== "authority-cleanup.source-layer-audit.v1") {
    fail("audit_version_invalid", "source-layer-audit.json 必须声明 authority-cleanup.source-layer-audit.v1。");
  }
  if (audit.fileLifecycleRegistry?.policyPath !== lifecyclePolicyPath) {
    fail("audit_lifecycle_registry_missing", "Source Layer Audit 必须绑定 File Lifecycle Registry。");
  }
  if (audit.fileLifecycleRegistry?.registryVersion !== "oam.file-lifecycle-registry.v1") {
    fail("audit_lifecycle_registry_version", "Source Layer Audit 必须绑定 oam.file-lifecycle-registry.v1。");
  }
  if (!Array.isArray(audit.entries) || audit.entries.length === 0) {
    fail("audit_entries_missing", "source-layer-audit.json 必须包含 entries。");
  }
  if (audit.unknownCount !== 0) {
    fail("audit_unknown_count", "权威层审计不得存在 unknown 结论。");
  }
  for (const field of [
    "sourceWhitelistUnique",
    "unknownCount",
    "derivedAsSourceCount",
    "generatedAsSourceCount",
    "businessFactAuthorityOutsideSourceCount",
    "generatedManualEditAllowedCount",
    "currentDecision",
    "blockingReasons"
  ]) {
    if (!(field in audit)) {
      fail("audit_decision_field_missing", `source-layer-audit.json 缺少机器裁决字段 ${field}。`);
    }
  }
  if (audit.sourceWhitelistUnique !== true) {
    fail("source_whitelist_not_unique", "current-authority-index 的 Source 白名单必须唯一生效。");
  }
  for (const field of [
    "unknownCount",
    "derivedAsSourceCount",
    "generatedAsSourceCount",
    "businessFactAuthorityOutsideSourceCount",
    "generatedManualEditAllowedCount"
  ]) {
    if (audit[field] !== 0) {
      fail("audit_blocking_count", `${field} 必须为 0，实际为 ${audit[field] ?? "missing"}。`);
    }
  }
  if (!["PASS", "FAIL"].includes(audit.currentDecision)) {
    fail("audit_current_decision_invalid", "currentDecision 只能是 PASS 或 FAIL。");
  }
  if (!Array.isArray(audit.blockingReasons)) {
    fail("audit_blocking_reasons_invalid", "blockingReasons 必须是数组。");
  }
  if (audit.currentDecision !== "PASS") {
    fail("audit_current_decision_fail", `Source Layer 审计未通过：${(audit.blockingReasons ?? []).join("; ")}`);
  }
  if (audit.currentDecision === "PASS" && Array.isArray(audit.blockingReasons) && audit.blockingReasons.length > 0) {
    fail("audit_pass_with_blockers", "currentDecision=PASS 时 blockingReasons 必须为空。");
  }

  const paths = new Set();
  const lifecycleByPath = new Map();
  for (const entry of audit.entries ?? []) {
    for (const field of requiredFields) {
      if (!(field in entry) || entry[field] === "" || entry[field] === "unknown") {
        fail("audit_entry_field_missing", `${entry.path ?? "<missing>"} 缺少有效字段 ${field}。`);
      }
    }
    if (paths.has(entry.path)) fail("audit_duplicate_path", `审计路径重复：${entry.path}`);
    paths.add(entry.path);
    if (!allowedLayers.has(entry.targetLayer)) {
      fail("audit_layer_invalid", `${entry.path} 的目标层非法：${entry.targetLayer}`);
    }
    if (!allowedLayers.has(entry.fileLifecycle)) {
      fail("audit_lifecycle_invalid", `${entry.path} 的 fileLifecycle 非法：${entry.fileLifecycle}`);
    }
    if (entry.fileLifecycle !== entry.targetLayer) {
      fail("audit_lifecycle_layer_mismatch", `${entry.path} 的 fileLifecycle 必须与 targetLayer 保持一致，避免路径层与生命周期双重解释。`);
    }
    if (lifecycleByPath.has(entry.path)) {
      fail("audit_lifecycle_duplicate", `${entry.path} 存在重复生命周期声明。`);
    }
    lifecycleByPath.set(entry.path, entry.fileLifecycle);
    for (const field of ["manualEditAllowed", "businessFactAuthorityAllowed", "contractAuthorityAllowed", "derived"]) {
      if (typeof entry[field] !== "boolean") {
        fail("audit_boolean_invalid", `${entry.path} 的 ${field} 必须是布尔值。`);
      }
    }
    if (!Array.isArray(entry.downstreamConsumers)) {
      fail("audit_consumers_invalid", `${entry.path} 的 downstreamConsumers 必须是数组。`);
    }
    if (entry.derived === true && entry.businessFactAuthorityAllowed === true) {
      fail("derived_business_authority", `${entry.path} 是派生文件，不得拥有业务事实权威。`);
    }
    if (["generated", "runtime", "evidence", "release", "retired", "referenceOnly"].includes(entry.targetLayer) && entry.businessFactAuthorityAllowed === true) {
      fail("non_source_business_authority", `${entry.path} 不在 Source Layer，不得拥有业务事实权威。`);
    }
    if (entry.targetLayer === "source" && !((audit.sourceWhitelist ?? []).includes(entry.path))) {
      fail("source_not_in_whitelist", `${entry.path} 不是 Source 白名单成员，不得声明 source 生命周期。`);
    }
    if (entry.targetLayer === "generated" && entry.manualEditAllowed !== false) {
      fail("generated_manual_edit_allowed", `${entry.path} 是 generated，manualEditAllowed 必须为 false。`);
    }
    if (entry.targetLayer === "generated" && !hasGeneratedBoundaryMarker(entry.path)) {
      fail("generated_marker_missing", `${entry.path} 是 generated，必须声明 doNotEdit / generatedBy / derivedFrom / generatedFrom 边界标记。`);
    }
    if (entry.targetLayer === "tooling" && entry.businessFactAuthorityAllowed === true) {
      fail("tooling_business_authority", `${entry.path} 是 Tooling，不得拥有业务事实权威。`);
    }
    if (/^scripts\//.test(entry.path) && entry.targetLayer === "generated" && entry.manualEditAllowed === false) {
      fail("tooling_misclassified_generated", `${entry.path} 是人工维护脚本，不得被误判为 generated 禁手改文件。`);
    }
    if (/^scripts\//.test(entry.path) && entry.manualEditAllowed !== true) {
      fail("tooling_manual_edit_forbidden", `${entry.path} 是人工维护脚本，manualEditAllowed 必须为 true。`);
    }
    if (/^artifacts\//.test(entry.path) && entry.targetLayer === "source") {
      fail("artifact_as_source", `${entry.path} 是 artifact，不得成为 Source。`);
    }
    if (entry.scanReasons?.includes("controlled-old-term-scan") &&
      entry.controlledOldTermUse !== true &&
      !String(entry.recommendedAction).includes("review_old_term_fence_or_remove")) {
      fail("old_term_without_action", `${entry.path} 含旧词但缺少 fence 或删除复核动作。`);
    }
    if (!/[\u4e00-\u9fff]/.test(entry.notesZh ?? "")) {
      fail("audit_notes_not_chinese", `${entry.path} 必须包含中文说明。`);
    }
  }
}

const requiredRegistryLifecycles = ["source", "generated", "tooling", "runtime", "evidence", "release", "retired", "referenceOnly"];
if (!sameSet(Object.keys(lifecycleRegistry.canonicalLifecycles ?? {}), requiredRegistryLifecycles)) {
  fail("lifecycle_registry_incomplete", "File Lifecycle Registry 必须定义八类 canonical lifecycle。");
}

if (failures.length > 0) {
  console.error("Authority source layer audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure.id}: ${failure.message}`);
  process.exit(1);
}

console.log("Authority source layer audit check: PASS");

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), "utf8"));
}

function hasGeneratedBoundaryMarker(file) {
  try {
    const text = fs.readFileSync(abs(file), "utf8");
    return /\b(doNotEdit|generatedBy|generatedFrom|derivedFrom)\b/.test(text);
  } catch {
    return false;
  }
}

function sameSet(left, right) {
  return JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());
}

function fail(id, message) {
  failures.push({ id, message });
}

function abs(file) {
  return path.join(root, file);
}
