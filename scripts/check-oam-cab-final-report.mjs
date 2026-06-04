import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "docs/architecture/CURRENT_ARCHITECTURE_BASELINE.md",
  "docs/architecture/active-components.yml",
  "docs/architecture/compatibility-components.yml",
  "docs/architecture/archive-candidates.yml",
  "docs/architecture/remove-candidates.yml",
  "docs/architecture/CODEX_EXECUTION_PLAYBOOK.md",
  "docs/architecture/compatibility-quarantine-rules.md",
  "artifacts/oam-cab/oam-cab-v1-execution-plan.md",
  "artifacts/oam-cab/oam-cab-v1-current-state.md",
  "artifacts/oam-cab/oam-cab-v1-inventory.json",
  "artifacts/oam-cab/oam-cab-v1-final-report.json",
  "docs/architecture/OAM_CAB_V1_FINAL_REPORT.md",
  "docs/contracts/oam-cab/contract-index.json"
];

const requiredFinalReportFields = [
  "project",
  "baseline",
  "current_stage",
  "architecture",
  "modules",
  "component_classification",
  "route_inventory",
  "non_get_route_classification",
  "business_write_path_inventory",
  "legacy_write_path_classification",
  "definition_registry_coverage",
  "work_item_definition_coverage",
  "fact_ownership_matrix",
  "compatibility_scan",
  "runtime_documents_audit",
  "search_kernel_coverage",
  "language_kernel_coverage",
  "security_trust_baseline",
  "control_plane_evidence",
  "evidence_graph_refs",
  "tests",
  "gates",
  "forbidden_findings",
  "risks",
  "next_stage"
];

const requiredContractKeys = [
  "apiBoundaryContract",
  "definitionRegistryContract",
  "commandSubmissionContract",
  "factOwnershipContract",
  "compatibilityBoxContract",
  "admissionDecisionContract",
  "businessLineAdmissionMatrix",
  "releaseStateAdmissionMatrix",
  "surfaceAdmissionMatrix",
  "actorDeviceAdmissionContract",
  "productionAdmissionContract",
  "controlPlaneCommandAppendOnlyContract",
  "evidenceGraphRefsContract",
  "businessSignoffContract",
  "rollbackCompensationContract",
  "searchContract",
  "biKpiContract",
  "languageKernelContract",
  "permissionExplainabilityContract"
];

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`missing required OAM-CAB file: ${file}`);
}

if (failures.length === 0) {
  checkInventory();
  checkContracts();
  checkFinalReport();
  checkComponentFiles();
  checkArchitectureDocs();
  checkExecutionEvidence();
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("OAM-CAB final report check failed.");
}

console.log("OAM-CAB final report check: PASS");

function checkInventory() {
  const inventory = readJson("artifacts/oam-cab/oam-cab-v1-inventory.json");
  if (inventory.version !== "oam-cab.inventory.v1") failures.push("inventory version mismatch.");
  for (const field of [
    "route_inventory",
    "non_get_route_classification",
    "business_write_path_inventory",
    "legacy_write_path_classification",
    "definition_registry_coverage",
    "work_item_definition_coverage",
    "handler_allowedFacts_coverage",
    "fact_ownership_matrix",
    "compatibility_scan",
    "projection_runtime_write_usage_scan",
    "retired_workspace_card_write_usage_scan",
    "runtime_documents_source_of_truth_usage_scan",
    "runtime_documents_snapshot_only_audit",
    "search_usage_inventory",
    "language_key_status_explanation_inventory",
    "control_plane_write_capability_inventory",
    "evidence_graph_write_reference_inventory",
    "forbidden_findings",
    "summary"
  ]) {
    if (!(field in inventory)) failures.push(`inventory missing field: ${field}`);
  }

  if (inventory.summary?.routeCount < 1) failures.push("inventory routeCount must be positive.");
  if (inventory.summary?.nonGetRouteCount < 1) failures.push("inventory nonGetRouteCount must be positive.");
  if (inventory.summary?.definitionCount < 1) failures.push("inventory definitionCount must be positive.");
  if (inventory.summary?.searchResultTypeCount < 15) failures.push("Search Kernel must define at least 15 result types.");
  if (inventory.summary?.languageCount !== 3) failures.push("Language Kernel must cover zh-CN, ru-RU, ky-KG.");
  if (inventory.summary?.forbiddenFindingCount !== 0) failures.push("inventory forbiddenFindingCount must be 0.");
  if (!Array.isArray(inventory.forbidden_findings) || inventory.forbidden_findings.length !== 0) {
    failures.push("inventory forbidden_findings must be empty.");
  }

  for (const route of inventory.non_get_route_classification || []) {
    if (!route.classification || route.classification === "unclassified") {
      failures.push(`non-GET route is unclassified: ${route.key}`);
    }
    if (!["primary operations confirm", "retired", "non-business write", "remove", "forbidden"].includes(route.legacyWritePathClass)) {
      failures.push(`legacy write path has invalid class: ${route.key} -> ${route.legacyWritePathClass}`);
    }
  }

  if (!hasRoute(inventory.business_write_path_inventory, "POST /api/operations/work-items/{workItemId}/confirm")) {
    failures.push("inventory must include primary Operations Confirm business write path.");
  }
}

