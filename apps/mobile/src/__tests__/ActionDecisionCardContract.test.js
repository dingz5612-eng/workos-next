import { describe, expect, it } from "vitest";
import { WorkItemCard } from "../views/experienceComponents.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("Stage B ActionDecisionCard contract", () => {
  it("renders a lightweight business task card without default technical diagnostics", () => {
    const ctx = createSurfaceCtx();
    const html = WorkItemCard(ctx.state.runtimeStore.workQueue[0], ctx);
    const text = visibleText(html);

    for (const label of ["当前可处理"]) {
      expect(text).toContain(label);
    }
    for (const label of ["工作内容", "处理："]) {
      expect(text).not.toContain(label);
    }
    for (const label of ["当前能否处理", "处理说明", "需要的材料", "下一步怎么做", "风险等级", "责任角色", "截止时间", "业务对象"]) {
      expect(text).not.toContain(label);
    }
    expect(html).toContain('data-surface="business-summary-header"');
    expect(html).toContain('data-surface="business-task-body"');
    expect(text).not.toContain("为什么不能处理");
    expect(text).not.toMatch(/\b(workItemId|caseId|traceRefs|lifecycleState|ownerRole)\b/);
  });

  it("uses blocker wording only when the work item is blocked", () => {
    const ctx = createSurfaceCtx();
    const item = {
      ...ctx.state.runtimeStore.workQueue[0],
      lifecycleState: "blocked",
      badges: ["mine", "blocked"],
      reason: "等待主管解除阻断"
    };
    const text = visibleText(WorkItemCard(item, ctx));

    expect(text).toContain("暂不能处理");
    expect(text).toContain("当前问题");
    expect(text).toContain("等待主管解除阻断");
  });

  it("uses business action labels for work item entry buttons", () => {
    const ctx = createSurfaceCtx();
    const readyText = visibleText(WorkItemCard(ctx.state.runtimeStore.workQueue[0], ctx));
    expect(readyText).toContain("开始办理");
    expect(readyText).not.toContain("进入办理面");

    const continuingText = visibleText(WorkItemCard({
      ...ctx.state.runtimeStore.workQueue[0],
      lifecycleState: "draft"
    }, ctx));
    expect(continuingText).toContain("继续办理");

    const detailText = visibleText(WorkItemCard({
      ...ctx.state.runtimeStore.workQueue[0],
      lifecycleState: "blocked",
      badges: ["mine", "blocked"],
      reason: "等待主管解除阻断"
    }, ctx));
    expect(detailText).toContain("查看详情");
  });
});
