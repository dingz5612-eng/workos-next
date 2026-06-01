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

    expect(tile).toContain('data-component="EvidenceTile"');
    expect(tile).toContain("房间重复校验");
    expect(tile).toContain("missing");
    expect(sheet).toContain('data-component="EvidenceSheet"');
    expect(sheet).toContain("0/1 attached");
  });
});
