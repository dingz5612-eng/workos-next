import fs from "node:fs";
import path from "node:path";
import { i18n } from "../../../apps/mobile/src/i18n.js";
import { routeView } from "../../../apps/mobile/src/appRouter.js";

const root = process.cwd();

const docs = {
  experience: "docs/surface/surface-experience-contract.yml",
  mobile: "docs/surface/mobile-work-plane-contract.yml",
  pc: "docs/surface/pc-governance-plane-contract.yml",
  copy: "docs/surface/operational-copy-matrix.yml",
  search: "docs/surface/mobile-search-contract.yml",
  learning: "docs/surface/learning-center-contract.yml",
  queue: "docs/surface/queue-state-contract.yml",
  device: "docs/surface/device-trust-experience-contract.yml",
  evidence: "docs/surface/evidence-trust-experience-contract.yml",
  permission: "docs/surface/permission-explainability-contract.yml",
  operation: "docs/surface/operation-panel-runtime-contract.yml",
  api: "docs/surface/surface-api-boundary.yml",
  runtimeGuard: "docs/surface/surface-runtime-guard-contract.yml"
};

const artifacts = {
  "surface-experience-contract": "artifacts/surface/surface-experience-contract-result.json",
  "mobile-pc-surface-boundary": "artifacts/surface/mobile-pc-boundary-result.json",
  "operational-copy-matrix": "artifacts/surface/mobile-visible-copy-result.json",
  "mobile-visible-copy": "artifacts/surface/mobile-visible-copy-result.json",
  "no-raw-surface-labels": "artifacts/surface/mobile-visible-copy-result.json",
  "mobile-search-contract": "artifacts/surface/search-learning-contract-result.json",
  "learning-center-contract": "artifacts/surface/search-learning-contract-result.json",
  "queue-state-contract": "artifacts/surface/queue-state-contract-result.json",
  "device-trust-contract": "artifacts/surface/device-trust-contract-result.json",
  "evidence-trust-contract": "artifacts/surface/evidence-trust-contract-result.json",
  "permission-explainability-contract": "artifacts/surface/permission-explainability-contract-result.json",
  "operation-panel-runtime-contract": "artifacts/surface/operation-panel-runtime-contract-result.json",
  "surface-api-boundary": "artifacts/surface/surface-api-boundary-result.json",
  "surface-runtime-guard-contract": "artifacts/surface/backend-runtime-guard-result.json"
};

export function runSurfaceCheck(checkName) {
  const violations = [];
  const contracts = readContracts(violations);
  const rendered = renderMobileSurfaces();
  const source = readSources();

  validateRequiredFiles(contracts, violations);
  switch (checkName) {
    case "surface-experience-contract":
      validateSurfaceExperience(contracts, source, violations);
      validateStatusBoundary(contracts.experience, violations);
      break;
    case "mobile-pc-surface-boundary":
      validateMobilePcBoundary(contracts, source, violations);
      break;
    case "operational-copy-matrix":
      validateOperationalCopy(contracts, source, violations);
      break;
    case "mobile-visible-copy":
      validateMobileVisibleCopy(contracts, rendered, violations);
      break;
    case "no-raw-surface-labels":
      validateNoRawSurfaceLabels(contracts, rendered, source, violations);
      break;
    case "mobile-search-contract":
      validateSearch(contracts, rendered, source, violations);
      break;
    case "learning-center-contract":
      validateLearning(contracts, rendered, source, violations);
      break;
    case "queue-state-contract":
      validateQueue(contracts, rendered, source, violations);
      break;
    case "device-trust-contract":
      validateDeviceTrust(contracts, rendered, source, violations);
      break;
    case "evidence-trust-contract":
      validateEvidenceTrust(contracts, source, violations);
      break;
    case "permission-explainability-contract":
      validatePermissionExplainability(contracts, rendered, source, violations);
      break;
    case "operation-panel-runtime-contract":
      validateOperationPanelRuntime(contracts, rendered, source, violations);
      break;
    case "surface-api-boundary":
      validateSurfaceApiBoundary(contracts, source, violations);
      break;
    case "surface-runtime-guard-contract":
      validateSurfaceRuntimeGuard(contracts, source, violations);
      break;
    default:
      violations.push(violation("surface.unknown_check", `未知 Surface checker：${checkName}。`, { checkName }));
  }

  writeArtifact(checkName, violations);
  if (violations.length) {
    for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
    throw new Error(`${checkName} failed.`);
  }
  console.log(`${checkName}: PASS`);
}