function checkContracts() {
  const index = readJson("docs/contracts/oam-cab/contract-index.json");
  if (index.version !== "oam-cab.contract-index.v1") failures.push("contract index version mismatch.");
  for (const key of requiredContractKeys) {
    const contractPath = index.contracts?.[key];
    if (!contractPath) {
      failures.push(`contract index missing key: ${key}`);
      continue;
    }
    if (!exists(contractPath)) {
      failures.push(`contract index points to missing file: ${key} -> ${contractPath}`);
      continue;
    }
    if (contractPath.endsWith(".json")) {
      try {
        readJson(contractPath);
      } catch (error) {
        failures.push(`contract file is not valid JSON: ${contractPath}: ${error.message}`);
      }
    }
  }

  const command = readJson(index.contracts.commandSubmissionContract);
  if (command.primaryRoute !== "POST /api/operations/work-items/{workItemId}/confirm") {
    failures.push("CommandSubmission contract primaryRoute mismatch.");
  }
  if (!command.requiredFields?.includes("idempotencyKey")) failures.push("CommandSubmission contract must require idempotencyKey.");
  if (command.idempotency?.missingKey !== "422 validation error") failures.push("CommandSubmission missing idempotency 422 policy.");

  const compatibility = readJson(index.contracts.compatibilityBoxContract);
  for (const forbidden of ["new business fact write semantics", "confirmAllowed decision", "Business Production release"]) {
    if (!compatibility.forbiddenUsage?.includes(forbidden)) failures.push(`Compatibility Box missing forbidden usage: ${forbidden}`);
  }

  const controlPlane = readJson(index.contracts.controlPlaneCommandAppendOnlyContract);
  if (controlPlane.appendOnly !== true) failures.push("ControlPlaneCommand contract must be appendOnly.");
  if (controlPlane.businessFactWriteAllowed !== false) failures.push("ControlPlaneCommand must not write business facts.");
  if (controlPlane.manualGateResultAllowed !== false) failures.push("manual GateResult must remain forbidden.");
  if (controlPlane.manualPassedEvidenceAllowed !== false) failures.push("manual passed evidence must remain forbidden.");

  const evidence = readJson(index.contracts.evidenceGraphRefsContract);
  if (evidence.appendOnlyEvidenceRequired !== true) failures.push("EvidenceGraph contract must require append-only evidence.");
  if (evidence.businessFactWriteAllowed !== false) failures.push("EvidenceGraph contract must not write business facts.");
}

