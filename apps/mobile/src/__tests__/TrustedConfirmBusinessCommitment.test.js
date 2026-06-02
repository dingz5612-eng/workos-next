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

    expect(text).toContain("业务承诺");
    expect(text).toContain("证据与权限");
    expect(text).toContain("审计与回滚");
    expect(text).toContain("必要时只能通过补偿或回滚指令处理");
    expect(text).not.toMatch(/\b(workItemId|caseId|TrustedConfirmSheet)\b/);
  });
});
