import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-ui-readside-experience-result.json";
const files = {
  matrix: "docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml",
  workbenchView: "apps/mobile/src/views/workbenchView.js",
  apiClient: "apps/mobile/src/apiClient.js",
  runtimeApiPaths: "apps/mobile/src/generated/runtimeApiPaths.js",
  dashboardCheck: "scripts/oam/check-dashboard-readonly.mjs",
  searchCheck: "scripts/check-search-kernel.mjs",
  surfaceCheck: "scripts/oam/check-surface-language-v2.mjs",
  surfaceContractCheck: "scripts/check-surface-contract.mjs"
};
const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
const violations = [];

checkMatrixUiContract();
checkWorkbenchExperience();
checkConfirmPathOnly();
checkReadSideProofs();
writeResult();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Dormitory UI/readside experience check: PASS");

function checkMatrixUiContract() {
  for (const token of [
    "uiMayNotInferAdmission: true",
    "dashboardSearchSurfaceMayNotWriteFacts: true",
    "readonlyCarryForward: true",
    "confirmPathOnly: true",
    "noInlineConfirm: true",
    "SearchResult: readonly",
    "Projection: readonly",
    "Dashboard: readonly"
  ]) {
    requireText(source.matrix, token, "ui.matrix_boundary_missing", `场景矩阵缺少 UI/读侧边界：${token}`);
  }
}

function checkWorkbenchExperience() {
  for (const token of [
    "workMyCanDo",
    "workBlocked",
    "workMissingEvidence",
    "waitingFinance",
    "completedWorkItems",
    "WorkItemCard",
    "selectWorkbenchQueue",
    "selectCompletedWorkbenchQueue"
  ]) {
    requireText(source.workbenchView, token, "ui.workbench_state_missing", `工作台缺少预期状态或 WorkItem 渲染：${token}`);
  }
  for (const scenario of ["Resource", "Checkin", "Deposit", "Payment", "Service", "Checkout", "Expense", "Period"]) {
    requireText(source.workbenchView, `workScenario${scenario}`, "ui.workbench_scenario_missing", `工作台缺少场景筛选：${scenario}`);
  }
}

function checkConfirmPathOnly() {
  requireText(source.runtimeApiPaths, "operationsConfirm: (workItemId) => `/api/operations/work-items/${workItemId}/confirm`", "ui.confirm_endpoint_missing", "移动端运行时路径必须暴露 WorkItem confirm endpoint。");
  requireText(source.apiClient, "confirmOperationWorkItem", "ui.confirm_client_missing", "移动端 API client 必须通过 confirmOperationWorkItem 确认。");
  requireText(source.apiClient, "runtimeApiPaths.operationsConfirm(workItemId)", "ui.confirm_path_not_used", "confirmOperationWorkItem 必须调用 WorkItem confirm path。");
  for (const forbidden of ["confirmCard(", "prepareCard("]) {
    if (source.apiClient.includes(forbidden)) {
      violations.push(v("ui.old_card_api_present", `移动端 API client 不得使用旧 card API：${forbidden}`));
    }
  }
}

function checkReadSideProofs() {
  for (const token of [
    "Dashboard business fact write must fail.",
    "Dashboard inline confirm must fail.",
    "onlyNavigationToWorkItemConfirmPath",
    "navigateToWorkItemConfirmPath"
  ]) {
    requireText(source.dashboardCheck, token, "ui.dashboard_proof_missing", `Dashboard 只读证明缺少：${token}`);
  }
  for (const token of ["writeThroughSearchAllowed", "writeBusinessFactAllowed", "writeBusinessFact"]) {
    requireText(source.searchCheck, token, "ui.search_proof_missing", `Search 只读证明缺少：${token}`);
  }
  for (const token of ["normalizeStructuredToken", "gateResultForSearchItem", "writeBusinessFactAllowed"]) {
    requireText(source.surfaceCheck, token, "ui.surface_proof_missing", `Surface 结构化/只读证明缺少：${token}`);
  }
  for (const token of ["confirmOperationWorkItem", "Operation panel must route active work through the shared card shell"]) {
    requireText(source.surfaceContractCheck, token, "ui.surface_contract_proof_missing", `Surface confirm path 证明缺少：${token}`);
  }
}

function requireText(text, token, id, message) {
  if (!text.includes(token)) violations.push(v(id, message, { token }));
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function v(id, message, extra = {}) {
  return { id, severity: "P0", message, ...extra };
}

function writeResult() {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.dormitory-ui-readside-experience-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    checkedFiles: Object.values(files),
    violations
  }, null, 2)}\n`, "utf8");
}