function checkFinalReport() {
  const report = readJson("artifacts/oam-cab/oam-cab-v1-final-report.json");
  const inventory = readJson("artifacts/oam-cab/oam-cab-v1-inventory.json");
  const contractIndex = readJson("docs/contracts/oam-cab/contract-index.json");

  for (const field of requiredFinalReportFields) {
    if (!(field in report)) failures.push(`final report missing required field: ${field}`);
  }

  if (report.project !== "WorkOSNext / FunRide") failures.push("final report project mismatch.");
  if (report.baseline !== "OAM-CAB v1") failures.push("final report baseline mismatch.");
  if (report.current_stage !== "OAM-CAB v1｜Baseline Repair & Evidence Closure") failures.push("final report current_stage mismatch.");
  if (report.architecture?.top_level !== "OAM-ACF v8") failures.push("final report top_level must be OAM-ACF v8.");
  if (report.architecture?.main_runtime !== "Operations Runtime") failures.push("final report main_runtime must be Operations Runtime.");
  if (report.architecture?.main_write_path !== "POST /api/operations/work-items/{workItemId}/confirm") failures.push("final report main_write_path mismatch.");
  if (report.architecture?.business_production !== "blocked") failures.push("Business Production must remain blocked.");
  if (report.architecture?.rules_os_go !== "not Business Production GO") failures.push("Rules OS GO must not be Business Production GO.");
  if (report.architecture?.surface_visibility !== "not confirmAllowed") failures.push("surfaceVisibility must not be confirmAllowed.");

  const requiredModules = [
    "architecture_authority",
    "admission_kernel",
    "operations_runtime",
    "compatibility_box",
    "experience_kernel",
    "language_kernel",
    "search_kernel",
    "control_plane",
    "evidence_graph",
    "definition_registry"
  ];
  for (const module of requiredModules) {
    if (!report.modules?.[module]) failures.push(`final report missing module: ${module}`);
  }

  for (const bucket of ["active", "compatibility", "archive_candidates"]) {
    const entries = report.component_classification?.[bucket];
    if (!Array.isArray(entries) || entries.length === 0) failures.push(`component_classification.${bucket} must be non-empty.`);
    for (const entry of entries || []) checkClassificationEntry(entry, `component_classification.${bucket}`);
  }
  if (!Array.isArray(report.component_classification?.remove_candidates)) {
    failures.push("component_classification.remove_candidates must be an array.");
  }
  for (const entry of report.component_classification?.remove_candidates || []) {
    checkClassificationEntry(entry, "component_classification.remove_candidates");
  }

  if (report.route_inventory?.count !== inventory.summary.routeCount) failures.push("final report route_inventory count mismatch.");
  if (report.non_get_route_classification?.count !== inventory.summary.nonGetRouteCount) failures.push("final report non_get_route_classification count mismatch.");
  if (report.business_write_path_inventory?.count !== inventory.summary.businessWriteRouteCount) failures.push("final report business_write_path_inventory count mismatch.");
  if (!hasRoute(report.business_write_path_inventory?.routes || [], "POST /api/operations/work-items/{workItemId}/confirm")) {
    failures.push("final report must include primary Operations Confirm route.");
  }

  if (report.definition_registry_coverage?.definitionCount !== inventory.summary.definitionCount) failures.push("definition_registry_coverage count mismatch.");
  if (!Array.isArray(report.work_item_definition_coverage?.cards) || report.work_item_definition_coverage.cards.length !== inventory.summary.definitionCount) {
    failures.push("work_item_definition_coverage card count mismatch.");
  }
  if (!report.fact_ownership_matrix?.source?.includes("fact-ownership.yml")) failures.push("fact_ownership_matrix must cite fact-ownership.yml.");
  if (!report.runtime_documents_audit?.snapshotOnlyAudit) failures.push("runtime_documents_audit must include snapshotOnlyAudit.");
  if (report.search_kernel_coverage?.resultTypeCount < 15) failures.push("final report Search Kernel resultTypeCount must be >= 15.");
  if (report.search_kernel_coverage?.readOnly !== true) failures.push("Search Kernel must remain read-only.");
  if (report.language_kernel_coverage?.languageCount !== 3) failures.push("final report Language Kernel languageCount must be 3.");
  if (report.language_kernel_coverage?.permissionExplainabilityChineseRequired !== true) failures.push("PermissionExplainability must require Chinese coverage.");

  if (report.security_trust_baseline?.cookieCsrfProductionBrowserAuth?.status !== "blocked_not_production_ready") {
    failures.push("Cookie / CSRF production browser auth baseline must remain blocked_not_production_ready.");
  }
  if (report.security_trust_baseline?.productionAdmission?.status !== "blocked") failures.push("ProductionAdmission must remain blocked.");
  if (report.security_trust_baseline?.manualGateResultAllowed !== false) failures.push("manualGateResultAllowed must be false.");
  if (report.security_trust_baseline?.manualPassedEvidenceAllowed !== false) failures.push("manualPassedEvidenceAllowed must be false.");

  if (report.control_plane_evidence?.businessFactWriteAllowed !== false) failures.push("Control Plane must not directly write business facts.");
  if (report.evidence_graph_refs?.businessFactWriteAllowed !== false) failures.push("Evidence Graph must not directly write business facts.");

  for (const key of requiredContractKeys) {
    if (report.contracts?.[key] !== contractIndex.contracts?.[key]) failures.push(`final report contract ref mismatch: ${key}`);
  }

  if (!Array.isArray(report.forbidden_findings)) failures.push("forbidden_findings must be an array.");
  if (report.forbidden_findings?.length !== 0) failures.push("forbidden_findings must be empty.");
  if (!Array.isArray(report.tests) || report.tests.length === 0) failures.push("tests must be non-empty.");
  if (!Array.isArray(report.gates) || report.gates.length === 0) failures.push("gates must be non-empty.");

  for (const command of [
    "npm --prefix apps/mobile run build",
    "npm --prefix apps/mobile run test",
    "npm --prefix apps/mobile run test:e2e",
    "dotnet build WorkOSNext.sln -c Release",
    "dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release",
    "dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release",
    "dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release"
  ]) {
    if (!hasCommand(report.tests, command, "passed")) failures.push(`final report tests missing passed command: ${command}`);
  }

  for (const command of [
    "npm --prefix apps/mobile run lint",
    "npm --prefix apps/mobile run typecheck",
    "npm run lint",
    "npm run typecheck",
    "dedicated regression test command"
  ]) {
    if (!hasCommand(report.tests, command, "not_available")) failures.push(`final report must record unavailable command: ${command}`);
  }

  for (const command of [
    "node scripts/build-oam-cab-inventory.mjs",
    "node scripts/check-oam-cab-final-report.mjs",
    "node scripts/check-oam-clean-baseline.mjs",
    "node scripts/check-compatibility-quarantine.mjs",
    "node scripts/check-api-boundaries.mjs",
    "node scripts/check-runtime-write-paths.mjs",
    "node scripts/check-admission-kernel.mjs",
    "node scripts/check-business-line-admission.mjs",
    "node scripts/check-admission-surface-alignment.mjs",
    "node scripts/validate-slice-admission.mjs",
    "node scripts/validate-runtime-api.mjs",
    "node scripts/check-definition-registry.mjs",
    "node scripts/check-language-kernel.mjs",
    "node scripts/check-search-kernel.mjs",
    "node scripts/check-fact-ownership.mjs",
    "node scripts/check-ledger-semantic-rules.mjs",
    "node scripts/check-surface-contract.mjs",
    "node scripts/surface/check-surface-runtime-guard-contract.mjs",
    "node scripts/check-no-raw-surface-labels.mjs",
    "node scripts/surface/check-permission-explainability-contract.mjs",
    "node scripts/surface/check-mobile-search-contract.mjs",
    "node scripts/surface/check-evidence-trust-contract.mjs",
    "node scripts/surface/check-device-trust-contract.mjs",
    "node scripts/trust/check-trust-boundary-kernel.mjs",
    "node scripts/check-rule-authority.mjs",
    "node scripts/check-rule-drift.mjs",
    "pwsh ./scripts/guard-architecture.ps1",
    "pwsh ./scripts/clean-baseline.ps1",
    "git diff --check"
  ]) {
    if (!hasCommand(report.gates, command, "passed")) failures.push(`final report gates missing passed command: ${command}`);
  }

  if (!Array.isArray(report.risks?.P0) || report.risks.P0.length !== 0) failures.push("final report P0 risks must be an empty array.");
  if (!Array.isArray(report.risks?.P1) || report.risks.P1.length === 0) failures.push("final report must keep known P1 risks.");
  if (!Array.isArray(report.risks?.P2) || report.risks.P2.length === 0) failures.push("final report must keep known P2 risks.");
  if (report.next_stage?.allowed !== false) failures.push("final report next_stage.allowed must be false.");
  if (report.next_stage?.reason !== "OAM-CAB v1 evidence and P0 gates are not fully proven; Business Production remains blocked.") {
    failures.push("final report next_stage.reason must use required default No-Go reason.");
  }
}

