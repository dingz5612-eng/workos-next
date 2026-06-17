import { describe, expect, it, vi } from "vitest";
import { i18n } from "../i18n.js";
import { searchView } from "../views/searchView.js";
import { meView } from "../views/meView.js";

describe("HOTFIX-SURFACE-UX-01 Search and Learning sync", () => {
  it("keeps Search focused on active business entry instead of personal activity log", () => {
    const html = searchView(ctx({ view: "search", query: "住宿" }));

    expect(html).toContain('class="search-box"');
    expect(html).not.toContain("WorkOS 搜索");
    expect(html).toContain("待办任务");
    expect(html).not.toContain('data-search-section="searchOperationCases"');
    expect(html).not.toContain('data-search-section="completedWorkItems"');
    expect(html).not.toContain('data-search-section="searchEvidence"');
    expect(html).not.toContain('data-search-section="searchSubmissionTrace"');
    expect(html).not.toContain('data-search-section="searchLearning"');
    expect(html).not.toContain("没有匹配结果");
    expect(html).not.toContain("PC Governance");
    expect(html).not.toContain("Release Control");
    expect(html).not.toContain("Finance admin");

    const mainlineEntry = searchView(ctx({ view: "search", query: "新增房间" }));
    expect(mainlineEntry).toContain("新建房间和床位");
    expect(mainlineEntry).not.toContain('data-start-operations-workspace="W-STAY-RESOURCE"');
  });

  it("keeps learning and evidence libraries in Me instead of Search results", () => {
    const html = searchView(ctx({ view: "search", query: "证据" }));

    expect(html).not.toContain('data-search-section="searchLearning"');
    expect(html).not.toContain('data-search-section="searchEvidence"');
    expect(html).toContain("记录、材料和学习内容请到我的查看");
  });

  it("keeps personal activity log in Me instead of adding a fifth bottom tab", () => {
    const html = meView(ctx({ view: "me" }));

    expect(html).toContain("业务资料");
    expect(html).toContain("业务记录");
    expect(html).toContain("已完成记录");
    expect(html).toContain("证据");
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
        workItemId: "wi-dorm-room-setup",
        workspaceId: "W-DORM-MAINLINE",
        cardId: "cert.roomSetupConfirm",
        caseId: "case:W-DORM-MAINLINE",
        workItemType: "Dorm.RoomSetupConfirm",
        lifecycleState: "ready",
        ownerRole: "operator",
        badges: ["mine", "ready"],
        traceRefs: ["trace-room"],
        commandSubmissionId: "cmd-room",
        reason: "开始新建房间和床位"
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
    id: "W-DORM-MAINLINE",
    domain: "stay",
    caseId: "case:W-DORM-MAINLINE",
    title: { "zh-CN": "新建房间和床位" },
    summary: { "zh-CN": "房间建档、确认床位信息和完成基础检查" },
    next: { "zh-CN": "开始新建房间和床位" },
    cards: [{
      id: "cert.roomSetupConfirm",
      status: "ready",
      title: { "zh-CN": "填写房间信息" },
      fields: { business: [], system: [], analytics: [] },
      evidence: [{ id: "room-basic-info-evidence", label: { "zh-CN": "房间基础资料证据" } }],
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
