import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = ".tmp/surface/no-raw-surface-labels-report.json";
const files = {
  shellCopy: "apps/mobile/src/i18n/shellCopy.js",
  homeView: "apps/mobile/src/views/homeView.js",
  meView: "apps/mobile/src/views/meView.js",
  searchView: "apps/mobile/src/views/searchView.js",
  experienceComponents: "apps/mobile/src/views/experienceComponents.js",
  apiClient: "apps/mobile/src/apiClient.js",
  pcApiClient: "apps/mobile/src/pcApiClient.js"
};
const source = Object.fromEntries(Object.entries(files).map(([key, relativePath]) => [key, read(relativePath)]));
const violations = [];

for (const [key, value] of Object.entries({
  today: "今天",
  work: "工作",
  search: "搜索",
  me: "我的",
  ruToday: "Сегодня",
  ruWork: "Работа",
  ruSearch: "Поиск",
  ruMe: "Мой"
})) {
  if (!source.shellCopy.includes(value)) {
    violations.push(violation("mobile.raw_surface.copy_key_missing", `shellCopy 缺少 ${key} locale copy。`, { key }));
  }
}

for (const token of ["UploadQueue", "SubmitQueue", "DeviceTrustPanel", "WorkItemMissionControl", "PersonalOpsCenter"]) {
  const visibleLiteralPattern = new RegExp(`>${escapeRegExp(token)}<|<h1>${escapeRegExp(token)}|<b>${escapeRegExp(token)}|<span>${escapeRegExp(token)}`);
  for (const [file, text] of Object.entries(source)) {
    if (visibleLiteralPattern.test(text)) {
      violations.push(violation("mobile.raw_surface.visible_component_name", `普通移动端可见模板不得输出组件名 ${token}。`, { file, token }));
    }
  }
}

for (const token of ["No pending evidence upload", "No pending submission", "surface pc", "pc-current"]) {
  for (const file of ["homeView", "meView", "searchView", "experienceComponents"]) {
    if (source[file].includes(token)) {
      violations.push(violation("mobile.raw_surface.raw_label", `普通移动端模板不得输出 raw surface label ${token}。`, { file, token }));
    }
  }
}

for (const token of ["deviceId", "trustState", "surface"]) {
  const visibleLiteralPattern = new RegExp(`>${escapeRegExp(token)}<|<dt>${escapeRegExp(token)}|<b>${escapeRegExp(token)}|<span>${escapeRegExp(token)}`);
  for (const file of ["homeView", "meView", "searchView", "experienceComponents"]) {
    if (visibleLiteralPattern.test(source[file])) {
      violations.push(violation("mobile.raw_surface.raw_visible_field", `普通移动端可见模板不得输出 raw field key ${token}。`, { file, token }));
    }
  }
}

for (const required of [
  'ctx.tr("searchPlaceholder")',
  'tr("personalBusinessLibrary")',
  'ctx.tr("learningCenter")',
  'ctx.tr("evidenceUpload")',
  'ctx.tr("submissionQueue")',
  'ctx.tr("currentDevice")'
]) {
  const combined = `${source.searchView}\n${source.meView}\n${source.experienceComponents}`;
  if (!combined.includes(required)) {
    violations.push(violation("mobile.raw_surface.copy_key_not_used", `Search/Learning/Me 必须使用 locale copy key：${required}。`, { required }));
  }
}

for (const token of ["confirmBankStatementImport", "recordGovernanceAuditEvent", "requestLedgerCorrection", "applyLedgerCorrection"]) {
  if (source.apiClient.includes(token)) {
    violations.push(violation("mobile.raw_surface.pc_api_in_mobile_client", `普通 mobile apiClient 不得包含 PC 控制 API ${token}。`, { token }));
  }
  if (!source.pcApiClient.includes(token)) {
    violations.push(violation("mobile.raw_surface.pc_api_not_split", `PC 控制 API ${token} 必须保留在 pcApiClient。`, { token }));
  }
}

writeReport();
if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("No raw surface labels check failed.");
}

console.log("No raw surface labels check: PASS");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function writeReport() {
  const reportPath = path.join(root, out);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({
    generated_at_utc: new Date().toISOString(),
    generated_by: "check-no-raw-surface-labels",
    status: violations.length ? "failed" : "passed",
    scanned_files: Object.values(files),
    violations
  }, null, 2)}\n`, "utf8");
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