function checkComponentFiles() {
  const active = read("docs/architecture/active-components.yml");
  for (const id of [
    "ArchitectureAuthority",
    "AdmissionKernel",
    "OperationsRuntime",
    "CompatibilityBox",
    "ExperienceKernel",
    "LanguageKernel",
    "SearchKernel",
    "ControlPlane",
    "EvidenceGraph",
    "DefinitionRegistry"
  ]) {
    const block = componentBlock(active, id);
    if (!block) failures.push(`active-components.yml missing ${id}`);
    else checkTextClassificationBlock(block, `active-components.yml ${id}`);
  }
  for (const forbidden of ["ProjectionRuntime", "Workspace/Card prepare-confirm"]) {
    if (componentBlock(active, forbidden)) failures.push(`${forbidden} must not be active.`);
  }

  const compatibility = read("docs/architecture/compatibility-components.yml");
  for (const id of ["ProjectionRuntime", "LensQueryService projection search adapter", "RuntimeDocumentStorage / runtime_documents snapshot"]) {
    const block = componentBlock(compatibility, id);
    if (!block) failures.push(`compatibility-components.yml missing ${id}`);
    else checkTextClassificationBlock(block, `compatibility-components.yml ${id}`);
  }
  for (const retired of ["Workspace/Card prepare-confirm", "WorkspaceCardCompatibilityAdapter"]) {
    if (componentBlock(compatibility, retired) || compatibility.includes(retired)) failures.push(`${retired} must be retired from compatibility-components.yml.`);
  }

  const archive = read("docs/architecture/archive-candidates.yml");
  for (const candidate of ["V1_ARCHITECTURE.md", "PHASE_PLAN.md", "WON_13_PRODUCTION_RUNTIME_ARCHITECTURE.md"]) {
    if (!archive.includes(candidate)) failures.push(`archive-candidates.yml missing ${candidate}`);
  }

  const remove = read("docs/architecture/remove-candidates.yml");
  if (!remove.includes("removeCandidates: []")) failures.push("remove-candidates.yml must keep explicit empty removeCandidates unless deletion is approved.");
}