function validateRequiredFiles(contracts, violations) {
  for (const [name, relativePath] of Object.entries(docs)) {
    if (!contracts[name]) violations.push(violation("surface.contract_missing", `缺少合同文件 ${relativePath}。`, { relativePath }));
    const schemaPath = `schemas/surface/${path.basename(relativePath).replace(/\.yml$/, ".schema.json")}`;
    if (!fs.existsSync(path.join(root, schemaPath))) {
      violations.push(violation("surface.schema_missing", `缺少 schema ${schemaPath}。`, { schemaPath }));
    }
  }
}

function validateSurfaceExperience(contracts, source, violations) {
  const requiredContracts = contracts.experience?.requiredContracts ?? [];
  for (const relativePath of Object.values(docs)) {
    if (relativePath !== docs.experience && !requiredContracts.includes(relativePath)) {
      violations.push(violation("surface.experience.contract_not_referenced", `总合同未引用 ${relativePath}。`, { relativePath }));
    }
  }
  for (const script of contracts.experience?.machineChecks ?? []) {
    if (!fs.existsSync(path.join(root, script))) {
      violations.push(violation("surface.experience.machine_check_missing", `总合同引用的 checker 不存在：${script}。`, { script }));
    }
  }
  if (!source.workflow.includes("scripts/surface/check-surface-experience-contract.mjs")) {
    violations.push(violation("surface.experience.ci_missing", "CI 必须接入 scripts/surface/check-surface-experience-contract.mjs。"));
  }
}

function validateStatusBoundary(contract, violations) {
  if (contract?.statusBoundary?.dormitoryL2ProductionAllowed !== false) {
    violations.push(violation("surface.boundary.dorm_l2_not_blocked", "合同必须明确 Dormitory L2 Production 不允许。"));
  }
  if (contract?.statusBoundary?.repairPartsHrProductionAllowed !== false) {
    violations.push(violation("surface.boundary.downstream_not_l0", "合同必须明确 Repair / Parts / HR 未放开 production。"));
  }
  if (contract?.statusBoundary?.businessProductionGo !== false) {
    violations.push(violation("surface.boundary.business_go_not_blocked", "合同不得声明 Business Production GO。"));
  }
}

function validateMobilePcBoundary(contracts, source, violations) {
  for (const view of contracts.mobile?.forbiddenViews ?? []) {
    if ((contracts.mobile?.allowedViews ?? []).includes(view)) {
      violations.push(violation("surface.boundary.forbidden_mobile_view", `Mobile allowedViews 不得包含 PC surface ${view}。`, { view }));
    }
  }
  for (const token of ["financeReconciliationView", "pcGovernanceView", "releaseControlView"]) {
    if (source.appRouter.includes(token)) {
      violations.push(violation("surface.boundary.mobile_router_imports_pc", `appRouter 不得直接 import ${token}。`, { token }));
    }
  }
  if (!source.appRouter.includes("routePcSurface") || !source.appRouter.includes("isPcSurfaceView")) {
    violations.push(violation("surface.boundary.pc_route_tree_missing", "appRouter 必须通过 PC route tree 分流 PC surfaces。"));
  }
  if (!source.eventBinder.includes('import("./pcEventBinder.js")')) {
    violations.push(violation("surface.boundary.pc_event_lazy_missing", "PC event binder 必须按 PC surface 懒加载。"));
  }
  for (const token of ["confirmBankStatementImport", "recordGovernanceAuditEvent", "requestLedgerCorrection"]) {
    if (source.apiClient.includes(token)) {
      violations.push(violation("surface.boundary.pc_api_in_mobile", `Mobile apiClient 不得包含 PC API ${token}。`, { token }));
    }
    if (!source.pcApiClient.includes(token)) {
      violations.push(violation("surface.boundary.pc_api_missing", `PC API ${token} 必须在 pcApiClient。`, { token }));
    }
  }
}

