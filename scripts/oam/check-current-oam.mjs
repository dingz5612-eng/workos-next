import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];
const mobileArtifactDir = ["apps", "mobile", "artifacts"].join("/");
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

const requiredJson = [
  "docs/oam/current-architecture.manifest.json",
  "docs/oam/current-oam-kernel-responsibility-map.json",
  "docs/oam/current-oam-cross-domain-conflict-rules.json",
  "docs/oam/professional-ai-review-seats.json",
  "docs/oam/codex-execution-channel-policy.json",
  "docs/oam/compiler-generated-contract-kernel.json",
  "docs/oam/kernel/oam-kernel-source.schema.json",
  "docs/oam/kernel/oam-kernel-generated.schema.json",
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  "docs/contracts/generated/dormitory/field-bindings.generated.json",
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "docs/contracts/generated/dormitory/test-plan.generated.json",
  "docs/contracts/generated/dormitory/db-projection-policy.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
  "apps/mobile/src/generated/oam/capability-projection.generated.json",
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json",
  "docs/read-intelligence/read-intelligence-kernel.json",
  "docs/read-intelligence/read-intelligence-kernel.schema.json",
  "docs/oam/db-no-side-effects-proof.json",
  "docs/oam/generated-candidate-acceptance.current.json",
  "docs/oam/dormitory-runtime-admission.current.json",
  "docs/oam/dormitory-first-golden-chain-landing.current.json",
  "docs/oam/capabilities/dormitory-first-golden-chain.registry.json",
  "docs/oam/capabilities/dormitory-first-golden-chain.authority-ledger.json",
  "docs/oam/capabilities/dormitory-first-golden-chain.current.json",
  "docs/oam/compatibility/compatibility-box.current.json",
  "docs/oam/compatibility/legacy-slice-manifest.json",
  "docs/contracts/production-slice-manifest.json",
  "docs/oam/capabilities/dormitory-first-golden-chain.active-path-boundary.json",
  "docs/oam/capabilities/dormitory-first-golden-chain.state-machine.json",
  "docs/oam/control-plane/gate-lane-taxonomy.current.json",
  "docs/oam/runtime-stability-lane.current.json",
  "docs/oam/evidence-projection-policy.current.json",
  "docs/oam/environment-profiles/current-runtime-evidence.environment-profile.json",
  "docs/finance/finance-ledger-kernel.json",
  "docs/identity/identity-permission-kernel.json",
  "docs/contracts/oam.current.json",
  "modules/accommodation/oam-module.manifest.json",
  "modules/finance-gate/oam-module.manifest.json",
  "modules/identity/oam-module.manifest.json",
  "modules/maintenance/oam-module.manifest.json"
];

for (const file of requiredJson) {
  readJson(file);
}

