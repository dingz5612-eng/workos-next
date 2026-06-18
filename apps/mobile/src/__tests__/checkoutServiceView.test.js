import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { routePcSurface } from "../pcRouteTree.js";
import { workspaceView } from "../views/workspaceView.js";

describe("retired checkout / service entry quarantine", () => {
  it("opens legacy checkout workspaces as readonly archive records", () => {
    const html = workspaceView(ctx({ selectedCardId: "checkoutStart" }));

    expect(html).toContain('data-legacy-archive-readonly="true"');
    expect(html).toContain("这是历史只读记录");
    expect(html).toContain("请从“工作项”或“搜索”进入当前住宿办理");
    expect(html).not.toContain("data-submit-card");
    expect(html).not.toContain("data-checkout-start-action");
    expect(html).not.toContain('data-workspace="W-STAY-CHECKOUT-SETTLEMENT"');
    expect(html).not.toContain("Checkout Manager");
  });

  it("routes pcManager alias to the current manager control tower", () => {
    const html = routePcSurface(ctx({ state: { view: "pcManager" } }));

    expect(html).toContain("data-pc-manager-control-tower");
    expect(html).toContain("经理控制塔");
    expect(html).not.toContain("PC Manager Lite");
    expect(html).not.toContain("Checkout Manager");
    expect(html).not.toContain("data-checkout-case-timeline");
  });

  it("keeps retired checkout without page-specific checkout API", () => {
    const root = repoRoot();
    const program = readFileSync(resolve(root, "services/core-api/WorkOS.Api/Program.cs"), "utf8");
    const generatedPaths = readFileSync(resolve(root, "apps/mobile/src/generated/runtimeApiPaths.js"), "utf8");
    const apiClient = readFileSync(resolve(root, "apps/mobile/src/apiClient.js"), "utf8");

    expect(program).not.toContain("/api/checkout/close");
    expect(generatedPaths).not.toContain("/api/checkout/close");
    expect(apiClient).not.toContain("/api/checkout/close");
  });
});

function ctx(overrides = {}) {
  const checkout = checkoutWorkspace();
  const state = {
    lang: "zh-CN",
    view: "workspace",
    selectedCardIndex: -1,
    selectedCardId: overrides.selectedCardId || "checkoutStart",
    selectedWorkspace: "W-STAY-CHECKOUT-SETTLEMENT",
    projectionEvents: [],
    runtimeStore: {
      workspaces: [checkout],
      events: [],
      workQueue: [],
      operationWorkItems: [],
      accommodationLenses: {}
    },
    accommodationLenses: {},
    pcGovernance: {},
    bankStatementImport: {},
    ...overrides.state
  };

  return {
    state,
    shell: (content) => content,
    workspace: () => checkout,
    tr: (key) => ({
      legacyArchivedReadonly: "这是历史只读记录，已归档到历史材料；如需继续办理，请从“新建房间和床位”重新进入。",
      completedRecordReadonly: "只读记录",
      intentWorkspace: "办理工作区",
      apiOffline: "暂时没有可用数据",
      coachNoMatch: "没有找到办理项"
    }[key] || key),
    tx: (value) => tx(value, state.lang),
    localTerm: (value) => tx(value?.label || value?.title || value, state.lang),
    escapeHtml,
    escapeAttr
  };
}

function checkoutWorkspace() {
  return {
    id: "W-STAY-CHECKOUT-SETTLEMENT",
    domain: "stay",
    taskId: "T-CHECKOUT",
    title: text("我要办理退住结算"),
    summary: text("处理退住、查房、押金、余额、清洁和床位释放。"),
    next: text("先确认阻断，再走 Operations Confirm。"),
    blockers: [],
    cards: [
      card("checkoutStart", "ready", "退住开始卡", ["stayId", "checkoutReason"]),
      card("roomInspection", "ready", "查房卡", ["inspectionId", "damageFound", "damageDescription", "damageChargeAmount", "cleaningRequired"], ["inspectionPhoto"]),
      card("finalBalanceClose", "blocked", "余额关闭卡", ["stayId"])
    ]
  };
}

function card(id, status, title, fieldIds, evidenceIds = []) {
  return {
    id,
    status,
    title: text(title),
    fields: {
      system: [],
      business: fieldIds.map((fieldId) => field(fieldId)),
      analytics: []
    },
    evidence: evidenceIds.map((evidenceId) => ({
      id: evidenceId,
      label: text(evidenceId),
      required: true,
      source: "operator",
      auditEventField: evidenceId
    })),
    checks: [],
    blockerRules: [],
    events: [],
    transitions: {},
    confirmation: { required: true, requiredRole: "operator" }
  };
}

function field(id) {
  return {
    id,
    label: text(id),
    type: "text",
    ui: { control: "text", options: [], defaultValue: "", readonly: false },
    help: text("")
  };
}

function text(value) {
  return { "zh-CN": value, "ru-RU": value };
}

function tx(value, lang) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value["zh-CN"] || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}