function validateOperationalCopy(contracts, source, violations) {
  const copy = contracts.copy;
  for (const label of ["今天", "工作", "搜索", "我的", "Сегодня", "Работа", "Поиск", "Мой"]) {
    if (!source.shellCopy.includes(label)) {
      violations.push(violation("surface.copy.locale_missing", `缺少本地化文案 ${label}。`, { label }));
    }
  }
  for (const [component, label] of Object.entries(copy?.componentCopy ?? {})) {
    if (!source.shellCopy.includes(label) && !source.experienceComponents.includes(label)) {
      violations.push(violation("surface.copy.component_label_missing", `${component} 必须显示为 ${label}。`, { component, label }));
    }
  }
}

function validateMobileVisibleCopy(contracts, rendered, violations) {
  const html = Object.values(rendered).join("\n");
  for (const label of contracts.mobile?.bottomNavigation ?? []) {
    if (!html.includes(label)) {
      violations.push(violation("surface.visible.bottom_nav_missing", `普通移动端缺少底部导航文案：${label}。`, { label }));
    }
  }
  for (const token of contracts.mobile?.visibleDomForbiddenTokens ?? []) {
    if (html.includes(token)) {
      violations.push(violation("surface.visible.forbidden_token", `普通移动端可见 HTML 不得出现 ${token}。`, { token }));
    }
  }
}

function validateNoRawSurfaceLabels(contracts, rendered, source, violations) {
  const text = visibleText(Object.values(rendered).join("\n"));
  for (const token of contracts.mobile?.visibleDomForbiddenRawKeys ?? []) {
    if (new RegExp(`\\b${escapeRegExp(token)}\\b`).test(text)) {
      violations.push(violation("surface.visible.raw_key", `普通移动端可见文本不得出现 raw key ${token}。`, { token }));
    }
  }
  for (const token of ["UploadQueue", "SubmitQueue", "DeviceTrustPanel", "WorkItemMissionControl", "PersonalOpsCenter", "OperationPanelView", "TrustedConfirmSheet", "EvidenceSheet", "ProjectionPendingState", "ActionResult"]) {
    const visibleLiteralPattern = new RegExp(`>${escapeRegExp(token)}<|<h1>${escapeRegExp(token)}|<b>${escapeRegExp(token)}|<span>${escapeRegExp(token)}`);
    if (visibleLiteralPattern.test(`${source.homeView}\n${source.meView}\n${source.searchView}\n${source.operationPanel}\n${source.experienceComponents}`)) {
      violations.push(violation("surface.visible.raw_component_name", `模板不得可见输出组件名 ${token}。`, { token }));
    }
  }
  for (const token of ["operationsPrepare", "operationsConfirm"]) {
    if (visibleText(rendered.operationPanel).includes(token)) {
      violations.push(violation("surface.visible.raw_runtime_action", `Operation Panel 可见文本不得出现 ${token}。`, { token }));
    }
  }
}

function validateSearch(contracts, rendered, source, violations) {
  for (const label of ["WorkOS 搜索", "待办任务", "业务记录", "房间", "床位", "入住", "证据", "提交轨迹", "学习内容"]) {
    if (!rendered.search.includes(label)) {
      violations.push(violation("surface.search.section_missing", `Search 缺少 ${label}。`, { label }));
    }
  }
  if (!source.searchView.includes("localizedTitle") && !(contracts.search?.resultContract ?? []).includes("localizedTitle")) {
    violations.push(violation("surface.search.localized_result_missing", "Search 合同必须定义 localized title/subtitle/status/nextAction。"));
  }
  for (const token of ["PC Governance", "Release Control", "Finance admin"]) {
    if (rendered.search.includes(token)) {
      violations.push(violation("surface.search.pc_raw_visible", `普通 mobile search 不得显示 ${token}。`, { token }));
    }
  }
}

