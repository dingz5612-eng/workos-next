import { describe, expect, it } from "vitest";
import { buildOperationActionState } from "../operationActionState.js";
import { routeView } from "../appRouter.js";
import { saveDraft } from "../operationDrafts.js";
import { primaryActionButton } from "../views/workspaceView.js";
import { createSurfaceCtx, runtimeStore, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM Surface primary action state machine", () => {
  it("renders one internal-observation submit CTA when the active card is ready", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({ view: "workspace", runtimeStore: store });

    const html = routeView(ctx);

    expect((html.match(/data-submit-card/g) || []).length).toBe(1);
    expect(visibleText(html)).toContain("填写房间信息");
  });

  it("uses generated confirmation labels for non-scenario1 operation cards", () => {
    const ctx = createSurfaceCtx({ lang: "ru-RU" });
    const card = {
      id: "cert.selectBaseReadyResource",
      status: "ready",
      confirmation: {
        required: true,
        requiredRole: "operator",
        label: {
          "zh-CN": "提交选择已基础就绪房源",
          "ru-RU": "Отправить: Выбрать готовую комнату или койку"
        }
      }
    };
    const workItem = {
      workspaceId: "W-DORM-RESOURCE-OPERATION-STATUS-TEST",
      cardId: "cert.selectBaseReadyResource",
      admission: {
        visibleAllowed: true,
        prepareAllowed: true,
        confirmAllowed: true,
        productionAllowed: false,
        mode: "internal_pilot_observation"
      }
    };

    const actionState = buildOperationActionState(workItem, card, null, ctx.state);
    const html = primaryActionButton(actionState, ctx);
    const text = visibleText(html);

    expect(text).toContain("Отправить: Выбрать готовую комнату или койку");
    expect(text).not.toContain("Отправить запись наблюдения");
  });

  it("does not render a second card-internal submit button", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({ view: "workspace", runtimeStore: store });

    const html = routeView(ctx);

    expect(html).not.toContain("submitForReview");
    expect((html.match(/data-submit-card/g) || []).length).toBe(1);
  });

  it.each([
    ["blocked", "查看暂不能提交的原因"],
    ["notStarted", "请先完成上一张卡"],
    ["done", "已完成"]
  ])("maps %s card state to the primary CTA", (status, label) => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].status = status;
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({ view: "workspace", runtimeStore: store });

    const html = routeView(ctx);

    expect(visibleText(html)).toContain(label);
    expect((html.match(/data-submit-card/g) || []).length).toBe(0);
  });

  it("does not repeat blocker explanations inside the primary CTA", () => {
    const ctx = createSurfaceCtx();
    const actionState = buildOperationActionState({}, { status: "notStarted" });
    const html = primaryActionButton(actionState, ctx);
    const text = visibleText(html);

    expect(text).toContain("请先完成上一张卡");
    expect(text).not.toContain("这张卡还没轮到办理");
    expect(html).toContain("title=");
  });

  it("maps submitting and submitted states to recovery actions", () => {
    const card = { id: "cert.roomSetupConfirm", status: "ready", evidence: [] };
    const workItem = { workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm" };

    expect(buildOperationActionState(workItem, card, { status: "submitting" }).primaryAction.labelKey).toBe("primarySubmitting");
    expect(buildOperationActionState(workItem, card, { status: "committed_projected" }).primaryAction.labelKey).toBe("primaryViewTrace");
    expect(buildOperationActionState(workItem, card, { status: "committed_projection_pending" }).primaryAction.labelKey).toBe("primaryRefreshStatus");
  });

  it("does not show submit labels after a successful submit", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeStore: store,
      lastActionResult: { status: "committed_projected", message: "已提交" }
    });

    const text = visibleText(routeView(ctx));

    expect(text).toContain("查看办理记录");
    expect(text).not.toContain("提交处理");
    expect(text).not.toContain("提交办理记录");
    expect(text).not.toContain("确认办理");
  });

  it("does not bind submit when Admission denies confirm", () => {
    const card = { id: "cert.roomSetupConfirm", status: "ready", evidence: [] };
    const workItem = {
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
      admission: {
        visibleAllowed: true,
        prepareAllowed: true,
        confirmAllowed: false,
        productionAllowed: false,
        mode: "contract_preview"
      }
    };
    const ctx = createSurfaceCtx();
    const actionState = buildOperationActionState(workItem, card, null, ctx.state);
    const html = primaryActionButton(actionState, ctx);

    expect(actionState.status).toBe("confirmDenied");
    expect(html).not.toContain("data-submit-card");
    expect(visibleText(html)).toContain("查看暂不能提交的原因");
  });

  it("does not bind submit when a Surface card has no Admission contract", () => {
    const card = { id: "cert.roomSetupConfirm", status: "ready", evidence: [] };
    const workItem = {
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm"
    };
    const ctx = createSurfaceCtx();
    const actionState = buildOperationActionState(workItem, card, null, ctx.state);
    const html = primaryActionButton(actionState, ctx);

    expect(actionState.status).toBe("confirmDenied");
    expect(actionState.admission.prepareAllowed).toBe(false);
    expect(actionState.admission.confirmAllowed).toBe(false);
    expect(actionState.admission.productionAllowed).toBe(false);
    expect(actionState.admission.reason).toBe("missing_admission_contract");
    expect(html).not.toContain("data-submit-card");
    expect(visibleText(html)).toContain("查看暂不能提交的原因");
  });

  it("keeps projection pending distinct from failure", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeStore: store,
      lastActionResult: { status: "committed_projection_pending", message: "已提交，视图同步中" }
    });

    const text = visibleText(routeView(ctx));

    expect(text).toContain("刷新状态");
    expect(text).toContain("视图同步中");
    expect(text).not.toContain("提交失败");
  });

  it.each([
    ["permission_blocked_403", "primaryViewPermission"],
    ["idempotency_conflict_409", "primaryViewTrace"],
    ["business_blocked_422", "primaryCompleteEvidence", "evidence_missing"]
  ])("maps %s to a specific recovery action", (status, labelKey, reason = "") => {
    const card = { id: "cert.roomSetupConfirm", status: "ready", evidence: [] };
    const workItem = { workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm" };

    expect(buildOperationActionState(workItem, card, { status, reason }).primaryAction.labelKey).toBe(labelKey);
  });

  it("maps non-evidence business blockers to blocker guidance", () => {
    const card = { id: "cert.roomSetupConfirm", status: "ready", evidence: [] };
    const workItem = { workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm" };

    expect(buildOperationActionState(workItem, card, {
      status: "business_blocked_422",
      reason: "persisted_work_item_required"
    }).primaryAction.labelKey).toBe("primaryViewBlocker");
  });

  it("maps local required-field validation to a field completion action", () => {
    const card = { id: "cert.roomSetupConfirm", status: "ready", evidence: [] };
    const workItem = { workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm" };

    expect(buildOperationActionState(workItem, card, {
      status: "business_blocked_422",
      reason: "required_field_missing"
    }).primaryAction.labelKey).toBe("primaryCompleteRequiredFields");
  });

  it("keeps required-field recovery bound to submit revalidation", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].evidence = [];
    const ctx = createSurfaceCtx({
      view: "workspace",
      runtimeStore: store,
      lastActionResult: {
        status: "business_blocked_422",
        reason: "required_field_missing"
      }
    });

    const html = routeView(ctx);

    expect(visibleText(html)).toContain("补齐必填项");
    expect((html.match(/data-submit-card/g) || []).length).toBe(1);
  });

  it("keeps evidence recovery bound to Operations Runtime evidence materialization", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].evidence = [{ id: "room-photo", label: { "zh-CN": "房间照片" } }];
    const ctx = createSurfaceCtx({
      view: "workspace",
      runtimeStore: store,
      lastActionResult: {
        status: "business_blocked_422",
        reason: "missing_required_evidence"
      }
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(text).toContain("补齐证据");
    expect((html.match(/data-submit-card/g) || []).length).toBe(1);
    expect(html).not.toContain('data-action-state="missingEvidence"');
  });

  it("counts missing evidence in the pre-submit check summary", () => {
    const store = runtimeStore();
    const evidenceOnlyCard = {
      ...store.workspaces[0].cards[0],
      id: "custom.evidenceOnly",
      workItemId: "wi-evidence-only",
      fields: { business: [], system: [], analytics: [] },
      evidence: [{ id: "room-photo", label: { "zh-CN": "房间照片" } }]
    };
    store.workspaces[0].cards[0] = evidenceOnlyCard;
    store.operationWorkItems[0] = {
      ...store.operationWorkItems[0],
      workItemId: "wi-evidence-only",
      cardId: evidenceOnlyCard.id,
      card: evidenceOnlyCard
    };
    store.workQueue[0] = {
      ...store.workQueue[0],
      workItemId: "wi-evidence-only",
      cardId: evidenceOnlyCard.id
    };
    saveDraft(store.workspaces[0].id, evidenceOnlyCard.id, {}, [{
      requirementId: "room-photo",
      evidenceId: "evidence-room-photo-draft",
      source: "system"
    }]);
    const ctx = createSurfaceCtx({
      view: "workspace",
      runtimeStore: store,
      selectedWorkItemId: "wi-evidence-only",
      selectedCardId: evidenceOnlyCard.id
    });

    const text = visibleText(routeView(ctx));

    expect(text).toContain("材料核对: 房间照片");
    expect(text).toContain("提交状态: 暂不能提交: 材料核对");
    expect(text).not.toContain("提交状态: 可以提交");
  });
});
