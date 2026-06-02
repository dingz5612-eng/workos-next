import { describe, expect, it } from "vitest";
import { searchView } from "../views/searchView.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("Stage B search result render contract", () => {
  it("formats localized DTO objects instead of rendering [object Object]", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "住宿" });
    ctx.state.runtimeStore.searchResultsByQuery = {
      "住宿": [{
        workspaceId: "W-STAY-RESOURCE",
        cardId: "roomSetup",
        localizedTitle: { "zh-CN": "房间配置办理" },
        localizedSubtitle: { "zh-CN": "宿舍资源" },
        localizedStatus: { "zh-CN": "可办理" },
        localizedNextAction: { "zh-CN": "进入办理面" }
      }]
    };

    const html = searchView(ctx);

    expect(visibleText(html)).not.toContain("[object Object]");
    expect(html).toContain("房间配置办理");
    expect(html).not.toContain("PC Governance");
  });
});