function validateLearning(contracts, rendered, source, violations) {
  for (const label of contracts.learning?.topics ?? []) {
    if (!rendered.search.includes(label) && !rendered.home.includes(label)) {
      violations.push(violation("surface.learning.topic_missing", `学习内容缺少主题：${label}。`, { label }));
    }
  }
  if (!rendered.me.includes("学习中心")) {
    violations.push(violation("surface.learning.me_entry_missing", "Learning Center 必须在 Me 中可见。"));
  }
  if (!source.homeView.includes("todayLearning")) {
    violations.push(violation("surface.learning.today_missing", "Today 必须支持今日必学。"));
  }
}

function validateQueue(contracts, rendered, source, violations) {
  for (const label of ["证据上传", "提交队列", "没有待上传证据", "没有待提交办理"]) {
    if (!rendered.me.includes(label)) {
      violations.push(violation("surface.queue.copy_missing", `Me 队列缺少 ${label}。`, { label }));
    }
  }
  const queueUsesSurfaceAttribute =
    source.experienceComponents.includes('data-surface="${attr(component, ctx)}"') ||
    (source.experienceComponents.includes('data-surface="upload-queue"') && source.experienceComponents.includes('data-surface="submit-queue"'));
  if (!queueUsesSurfaceAttribute) {
    violations.push(violation("surface.queue.data_surface_missing", "Upload/Submit queue 必须使用 surface 标记而不是组件名。"));
  }
}

function validateDeviceTrust(contracts, rendered, source, violations) {
  if (!rendered.me.includes("当前设备")) {
    violations.push(violation("surface.device.label_missing", "Me 必须显示当前设备。"));
  }
  if (!source.experienceComponents.includes("deviceContextIssue") || !source.experienceComponents.includes("pc-")) {
    violations.push(violation("surface.device.pc_context_guard_missing", "DeviceTrustPanel 必须诊断 PC device context 泄露。"));
  }
}

function validateEvidenceTrust(contracts, source, violations) {
  if (!source.experienceComponents.includes("EvidenceTile") || !source.experienceComponents.includes("EvidenceSheet")) {
    violations.push(violation("surface.evidence.component_missing", "EvidenceTile / EvidenceSheet 必须存在。"));
  }
  if (contracts.evidence?.missingBlocksConfirm !== true || contracts.evidence?.rejectedBlocksConfirm !== true) {
    violations.push(violation("surface.evidence.blocks_confirm_missing", "missing/rejected evidence 必须阻断 confirm。"));
  }
  if (!source.runtimeTests.includes("evidence_object_scope_mismatch") && !source.runtimeTests.includes("EvidenceAttachPilotScopeTests")) {
    violations.push(violation("surface.evidence.backend_scope_missing", "后端测试必须覆盖 evidence scope。"));
  }
}

function validatePermissionExplainability(contracts, rendered, source, violations) {
  for (const label of ["权限诊断", "为什么不能访问", "谁能处理", "需要的权限", "下一步动作"]) {
    if (!source.experienceComponents.includes(label) && !source.shellCopy.includes(label)) {
      violations.push(violation("surface.permission.copy_missing", `PermissionDiagnostic 缺少 ${label}。`, { label }));
    }
  }
  if (!source.navigationController.includes("evaluateSurfaceAccess")) {
    violations.push(violation("surface.permission.guard_missing", "setView 必须经过 SurfaceGuard。"));
  }
}

function validateOperationPanelRuntime(contracts, rendered, source, violations) {
  if (!source.operationPanel.includes("state.selectedWorkItemId = persistedWorkItemId")) {
    violations.push(violation("surface.operation_panel.persisted_resolution_missing", "OperationPanelView 必须把 legacy id 归一到 persisted WorkItemId。"));
  }
  if (source.operationPanel.includes("ctx.workspace()")) {
    violations.push(violation("surface.operation_panel.workspace_fallback", "OperationPanelView 不得用 ctx.workspace() 重建 runtime identity。"));
  }
  for (const token of ["allowCompatibilityFallback = false", "persisted_work_item_required"]) {
    if (!source.operationRuntime.includes(token)) {
      violations.push(violation("surface.operation_panel.compatibility_block_missing", `operationRuntime 缺少 ${token}。`, { token }));
    }
  }
  if (!source.operationRuntime.includes("prepareOperationWorkItem") || !source.operationRuntime.includes("confirmOperationWorkItem")) {
    violations.push(violation("surface.operation_panel.operations_api_missing", "Operation Panel 必须使用 operations prepare/confirm。"));
  }
  if (rendered.operationPanel.includes("T-ROOM-CREATE")) {
    violations.push(violation("surface.operation_panel.legacy_id_visible", "Operation Panel 不得显示 T-ROOM-CREATE。"));
  }
}

