import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pcManagerLiteView } from "../views/checkoutServiceView.js";
import { workspaceView } from "../views/workspaceView.js";

describe("Checkout / Service mobile and PC manager surfaces", () => {
  it("mobile_checkout_start_opens_operation_panel", () => {
    const html = workspaceView(ctx({ selectedCardId: "checkoutStart" }));

    expect(html).toContain("data-checkout-start-action");
    expect(html).toContain("发起退住 action");
    expect(html).toContain("退住开始");
    expect(html).toContain("data-submit-card");
    expect(html).toContain("cardConfirm");
  });

  it("mobile_case_timeline_shows_blocker", () => {
    const html = workspaceView(ctx({ selectedCardId: "roomInspection" }));

    expect(html).toContain("data-checkout-case-timeline");
    expect(html).toContain("查房");
    expect(html).toContain("押金处理");
    expect(html).toContain("余额关闭");
    expect(html).toContain("清洁/维修");
    expect(html).toContain("床位释放");
    expect(html).toContain("DamageAssessment fields");
    expect(html).toContain("损坏扣款金额");
    expect(html).toContain("ServiceTask card");
    expect(html).toContain("data-service-task-complete");
    expect(html).toContain("当前仍有欠款未关闭");
    expect(html).toContain("责任角色");
    expect(html).toContain("finance");
  });

  it("mobile_blocker_resolve_action_creates_work_item", () => {
    const html = workspaceView(ctx({ selectedCardId: "finalBalanceClose" }));

    expect(html).toContain("data-blocker-resolve");
    expect(html).toContain("data-resolve-action=\"createBalanceCloseWorkItem\"");
    expect(html).toContain("data-workspace=\"W-STAY-CHECKOUT-SETTLEMENT\"");
    expect(html).toContain("data-card-id=\"finalBalanceClose\"");
  });

  it("pc_manager_checkout_timeline_loads", () => {
    const html = pcManagerLiteView(ctx());

    expect(html).toContain("PC Manager Lite");
    expect(html).toContain("Checkout Case Timeline");
    expect(html).toContain("退住开始");
    expect(html).toContain("CaseClosureCheck detail");
    expect(html).toContain("closure-check-1");
  });

  it("pc_blocker_list_shows_owner_and_due", () => {
    const html = pcManagerLiteView(ctx());

    expect(html).toContain("Blocker List");
    expect(html).toContain("当前仍有欠款未关闭");
    expect(html).toContain("finance");
    expect(html).toContain("2026-06-01T10:00:00Z");
  });

  it("no_page_specific_checkout_api", () => {
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
  const service = serviceWorkspace();
  const state = {
    lang: "zh-CN",
    selectedCardIndex: -1,
    selectedCardId: overrides.selectedCardId || "checkoutStart",
    selectedWorkspace: "W-STAY-CHECKOUT-SETTLEMENT",
    projectionEvents: [
      event("Accommodation.ResidentCheckedOut", "checkoutStart"),
      event("Accommodation.CaseClosurePolicyFailed", "finalBalanceClose", {
        caseClosureCheckId: "closure-check-1",
        blockerCode: "OUTSTANDING_BALANCE",
        message: "当前仍有欠款未关闭",
        ownerRole: "finance",
        resolveAction: "createBalanceCloseWorkItem",
        relatedObjectType: "Stay",
        relatedObjectId: "stay-test",
        dueAtUtc: "2026-06-01T10:00:00Z",
        blockerCount: "1"
      })
    ],
    checkoutManager: {
      blockers: [
        {
          blockerCode: "OUTSTANDING_BALANCE",
          message: "当前仍有欠款未关闭",
          ownerRole: "finance",
          resolveAction: "createBalanceCloseWorkItem",
          relatedObject: "Stay:stay-test",
          dueAt: "2026-06-01T10:00:00Z"
        }
      ],
      caseClosureChecks: [
        {
          checkId: "closure-check-1",
          canClose: false,
          blockerCount: 1,
          status: "failed"
        }
      ]
    },
    accommodationLenses: {
      "checkout-queue": [
        { checkoutId: "checkout-test", currentBalance: "1200 KGS", status: "open" }
      ],
      "service-task-queue": [
        {
          taskId: "service-task-1",
          taskType: "cleaning",
          status: "open",
          assignedRole: "operator",
          dueAt: "2026-06-02T10:00:00Z"
        }
      ]
    },
    runtimeStore: {
      workspaces: [checkout, service],
      events: [],
      workQueue: [
        {
          queueItemId: "wi-overdue-1",
          workspaceId: "W-STAY-CHECKOUT-SETTLEMENT",
          cardId: "finalBalanceClose",
          status: "overdue",
          dueAt: "2026-05-01T10:00:00Z"
        }
      ],
      accommodationLenses: {}
    },
    ...overrides.state
  };

  return {
    state,
    shell: (content) => content,
    workspace: () => checkout,
    tr: (key) => key,
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
      card("depositSettlement", "blocked", "押金处理卡", ["depositId"]),
      card("finalBalanceClose", "blocked", "余额关闭卡", ["stayId"]),
      card("bedRelease", "notStarted", "床位释放卡", ["bedId"]),
      card("postCheckoutCleaning", "notStarted", "退住后清洁卡", ["serviceTaskId"])
    ]
  };
}

function serviceWorkspace() {
  return {
    id: "W-STAY-SERVICE-TASK",
    domain: "repair",
    taskId: "T-SERVICE",
    title: text("我要处理服务任务"),
    summary: text("创建、分派、完成和验收服务任务。"),
    next: text("完成后上传凭证。"),
    blockers: [],
    cards: [
      card("serviceTaskCreate", "ready", "服务任务创建卡", ["taskId"]),
      card("serviceTaskAssign", "notStarted", "服务任务分派卡", ["taskId"]),
      card("serviceTaskComplete", "ready", "服务任务完成卡", ["taskId", "completionResult"], ["completionEvidence"]),
      card("serviceTaskVerify", "notStarted", "服务任务验收卡", ["taskId"]),
      card("roomReleaseAfterService", "notStarted", "服务后释放房间卡", ["roomId"])
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
    blockerRules: id === "finalBalanceClose" ? [
      {
        id: "OUTSTANDING_BALANCE",
        title: text("当前仍有欠款未关闭"),
        ownerRole: "finance",
        unblockAction: text("createBalanceCloseWorkItem")
      }
    ] : [],
    events: [],
    transitions: {},
    confirmation: { required: true, requiredRole: "operator" }
  };
}

function field(id) {
  const labels = {
    damageFound: "是否发现损坏",
    damageDescription: "损坏说明",
    damageChargeAmount: "损坏扣款金额"
  };
  return {
    id,
    label: text(labels[id] || id),
    type: id.includes("Amount") ? "money" : "text",
    ui: { control: "text", options: [], defaultValue: "", readonly: false },
    help: text("")
  };
}

function event(eventType, cardId, payload = {}) {
  return {
    eventId: `${eventType}-${cardId}`,
    workspaceId: "W-STAY-CHECKOUT-SETTLEMENT",
    cardId,
    eventType,
    payload
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
