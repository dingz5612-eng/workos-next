import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const outputPath = "artifacts/oam/authority-cleanup/source-layer-audit.json";
const lifecyclePolicyPath = "docs/oam/file-lifecycle-policy.json";
const lifecyclePolicy = readJson(lifecyclePolicyPath);
const lifecycleRegistry = lifecyclePolicy.fileLifecycleRegistry ?? {};
const index = readJson("docs/oam/current-authority-index.json");
const ledger = readJson("docs/oam/current-engineering-ledger.json");
const ledgerByPath = new Map((ledger.files ?? []).map((item) => [slash(item.path), item]));
const indexByPath = new Map((index.entries ?? []).map((item) => [slash(item.path), item]));
const audited = new Map();

const sourceWhitelistEntries = [
  "docs/oam/current-architecture.md",
  "docs/oam/current-architecture.manifest.json",
  "docs/oam/current-authority-index.json",
  "docs/contracts/oam.current.json",
  "docs/oam/current-oam-kernel-responsibility-map.json",
  "docs/oam/oam-kernel-graph.json",
  "docs/oam/system-operating-kernel.json",
  "docs/oam/compiler-generated-contract-kernel.json",
  "docs/oam/file-lifecycle-policy.json",
  "docs/oam/current-oam-cross-domain-conflict-rules.json",
  "docs/oam/codex-execution-channel-policy.json",
  "docs/oam/professional-ai-review-seats.json",
  "docs/oam/system-change-governance-contract.json",
  "docs/oam/system-failure-routing-contract.json",
  "docs/oam/system-handoff-contract.json",
  "docs/oam/iteration-kernel.json",
  "docs/system/oam-p0-rule-ledger.json",
  "docs/business/business-line-registry.json",
  "docs/business/admission/business-line-levels.yml",
  "docs/oam/current-admission-state.json",
  "docs/business/truth-owner-registry.yml",
  "docs/business/domains/dormitory/dormitory-operating-kernel.json",
  "docs/business/domains/dormitory/dormitory-bed-cardinality.authority.json",
  "docs/business/domains/dormitory/dormitory-command-contracts.authority.json",
  "docs/business/domains/dormitory/dormitory-failure-semantics.authority.json",
  "docs/business/domains/dormitory/dormitory-first-golden-chain.capability-decision.authority.json",
  "docs/business/domains/dormitory/dormitory-invariants.authority.json",
  "docs/business/domains/dormitory/dormitory-object-graph.authority.json",
  "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json",
  "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json",
  "docs/business/domains/finance/finance-operating-kernel.json",
  "docs/business/domains/maintenance/maintenance-operating-kernel.json",
  "docs/finance/finance-ledger-kernel.json",
  "docs/identity/identity-permission-kernel.json",
  "docs/read-intelligence/read-intelligence-kernel.json",
  "docs/surface/surface-contract.yml",
  "docs/contracts/language/language-contract.json",
  "docs/contracts/database/oam-db-ownership-map.json"
];
const sourceWhitelist = new Set(sourceWhitelistEntries);

for (const entry of index.entries ?? []) {
  if (entry.currentTruthAllowed === true) {
    addAudit(entry.path, "current-authority-index.currentTruthAllowed=true");
  }
}

for (const file of gitFiles()) {
  if (!isTextFile(file)) continue;
  const text = readText(file);
  if (/\b(generatedBy|derivedFrom|doNotEdit)\b/.test(text) ||
    /"generated"\s*:\s*true/.test(text) ||
    /"sourceTruthAllowed"\s*:\s*false/.test(text) ||
    /"currentTruthAllowed"\s*:\s*false/.test(text)) {
    addAudit(file, "generated-or-derived-marker-scan");
  }
  if (/\b(compatibility|retired|legacy|obsolete|deprecated)\b/i.test(text)) {
    addAudit(file, "controlled-old-term-scan");
  }
}

for (const item of ledger.files ?? []) {
  const file = slash(item.path);
  const identity = String(item.currentIdentity ?? "");
  const target = /^(schemas\/|docs\/contracts\/read\/|docs\/contracts\/bi-kpi\/|services\/core-api\/WorkOS\.Api\/Runtime\/|infra\/db\/migrations\/|artifacts\/oam\/evidence\/)/.test(file);
  if (target && (identity === "authority_file" || item.currentFactAuthorityAllowed === true)) {
    addAudit(file, "engineering-ledger-authority-or-fact-authority");
  }
}

for (const file of gitFiles()) {
  if (/^(docs\/contracts\/authority\/|docs\/business\/dormitory\/|docs\/business\/domains\/dormitory\/workitems\/|docs\/contracts\/business\/|docs\/contracts\/definition\/)/.test(file)) {
    addAudit(file, "authority-pollution-target-scan");
  }
}