function validateSurfaceApiBoundary(contracts, source, violations) {
  for (const token of contracts.api?.mobileForbiddenApiTokens ?? []) {
    if (source.apiClient.includes(token)) {
      violations.push(violation("surface.api.mobile_forbidden_token", `Mobile apiClient 不得包含 ${token}。`, { token }));
    }
  }
  for (const header of contracts.api?.pcRequiredHeaders ?? []) {
    if (!source.pcApiClient.includes(header)) {
      violations.push(violation("surface.api.pc_header_missing", `PC API 必须包含 ${header}。`, { header }));
    }
  }
  if (contracts.api?.pageSpecificBusinessWriteApiAllowed !== false) {
    violations.push(violation("surface.api.page_specific_write_not_blocked", "合同必须禁止 page-specific business write API。"));
  }
}

function validateSurfaceRuntimeGuard(contracts, source, violations) {
  for (const file of [
    "tests/WorkOS.RuntimeIntegrationTests/MobileSurfaceRuntimeGuardTests.cs",
    "tests/WorkOS.RuntimeIntegrationTests/PcGovernanceSurfaceRuntimeGuardTests.cs",
    "tests/WorkOS.RuntimeIntegrationTests/SearchScopeRuntimeTests.cs",
    "tests/WorkOS.RuntimeIntegrationTests/LearningScopeRuntimeTests.cs",
    "tests/WorkOS.RuntimeIntegrationTests/OperationsConfirmPilotScopeTests.cs",
    "tests/WorkOS.RuntimeIntegrationTests/WorkspaceCardCompatibilityPilotScopeTests.cs",
    "tests/WorkOS.RuntimeIntegrationTests/EvidenceAttachPilotScopeTests.cs",
    "tests/WorkOS.RuntimeIntegrationTests/FinanceMoneyCommandPilotScopeTests.cs"
  ]) {
    if (!fs.existsSync(path.join(root, file))) {
      violations.push(violation("surface.runtime_guard.test_missing", `缺少后端 runtime guard 测试 ${file}。`, { file }));
    }
  }
  for (const marker of ["mobile token", "pc governance", "learning content", "workspace/card compatibility"]) {
    if (!(contracts.runtimeGuard?.backendGuards ?? []).join(" ").includes(marker)) {
      violations.push(violation("surface.runtime_guard.contract_marker_missing", `后端 guard 合同缺少 ${marker}。`, { marker }));
    }
  }
  if (contracts.runtimeGuard?.frontendGuardIsNotAuthorization !== true) {
    violations.push(violation("surface.runtime_guard.frontend_not_auth_missing", "合同必须声明 SurfaceGuard 不是后端授权替代。"));
  }
}

function readContracts(violations) {
  const result = {};
  for (const [name, relativePath] of Object.entries(docs)) {
    try {
      result[name] = JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
    } catch (error) {
      violations.push(violation("surface.contract_parse_failed", `合同解析失败：${relativePath}。`, { relativePath, error: error.message }));
    }
  }
  return result;
}

