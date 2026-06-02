import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM-04B experience module productization", () => {
  it("keeps raw technical refs out of ordinary module containers", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel", selectedWorkItemId: "T-ROOM-CREATE" });
    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
    expect(html).toContain("operation-technical-details");
    expect(html).toContain("data-case-id");
    expect(html).toContain("data-submission-id");
    expect(html).toContain("data-payload-fingerprint");
    expect(html).not.toContain("T-ROOM-CREATE");
    expect(text).not.toMatch(/\b(OperationPanelView|TrustedConfirmSheet|EvidenceSheet|ActionResult)\b/);
    expect(text).not.toMatch(/\b(workItemId|caseId|payloadHash|commandSubmissionId)\b/);
  });
});

