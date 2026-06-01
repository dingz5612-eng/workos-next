import { describe, expect, it } from "vitest";
import { SubmitQueue } from "../views/experienceComponents.js";
import { createSurfaceCtx } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C submit queue recovery", () => {
  it("shows pending submission queue state with localized copy", () => {
    const ctx = createSurfaceCtx({ submitQueue: [{ submissionId: "sub-1" }] });
    const html = SubmitQueue(ctx.state, ctx);

    expect(html).toContain("提交队列");
    expect(html).toContain("办理等待提交");
    expect(html).toContain("<strong>1</strong>");
  });
});