const entries = [...audited.values()].sort((left, right) => left.path.localeCompare(right.path));
const unknownCount = entries.filter((item) => item.targetLayer === "unknown" || item.recommendedAction === "unknown").length;
const derivedAsSourceCount = entries.filter((item) => item.targetLayer === "source" && item.derived === true).length;
const generatedAsSourceCount = entries.filter((item) =>
  item.targetLayer === "source" &&
  (item.manualEditAllowed === false || item.derived === true || hasTopLevelGeneratedMarker(item.path))
).length;
const businessFactAuthorityOutsideSourceCount = entries.filter((item) =>
  item.targetLayer !== "source" && item.businessFactAuthorityAllowed === true
).length;
const generatedManualEditAllowedCount = entries.filter((item) =>
  item.targetLayer === "generated" && item.manualEditAllowed === true
).length;
const sourceWhitelistUnique = checkSourceWhitelistUnique();
const blockingReasons = [
  sourceWhitelistUnique ? null : "sourceWhitelistUnique=false",
  unknownCount === 0 ? null : `unknownCount=${unknownCount}`,
  derivedAsSourceCount === 0 ? null : `derivedAsSourceCount=${derivedAsSourceCount}`,
  generatedAsSourceCount === 0 ? null : `generatedAsSourceCount=${generatedAsSourceCount}`,
  businessFactAuthorityOutsideSourceCount === 0 ? null : `businessFactAuthorityOutsideSourceCount=${businessFactAuthorityOutsideSourceCount}`,
  generatedManualEditAllowedCount === 0 ? null : `generatedManualEditAllowedCount=${generatedManualEditAllowedCount}`
].filter(Boolean);
const report = {
  version: "authority-cleanup.source-layer-audit.v1",
  generatedAtUtc: "pending",
  fileLifecycleRegistry: {
    policyPath: lifecyclePolicyPath,
    registryVersion: lifecycleRegistry.version ?? "missing",
    registryDigest: hashFileStrict(lifecyclePolicyPath),
    classificationPriority: lifecycleRegistry.classificationPriority ?? []
  },
  sourceWhitelist: [...sourceWhitelist].sort(),
  sourceWhitelistUnique,
  unknownCount,
  derivedAsSourceCount,
  generatedAsSourceCount,
  businessFactAuthorityOutsideSourceCount,
  generatedManualEditAllowedCount,
  currentDecision: blockingReasons.length === 0 ? "PASS" : "FAIL",
  blockingReasons,
  entries
};
report.generatedAtUtc = stableTimestamp(outputPath, report, "generatedAtUtc");