function checkArchitectureDocs() {
  const baseline = read("docs/architecture/CURRENT_ARCHITECTURE_BASELINE.md");
  for (const term of [
    "OAM-ACF v8",
    "Operations Runtime",
    "POST /api/operations/work-items/{workItemId}/confirm",
    "Admission Kernel 是 confirmAllowed",
    "Definition Registry",
    "Experience Kernel",
    "Language Kernel",
    "Search Kernel 必须经过 Admission / Permission / Language",
    "Control Plane / Evidence Graph",
    "Business Production 当前 blocked",
    "surface visible 解释为 confirmAllowed"
  ]) {
    if (!baseline.includes(term)) failures.push(`CURRENT_ARCHITECTURE_BASELINE.md missing term: ${term}`);
  }

  const quarantine = read("docs/architecture/compatibility-quarantine-rules.md");
  for (const term of [
    "ProjectionRuntime 只能作为 compatibility facade",
    "Workspace/Card 只能作为展示/投影对象，不得作为 compatibility write wrapper",
    "兼容层不得新增业务写语义",
    "兼容层不得决定 confirmAllowed",
    "兼容层不得绕过 Operations Runtime",
    "兼容层不得绕过 Admission Kernel",
    "兼容层不得承载 Business Production 放行",
    "兼容层只能通过受控接口读取、展示、映射、适配",
    "任何兼容层扩大职责必须被 gate 阻断"
  ]) {
    if (!quarantine.includes(term)) failures.push(`compatibility quarantine missing term: ${term}`);
  }

  const playbook = read("docs/architecture/CODEX_EXECUTION_PLAYBOOK.md");
  for (const term of [
    "Codex 不是架构裁决者",
    "只能执行 00｜OAM 总控唯一指令",
    "专业 AI、局部建议或页面反馈不能直接给 Codex 下最终架构命令",
    "必须停止扩大实现范围",
    "modified files",
    "tests run",
    "gates run",
    "evidence",
    "next-stage recommendation",
    "不得新增业务功能来掩盖架构缺口",
    "不得把局部测试通过解释为 Business Production GO"
  ]) {
    if (!playbook.includes(term)) failures.push(`CODEX_EXECUTION_PLAYBOOK.md missing term: ${term}`);
  }

  const md = read("docs/architecture/OAM_CAB_V1_FINAL_REPORT.md");
  if (!md.includes("No-Go for Business Production")) failures.push("Markdown final report must state No-Go for Business Production.");
  if (!md.includes("Inventory Summary")) failures.push("Markdown final report must include Inventory Summary.");
}

