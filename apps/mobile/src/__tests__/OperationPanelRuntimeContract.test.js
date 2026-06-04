import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, source, visibleText } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C Operation Panel runtime contract", () => {
  it("normalizes legacy task ids and renders only persisted WorkItem runtime identity", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel", selectedWorkItemId: "T-ROOM-CREATE" });
    const html = routeView(ctx);

    expect(ctx.state.selectedWorkItemId).toBe("W-STAY-RESOURCE:roomSetup");
    expect(html).toContain("W-STAY-RESOURCE:roomSetup");
    expect(html).not.toContain("T-ROOM-CREATE");
    expect(visibleText(html)).not.toMatch(/\b(commandSubmissionId|payloadHash|workItemId|caseId|OperationPanelView|TrustedConfirmSheet|ActionResult)\b/);
    expect(html).toContain("提交记录");
    expect(html).toContain("载荷指纹");
    expect(visibleText(html)).not.toContain("operationsPrepare");
    expect(visibleText(html)).not.toContain("operationsConfirm");
  });

  it("blocks submit when a persisted WorkItem is missing", () => {
    const runtime = source("../operationRuntime.js");
    const panel = source("../views/operationPanelView.js");

    expect(runtime).toContain("persisted_work_item_required");
    expect(runtime).toContain("allowCompatibilityFallback = false");
    expect(runtime).toContain("submitCardOperationCompatibilityFallback");
    expect(panel).toContain("state.selectedWorkItemId = persistedWorkItemId");
    expect(panel).not.toContain("ctx.workspace()");
  });
});
