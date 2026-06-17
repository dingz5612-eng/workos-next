import { describe, expect, it } from "vitest";
import { TrustedConfirmSheet } from "../views/experienceComponents.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("Stage B TrustedConfirm business commitment", () => {
  it("renders business commitment, evidence/permission, audit, and rollback sections without raw ids", () => {
    const ctx = createSurfaceCtx();
    const workspace = ctx.state.runtimeStore.workspaces[0];
    const card = workspace.cards[0];
    const html = TrustedConfirmSheet({ ...ctx.state.runtimeStore.operationWorkItems[0], workspace, card }, card, ctx);
    const text = visibleText(html);

    expect(text).toContain("本次办理影响");
    expect(text).toContain("材料与权限");
    expect(text).toContain("提交后处理");
    expect(text).toContain("提交后如需修改，请走更正或作废流程");
    expect(text).not.toMatch(/\b(workItemId|caseId|TrustedConfirmSheet)\b/);
  });
});
