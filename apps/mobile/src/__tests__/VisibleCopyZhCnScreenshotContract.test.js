import { describe, expect, it } from "vitest";
import { renderSurface, visibleText } from "./surfaceContractTestHelpers.js";

describe("Stage B zh-CN visible copy contract", () => {
  it("keeps ordinary zh-CN surfaces free from implementation names, raw keys, and English fallback", () => {
    const html = ["home", "workbench", "search", "me", "operationPanel"].map((view) => renderSurface(view)).join("\n");
    const text = visibleText(html);

    for (const forbidden of ["OperationPanelView", "TrustedConfirmSheet", "EvidenceSheet", "ProjectionPendingState", "ActionResult", "UploadQueue", "SubmitQueue", "DeviceTrustPanel"]) {
      expect(text).not.toContain(forbidden);
    }
    expect(text).not.toMatch(/\b(workItemId|caseId|lifecycleState|ownerRole|payloadHash|commandSubmissionId|deviceId|trustState|surface)\b/);
    expect(text).not.toContain("No pending evidence upload");
    expect(text).not.toContain("No pending submission");
  });
});
