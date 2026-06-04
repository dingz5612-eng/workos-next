import { describe, expect, it, vi } from "vitest";
import { optionsForField } from "../controls/fieldControls.js";
import { clearDraft } from "../operationDrafts.js";
import { submitCurrentCard } from "../operationController.js";
import { ActionResult, EvidenceSheet, EvidenceStateVM, PermissionDiagnostic } from "../views/experienceComponents.js";
import { homeView } from "../views/homeView.js";
import { operationPanelView } from "../views/operationPanelView.js";
import { searchView } from "../views/searchView.js";
import { operationFieldId, workspaceView } from "../views/workspaceView.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM-04B business and technical layering contract", () => {
  it("hides operation technical proof by default while keeping non-visible audit selectors", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    const html = operationPanelView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
    expect(html).toContain('data-case-id=');
    expect(html).not.toContain('class="operation-technical-details"');
    expect(html).not.toContain("open>");
    expect(text).not.toMatch(/\b(workItemId|caseId|payloadHash|commandSubmissionId)\b/);
  });

  it("opens technical details under debugSurface", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel", debugSurface: true });
    const html = operationPanelView(ctx);

    expect(html).toContain("operation-technical-details");
    expect(html).toContain("open>");
    expect(visibleText(html)).toContain("审计详情");
  });

  it("hides workspace Operations step debug tabs unless debugSurface", () => {
    const normal = workspaceView(createSurfaceCtx({ view: "workspace" }));
    const debug = workspaceView(createSurfaceCtx({ view: "workspace", debugSurface: true }));

    expect(visibleText(normal)).not.toContain("Debug / Operations steps");
    expect(debug).toContain("OperationStepDebugTabs");
    expect(visibleText(debug)).toContain("Debug / Operations steps");
  });

  it("renders system evidence binding, placeholder, rejected, and recovery states", () => {
    const ctx = createSurfaceCtx();
    const card = ctx.state.runtimeStore.workspaces[0].cards[0];
    clearDraft("W-STAY-RESOURCE", "roomSetup");
    const missing = EvidenceSheet(card, {}, ctx);

    expect(visibleText(missing)).toContain("系统将在提交时自动绑定");
    expect(visibleText(missing)).toContain("证据已就绪");

    const placeholder = EvidenceStateVM(card.evidence[0], {
      requirementId: "room-duplicate-check",
      evidenceId: "ev-runtime",
      fileName: "room-duplicate-check.runtime-evidence"
    }, ctx);
    expect(placeholder.status).toBe("pending_review");
    expect(placeholder.label).toContain("等待可信校验");

    const rejected = EvidenceStateVM(card.evidence[0], {
      requirementId: "room-duplicate-check",
      status: "rejected",
      reason: "照片不清晰"
    }, ctx);
    expect(rejected.label).toContain("证据被拒绝");
    expect(rejected.label).toContain("照片不清晰");
  });

  it("uses normal submit CTA before runtime reports an evidence blocker", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    clearDraft("W-STAY-RESOURCE", "roomSetup");
    const html = operationPanelView(ctx);

    expect(visibleText(html)).toContain("提交处理");
    expect(visibleText(html)).toContain("提交前检查");
    expect(visibleText(html)).toContain("材料核对");
    expect(visibleText(html)).not.toContain("提交证据");
    expect(visibleText(html)).not.toContain("可信确认");
  });

  it("marks required business fields and blocks submit locally before prepare/confirm", async () => {
    const ctx = createSurfaceCtx({ view: "workspace" });
    ctx.state.runtimeStore.workspaces[0].cards[0].fields.business = [{
      id: "buildingId",
      label: { "zh-CN": "楼栋", "ru-RU": "Корпус" },
      required: true,
      ui: { control: "text", options: [] },
      help: { "zh-CN": "填写楼栋" }
    }];
    ctx.render = vi.fn();
    vi.stubGlobal("document", {
      querySelectorAll: () => [],
      querySelector: () => null
    });
    vi.stubGlobal("crypto", { randomUUID: () => "55555555-5555-4555-8555-555555555555" });

    const html = workspaceView(ctx);
    expect(html).toContain('data-required-field="true"');
    expect(visibleText(html)).toContain("必填");
    expect(visibleText(html)).toContain("还需填写: 楼栋");

    await submitCurrentCard(ctx);

    expect(ctx.state.lastActionResult?.status).toBe("business_blocked_422");
    expect(ctx.state.operationMessage).toContain("楼栋");
    expect(ctx.state.fieldValidation?.missingFieldIds).toContain("buildingName");
    expect(ctx.render).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("normalizes runtime option labels before translating dropdown choices", () => {
    const gender = optionsForField({
      label: { "zh-CN": "性别策略" },
      ui: { optionSet: "genderPolicy", options: [{ value: "female", label: "女生房" }] }
    }, "ru-RU");
    const technical = optionsForField({
      label: { "zh-CN": "技术状态" },
      ui: { optionSet: "technicalState", options: [{ value: "ready" }] }
    }, "ru-RU");

    expect(gender[0].label).toBe("Женская комната");
    expect(technical[0].label).toBe("Готова к заселению");
  });

  it("prefills same-case context fields instead of asking operators to re-enter them", () => {
    const ctx = createSurfaceCtx({ view: "workspace", selectedCardId: "bedSetup" });
    clearDraft("W-STAY-RESOURCE", "roomSetup");
    clearDraft("W-STAY-RESOURCE", "bedSetup");
    const workspace = ctx.state.runtimeStore.workspaces[0];
    workspace.cards = [{
      ...workspace.cards[0],
      id: "roomSetup",
      status: "done",
      title: { "zh-CN": "房间配置卡" }
    }, {
      id: "bedSetup",
      status: "ready",
      workItemId: "W-STAY-RESOURCE:bedSetup",
      title: { "zh-CN": "床位配置卡" },
      fields: { business: [{
        id: "所属房间",
        label: { "zh-CN": "所属房间" },
        required: true,
        ui: { control: "searchSelect", options: [] },
        help: { "zh-CN": "从已有对象中选择。" }
      }, {
        id: "床位号",
        label: { "zh-CN": "床位号" },
        required: true,
        ui: { control: "text", options: [] }
      }], system: [], analytics: [] },
      evidence: [],
      checks: [],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
    }];
    ctx.state.projectionEvents = [{
      eventId: "evt-room-setup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      payload: { buildingName: "D03", roomNo: "31", roomType: "single" }
    }];

    const html = workspaceView(ctx);
    const text = visibleText(html);

    expect(operationFieldId(workspace.cards[1].fields.business[0])).toBe("roomId");
    expect(html).toContain('type="hidden" data-operation-field="roomId" value="room-31"');
    expect(html).toContain('value="D03 / 31"');
    expect(text).toContain("已从本案带入");
    expect(text).toContain("已从前一步带入");
    expect(text).not.toContain("所属房间 · 可搜索选择");
  });

  it("does not render active submit surfaces for completed cards", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    ctx.state.runtimeStore.workspaces[0].cards[0].status = "done";
    const html = operationPanelView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(html).toContain('data-surface="completed-workspace-route"');
    expect(text).toContain("已完成");
    expect(text).toContain("只读记录");
    expect(text).toContain("请先核对已提交的业务内容");
    expect(text).not.toContain("操作输入");
    expect(text).not.toContain("系统证据要求");
    expect(text).not.toContain("提交证据");
    expect(text).not.toContain("可信确认");
    expect(text).not.toContain("Ready to prepare / confirm");
    expect(html).not.toContain("sticky-action");
    expect(html).not.toContain('data-submit-card');
    expect(html).not.toContain('data-surface="operation-panel-runtime"');
    expect(html).not.toContain('data-surface="completed-operation-record"');
  });

  it("renders completed workspace through the shared operation shell as a readonly record", () => {
    const ctx = createSurfaceCtx({ view: "workspace" });
    ctx.state.runtimeStore.workspaces[0].cards[0].status = "done";
    const html = workspaceView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(html).toContain('data-surface="completed-workspace-route"');
    expect(html).toContain('class="completed-record-control"');
    expect(html).toContain('class="card-operation completed-record-operation"');
    expect(html).toContain('data-component="operation-card-shell"');
    expect(text).toContain("只读记录");
    expect(text).toContain("步骤详情");
    expect(html).toContain('data-card-id="roomSetup"');
    expect(html).not.toContain("completed-record-detail");
    expect(html).not.toContain('data-surface="completed-step-list"');
    expect(text).not.toContain("已完成步骤");
    expect(text).not.toContain("当前办理项");
    expect(text).not.toContain("必填字段");
    expect(html).not.toContain("sticky-action");
    expect(html).not.toContain("intent-card");
    expect(html).not.toContain("workspace-control completed-record-control");
  });

  it("allows a completed previous step to be reviewed without making it submittable", () => {
    const ctx = createSurfaceCtx({ view: "workspace", selectedCardId: "roomSetup" });
    const workspace = ctx.state.runtimeStore.workspaces[0];
    workspace.cards[0].status = "confirmed";
    workspace.cards.push({
      id: "bedSetup",
      status: "ready",
      workItemId: "W-STAY-RESOURCE:bedSetup",
      title: { "zh-CN": "床位配置卡" },
      fields: { business: [], system: [], analytics: [] },
      evidence: [],
      checks: [],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" }
    });
    ctx.state.runtimeStore.operationWorkItems.push({
      workItemId: "W-STAY-RESOURCE:bedSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "bedSetup",
      lifecycleState: "ready",
      ownerRole: "operator"
    });

    const html = workspaceView(ctx);
    const text = visibleText(html);

    expect(text).toContain("办理记录");
    expect(text).toContain("房间床位配置");
    expect(text).toContain("已完成");
    expect(text).toContain("继续办理下一阶段");
    expect(text).not.toContain("返回当前办理");
    expect(text).not.toContain("可提交");
    expect(html).toContain('data-card-id="roomSetup"');
    expect(html).toContain('data-card-id="bedSetup"');
    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:bedSetup"');
    expect(text).not.toContain("操作输入");
    expect(html).not.toContain("sticky-action");
    expect(html).not.toContain('data-submit-card');
  });

  it("treats every terminal operation status as a readonly completed record", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    ctx.state.runtimeStore.workspaces[0].cards[0].status = "confirmed";
    const html = operationPanelView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(html).toContain('data-surface="completed-workspace-route"');
    expect(text).toContain("只读记录");
    expect(text).not.toContain("操作输入");
    expect(html).not.toContain("sticky-action");
    expect(html).not.toContain('data-submit-card');
    expect(html).not.toContain('data-surface="completed-operation-record"');
  });

  it("renders completed operation audit summary in the readonly record without the retired audit detail panel", () => {
    const operatorCtx = createSurfaceCtx({ view: "operationPanel" });
    operatorCtx.state.runtimeStore.workspaces[0].cards[0].status = "done";
    const adminCtx = createSurfaceCtx({
      view: "operationPanel",
      currentActor: { role: "admin", displayName: "审计管理员", token: "admin-token", capabilities: ["operation.confirm"] }
    });
    adminCtx.state.runtimeStore.workspaces[0].cards[0].status = "done";

    const operatorHtml = operationPanelView(operatorCtx);
    const adminHtml = operationPanelView(adminCtx);

    expect(visibleText(operatorHtml)).toContain("审计摘要");
    expect(visibleText(operatorHtml)).toContain("只读记录");
    expect(operatorHtml).not.toContain('data-surface="completed-operation-audit-details"');
    expect(visibleText(adminHtml)).toContain("审计摘要");
    expect(adminHtml).not.toContain('data-surface="completed-operation-audit-details"');
  });

  it("renders 403, 409, 422, and projection pending recovery with learning or trace entry", () => {
    const ctx = createSurfaceCtx();

    expect(visibleText(ActionResult({ status: "permission_blocked_403", reason: "missing_capability", requiredPermission: "finance.control.view", owner: "finance" }, ctx))).toContain("财务工作台访问权限");
    expect(ActionResult({ status: "permission_blocked_403", reason: "missing_capability" }, ctx)).toContain('data-view="learning"');
    expect(ActionResult({ status: "idempotency_conflict_409" }, ctx)).toContain('data-view="recentTraces"');
    expect(visibleText(ActionResult({ status: "business_blocked_422" }, ctx))).toContain("提交校验未通过");
    expect(ActionResult({ status: "business_blocked_422" }, ctx)).toContain('data-view="learning"');
    expect(visibleText(ActionResult({ status: "committed_projection_pending", message: "已提交，视图同步中" }, ctx))).toContain("已提交，视图同步中");
    expect(visibleText(ActionResult({ status: "committed_projection_pending", message: "已提交，视图同步中" }, ctx))).not.toContain("失败");
  });

  it("Home, blocked work, search learning, and permission diagnostic include learning recovery", () => {
    const ctx = createSurfaceCtx({ view: "home" });
    expect(homeView(ctx)).toContain('data-view="learning"');
    expect(visibleText(homeView(ctx))).toContain("学习中心");

    ctx.state.runtimeStore.workspaces[0].cards[0].status = "blocked";
    ctx.state.runtimeStore.workQueue[0].lifecycleState = "blocked";
    expect(visibleText(operationPanelView(ctx))).toContain("查看不能提交原因");

    const search = searchView(createSurfaceCtx({ view: "search", query: "证据" }));
    expect(search).toContain('data-learning-id="learnEvidenceFix"');

    const diagnostic = PermissionDiagnostic({ requiredPermission: "finance.control.view", owner: "finance" }, createSurfaceCtx());
    expect(visibleText(diagnostic)).not.toContain("finance.control.view");
    expect(diagnostic).toContain('data-view="learning"');
  });
});