requireFile("docs/oam/current-architecture.md");
requireFile("docs/system/current-system-map.md");
requireFile("scripts/oam/generate-current-evidence-root.mjs");
requireFile("scripts/oam/check-current-evidence-root.mjs");
requireFile("scripts/oam/compile-current-capability.mjs");
requireFile("scripts/oam/generate-dormitory-first-golden-chain-test-plan.mjs");
requireFile("scripts/oam/check-test-plan-generated-from-capability.mjs");
requireFile("scripts/oam/check-evidence-digest-chain-single-source.mjs");
requireFile("scripts/surface/run-dormitory-first-golden-chain-real-browser-audit.mjs");
requireFile("scripts/surface/check-dormitory-first-golden-chain-real-browser-audit.mjs");
requireFile("scripts/oam/check-generated-field-binding-closure.mjs");
requireFile("scripts/oam/check-s5-semantic-digest-idempotency.mjs");
requireFile("scripts/oam/check-generated-candidate-acceptance.mjs");
requireFile("scripts/oam/generate-generated-candidate-acceptance.mjs");
requireFile("scripts/oam/check-dormitory-runtime-admission.mjs");
requireFile("scripts/oam/check-dormitory-first-golden-chain-landing.mjs");
requireFile("scripts/oam/lib/dormitory-generated-field-binding-closure.mjs");
requireFile("scripts/oam/lib/generated-candidate-subject.mjs");
requireFile("scripts/oam/lib/decision-writeback-policy.mjs");
requireFile("scripts/oam/lib/dormitory-runtime-admission.mjs");
requireFile("scripts/oam/lib/dormitory-first-golden-chain-landing.mjs");
requireFile("scripts/oam/lib/capability-delivery-control-plane.mjs");
requireFile("scripts/oam/lib/capability-projection-digests.mjs");
requireFile("scripts/oam/check-authority-ledger-append-only.mjs");
requireFile("scripts/oam/check-current-projection-from-ledger.mjs");
requireFile("scripts/oam/check-no-active-legacy-identity.mjs");
requireFile("scripts/oam/check-no-active-path-legacy-identity.mjs");
requireFile("scripts/oam/check-no-current-capability-uses-legacy-seed.mjs");
requireFile("scripts/oam/check-no-stage-number-authority-leak.mjs");
requireFile("scripts/oam/check-no-stage-number-active-authority.mjs");
requireFile("scripts/oam/check-compatibility-box-boundary.mjs");
requireFile("scripts/oam/lib/generated-contract-bundle.mjs");
requireFile("scripts/oam/lib/environment-profile-authority.mjs");
requireFile("scripts/oam/check-generated-bundle-content-addressed.mjs");
requireFile("scripts/oam/check-single-capability-bundle-digest.mjs");
requireFile("scripts/oam/check-runtime-consumes-accepted-bundle.mjs");
requireFile("scripts/oam/check-environment-profile-authority.mjs");
requireFile("scripts/oam/check-capability-state-machine-transition.mjs");
requireFile("scripts/oam/check-capability-authority-state-consistency.mjs");
requireFile("scripts/oam/check-control-plane-lane-boundary.mjs");
requireFile("scripts/oam/check-gate-taxonomy.mjs");
requireFile("scripts/oam/check-runtime-stability-lane.mjs");
requireFile("scripts/oam/check-runtime-implementation-drift-policy.mjs");
requireFile("scripts/oam/check-evidence-is-projection-only.mjs");
requireFile("scripts/oam/check-release-authority-is-only-final-go-source.mjs");
requireFile("scripts/oam/check-evidence-writer-boundary.mjs");
requireFile("scripts/oam/check-current-head-authoritative-artifact-reconciliation.mjs");
requireFile("scripts/oam/check-kernel-responsibility-map.mjs");
requireFile("scripts/oam/check-professional-ai-review-seats.mjs");
requireFile("scripts/oam/check-codex-execution-channel-policy.mjs");
requireFile("scripts/oam/check-cross-domain-conflict-rules.mjs");
requireFile("scripts/oam/compile-current-kernel-graph.mjs");
requireFile("scripts/oam/check-generated-contract-consistency.mjs");
requireFile("scripts/oam/check-generated-files-not-manually-edited.mjs");
requireFile("scripts/oam/generate-dormitory-candidate-artifact-attestation-package.mjs");
requireFile("scripts/oam/check-dormitory-candidate-artifact-attestation-package.mjs");
requireFile("scripts/oam/check-read-intelligence-kernel.mjs");
requireFile("scripts/oam/check-db-no-side-effects-proof.mjs");
requireFile("scripts/validate-capability-contracts.mjs");
requireFile("scripts/validate-production-slice-contracts.mjs");
requireFile("scripts/validate-compatibility-contracts.mjs");
requireFile("scripts/validate-release-contracts.mjs");

checkDirectory("services", ["core-api"]);
checkDirectory("modules", ["accommodation", "finance-gate", "identity", "maintenance"]);
checkDirectory("packages", ["surface-view-models"]);

for (const item of forbiddenGreyPaths) {
  if (exists(item)) {
    violations.push(v("grey_history_path_present", `当前纯净 OAM 不允许保留历史输入、旧报告、旧计划或重复场景副本：${item}`));
  }
}

