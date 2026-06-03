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
    expect(html).toContain('class="search-result-main"');
    expect(html).toContain('class="search-result-action"');
    expect(html).not.toContain("PC Governance");
  });

  it("localizes object result prefixes outside Chinese", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "room", lang: "ru-RU" });
    ctx.state.runtimeStore.workspaces.push({
      id: "W-STAY-RU-ROOM",
      domain: "stay",
      title: { "zh-CN": "我要创建住宿资源", "ru-RU": "Создать ресурс проживания" },
      summary: { "ru-RU": "Комнаты и койки" },
      next: { "ru-RU": "Открыть объект" },
      cards: [{
        id: "roomSetup",
        status: "ready",
        title: { "ru-RU": "Комната" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [],
        blockerRules: [],
        confirmation: { required: false }
      }]
    });

    const text = visibleText(searchView(ctx));

    expect(text).toContain("Комнаты · Создать ресурс проживания");
    expect(text).not.toContain("房间 · Создать ресурс проживания");
  });
});
