import { describe, expect, it } from "vitest";
import { WorkItemCard } from "../views/experienceComponents.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("Stage B ActionDecisionCard contract", () => {
  it("answers can-handle, blocker, evidence, next action, risk, owner, due date, and object without raw ids", () => {
    const ctx = createSurfaceCtx();
    const html = WorkItemCard(ctx.state.runtimeStore.workQueue[0], ctx);
    const text = visibleText(html);

    for (const label of ["当前能否处理", "为什么不能处理", "还缺什么证据", "下一步怎么做", "风险等级", "责任角色", "截止时间", "业务对象"]) {
      expect(text).toContain(label);
    }
    expect(text).not.toMatch(/\b(workItemId|caseId|traceRefs|lifecycleState|ownerRole)\b/);
  });
});
