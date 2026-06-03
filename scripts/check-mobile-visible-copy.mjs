import fs from "node:fs";
import path from "node:path";
import { i18n } from "../apps/mobile/src/i18n.js";
import { routeView } from "../apps/mobile/src/appRouter.js";

const root = process.cwd();
const out = ".tmp/surface/mobile-visible-copy-report.json";
const violations = [];
const rendered = {
  home: render("home"),
  me: render("me"),
  search: render("search")
};
const html = Object.values(rendered).join("\n");
const text = visibleText(html);

for (const token of [
  "UploadQueue",
  "SubmitQueue",
  "DeviceTrustPanel",
  "WorkItemMissionControl",
  "PersonalOpsCenter",
  "No pending evidence upload",
  "No pending submission",
  "pc-current",
  "surface pc"
]) {
  if (html.includes(token)) {
    violations.push(violation("mobile.visible_copy.forbidden_token", `普通移动端 HTML 不得出现 ${token}。`, { token }));
  }
}

for (const token of ["deviceId", "trustState", "surface"]) {
  if (new RegExp(`\\b${token}\\b`).test(text)) {
    violations.push(violation("mobile.visible_copy.raw_field", `普通移动端可见文本不得出现 raw field key ${token}。`, { token }));
  }
}

for (const label of ["今天", "工作", "搜索", "我的"]) {
  if (!html.includes(label)) {
    violations.push(violation("mobile.visible_copy.bottom_nav_missing", `底部导航缺少中文 copy：${label}。`, { label }));
  }
}

for (const label of ["证据上传", "提交队列", "当前设备", "没有待上传证据", "没有待提交办理", "学习中心"]) {
  if (!rendered.me.includes(label)) {
    violations.push(violation("mobile.visible_copy.me_copy_missing", `Me 页面缺少中文 copy：${label}。`, { label }));
  }
}

for (const label of ["WorkOS 搜索", "待办任务", "业务记录", "房间", "床位", "入住", "证据", "提交轨迹", "学习内容"]) {
  if (!rendered.search.includes(label)) {
    violations.push(violation("mobile.visible_copy.search_copy_missing", `Search 页面缺少 WorkOS Search copy：${label}。`, { label }));
  }
}

writeReport();
if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("Mobile visible copy check failed.");
}

console.log("Mobile visible copy check: PASS");

function render(view) {
  const state = {
    view,
    lang: "zh-CN",
    apiStatus: "online",
    query: "住宿",
    recentSearches: [],
    queueDomain: "all",
    queueBadge: "mine",
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
  return routeView(ctx);
}

function runtimeStore() {
  return {
    workspaces: [{
      id: "W-STAY-RESOURCE",
      domain: "stay",
      caseId: "case:W-STAY-RESOURCE",
      title: { "zh-CN": "住宿资源" },
      summary: { "zh-CN": "房间床位入住资源" },
      next: { "zh-CN": "先配置房间和床位" },
      cards: [{
        id: "roomSetup",
        status: "ready",
        title: { "zh-CN": "房间床位配置" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [{ id: "room-duplicate-check", label: { "zh-CN": "房间重复校验" } }],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }]
    }],
    workQueue: [{
      queueItemId: "q-room",
      workItemId: "W-STAY-RESOURCE:roomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      caseId: "case:W-STAY-RESOURCE",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "ready",
      ownerRole: "operator",
      badges: ["mine", "ready"],
      traceRefs: ["trace-room"],
      commandSubmissionId: "cmd-room",
      reason: "先配置房间和床位"
    }],
    operationWorkItems: [],
    homeSurface: [],
    learningCatalog: [],
    searchResultsByQuery: {}
  };
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

function writeReport() {
  const reportPath = path.join(root, out);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({
    generated_at_utc: new Date().toISOString(),
    generated_by: "check-mobile-visible-copy",
    status: violations.length ? "failed" : "passed",
    rendered_surfaces: Object.keys(rendered),
    violations
  }, null, 2)}\n`, "utf8");
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