function readSources() {
  const source = {
    workflow: read(".github/workflows/ci.yml"),
    apiClient: read("apps/mobile/src/apiClient.js"),
    appRouter: read("apps/mobile/src/appRouter.js"),
    eventBinder: read("apps/mobile/src/eventBinder.js"),
    experienceComponents: read("apps/mobile/src/views/experienceComponents.js"),
    homeView: read("apps/mobile/src/views/homeView.js"),
    meView: read("apps/mobile/src/views/meView.js"),
    searchView: read("apps/mobile/src/views/searchView.js"),
    operationPanel: read("apps/mobile/src/views/operationPanelView.js"),
    operationRuntime: read("apps/mobile/src/operationRuntime.js"),
    pcApiClient: read("apps/mobile/src/pcApiClient.js"),
    shellCopy: read("apps/mobile/src/i18n/shellCopy.js"),
    navigationController: read("apps/mobile/src/navigationController.js"),
    runtimeTests: ""
  };
  const testDir = path.join(root, "tests/WorkOS.RuntimeIntegrationTests");
  if (fs.existsSync(testDir)) {
    source.runtimeTests = fs.readdirSync(testDir)
      .filter((name) => name.endsWith(".cs"))
      .map((name) => read(path.join("tests/WorkOS.RuntimeIntegrationTests", name)))
      .join("\n");
  }
  return source;
}

function renderMobileSurfaces() {
  const state = {
    view: "home",
    lang: "zh-CN",
    apiStatus: "online",
    query: "住宿",
    recentSearches: [],
    queueDomain: "all",
    queueBadge: "mine",
    selectedWorkItemId: "T-ROOM-CREATE",
    selectedWorkspace: "W-STAY-RESOURCE",
    selectedCardId: "roomSetup",
    currentActor: { role: "operator", displayName: "内测经办人" },
    currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
    pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" } },
    runtimeStore: runtimeStore()
  };
  const ctx = {
    state,
    shell: (content) => content,
    tr: (key) => escape(i18n[state.lang][key] || key),
    tx: (value) => escape(typeof value === "string" ? value : value?.[state.lang] || value?.["zh-CN"] || ""),
    localTerm: (value) => escape(value?.label?.[state.lang] || value?.label?.["zh-CN"] || value?.id || value),
    escapeHtml: escape,
    escapeAttr: escape,
    metric: (value, label) => `<article><span>${label}</span><strong>${value}</strong></article>`,
    render: () => {}
  };
  const render = (view) => {
    state.view = view;
    return routeView(ctx);
  };
  return {
    home: render("home"),
    me: render("me"),
    search: render("search"),
    operationPanel: render("operationPanel")
  };
}

function runtimeStore() {
  return {
    workspaces: [{
      id: "W-STAY-RESOURCE",
      domain: "stay",
      caseId: "case:W-STAY-RESOURCE",
      title: { "zh-CN": "住宿资源", "ru-RU": "Ресурс проживания" },
      summary: { "zh-CN": "房间床位入住资源", "ru-RU": "Комнаты и койки" },
      next: { "zh-CN": "先配置房间和床位", "ru-RU": "Настройте комнаты и койки" },
      blockers: [],
      cards: [{
        id: "roomSetup",
        status: "ready",
        workItemId: "T-ROOM-CREATE",
        title: { "zh-CN": "房间床位配置", "ru-RU": "Комнаты и койки" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [{ id: "room-duplicate-check", label: { "zh-CN": "房间重复校验" } }],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
      }]
    }],
    workQueue: [{
      workItemId: "W-STAY-RESOURCE:roomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      caseId: "case:W-STAY-RESOURCE",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "ready",
      ownerRole: "operator",
      traceRefs: ["trace-room"],
      commandSubmissionId: "cmd-room",
      reason: "先配置房间和床位"
    }],
    operationWorkItems: [{
      workItemId: "W-STAY-RESOURCE:roomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      caseId: "case:W-STAY-RESOURCE",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "ready",
      ownerRole: "operator",
      traceRefs: ["trace-room"],
      commandSubmissionId: "cmd-room",
      reason: "先配置房间和床位"
    }],
    homeSurface: [],
    learningCatalog: [],
    searchResultsByQuery: {}
  };
}

function writeArtifact(checkName, violations) {
  const relativePath = artifacts[checkName] || `artifacts/surface/${checkName}-result.json`;
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({
    generated_at_utc: new Date().toISOString(),
    generated_by: `scripts/surface/check-${checkName}.mjs`,
    status: violations.length ? "failed" : "passed",
    check: checkName,
    violation_count: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function visibleText(value) {
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