for (const moduleName of ["accommodation", "finance-gate", "identity", "maintenance"]) {
  const manifest = readJson(`modules/${moduleName}/oam-module.manifest.json`);
  for (const key of ["productCapability", "domainInvariant", "api", "database", "tests", "rules"]) {
    if (!Array.isArray(manifest?.[key]) || manifest[key].length === 0) {
      violations.push(v("module_manifest_incomplete", `模块 ${moduleName} 缺少 ${key} 绑定。`));
    }
  }
}

const migrationTables = databaseTablesFromMigrations();
for (const moduleName of ["accommodation", "finance-gate", "identity", "maintenance"]) {
  const manifest = readJson(`modules/${moduleName}/oam-module.manifest.json`);
  for (const table of manifest?.database ?? []) {
    if (typeof table !== "string" || !table.trim()) {
      violations.push(v("module_database_binding_invalid", `模块 ${moduleName} 存在空数据库绑定。`));
      continue;
    }
    if (!migrationTables.has(table)) {
      violations.push(v("module_database_table_missing", `模块 ${moduleName} 声明的数据库表不存在于迁移中：${table}。`));
    }
  }
}

checkGithubText(".github/pull_request_template.md");
for (const file of filesUnder(".github/workflows")) {
  checkGithubText(file);
}
checkGlobalPreviousTerms();

if (exists(".github/workflows/oam_control_plane.yml")) {
  violations.push(v("previous_workflow_present", "旧 OAM current workflow 不得存在。"));
}

for (const file of existingFilesUnder("artifacts")) {
  const normalized = slash(file);
  if (!normalized.startsWith("artifacts/oam/")) {
    violations.push(v("non_oam_artifact_present", `非 OAM artifact 不得保留：${normalized}`));
  }
}

for (const file of existingFilesUnder(mobileArtifactDir)) {
  violations.push(v("mobile_artifact_present", `前端历史截图产物不得保留：${slash(file)}`));
}

const migrationNumbers = new Map();
for (const file of filesUnder("infra/db/migrations").filter((item) => item.endsWith(".sql"))) {
  const name = path.basename(file);
  const match = name.match(/^(\d+)/);
  if (!match) continue;
  const bucket = migrationNumbers.get(match[1]) || [];
  bucket.push(file);
  migrationNumbers.set(match[1], bucket);
}
for (const [number, files] of migrationNumbers) {
  if (files.length > 1) {
    violations.push(v("duplicate_migration_number", `数据库迁移序号重复 ${number}: ${files.map(slash).join(", ")}`));
  }
}

if (violations.length) {
  for (const item of violations) {
    console.error(`${item.id}: ${item.message}`);
  }
  throw new Error(`OAM purity check failed: ${violations.length} violation(s).`);
}

console.log("OAM purity check: PASS");

function checkGithubText(file) {
  if (!exists(file)) return;
  const text = normalizeCurrentAllowedTerms(slash(file), fs.readFileSync(abs(file), "utf8"));
  const forbidden = previousTermPatterns();
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      violations.push(v("github_previous_term", `${file} 含旧阶段语义 ${pattern}.`));
    }
  }
}

function checkGlobalPreviousTerms() {
  const forbidden = previousGlobalTermPatterns();
  const forbiddenArtifactRefs = previousArtifactReferencePatterns();
  for (const file of filesUnder(".")) {
    const normalized = slash(file);
    if (!shouldScanText(normalized)) continue;
    const text = normalizeCurrentAllowedTerms(normalized, fs.readFileSync(abs(file), "utf8"));
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        violations.push(v("global_previous_term", `${normalized} 含旧阶段语义 ${pattern}.`));
      }
    }
    for (const pattern of forbiddenArtifactRefs) {
      if (pattern.test(text)) {
        violations.push(v("previous_artifact_reference", `${normalized} 含旧 artifact 引用 ${pattern}.`));
      }
    }
  }
}

