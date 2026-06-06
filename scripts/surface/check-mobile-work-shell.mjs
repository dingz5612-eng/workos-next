import fs from "node:fs";
import path from "node:path";
import { i18n } from "../../apps/mobile/src/i18n.js";
import { routeView } from "../../apps/mobile/src/appRouter.js";
import { shell } from "../../apps/mobile/src/appShell.js";

const root = process.cwd();
const artifactPath = "artifacts/oam/checks/mobile-work-productization-result.json";
const violations = [];
const html = renderMobile();
const text = visibleText(html);

for (const label of ["必须做", "即将超时", "缺材料/缺证据", "等他人", "等待财务", "刚提交 / 同步中", "风险提醒", "全部工作项", "我的可办", "有阻断", "等他人处理", "可转交", "住宿资源", "入住收款", "押金", "普通收款", "服务任务", "退住", "支出", "周期复盘"]) {
  if (!text.includes(label)) violations.push(v("mobile_work.ia_missing", `移动端 IA 缺少 ${label}`, { label }));
}

const todayOverview = html.match(/<section class="command-card today-focus-overview"[\s\S]*?<\/section>/)?.[0] || "";
if (todayOverview.includes("data-work-filter") || todayOverview.includes('data-view="workbench"')) {
  violations.push(v("mobile_work.today_filter_leaks_workbench", "今日重点数字只能使用 data-today-filter，不得复用 data-work-filter 跳工作项。"));
}

if (!html.includes("data-today-filter=\"must-do\"") || !html.includes("data-work-filter=\"all-work\"") || !html.includes("data-mobile-work-scenario-ia")) {
  violations.push(v("mobile_work.filter_contract_missing", "Today / Work 必须拆成 data-today-filter 和 data-work-filter 两套合同，并包含场景筛选。"));
}

if (text.includes("今日必学")) {
  violations.push(v("mobile_work.today_learning_retired", "Today 首页内容区不得再放今日必学；学习入口应从搜索或我的进入。"));
}

if (!html.includes('aria-label="移动端主导航"') || !html.includes('aria-current="page"')) {
  violations.push(v("mobile_work.nav_a11y_missing", "底部导航必须有 aria-label 和 aria-current。"));
}

if (text.includes("runtimeAudit") || text.includes("rf-") || text.includes("engineering diagnostic")) {
  violations.push(v("mobile_work.diagnostic_queue_visible", "普通移动队列不得出现 runtimeAudit / rf / engineering diagnostic WorkItem。"));
}

if (text.includes("PC Governance") || text.includes("Release Control") || text.includes("Finance admin")) {
  violations.push(v("mobile_work.pc_surface_visible", "移动端普通工作面不得显示 PC-only surface。"));
}

writeArtifact();
if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("mobile work shell check failed.");
}
console.log("mobile work shell check: PASS");

function renderMobile() {
  const state = {
    view: "home",
    lang: "zh-CN",
    apiStatus: "online",
    query: "住宿",
    queueDomain: "all",
    queueBadge: "all",
    todayFilter: "must-do",
    selectedWorkspace: "W-STAY-RESOURCE",
    selectedCardId: "roomSetup",
    currentActor: { role: "operator", displayName: "内测经办人" },
    currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
    runtimeStore: runtimeStore()
  };
  const ctx = {
    state,
    shell: (content) => shell(content, ctx),
    tr: (key) => escape(i18n["zh-CN"][key] || key),
    tx: (value) => escape(typeof value === "string" ? value : value?.["zh-CN"] || ""),
    localTerm: (value) => escape(value?.label?.["zh-CN"] || value?.id || value),
    escapeHtml: escape,
    escapeAttr: escape,
    metric: (value, label) => `<article><span>${escape(i18n["zh-CN"][label] || label)}</span><strong>${value}</strong></article>`,
    render: () => {}
  };
  const views = ["home", "workbench", "search", "me"];
  return views.map((view) => {
    state.view = view;
    return routeView(ctx);
  }).join("\n");
}

function runtimeStore() {
  const workspace = {
    id: "W-STAY-RESOURCE",
    domain: "stay",
    caseId: "case:W-STAY-RESOURCE",
    title: { "zh-CN": "住宿资源" },
    summary: { "zh-CN": "房间床位入住资源" },
    next: { "zh-CN": "先配置房间和床位" },
    blockers: [],
    cards: [{
      id: "roomSetup",
      status: "ready",
      title: { "zh-CN": "房间床位配置" },
      fields: { business: [], system: [], analytics: [] },
      evidence: [{ id: "room-duplicate-check", label: { "zh-CN": "房间重复校验" } }],
      checks: [],
      blockerRules: [],
      confirmation: { required: true }
    }]
  };
  return {
    workspaces: [workspace],
    workQueue: [
      { workItemId: "W-STAY-RESOURCE:roomSetup", workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup", domain: "stay", lifecycleState: "ready", badges: ["mine", "ready"], reason: "先配置房间和床位" },
      { workItemId: "runtimeAudit-001", workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup", domain: "diagnostic", badges: ["mine"] }
    ],
    operationWorkItems: []
  };
}

function writeArtifact() {
  const fullPath = path.join(root, artifactPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "scripts/surface/check-mobile-work-shell.mjs",
    status: violations.length ? "failed" : "passed",
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    violations
  }, null, 2)}\n`, "utf8");
}

function visibleText(value) {
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function escape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