fs.mkdirSync(path.dirname(abs(outputPath)), { recursive: true });
fs.writeFileSync(abs(outputPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Authority source layer audit generated: ${outputPath}`);
console.log(`audited=${entries.length} decision=${report.currentDecision} unknown=${report.unknownCount}`);

function checkSourceWhitelistUnique() {
  const declared = (index.classificationModel?.sourceLayerWhitelist ?? []).map(slash);
  const declaredSet = new Set(declared);
  const indexSourceEntries = (index.entries ?? [])
    .filter((entry) => entry.layer === "source")
    .map((entry) => slash(entry.path));
  const indexSourceSet = new Set(indexSourceEntries);
  const localUnique = sourceWhitelistEntries.length === sourceWhitelist.size;
  const declaredUnique = declared.length === declaredSet.size;
  const indexSourceUnique = indexSourceEntries.length === indexSourceSet.size;
  const declaredMatchesLocal = sameSet(declaredSet, sourceWhitelist);
  const sourceEntriesMatchDeclared = sameSet(indexSourceSet, declaredSet);
  return localUnique && declaredUnique && indexSourceUnique && declaredMatchesLocal && sourceEntriesMatchDeclared;
}

function sameSet(left, right) {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

function hasTopLevelGeneratedMarker(file) {
  if (!file.endsWith(".json") || !isTextFile(file)) return false;
  try {
    const document = JSON.parse(readText(file));
    return document?.generated === true ||
      document?.doNotEdit === true ||
      Boolean(document?.generatedBy) ||
      Boolean(document?.derivedFrom);
  } catch {
    return false;
  }
}

function addAudit(file, reason) {
  const normalized = slash(file);
  if (!fs.existsSync(abs(normalized)) && !fs.existsSync(absDir(normalized))) return;
  const previous = audited.get(normalized);
  const reasons = new Set(previous?.scanReasons ?? []);
  reasons.add(reason);
  const classification = classify(normalized);
  if (reasons.has("controlled-old-term-scan") && classification.controlledOldTermUse !== true) {
    classification.action = `${classification.action}+review_old_term_fence_or_remove`;
    classification.notesZh = `${classification.notesZh} 旧词已纳入审计，必须由受控 fence、ADR 或明确迁移证明约束，不能解释为当前业务事实权威。`;
  }
  audited.set(normalized, {
    path: normalized,
    currentIdentity: indexByPath.get(normalized)?.identity ?? ledgerByPath.get(normalized)?.currentIdentity ?? "not_registered",
    targetLayer: classification.layer,
    fileLifecycle: classification.lifecycle ?? classification.layer,
    manualEditAllowed: classification.manualEditAllowed,
    businessFactAuthorityAllowed: classification.businessFactAuthorityAllowed,
    contractAuthorityAllowed: classification.contractAuthorityAllowed,
    derived: classification.derived,
    upstreamSource: classification.upstreamSource,
    downstreamConsumers: consumersFor(normalized),
    recommendedAction: classification.action,
    deletionRisk: classification.deletionRisk,
    controlledOldTermUse: classification.controlledOldTermUse,
    scanReasons: [...reasons].sort(),
    notesZh: classification.notesZh
  });
}

function classify(file) {
  const text = isTextFile(file) ? readText(file) : "";
  const hasDerivedMarker = /\b(generatedBy|derivedFrom|doNotEdit)\b/.test(text) || /"generated"\s*:\s*true/.test(text);
  const controlledOldTermUse = isControlledOldTermFile(file);
  const registryLifecycle = lifecycleFromRegistry(file);

  if (registryLifecycle) {
    return classificationFromLifecycle(file, registryLifecycle, controlledOldTermUse);
  }

  if (/^docs\/contracts\/authority\/.*\.contract\.json$/.test(file)) {
    return referenceOnly(file, "keep_as_reference_only_authority_view", "该 authority contract 只能作为参考或迁移证明，唯一事实需吸收到现有 Source。");
  }
  if (/^docs\/business\/dormitory\//.test(file) || /^docs\/business\/domains\/dormitory\/workitems\//.test(file)) {
    return generated(file, "docs/business/domains/dormitory/dormitory-operating-kernel.json", "downgrade_to_generated_or_delete_after_absorption", "宿舍派生副本不得作为业务事实权威，唯一 Source 是 dormitory-operating-kernel.json。");
  }
  if (/^docs\/contracts\/business\//.test(file) || /^docs\/contracts\/definition\//.test(file)) {
    return generated(file, "docs/business/domains/dormitory/dormitory-operating-kernel.json", "downgrade_to_generated_contract", "业务对象、流程、定义和引用合同只能作为生成合同，不得作为 Source 业务事实权威。");
  }
  if (/^docs\/contracts\/read\/|^docs\/contracts\/bi-kpi\/|^docs\/contracts\/search\//.test(file)) {
    return generated(file, "docs/read-intelligence/read-intelligence-kernel.json", "keep_as_read_or_metric_contract", "读侧、搜索和 BI-KPI 合同只能支持读取、展示和指标，不得拥有业务事实写权。");
  }
  if (/^schemas\//.test(file) || /\.schema\.json$/.test(file)) {
    return runtime(file, "validationSchema", "keep_as_validation_schema", "Schema 只验证结构，不拥有业务事实权威。");
  }
  if (/^infra\/db\/migrations\//.test(file)) {
    return runtime(file, "databaseAsset", "keep_as_database_asset", "数据库迁移是运行资产，不得成为 Source 业务事实权威。");
  }
  if (/^services\/core-api\/WorkOS\.Api\/Runtime\//.test(file)) {
    return runtime(file, "runtimeImplementation", "keep_as_runtime_implementation", "Runtime 只能消费 Source 或 Generated 合同，不得重新解释业务事实。");
  }
  if (/^artifacts\/oam\//.test(file)) {
    return evidence(file, "keep_as_evidence_artifact", "OAM 产物只证明执行结果，不替代 Source。");
  }
  if (/^scripts\//.test(file)) {
    return tooling(file, "keep_as_tooling", "脚本属于人工维护的 Tooling / Checker / Generator，只执行或验证边界，不拥有业务事实权威。");
  }
  if (hasDerivedMarker) {
    return generated(file, inferUpstream(file), "downgrade_to_generated", "文件带派生或生成标记，不能作为 Source 业务事实权威。");
  }
  return {
    layer: "referenceOnly",
    manualEditAllowed: true,
    businessFactAuthorityAllowed: false,
    contractAuthorityAllowed: false,
    derived: false,
    upstreamSource: inferUpstream(file),
    action: controlledOldTermUse ? "keep_controlled_fence_or_adr" : "keep_as_reference_only",
    deletionRisk: "medium",
    controlledOldTermUse,
    notesZh: controlledOldTermUse
      ? "旧词只允许作为受控 fence、ADR 或迁移证明存在。"
      : "保留为人读说明或辅助文件，只能 referenceOnly，不作为业务事实权威。"
  };
}

function lifecycleFromRegistry(file) {
  const rules = lifecycleRegistry.pathRules ?? [];
  for (const rule of rules) {
    if (rule.matchType === "sourceWhitelist" && sourceWhitelist.has(file)) return rule.lifecycle;
    const patterns = rule.patterns ?? [];
    if (rule.matchType === "exactPath" && patterns.includes(file)) return rule.lifecycle;
    if (rule.matchType === "prefix" && patterns.some((pattern) => file.startsWith(pattern))) return rule.lifecycle;
    if (rule.matchType === "suffix" && patterns.some((pattern) => file.endsWith(pattern))) return rule.lifecycle;
    if (rule.matchType === "contains" && patterns.some((pattern) => file.includes(pattern))) return rule.lifecycle;
  }
  return "referenceOnly";
}

function classificationFromLifecycle(file, lifecycle, controlledOldTermUse) {
  if (lifecycle === "source") {
    return {
      layer: "source",
      lifecycle,
      manualEditAllowed: true,
      businessFactAuthorityAllowed: /business-line|truth-owner|operating-kernel|finance-ledger|identity-permission|read-intelligence|surface-contract|language-contract|current-admission/.test(file),
      contractAuthorityAllowed: true,
      derived: false,
      upstreamSource: file,
      action: "keep_source",
      deletionRisk: "high",
      controlledOldTermUse,
      notesZh: "保留为少而硬的 Source Layer 权威源；只能由 Source 白名单授权，不得由 artifact、dashboard、search 或 surface 替代。"
    };
  }
  if (lifecycle === "generated") {
    return generated(file, inferUpstream(file), "keep_as_generated_contract", "由 Source 或 generator 派生的合同 / manifest / generated view；禁止手改，不拥有业务事实权威。");
  }
  if (lifecycle === "tooling") {
    return tooling(file, "keep_as_tooling", "脚本属于人工维护的 Tooling / Checker / Generator，只执行或验证边界，不拥有业务事实权威。");
  }
  if (lifecycle === "runtime") {
    return runtime(file, "runtimeImplementation", "keep_as_runtime_implementation", "Runtime / schema / migration 只能消费 Source 或 Generated 合同，不得重新解释业务事实。");
  }
  if (lifecycle === "evidence") {
    return evidence(file, "keep_as_evidence_artifact", "OAM 本地证据产物只证明执行结果，不替代 Source，不授权发布。");
  }
  if (lifecycle === "release") {
    return release(file, "keep_as_release_evidence", "Release Evidence 只由 CI / release 流程证明发布状态，本地必须保持 releaseAuthority=false。");
  }
  if (lifecycle === "retired") {
    return retired(file, "keep_retired_blocked_or_delete", "退役文件不得作为当前权威，也不得被 Runtime / Search / Surface / Dashboard 消费为事实来源。");
  }
  return referenceOnly(file, controlledOldTermUse ? "keep_controlled_fence_or_adr" : "keep_as_reference_only", controlledOldTermUse
    ? "旧词只允许作为受控 fence、ADR 或迁移证明存在，不能解释为当前业务事实权威。"
    : "参考材料只能用于说明背景，不得成为当前事实权威。");
}

function generated(file, upstreamSource, action, notesZh) {
  return {
    layer: "generated",
    lifecycle: "generated",
    manualEditAllowed: false,
    businessFactAuthorityAllowed: false,
    contractAuthorityAllowed: true,
    derived: true,
    upstreamSource,
    action,
    deletionRisk: "medium",
    controlledOldTermUse: isControlledOldTermFile(file),
    notesZh
  };
}

function runtime(file, authorityRole, action, notesZh) {
  return {
    layer: authorityRole === "validationSchema" || authorityRole === "databaseAsset" ? "runtime" : "runtime",
    lifecycle: "runtime",
    manualEditAllowed: true,
    businessFactAuthorityAllowed: false,
    contractAuthorityAllowed: false,
    derived: false,
    upstreamSource: inferUpstream(file),
    action,
    deletionRisk: "high",
    controlledOldTermUse: isControlledOldTermFile(file),
    notesZh
  };
}

function evidence(file, action, notesZh) {
  return {
    layer: "evidence",
    lifecycle: "evidence",
    manualEditAllowed: false,
    businessFactAuthorityAllowed: false,
    contractAuthorityAllowed: false,
    derived: true,
    upstreamSource: "scripts/oam/run-control-plane-checks.ps1",
    action,
    deletionRisk: "low",
    controlledOldTermUse: isControlledOldTermFile(file),
    notesZh
  };
}

function tooling(file, action, notesZh) {
  return {
    layer: "tooling",
    lifecycle: "tooling",
    manualEditAllowed: true,
    businessFactAuthorityAllowed: false,
    contractAuthorityAllowed: false,
    derived: false,
    upstreamSource: inferUpstream(file),
    action,
    deletionRisk: "medium",
    controlledOldTermUse: isControlledOldTermFile(file),
    notesZh
  };
}

function release(file, action, notesZh) {
  return {
    layer: "release",
    lifecycle: "release",
    manualEditAllowed: false,
    businessFactAuthorityAllowed: false,
    contractAuthorityAllowed: false,
    derived: true,
    upstreamSource: "scripts/oam/generate-current-evidence-root.mjs",
    action,
    deletionRisk: "low",
    controlledOldTermUse: isControlledOldTermFile(file),
    notesZh
  };
}

function retired(file, action, notesZh) {
  return {
    layer: "retired",
    lifecycle: "retired",
    manualEditAllowed: false,
    businessFactAuthorityAllowed: false,
    contractAuthorityAllowed: false,
    derived: false,
    upstreamSource: inferUpstream(file),
    action,
    deletionRisk: "low",
    controlledOldTermUse: isControlledOldTermFile(file),
    notesZh
  };
}

function referenceOnly(file, action, notesZh) {
  return {
    layer: "referenceOnly",
    lifecycle: "referenceOnly",
    manualEditAllowed: true,
    businessFactAuthorityAllowed: false,
    contractAuthorityAllowed: false,
    derived: false,
    upstreamSource: inferUpstream(file),
    action,
    deletionRisk: "medium",
    controlledOldTermUse: isControlledOldTermFile(file),
    notesZh
  };
}

function inferUpstream(file) {
  const ledgerItem = ledgerByPath.get(file);
  if (ledgerItem?.upstreamSource) return ledgerItem.upstreamSource;
  const text = isTextFile(file) ? readText(file) : "";
  const match = text.match(/"?(?:generatedFrom|derivedFrom)"?\s*:\s*(?:"([^"]+)"|\[\s*"([^"]+)")/);
  return match?.[1] ?? match?.[2] ?? "docs/oam/oam-kernel-graph.json";
}

function consumersFor(file) {
  const consumers = new Set();
  for (const item of ledgerByPath.get(file)?.downstreamConsumers ?? []) consumers.add(item);
  for (const item of indexByPath.get(file)?.checker ? [indexByPath.get(file).checker] : []) consumers.add(item);
  return [...consumers].sort();
}

function isControlledOldTermFile(file) {
  return file === "docs/contracts/definition/definition-compatibility-fence.json" ||
    file === "docs/decisions/ADR-business-3-7-current-registry-decision.md" ||
    /migration|fence|ADR/i.test(file);
}

function gitFiles() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .map(slash)
    .filter(Boolean)
    .filter((item) => !item.startsWith("artifacts/oam/authority-cleanup/"));
}

function isTextFile(file) {
  return /\.(json|jsonl|ya?ml|md|mjs|js|cs|ps1|txt|schema)$/.test(file) || !path.extname(file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), "utf8"));
}

function readText(file) {
  try {
    return fs.readFileSync(abs(file), "utf8");
  } catch {
    return "";
  }
}

function abs(file) {
  return path.join(root, file);
}

function absDir(file) {
  return path.join(root, file);
}

function slash(file) {
  return String(file).trim().replace(/\\/g, "/");
}

function hashFileStrict(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(abs(file), "utf8")).digest("hex")}`;
}

function stableTimestamp(file, nextDocument, field) {
  const full = abs(file);
  if (!fs.existsSync(full)) return new Date().toISOString();
  try {
    const previous = JSON.parse(fs.readFileSync(full, "utf8"));
    if (sameExceptField(previous, nextDocument, field)) {
      return previous[field] ?? new Date().toISOString();
    }
  } catch {
    return new Date().toISOString();
  }
  return new Date().toISOString();
}

function sameExceptField(left, right, field) {
  const leftClone = { ...left };
  const rightClone = { ...right };
  delete leftClone[field];
  delete rightClone[field];
  return JSON.stringify(leftClone) === JSON.stringify(rightClone);
}