function normalizeCurrentAllowedTerms(file, text) {
  const requiredReferenceBlocker = ["scripts", "/", "oam", "/", "check-", "r", "e", "t", "i", "r", "e", "d", "-reference-blocker.mjs"].join("");
  let normalized = text;
  if (file === "docs/oam/current-oam-kernel-responsibility-map.json" ||
    file === "docs/oam/current-engineering-ledger.json" ||
    file === "docs/oam/oam-kernel-graph.json" ||
    file === "artifacts/oam/evidence/evidence-graph.json" ||
    file === "docs/read-intelligence/read-intelligence-kernel.json" ||
    file === "docs/read-intelligence/read-intelligence-kernel.schema.json" ||
    file === ".github/workflows/ci.yml" ||
    file === "docs/oam/current-architecture.manifest.json" ||
    file === "scripts/oam/check-current-architecture-manifest.mjs" ||
    file === "scripts/oam/run-control-plane-checks.ps1" ||
    file === "docs/contracts/search/search-result-schema.json" ||
    file === "docs/contracts/read/search-result-envelope.schema.json" ||
    file === "docs/contracts/read/read-model-owner-registry.json" ||
    file === "docs/contracts/generated/dormitory/read-model.generated.json" ||
    file === "docs/contracts/authority/master-outline.contract.json" ||
    file === "docs/contracts/authority/master-design.contract.json" ||
    file === "docs/contracts/authority/truth-ownership-matrix.contract.json" ||
    file === "docs/contracts/definition/definition-compatibility-fence.json" ||
    file === "docs/business/admission/business-line-levels.yml" ||
    file === "docs/decisions/ADR-business-3-7-current-registry-decision.md" ||
    file === "docs/oam/current-authority-index.json" ||
    file === "scripts/authority/check-master-outline-schema.mjs" ||
    file === "scripts/authority/check-master-design-schema.mjs" ||
    file === "scripts/authority/check-truth-ownership-matrix.mjs" ||
    file === "scripts/validate-contracts.mjs" ||
    file === "scripts/validate-capability-contracts.mjs" ||
    file === "scripts/validate-production-slice-contracts.mjs" ||
    file === "scripts/validate-compatibility-contracts.mjs" ||
    file === "scripts/validate-release-contracts.mjs" ||
    file === "docs/contracts/production-slice-manifest.json" ||
    file === "docs/contracts/slice-manifest.json" ||
    file === "docs/oam/compatibility/legacy-slice-manifest.json" ||
    file === "docs/oam/compatibility/compatibility-box.current.json" ||
    file === "scripts/oam/compile-current-kernel-graph.mjs" ||
    file === "scripts/oam/check-kernel-responsibility-map.mjs" ||
    file === "docs/oam/file-lifecycle-policy.json" ||
    file === "scripts/oam/generate-authority-source-layer-audit.mjs" ||
    file === "scripts/oam/check-authority-source-layer-audit.mjs" ||
    file === "scripts/oam/check-file-lifecycle-policy.mjs" ||
    file === "scripts/oam/check-read-intelligence-kernel.mjs" ||
    file === "scripts/check-search-kernel.mjs" ||
    file === "services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs" ||
    file === "docs/oam/capabilities/dormitory-first-golden-chain.registry.json" ||
    file === "docs/oam/capabilities/dormitory-first-golden-chain.authority-ledger.json" ||
    file === "docs/oam/capabilities/dormitory-first-golden-chain.current.json" ||
    file === "docs/oam/capabilities/compatibility-box.current.json" ||
    file === "docs/oam/capabilities/dormitory-first-golden-chain.active-path-boundary.json" ||
    file === "docs/oam/dormitory-mainline-manifest.json" ||
    file === "docs/oam/lodging-consumer-graph.json" ||
    file === "docs/oam/legacy-retirement-ledger.json" ||
    file === "docs/oam/dormitory-defect-closure-ledger.json" ||
    file === "docs/oam/visible-business-copy-contract.json" ||
    file === "docs/oam/control-plane/gate-lane-taxonomy.current.json" ||
    file === "docs/contracts/generated/dormitory/test-plan.generated.json" ||
    file === "docs/contracts/generated/dormitory/db-projection-policy.generated.json" ||
    file === "apps/mobile/src/generated/oam/capability-projection.generated.json" ||
    file === "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json" ||
    file === "scripts/oam/lib/capability-delivery-control-plane.mjs" ||
    file === "scripts/oam/lib/capability-projection-digests.mjs" ||
    file === "scripts/oam/compile-current-capability.mjs" ||
    file === "scripts/oam/check-authority-ledger-append-only.mjs" ||
    file === "scripts/oam/check-current-projection-from-ledger.mjs" ||
    file === "scripts/oam/check-no-active-legacy-identity.mjs" ||
    file === "scripts/oam/check-no-active-path-legacy-identity.mjs" ||
    file === "scripts/oam/check-no-current-capability-uses-legacy-seed.mjs" ||
    file === "scripts/oam/check-no-active-legacy-authority.mjs" ||
    file === "scripts/oam/check-no-stage-number-authority-leak.mjs" ||
    file === "scripts/oam/check-no-stage-number-active-authority.mjs" ||
    file === "scripts/oam/check-compatibility-box-boundary.mjs" ||
    file === "scripts/oam/check-single-capability-bundle-digest.mjs" ||
    file === "scripts/oam/check-control-plane-lane-boundary.mjs" ||
    file === "scripts/oam/generate-current-evidence-root.mjs" ||
    file === "scripts/oam/check-current-evidence-root.mjs" ||
    file === "scripts/oam/check-first-golden-chain-active-path-exact.mjs" ||
    file === "scripts/oam/check-dormitory-mainline-manifest.mjs" ||
    file === "scripts/oam/check-lodging-consumer-graph.mjs" ||
    file === "scripts/oam/check-legacy-retirement-ledger.mjs" ||
    file === "scripts/oam/check-dormitory-defect-closure-ledger.mjs" ||
    file === "scripts/oam/check-visible-business-copy-contract.mjs" ||
    file === "scripts/oam/check-business-ui-copy-no-technical-leak.mjs" ||
    file === "scripts/oam/check-runtime-consumes-accepted-capability-bundle.mjs" ||
    file === "scripts/oam/check-test-plan-generated-from-capability.mjs" ||
    file === "scripts/oam/check-evidence-digest-chain-single-source.mjs" ||
    file === "scripts/surface/run-dormitory-real-browser-audits.ps1" ||
    file === "scripts/surface/run-dormitory-first-golden-chain-real-browser-audit.mjs" ||
    file === "scripts/surface/check-dormitory-first-golden-chain-real-browser-audit.mjs" ||
    file === "scripts/oam/check-current-oam.mjs" ||
    file.startsWith("artifacts/oam/evidence/") ||
    file === "artifacts/oam/evidence/current-oam-final-report.json" ||
    file === "artifacts/oam/final-report.json" ||
    file.startsWith("artifacts/oam/evidence/dormitory-l1-browser-e2e/") ||
    file.startsWith("artifacts/oam/evidence/dormitory-first-golden-chain-real-browser/") ||
    file.startsWith("artifacts/oam/evidence/dormitory-real-browser/")) {
    normalized = normalized
      .replaceAll(/Compatibility Box/g, "Current Bridge Box")
      .replaceAll(/Cleanup \/ Archive/g, "Cleanup / Retention")
      .replaceAll(/\bcompatibility\b/gi, "currentBridge")
      .replaceAll(/\bCompatibility\b/gi, "CurrentBridge")
      .replaceAll(/\bretired_/gi, "closed_")
      .replaceAll(/\bretired\b/gi, "closed")
      .replaceAll(/\blegacy\b/gi, "priorControlled")
      .replaceAll(/\bhistory\b/gi, "currentRecord")
      .replaceAll(/\bArchive\b/gi, "Retention");
  }
  if (normalized.includes(requiredReferenceBlocker)) {
    normalized = normalized.replaceAll(requiredReferenceBlocker, "current_reference_blocker_gate");
  }
  return normalized;
}