function checkExecutionEvidence() {
  const currentState = read("artifacts/oam-cab/oam-cab-v1-current-state.md");
  for (const term of [
    "OAM-CAB v1｜Baseline Repair & Evidence Closure",
    "API route inventory",
    "non-GET route classification",
    "business write path inventory",
    "Definition Registry coverage",
    "WorkItem definition coverage",
    "handler allowedFacts coverage",
    "Fact Ownership matrix",
    "ProjectionRuntime write usage scan",
    "Workspace/Card write usage scan",
    "runtime_documents source-of-truth usage scan",
    "runtime_documents snapshot-only audit",
    "Search usage inventory",
    "Language key/status explanation inventory",
    "Control Plane write capability inventory",
    "Evidence Graph write/reference inventory",
    "artifacts/oam-cab/oam-cab-v1-inventory.json"
  ]) {
    if (!currentState.includes(term)) failures.push(`current state missing inventory term: ${term}`);
  }

  const logLines = read("artifacts/oam-cab/execution-log.jsonl").split(/\r?\n/).filter(Boolean);
  if (logLines.length === 0) failures.push("OAM-CAB execution log must not be empty.");
  for (const [index, line] of logLines.entries()) {
    try {
      JSON.parse(line);
    } catch (error) {
      failures.push(`execution-log.jsonl line ${index + 1} is not valid JSON: ${error.message}`);
    }
  }

  const releaseState = readJson("artifacts/release-state/current-state.json");
  if (releaseState.authoritativeState?.businessProduction !== "BLOCKED") failures.push("release-state businessProduction must remain BLOCKED.");

  const screenshotCheck = readJson("artifacts/oam-cab/browser-checks/phase-5/check-result.json");
  if (!Array.isArray(screenshotCheck) || screenshotCheck.length === 0) failures.push("browser screenshot check must be non-empty.");
  for (const item of screenshotCheck || []) {
    if (item.hasPayloadHash || item.hasCommandSubmissionId || item.hasTraceKey || item.hasTrustedConfirm) {
      failures.push(`browser check leaked technical or removed confirm UI on ${item.name}.`);
    }
  }
}

function checkClassificationEntry(entry, label) {
  for (const field of ["name", "path", "status", "owner_domain", "reason", "allowed_usage", "forbidden_usage", "evidence"]) {
    if (field === "evidence") {
      if (!Array.isArray(entry?.[field]) || entry[field].length === 0) failures.push(`${label} entry ${entry?.name || "<unknown>"} missing non-empty evidence.`);
    } else if (typeof entry?.[field] !== "string" || entry[field].trim().length === 0) {
      failures.push(`${label} entry ${entry?.name || "<unknown>"} missing ${field}.`);
    }
  }
}

function checkTextClassificationBlock(block, label) {
  for (const field of ["name", "path", "status", "owner_domain", "reason", "allowed_usage", "forbidden_usage", "evidence"]) {
    if (!new RegExp(`${field}:\\s*\\S`).test(block)) failures.push(`${label} missing field ${field}.`);
  }
}

function hasCommand(entries, command, status) {
  return entries.some((entry) => entry.command === command && (!status || entry.status === status));
}

function hasRoute(entries, key) {
  return entries.some((entry) => entry.key === key);
}

function componentBlock(text, id) {
  const escaped = escapeRegex(id);
  const match = text.match(new RegExp(`(^|\\n)\\s*-\\s+id:\\s*${escaped}\\s*\\n[\\s\\S]*?(?=\\n\\s*-\\s+id:\\s|\\nexistingCompatibilityRoutes:|$)`));
  return match ? match[0] : "";
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(fullPath, "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
