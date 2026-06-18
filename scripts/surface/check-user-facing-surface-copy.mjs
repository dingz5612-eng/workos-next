import fs from "node:fs";
import path from "node:path";
import { i18n } from "../../apps/mobile/src/i18n.js";
import { routeView } from "../../apps/mobile/src/appRouter.js";
import { shell } from "../../apps/mobile/src/appShell.js";

const root = process.cwd();
const artifactPath = "artifacts/oam/checks/user-facing-surface-copy-result.json";
const violations = [];

const rendered = renderAll();
const visible = visibleText(Object.values(rendered).join("\n"));

for (const label of ["今天", "工作", "搜索", "我的", "必须做", "缺证据", "等待财务", "上传队列", "提交队列", "设备可信"]) {
  if (!visible.includes(label)) {
    violations.push(v("surface_copy.zh_label_missing", `普通移动端缺少中文用户文案：${label}`, { label }));
  }
}

for (const token of [
  "UploadQueue",
  "SubmitQueue",
  "DeviceTrustPanel",
  "WorkItemMissionControl",
  "PersonalOpsCenter",
  "OperationPanelView",
  "TrustedConfirmSheet",
  "EvidenceSheet",
  "ProjectionPendingState",
  "ActionResult",
  "[object Object]",
  "apiBaseUrl",
  "payload fingerprint"
]) {
  if (visible.includes(token)) {
    violations.push(v("surface_copy.raw_visible_token", `普通用户可见文案不得出现 ${token}`, { token }));
  }
}

for (const rawKey of ["workItemId", "caseId", "lifecycleState", "ownerRole", "payloadHash", "commandSubmissionId", "deviceId", "trustState", "surface"]) {
  if (new RegExp(`\\b${rawKey}\\b`).test(visible)) {
    violations.push(v("surface_copy.raw_key_visible", `普通用户可见文本不得出现 raw key ${rawKey}`, { rawKey }));
  }
}

if (/http:\/\/127\.0\.0\.1|localhost:\d+/.test(visible)) {
  violations.push(v("surface_copy.api_url_visible", "普通用户页面不得默认显示 API base URL。"));
}

writeArtifact();
if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("user-facing surface copy check failed.");
}
console.log("user-facing surface copy check: PASS");

function renderAll() {
  const state = {
    view: "home",
    lang: "zh-CN",
    apiStatus: "online",
    query: "住宿",
    recentSearches: [],
    queueDomain: "all",
    queueBadge: "mine",
    selectedWorkItemId: "wi-dorm-room-setup",
    selectedWorkspace: "W-DORM-MAINLINE",
    selectedCardId: "cert.roomSetupConfirm",
    currentActor: { role: "operator", displayName: "住宿经办人" },
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
  const render = (view) => {
    state.view = view;
    return routeView(ctx);
  };
  return {
    home: render("home"),
    workbench: render("workbench"),
    search: render("search"),
    me: render("me"),
    operationPanel: render("operationPanel")
  };
}

function runtimeStore() {
  return {
    workspaces: [{
      id: "W-DORM-MAINLINE",
      domain: "stay",
      caseId: "case:W-DORM-MAINLINE",
      title: { "zh-CN": "房源建档与基础就绪" },
      summary: { "zh-CN": "房间建档、床位组确认和基础就绪确认" },
      next: { "zh-CN": "发起房源建档与基础就绪" },
      blockers: [],
      cards: [{
        id: "cert.roomSetupConfirm",
        status: "ready",
        title: { "zh-CN": "房间建档确认" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [{ id: "room-duplicate-check", label: { "zh-CN": "房间重复校验" } }],
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
      badges: ["mine", "ready"],
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
      reason: "发起房源建档与基础就绪"
    }]
  };
}

function writeArtifact() {
  const fullPath = path.join(root, artifactPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "scripts/surface/check-user-facing-surface-copy.mjs",
    status: violations.length ? "failed" : "passed",
    checkedViews: Object.keys(rendered),
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    violations
  }, null, 2)}\n`, "utf8");
}

function visibleText(html) {
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function escape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