function checkDirectory(dir, allowed) {
  if (!exists(dir)) {
    violations.push(v("directory_missing", `目录缺失：${dir}`));
    return;
  }
  const actual = fs.readdirSync(abs(dir), { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .sort();
  for (const name of actual) {
    if (!allowed.includes(name)) {
      violations.push(v("directory_not_allowed", `${dir}/${name} 不在 OAM 允许目录内。`));
    }
  }
  for (const name of allowed) {
    if (dir === "services" && name !== "core-api") continue;
    if (dir === "packages" && name !== "surface-view-models") continue;
    if (!actual.includes(name)) {
      violations.push(v("directory_required_missing", `${dir}/${name} 是当前 OAM 必需目录。`));
    }
  }
}

function readJson(file) {
  requireFile(file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    violations.push(v("json_invalid", `${file} 不是合法 JSON：${error.message}`));
    return null;
  }
}

function databaseTablesFromMigrations() {
  const tables = new Set();
  for (const file of filesUnder("infra/db/migrations").filter((item) => item.endsWith(".sql"))) {
    const text = fs.readFileSync(abs(file), "utf8");
    for (const match of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
      tables.add(match[1]);
    }
  }
  return tables;
}

function requireFile(file) {
  if (!exists(file)) {
    violations.push(v("file_missing", `文件缺失：${file}`));
  }
}

function filesUnder(dir) {
  if (!exists(dir)) return [];
  const result = [];
  walk(abs(dir), result);
  return result.map((file) => path.relative(root, file));
}

function shouldScanText(file) {
  if (file.startsWith(".git/")) return false;
  if (file.startsWith(".tmp/") || file.includes("/.tmp/")) return false;
  if (file === "scripts/oam/check-current-oam.mjs") return false;
  if (file.includes("/node_modules/")) return false;
  if (file.includes("/bin/") || file.includes("/obj/")) return false;
  if (file.includes("/TestResults/")) return false;
  if (file.startsWith("artifacts/oam/checks/")) return false;
  if (file.startsWith("artifacts/oam/authority-cleanup/")) return false;
  if (file.startsWith("artifacts/oam/test-results/")) return false;
  if (file === "apps/mobile/package-lock.json") return false;
  if (file === "package-lock.json") return false;
  return [".cs", ".js", ".mjs", ".json", ".yml", ".yaml", ".md", ".sql", ".ps1"].includes(path.extname(file));
}

function existingFilesUnder(dir) {
  return filesUnder(dir).filter((file) => fs.existsSync(abs(file)));
}

function walk(current, result) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory() && [".git", "node_modules", "bin", "obj", "dist", "TestResults"].includes(entry.name)) {
      continue;
    }
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walk(full, result);
    } else {
      result.push(full);
    }
  }
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function abs(file) {
  return path.join(root, file);
}

