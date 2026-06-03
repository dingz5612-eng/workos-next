import { describe, expect, it, vi } from "vitest";
import { i18n } from "../i18n.js";
import { searchView } from "../views/searchView.js";
import { meView } from "../views/meView.js";

describe("HOTFIX-SURFACE-UX-01 Search and Learning sync", () => {
  it("renders only matching WorkOS Search sections instead of dumping every dormitory category", () => {
    const html = searchView(ctx({ view: "search", query: "住宿" }));

    expect(html).toContain("WorkOS 搜索");
    for (const label of ["业务记录", "提交轨迹"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain('data-search-section="searchLearning"');
    expect(html).not.toContain("没有匹配结果");
    expect(html).not.toContain("PC Governance");
    expect(html).not.toContain("Release Control");
    expect(html).not.toContain("Finance admin");
  });

  it("shows learning content when the search intent is learning or evidence help", () => {
    const html = searchView(ctx({ view: "search", query: "证据" }));

    expect(html).toContain("学习内容");
    expect(html).toContain("证据怎么补");
  });

  it("keeps Learning Center in Me instead of adding a fifth bottom tab", () => {
    const html = meView(ctx({ view: "me" }));

    expect(html).toContain("学习中心");
    expect(html).toContain("我的权限");
    expect(html).toContain("最近轨迹");
    expect(html).not.toContain("UploadQueue");
    expect(html).not.toContain("DeviceTrustPanel");
  });
});

function ctx(overrides = {}) {
  const state = {
    view: "search",
    lang: "zh-CN",
    apiStatus: "online",
    query: "",
    recentSearches: [],
    queueDomain: "all",
    queueBadge: "mine",
    currentActor: { role: "operator", displayName: "内测经办人" },
    currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
    pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" } },
    runtimeStore: {
      workspaces: [workspace()],
      workQueue: [{
        queueItemId: "q-room",
        workItemId: "W-STAY-RESOURCE:roomSetup",
        workspaceId: "W-STAY-RESOURCE",
        cardId: "roomSetup",
        caseId: "case:W-STAY-RESOURCE",
        workItemType: "Dorm.RoomSetup",
        lifecycleState: "ready",
        ownerRole: "operator",
        badges: ["mine", "ready"],
        traceRefs: ["trace-room"],
        commandSubmissionId: "cmd-room",
        reason: "先配置房间和床位"
      }],
      operationWorkItems: [],
      homeSurface: [],
      learningCatalog: [],
      searchResultsByQuery: {}
    },
    ...overrides
  };
  return {
    state,
    shell: (content) => content,
    tr: (key) => escape(i18n[state.lang][key] || key),
    tx: (value) => escape(typeof value === "string" ? value : value?.[state.lang] || value?.["zh-CN"] || ""),
    localTerm: (value) => escape(value?.label?.[state.lang] || value?.label?.["zh-CN"] || value?.id || value),
    escapeHtml: escape,
    escapeAttr: escape,
    metric: (value, label) => `<article><span>${label}</span><strong>${value}</strong></article>`,
    render: vi.fn()
  };
}

function workspace() {
  return {
    id: "W-STAY-RESOURCE",
    domain: "stay",
    caseId: "case:W-STAY-RESOURCE",
    title: { "zh-CN": "住宿资源" },
    summary: { "zh-CN": "房间床位入住资源" },
    next: { "zh-CN": "先配置房间和床位" },
    cards: [{
      id: "roomSetup",
      status: "ready",
      title: { "zh-CN": "房间床位配置" },
      fields: { business: [], system: [], analytics: [] },
      evidence: [{ id: "room-duplicate-check", label: { "zh-CN": "房间重复校验" } }],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "operator" }
    }]
  };
}

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
