import fs from "node:fs";
import path from "node:path";
import { i18n } from "../../../apps/mobile/src/i18n.js";
import { routeView } from "../../../apps/mobile/src/appRouter.js";
import { shell as appShell } from "../../../apps/mobile/src/appShell.js";

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
  "surface-experience-contract": "artifacts/oam/checks/surface-experience-contract-result.json",
  "mobile-pc-surface-boundary": "artifacts/oam/checks/mobile-pc-boundary-result.json",
  "operational-copy-matrix": "artifacts/oam/checks/mobile-visible-copy-result.json",
  "mobile-visible-copy": "artifacts/oam/checks/mobile-visible-copy-result.json",
  "no-raw-surface-labels": "artifacts/oam/checks/mobile-visible-copy-result.json",
  "mobile-search-contract": "artifacts/oam/checks/search-learning-contract-result.json",
  "learning-center-contract": "artifacts/oam/checks/search-learning-contract-result.json",
  "queue-state-contract": "artifacts/oam/checks/queue-state-contract-result.json",
  "device-trust-contract": "artifacts/oam/checks/device-trust-contract-result.json",
  "evidence-trust-contract": "artifacts/oam/checks/evidence-trust-contract-result.json",
  "permission-explainability-contract": "artifacts/oam/checks/permission-explainability-contract-result.json",
  "operation-panel-runtime-contract": "artifacts/oam/checks/operation-panel-runtime-contract-result.json",
  "surface-api-boundary": "artifacts/oam/checks/surface-api-boundary-result.json",
  "surface-runtime-guard-contract": "artifacts/oam/checks/backend-runtime-guard-result.json"
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
  validatePcGovernanceOperationalRiskCommand(source, violations);
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
  if (!rendered.search.includes('data-shell-page="search"') || !rendered.search.includes('class="search-box"')) {
    violations.push(violation("surface.search.shell_title_missing", "Search 必须使用移动端共享顶部栏标题和搜索框，而不是正文重复页面标题。"));
  }
  for (const label of contracts.search?.contentTitleForbidden ?? []) {
    if (rendered.search.includes(label)) {
      violations.push(violation("surface.search.duplicate_content_title", `Search 正文不得重复通用页面标题 ${label}。`, { label }));
    }
  }
  for (const label of contracts.search?.sections ?? []) {
    const source = label === "主动办理" ? rendered.searchCommand : rendered.search;
    if (!source.includes(label)) {
      violations.push(violation("surface.search.section_missing", `Search 缺少 ${label}。`, { label }));
    }
  }
  for (const sectionId of contracts.search?.sectionsMovedToMe ?? []) {
    if (rendered.search.includes(`data-search-section="${sectionId}"`)) {
      violations.push(violation("surface.search.activity_log_section_leaked", `Search 不得展示个人资料库 section ${sectionId}。`, { sectionId }));
    }
  }
  const personalActivityLogLabels = ["业务记录", "已完成记录", "证据", "学习中心"];
  for (const label of personalActivityLogLabels) {
    if (!rendered.me.includes(label)) {
      violations.push(violation("surface.search.activity_log_not_in_me", `Me 必须承接个人资料入口：${label}。`, { label }));
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
  if (!rendered.search.includes("data-search-admission-state") || !source.searchView.includes("data-search-admission-state")) {
    violations.push(violation("surface.search.admission_missing", "Search 结果卡必须携带 Admission 决策标记，但普通卡片不应强制展示准入术语。"));
  }
  if (contracts.search?.businessAnchor?.visible !== true ||
      !source.searchView.includes("BusinessSummaryHeader") ||
      !source.experienceComponents.includes("businessAnchorFieldsHtml") ||
      !rendered.search.includes('data-surface="business-anchor-fields"')) {
    violations.push(violation("surface.search.business_anchor_missing", "Search 结果卡必须使用 Business Anchor 展示人可记忆的业务锚点。"));
  }
  if (contracts.search?.businessAnchor?.mustMergeOperationsWorkItems !== true ||
      !source.navigationController.includes("operationWorkItemsFromSearchResults") ||
      !source.navigationController.includes("applyRuntimeSurfacePayloads")) {
    violations.push(violation("surface.search.operations_result_not_openable", "Search 后端返回的 Operations 工作项必须合并进可打开的运行时待办池。"));
  }
  for (const token of ["admissionDecisionRef", "blockedAdapter", "definitionId", "raw reason", "raw code"]) {
    if (visibleText(rendered.search).includes(token)) {
      violations.push(violation("surface.search.admission_raw_visible", `Search 普通用户文案不得显示 ${token}。`, { token }));
    }
  }
}

function validatePcGovernanceOperationalRiskCommand(source, violations) {
  const panelSource = source.pcGovernanceView.match(/function riskCommandPanel[\s\S]+?function accountUsersPanel/)?.[0] || "";
  if (!panelSource) {
    violations.push(violation("surface.pc.risk_command_missing", "PC 风险作战室必须有独立 riskCommandPanel。"));
    return;
  }
  for (const label of ["影响", "负责人", "建议动作", "进入处理"]) {
    if (!panelSource.includes(label)) {
      violations.push(violation("surface.pc.risk_command_operator_label_missing", `风险作战室缺少运营可读字段：${label}。`, { label }));
    }
  }
  if (panelSource.includes("tableOrEmpty") || panelSource.includes("drilldownUrl\"]")) {
    violations.push(violation("surface.pc.risk_command_technical_table", "风险作战室不得回退成风险编号 / URL 技术表格。"));
  }
  if (!source.pcGovernanceView.includes("risk-command-card") || !source.pcGovernanceView.includes("data-risk-action")) {
    violations.push(violation("surface.pc.risk_command_action_missing", "风险作战室必须用运营卡片并提供进入处理动作。"));
  }
}

function validateLearning(contracts, rendered, source, violations) {
  for (const label of contracts.learning?.topics ?? []) {
    if (!rendered.learning.includes(label)) {
      violations.push(violation("surface.learning.topic_missing", `学习内容缺少主题：${label}。`, { label }));
    }
  }
  if (!rendered.me.includes("学习中心")) {
    violations.push(violation("surface.learning.me_entry_missing", "Learning Center 必须在 Me 中可见。"));
  }
  if (source.homeView.includes("todayLearning")) {
    violations.push(violation("surface.learning.today_source-locked", "Today 首页内容区不得再放今日必学；学习内容应通过 Me 进入。"));
  }
  if (contracts.learning?.searchCanFindLearning === false && source.searchView.includes("learningResults")) {
    violations.push(violation("surface.learning.search_activity_log_leaked", "Search 不得直接渲染学习内容结果；学习内容归 Me / Learning Center。"));
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
  const todayOverview = rendered.home.match(/<section class="command-card today-focus-overview"[\s\S]*?<\/section>/)?.[0] || "";
  if (!source.queueSelectors.includes("selectTodayFocusQueue") || !source.homeView.includes("todayFocusItems")) {
    violations.push(violation("surface.today.selector_missing", "Today 必须通过 selectTodayFocusQueue / todayFocusItems 渲染本页今日列表。"));
  }
  if (todayOverview.includes("data-work-filter") || todayOverview.includes('data-view="workbench"')) {
    violations.push(violation("surface.today.workbench_filter_leak", "Today 指标按钮不得使用 data-work-filter 或跳转 Workbench。"));
  }
  for (const token of ["data-today-filter=\"must-do\"", "data-today-filter=\"due-soon\"", "data-today-filter=\"missing-evidence\"", "data-today-filter=\"waiting-others\"", "data-today-filter=\"waiting-finance\"", "data-today-filter=\"just-submitted\"", "data-today-filter=\"risk-reminder\""]) {
    if (!rendered.home.includes(token)) {
      violations.push(violation("surface.today.filter_missing", `Today 缺少本页筛选 ${token}。`, { token }));
    }
  }
  for (const token of ["data-work-filter=\"all-work\"", "data-work-filter=\"can-do\"", "data-work-filter=\"blocked\"", "data-work-filter=\"need-evidence\"", "data-work-filter=\"waiting-others\"", "data-work-filter=\"waiting-finance\"", "data-work-filter=\"due-risk\"", "data-work-filter=\"transferable\"", "data-work-filter=\"just-submitted\"", "data-mobile-work-scenario-ia", "riskSort", "recentSort"]) {
    if (!rendered.workbench.includes(token)) {
      violations.push(violation("surface.work.filter_missing", `Work 缺少全量工作筛选或排序 ${token}。`, { token }));
    }
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
    violations.push(violation("surface.operation_panel.persisted_resolution_missing", "OperationPanelView 必须把 non-persisted id 归一到 persisted WorkItemId。"));
  }
  if (source.operationPanel.includes("ctx.workspace()")) {
    violations.push(violation("surface.operation_panel.workspace_fallback", "OperationPanelView 不得用 ctx.workspace() 重建 runtime identity。"));
  }
  if (!source.operationRuntime.includes("persisted_work_item_required")) {
    violations.push(violation("surface.operation_panel.persisted_block_missing", "operationRuntime 缺少 persisted_work_item_required 阻断。"));
  }
  for (const token of ["allowBlockedFallback", "submitCardOperationBlockedFallback", "prepareCard", "confirmCard"]) {
    if (source.operationRuntime.includes(token)) {
      violations.push(violation("surface.operation_panel.mobile_runtime_blocked_fallback", `operationRuntime 不得包含 ${token}。`, { token }));
    }
  }
  if (!source.operationRuntime.includes("prepareOperationWorkItem") || !source.operationRuntime.includes("confirmOperationWorkItem")) {
    violations.push(violation("surface.operation_panel.operations_api_missing", "Operation Panel 必须使用 operations prepare/confirm。"));
  }
  if (rendered.operationPanel.includes("T-ROOM-CREATE")) {
    violations.push(violation("surface.operation_panel.non_persisted_id_visible", "Operation Panel 不得显示 T-ROOM-CREATE。"));
  }
  if (!rendered.operationPanel.includes("准入状态") || !source.operationPanel.includes("operation-admission")) {
    violations.push(violation("surface.operation_panel.admission_missing", "Operation Panel 必须显示顶部 Admission 准入状态。"));
  }
  if (!source.operationActionState.includes("admissionStateFromWorkItem") || !source.operationActionState.includes("readyObservation") || !source.operationActionState.includes("confirmDenied")) {
    violations.push(violation("surface.operation_panel.admission_action_missing", "OperationActionState 必须由 Admission 决定 confirmDenied / readyObservation。"));
  }
  if (!source.operationController.includes("safeConfirmErrorKey") || source.operationController.includes("error?.reason || error?.code || \"\"")) {
    violations.push(violation("surface.operation_panel.raw_error_passthrough", "confirm error/blocked 文案不得直接拼接 raw reason/code。"));
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
    "tests/WorkOS.RuntimeIntegrationTests/EvidenceAttachPilotScopeTests.cs",
    "tests/WorkOS.RuntimeIntegrationTests/FinanceMoneyCommandPilotScopeTests.cs"
  ]) {
    if (!fs.existsSync(path.join(root, file))) {
      violations.push(violation("surface.runtime_guard.test_missing", `缺少后端 runtime guard 测试 ${file}。`, { file }));
    }
  }
  for (const marker of ["mobile token", "pc governance", "learning content", "operations confirm"]) {
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
    operationActionState: read("apps/mobile/src/operationActionState.js"),
    operationController: read("apps/mobile/src/operationController.js"),
    operationRuntime: read("apps/mobile/src/operationRuntime.js"),
    queueSelectors: read("apps/mobile/src/selectors/queueSelectors.js"),
    pcGovernanceView: read("apps/mobile/src/views/pcGovernanceView.js"),
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
    queueBadge: "all",
    todayFilter: "must-do",
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
    shell: (content) => appShell(content, ctx),
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
    workbench: render("workbench"),
    me: render("me"),
    search: render("search"),
    searchCommand: renderWith({ view: "search", query: "房源建档与基础就绪" }),
    learning: renderWith({ view: "learning", learningQuery: "" }),
    operationPanel: render("operationPanel")
  };
}

function renderWith(overrides = {}) {
  const state = {
    view: "home",
    lang: "zh-CN",
    apiStatus: "online",
    query: "住宿",
    recentSearches: [],
    queueDomain: "all",
    queueBadge: "all",
    todayFilter: "must-do",
    selectedWorkItemId: "wi-dorm-room-setup",
    selectedWorkspace: "W-DORM-MAINLINE",
    selectedCardId: "cert.roomSetupConfirm",
    currentActor: { role: "operator", displayName: "住宿经办人" },
    currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
    pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" } },
    runtimeStore: runtimeStore(),
    ...overrides
  };
  const ctx = {
    state,
    shell: (content) => appShell(content, ctx),
    tr: (key) => escape(i18n[state.lang][key] || key),
    tx: (value) => escape(typeof value === "string" ? value : value?.[state.lang] || value?.["zh-CN"] || ""),
    localTerm: (value) => escape(value?.label?.[state.lang] || value?.label?.["zh-CN"] || value?.id || value),
    escapeHtml: escape,
    escapeAttr: escape,
    metric: (value, label) => `<article><span>${label}</span><strong>${value}</strong></article>`,
    render: () => {}
  };
  return routeView(ctx);
}

function runtimeStore() {
  return {
    workspaces: [{
      id: "W-DORM-MAINLINE",
      domain: "stay",
      caseId: "case:W-DORM-MAINLINE",
      title: { "zh-CN": "房源建档与基础就绪", "ru-RU": "Ресурс проживания" },
      summary: { "zh-CN": "房间建档、床位组确认和基础就绪确认", "ru-RU": "Комнаты и койки" },
      next: { "zh-CN": "发起房源建档与基础就绪", "ru-RU": "Открыть карточку" },
      blockers: [],
      cards: [{
        id: "cert.roomSetupConfirm",
        status: "ready",
        workItemId: "wi-dorm-room-setup",
        title: { "zh-CN": "房间建档确认", "ru-RU": "Комнаты и койки" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [{ id: "room-basic-info-evidence", label: { "zh-CN": "房间基础资料证据" } }],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
      }]
    }],
    workQueue: [{
      workItemId: "wi-dorm-room-setup",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
      caseId: "case:W-DORM-MAINLINE",
      workItemType: "Dorm.RoomSetupConfirm",
      lifecycleState: "ready",
      ownerRole: "operator",
      traceRefs: ["trace-room"],
      commandSubmissionId: "cmd-room",
      reason: "发起房源建档与基础就绪"
    }],
    operationWorkItems: [{
      workItemId: "wi-dorm-room-setup",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
      caseId: "case:W-DORM-MAINLINE",
      workItemType: "Dorm.RoomSetupConfirm",
      lifecycleState: "ready",
      ownerRole: "operator",
      traceRefs: ["trace-room"],
      commandSubmissionId: "cmd-room",
      reason: "发起房源建档与基础就绪"
    }],
    homeSurface: [],
    learningCatalog: [],
    searchResultsByQuery: {}
  };
}

function writeArtifact(checkName, violations) {
  const relativePath = artifacts[checkName] || `artifacts/oam/checks/${checkName}-result.json`;
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