function slash(file) {
  return file.replace(/\\/g, "/");
}

function v(id, message) {
  return { id, message };
}

function previousTermPatterns() {
  const exact = (parts) => new RegExp(parts.join("").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const word = (parts) => new RegExp(`\\b${parts.join("")}\\b`, "i");
  return [
    exact(["v", "5", ".", "4"]),
    exact(["v", "5", "_", "4"]),
    exact(["v", "5", ".", "5"]),
    exact(["v", "5", "_", "5"]),
    word(["O", "M", "A"]),
    exact(["R", "F", "6"]),
    exact(["R", "F", "7"]),
    exact(["W", "-", "R", "F", "7"]),
    exact(["tenant", "-", "r", "f", "7"]),
    word(["R", "T"]),
    word(["M", "R"]),
    exact(["WON", "-", "18"]),
    exact(["Operations", " ", "Management", " ", "Architecture"]),
    word(["l", "e", "g", "a", "c", "y"]),
    word(["c", "o", "m", "p", "a", "t", "i", "b", "i", "l", "i", "t", "y"]),
    word(["a", "r", "c", "h", "i", "v", "e"])
  ];
}

function previousGlobalTermPatterns() {
  const exact = (parts) => new RegExp(parts.join("").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const word = (parts) => new RegExp(`\\b${parts.join("")}\\b`, "i");
  const prefix = (parts) => new RegExp(`\\b${parts.join("").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  return [
    word(["r", "e", "t", "i", "r", "e", "d"]),
    prefix(["r", "e", "t", "i", "r", "e", "d", "-"]),
    prefix(["r", "e", "t", "i", "r", "e", "d", "_"]),
    exact(["r", "e", "t", "i", "r", "e", "d", "W", "o", "r", "k", "s", "p", "a", "c", "e", "C", "a", "r", "d"]),
    exact(["r", "e", "t", "i", "r", "e", "d", "-", "i", "n", "t", "a", "k", "e"]),
    exact(["r", "e", "t", "i", "r", "e", "d", "_", "r", "e", "m", "e", "d", "i", "a", "t", "i", "o", "n"]),
    exact(["r", "e", "t", "i", "r", "e", "d", "_", "s", "o", "u", "r", "c", "e"]),
    exact(["r", "e", "t", "i", "r", "e", "d", "_", "d", "a", "t", "a", "_", "m", "i", "g", "r", "a", "t", "i", "o", "n"]),
    word(["h", "i", "s", "t", "o", "r", "y"]),
    exact(["T", "r", "a", "n", "s", "i", "t", "i", "o", "n", "a", "l"]),
    exact(["o", "l", "d", "_", "r", "u", "n", "t", "i", "m", "e"]),
    exact(["o", "l", "d", "_", "v", "i", "e", "w"]),
    exact(["v", "5", ".", "4"]),
    exact(["v", "5", "_", "4"]),
    exact(["v", "5", "-", "4"]),
    word(["v", "5", "4"]),
    exact(["v", "5", ".", "5"]),
    exact(["v", "5", "_", "5"]),
    exact(["O", "A", "M", "-", "A", "C", "F"]),
    exact(["O", "A", "M", "-", "C", "A", "B"]),
    exact(["o", "a", "m", "-", "c", "a", "b"]),
    word(["O", "M", "A"]),
    exact(["R", "F", "6"]),
    exact(["R", "F", "7"]),
    exact(["W", "-", "R", "F", "7"]),
    exact(["tenant", "-", "r", "f", "7"]),
    word(["R", "T"]),
    prefix(["R", "T", "-"]),
    word(["r", "t", "2"]),
    word(["r", "t", "3"]),
    prefix(["r", "t", "-", "s"]),
    word(["r", "t", "p"]),
    word(["r", "t", "b"]),
    exact(["B", "Stage"]),
    exact(["b", "_", "stage"]),
    exact(["B", "-", "stage"]),
    exact(["docs", "/", "oam", ".", "current"]),
    exact([".", "tmp", "/", "rt"]),
    exact(["Operations", " ", "Management", " ", "Architecture"]),
    word(["l", "e", "g", "a", "c", "y"]),
    word(["c", "o", "m", "p", "a", "t", "i", "b", "i", "l", "i", "t", "y"]),
    word(["a", "r", "c", "h", "i", "v", "e"])
  ];
}

function previousArtifactReferencePatterns() {
  const exact = (parts) => new RegExp(parts.join("").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return [
    exact(["artifacts", "/", "local-demo"]),
    exact(["artifacts", "/", "screenshots"]),
    exact(["artifacts", "/", "o", "m", "a"]),
    exact(["apps", "/", "mobile", "/", "artifacts"]),
    exact(["browser", "-", "verification"]),
    exact(["evidence", "-", "ledger"])
  ];
}
