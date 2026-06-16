import fs from "node:fs";
import path from "node:path";
import { i18n } from "../../apps/mobile/src/i18n.js";
import { routeView } from "../../apps/mobile/src/appRouter.js";
import { shell } from "../../apps/mobile/src/appShell.js";

const root = process.cwd();
const artifactPath = "artifacts/oam/checks/pc-governance-productization-result.json";
const violations = [];

const renders = {
  finance: renderPc("financeControl", "finance", ["finance.control.view", "finance.correction.approve.highRisk"]),
  manager: renderPc("managerControlTower", "manager", ["manager.control.view"]),
  governance: renderPc("governanceCenter", "admin", ["governance.center.view", "admin.role_capability.edit"]),
  release: renderPc("releaseFlightDeck", "releaseOwner", ["release.flight_deck.view"]),
  mobile: renderMobile()
};

assertPc("finance", renders.finance, ["财务对账与修正工作区", "银行流水导入"]);
assertPc("manager", renders.manager, ["经理控制塔", "风险总览"]);
assertPc("governance", renders.governance, ["治理中心", "受控导出"]);
assertPc("release", renders.release, ["发布工作区"]);

if (visibleText(renders.mobile).includes("PC Governance") || visibleText(renders.mobile).includes("财务对账与修正工作区")) {
  violations.push(v("pc_shell.mobile_leaks_pc_surface", "普通移动端不得泄露 PC surface。"));
}

for (const [name, html] of Object.entries(renders).filter(([name]) => name !== "mobile")) {
  if (!html.includes("surface-pc")) violations.push(v("pc_shell.missing_pc_class", `${name} 必须使用 PC desktop shell。`));
  if (html.includes("bottom-nav")) violations.push(v("pc_shell.mobile_bottom_nav_visible", `${name} 不得显示 mobile bottom nav。`));
}

writeArtifact();
if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("pc desktop shell check failed.");
}
console.log("pc desktop shell check: PASS");

function assertPc(name, html, labels) {
  const text = visibleText(html);
  for (const label of labels) {
    if (!text.includes(label)) violations.push(v("pc_shell.label_missing", `${name} 缺少中文工作区文案：${label}`, { label }));
  }
}

function renderPc(view, role, capabilities) {
  const state = baseState({ view, role, capabilities, surface: "pc" });
  const ctx = context(state);
  return routeView(ctx);
}

function renderMobile() {
  const state = baseState({ view: "home", role: "operator", capabilities: ["operation.confirm"], surface: "mobile" });
  const ctx = context(state);
  return routeView(ctx);
}

function baseState({ view, role, capabilities, surface }) {
  return {
    view,
    lang: "zh-CN",
    apiStatus: "online",
    query: "住宿",
    queueDomain: "all",
    queueBadge: "mine",
    selectedWorkItemId: "wi-dorm-room-setup",
    selectedWorkspace: "W-DORM-MAINLINE",
    selectedCardId: "cert.roomSetupConfirm",
    currentActor: { role, displayName: "内测人员", capabilities },
    currentDevice: { deviceId: `${surface}-current`, deviceTrustStatus: "trusted", surface },
    pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "trusted", surface: "pc" } },
    runtimeStore: { workspaces: [], workQueue: [], operationWorkItems: [] },
    releaseControl: { releases: [], selectedRelease: null },
    bankStatementImport: {}
  };
}

function context(state) {
  const ctx = {
    state,
    shell: (content) => shell(content, ctx),
    tr: (key) => escape(i18n["zh-CN"]?.[key] || key),
    tx: (value) => escape(typeof value === "string" ? value : value?.["zh-CN"] || ""),
    localTerm: (value) => escape(value?.label?.["zh-CN"] || value?.id || value),
    escapeHtml: escape,
    escapeAttr: escape,
    metric: (value, label) => `<article><span>${escape(i18n["zh-CN"]?.[label] || label)}</span><strong>${escape(value)}</strong></article>`,
    render: () => {},
    hydrateProjectionFromApi: async () => {},
    workspace: () => null
  };
  return ctx;
}

function writeArtifact() {
  const fullPath = path.join(root, artifactPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "scripts/surface/check-pc-desktop-shell.mjs",
    status: violations.length ? "failed" : "passed",
    checkedSurfaces: Object.keys(renders),
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

