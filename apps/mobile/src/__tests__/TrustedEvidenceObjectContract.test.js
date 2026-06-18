import { describe, expect, it } from "vitest";
import { EvidenceSheet, EvidenceTile } from "../views/experienceComponents.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("Stage B trusted evidence object contract", () => {
  it("shows trusted evidence state and next review meaning instead of a plain upload button", () => {
    const ctx = createSurfaceCtx();
    const card = ctx.state.runtimeStore.workspaces[0].cards[0];
    const draft = { evidenceDrafts: [] };
    const html = `${EvidenceTile(card.evidence[0], draft, "", ctx)}${EvidenceSheet(card, draft, ctx)}`;
    const text = visibleText(html);

    expect(text).toContain("房间基础资料证据");
    expect(text).toContain("材料");
    expect(text).toContain("系统将在提交时自动绑定");
    expect(text).toContain("材料已就绪");
    expect(text).not.toContain("EvidenceSheet");
  });
});
