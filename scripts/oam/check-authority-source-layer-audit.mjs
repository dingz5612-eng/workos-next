import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const auditPath = "artifacts/oam/authority-cleanup/source-layer-audit.json";
const allowedLayers = new Set(["source", "generated", "runtime", "evidence", "manual"]);
const requiredFields = [
  "path",
  "currentIdentity",
  "targetLayer",
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
  if (!Array.isArray(audit.entries) || audit.entries.length === 0) {
    fail("audit_entries_missing", "source-layer-audit.json 必须包含 entries。");
  }
  if (audit.unknownCount !== 0) {
    fail("audit_unknown_count", "权威层审计不得存在 unknown 结论。");
  }

  const paths = new Set();
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
    if (["generated", "runtime", "evidence"].includes(entry.targetLayer) && entry.businessFactAuthorityAllowed === true) {
      fail("non_source_business_authority", `${entry.path} 不在 Source Layer，不得拥有业务事实权威。`);
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

if (failures.length > 0) {
  console.error("Authority source layer audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure.id}: ${failure.message}`);
  process.exit(1);
}

console.log("Authority source layer audit check: PASS");

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), "utf8"));
}

function fail(id, message) {
  failures.push({ id, message });
}

function abs(file) {
  return path.join(root, file);
}
