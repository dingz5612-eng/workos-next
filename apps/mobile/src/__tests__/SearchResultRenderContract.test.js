import { describe, expect, it } from "vitest";
import { searchView } from "../views/searchView.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("Stage B search result render contract", () => {
  it("formats localized DTO objects instead of rendering [object Object]", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "住宿" });
    ctx.state.runtimeStore.searchResultsByQuery = {
      "住宿": [{
        workspaceId: "W-DORM-MAINLINE",
        cardId: "cert.roomSetupConfirm",
        localizedTitle: { "zh-CN": "填写房间信息" },
        localizedSubtitle: { "zh-CN": "新建房间和床位" },
        localizedStatus: { "zh-CN": "待处理" },
        localizedNextAction: { "zh-CN": "继续填写" }
      }]
    };

    const html = searchView(ctx);

    expect(visibleText(html)).not.toContain("[object Object]");
    expect(html).toContain("填写房间信息");
    expect(html).toContain("新建房间和床位");
    expect(html).toContain('data-surface="business-summary-header"');
    expect(html).toContain('data-surface="business-task-body"');
    expect(html).toContain('class="search-result-main"');
    expect(html).toContain('class="search-result-action business-summary-actions"');
    expect(html).not.toContain('class="search-result-facts"');
    expect(html).not.toContain("PC Governance");
  });

  it("localizes object result prefixes outside Chinese", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "room", lang: "ru-RU" });
    ctx.state.runtimeStore.workspaces.push({
      id: "W-DORM-RU-MAINLINE",
      domain: "stay",
      title: { "zh-CN": "新建房间和床位", "ru-RU": "Создать комнаты и койки" },
      summary: { "ru-RU": "Комнаты и койки" },
      next: { "ru-RU": "Открыть объект" },
      cards: [{
        id: "cert.roomSetupConfirm",
        status: "ready",
        title: { "ru-RU": "Комната" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [],
        blockerRules: [],
        confirmation: { required: false }
      }]
    });

    const text = visibleText(searchView(ctx));

    expect(text).toContain("Комнаты · Создать комнаты и койки");
    expect(text).not.toContain("房间 · Создать комнаты и койки");
  });
});
