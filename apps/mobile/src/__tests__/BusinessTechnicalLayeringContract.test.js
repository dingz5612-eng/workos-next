import { describe, expect, it } from "vitest";
import { clearDraft } from "../operationDrafts.js";
import { ActionResult, EvidenceSheet, EvidenceStateVM, PermissionDiagnostic } from "../views/experienceComponents.js";
import { homeView } from "../views/homeView.js";
import { operationPanelView } from "../views/operationPanelView.js";
import { searchView } from "../views/searchView.js";
import { workspaceView } from "../views/workspaceView.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM-04B business and technical layering contract", () => {
  it("hides operation technical proof by default while keeping audit selectors", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    const html = operationPanelView(ctx);
    const text = visibleText(html);

    expect(html).toContain("<details");
    expect(html).toContain('class="operation-technical-details"');
    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
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

  it("hides workspace Debug / compatibility unless debugSurface", () => {
    const normal = workspaceView(createSurfaceCtx({ view: "workspace" }));
    const debug = workspaceView(createSurfaceCtx({ view: "workspace", debugSurface: true }));

    expect(visibleText(normal)).not.toContain("Debug / compatibility");
    expect(debug).toContain("CompatibilityCardTabs");
    expect(visibleText(debug)).toContain("Debug / compatibility");
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
    expect(visibleText(html)).toContain("系统将在提交时自动绑定");
  });

  it("does not render active submit surfaces for completed cards", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    ctx.state.runtimeStore.workspaces[0].cards[0].status = "done";
    const html = operationPanelView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-operation-record"');
    expect(text).toContain("已完成");
    expect(text).toContain("这条记录已经完成");
    expect(text).not.toContain("操作输入");
    expect(text).not.toContain("提交证据");
    expect(text).not.toContain("可信确认");
    expect(text).not.toContain("Ready to prepare / confirm");
    expect(html).not.toContain("sticky-action");
    expect(html).not.toContain('data-submit-card');
    expect(html).not.toContain('data-surface="operation-panel-runtime"');
  });

  it("renders completed workspace as a record detail instead of an operation lens", () => {
    const ctx = createSurfaceCtx({ view: "workspace" });
    ctx.state.runtimeStore.workspaces[0].cards[0].status = "done";
    const html = workspaceView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(html).toContain('data-surface="completed-step-list"');
    expect(text).toContain("已完成记录");
    expect(text).toContain("已完成步骤");
    expect(text).toContain("房间重复校验");
    expect(text).toContain("步骤详情");
    expect(html).toContain('data-card-id="roomSetup"');
    expect(text).not.toContain("当前办理项");
    expect(text).not.toContain("必填字段");
    expect(html).not.toContain("sticky-action");
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
    expect(visibleText(operationPanelView(ctx))).toContain("查看阻断处理说明");

    const search = searchView(createSurfaceCtx({ view: "search", query: "证据" }));
    expect(search).toContain('data-learning-id="learnEvidenceFix"');

    const diagnostic = PermissionDiagnostic({ requiredPermission: "finance.control.view", owner: "finance" }, createSurfaceCtx());
    expect(visibleText(diagnostic)).not.toContain("finance.control.view");
    expect(diagnostic).toContain('data-view="learning"');
  });
});
