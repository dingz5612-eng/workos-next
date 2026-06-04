import { describe, expect, it } from "vitest";
import { renderSurface, visibleText } from "./surfaceContractTestHelpers.js";

describe("Stage B Operation Panel deep link contract", () => {
  it("renders a legacy deep link through the persisted runtime WorkItem without blank panel or raw labels", () => {
    const html = renderSurface("operationPanel", { selectedWorkItemId: "T-ROOM-CREATE" });
    const text = visibleText(html);

    expect(html).toContain('data-surface="operation-panel-route"');
    expect(html).toContain("W-STAY-RESOURCE:roomSetup");
    expect(html).not.toContain("T-ROOM-CREATE");
    expect(text).not.toMatch(/\b(OperationPanelView|TrustedConfirmSheet|ActionResult|workItemId|caseId|payloadHash|commandSubmissionId|operationsPrepare|operationsConfirm)\b/);
    expect(html).toContain('data-surface="system-validation-summary"');
    expect(text).toContain("提交前检查");
    expect(text).not.toContain("可信确认");
    expect(text).not.toContain("提交证据");
  });
});
