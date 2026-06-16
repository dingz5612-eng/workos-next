import { describe, expect, it } from "vitest";
import { EvidenceSheet, EvidenceTile } from "../views/experienceComponents.js";
import { createSurfaceCtx, runtimeStore } from "./surfaceContractTestHelpers.js";

describe("SURFACE-C evidence trust experience", () => {
  it("renders required evidence as trusted evidence objects, not a plain upload action", () => {
    const ctx = createSurfaceCtx();
    const card = runtimeStore().workspaces[0].cards[0];
    const draft = { evidenceDrafts: [] };
    const tile = EvidenceTile(card.evidence[0], draft, "", ctx);
    const sheet = EvidenceSheet(card, draft, ctx);

    expect(tile).toContain('data-surface="evidence-tile"');
    expect(tile).toContain("房间基础资料证据");
    expect(tile).toContain("系统将在提交时自动绑定");
    expect(sheet).toContain('data-surface="evidence-sheet"');
    expect(sheet).toContain("1/1 证据已就绪");
  });
});
