import { describe, expect, it } from "vitest";
import { SubmitQueue, UploadQueue } from "../views/experienceComponents.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C queue state contract", () => {
  it("renders upload and submit queues as localized user states", () => {
    const ctx = createSurfaceCtx();
    const html = `${UploadQueue(ctx.state, ctx)}\n${SubmitQueue(ctx.state, ctx)}`;

    expect(html).toContain('data-surface="upload-queue"');
    expect(html).toContain('data-surface="submit-queue"');
    expect(html).toContain("证据上传");
    expect(html).toContain("提交队列");
    expect(html).toContain("没有待上传证据");
    expect(html).toContain("没有待提交办理");
    expect(visibleText(html)).not.toContain("UploadQueue");
    expect(visibleText(html)).not.toContain("SubmitQueue");
  });
});
