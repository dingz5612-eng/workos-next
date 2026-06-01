import { describe, expect, it } from "vitest";
import { UploadQueue } from "../views/experienceComponents.js";
import { createSurfaceCtx } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C upload queue recovery", () => {
  it("shows pending evidence upload state with localized next status", () => {
    const ctx = createSurfaceCtx({ uploadQueue: [{ evidenceId: "evd-1" }] });
    const html = UploadQueue(ctx.state, ctx);

    expect(html).toContain("证据上传");
    expect(html).toContain("证据等待上传");
    expect(html).toContain("<strong>1</strong>");
  });
});
