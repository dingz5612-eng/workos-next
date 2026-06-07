import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM Surface experience module productization", () => {
  it("keeps raw technical refs out of ordinary module containers", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel", selectedWorkItemId: "T-ROOM-CREATE" });
    const html = routeView(ctx);
    const text = visibleText(html);
    const technicalDetails = html.match(/<details class="operation-technical-details"[\s\S]*?<\/details>/)?.[0] || "";
    const ordinaryHtml = html.replace(technicalDetails, "");

    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
    expect(technicalDetails).toContain("data-case-id");
    expect(technicalDetails).toContain("data-submission-id");
    expect(technicalDetails).toContain("data-payload-fingerprint");
    expect(ordinaryHtml).not.toContain("data-case-id");
    expect(ordinaryHtml).not.toContain("data-submission-id");
    expect(ordinaryHtml).not.toContain("data-payload-fingerprint");
    expect(html).not.toContain("T-ROOM-CREATE");
    expect(text).not.toMatch(/\b(OperationPanelView|TrustedConfirmSheet|EvidenceSheet|ActionResult)\b/);
    expect(text).not.toMatch(/\b(workItemId|caseId|payloadHash|commandSubmissionId)\b/);
  });
});

