import { describe, expect, it, vi } from "vitest";
import { shell } from "../appShell.js";
import { i18n } from "../i18n.js";
import { routeView } from "../appRouter.js";

describe("HOTFIX-SURFACE-UX-01 mobile visible copy contract", () => {
  it("renders zh-CN mobile shell without implementation component names or raw device fields", () => {
    stubBrowser();
    const home = render("home");
    const me = render("me", {
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" } }
    });
    const html = `${home}\n${me}`;

    for (const forbidden of [
      "UploadQueue",
      "SubmitQueue",
      "DeviceTrustPanel",
      "WorkItemMissionControl",
      "PersonalOpsCenter",
      "No pending evidence upload",
      "No pending submission",
      "pc-current",
      "surface pc"
    ]) {
      expect(html).not.toContain(forbidden);
    }

    expect(html).toContain("今天");
    expect(html).toContain("工作");
    expect(html).toContain("搜索");
    expect(html).toContain("我的");
    expect(me).toContain("材料上传");
    expect(me).toContain("提交队列");
    expect(me).toContain("当前设备");
    expect(me).toContain("没有待上传材料");
    expect(me).toContain("没有待提交办理");
    expect(me).toContain("学习中心");
    expect(me).toContain("我的权限");
    expect(me).toContain("最近提交");
    expect(me).toContain("最近轨迹");
    expect(me).toContain("设备可信状态");
    expect(visibleText(me)).not.toMatch(/\b(deviceId|trustState|surface)\b/);
    vi.unstubAllGlobals();
  });

  it("diagnoses leaked PC device context instead of rendering it as ordinary mobile state", () => {
    stubBrowser();
    const html = render("me", {
      currentDevice: null,
      pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" } }
    });

    expect(html).toContain("设备上下文异常");
    expect(html).not.toContain("pc-current");
    expect(html).not.toContain("surface pc");
    vi.unstubAllGlobals();
  });

  it("keeps actor labels out of the mobile topbar and localizes them in Me", () => {
    stubBrowser();
    const ru = visibleText(render("home", {
      lang: "ru-RU",
      currentActor: { role: "frontdesk", displayName: "住宿试点前台" }
    }));
    const ky = visibleText(render("home", {
      lang: "ky-KG",
      currentActor: { role: "frontdesk", displayName: "住宿试点前台" }
    }));
    const ruMe = visibleText(render("me", {
      lang: "ru-RU",
      currentActor: { role: "frontdesk", displayName: "住宿试点前台" }
    }));

    expect(ru).not.toContain("住宿试点前台");
    expect(ruMe).toContain("Сотрудник стойки проживания");
    expect(ky).not.toContain("住宿试点前台");
    vi.unstubAllGlobals();
  });

  it("keeps online runtime status as a quiet topbar chip instead of a content banner", () => {
    stubBrowser();
    const html = render("operationPanel");

    expect(html).toContain('class="runtime-status online"');
    expect(html).not.toContain('class="api-status online"');
    expect(visibleText(html)).toContain("已连接");
    expect(visibleText(html)).not.toContain("运行服务已连接");
    expect(visibleText(html)).not.toContain("已连接内测运行服务");
    vi.unstubAllGlobals();
  });

  it("renders personal support pages as runtime read surfaces instead of placeholder forms", () => {
    stubBrowser();
    const supportViews = [
      "notes",
      "reminders",
      "permissions",
      "uploadQueue",
      "submitQueue",
      "drafts",
      "failedSync",
      "recentSubmissions",
      "recentTraces",
      "deviceTrust"
    ];
    const rendered = supportViews.map((view) => render(view));
    const html = [...rendered, render("result")].join("\n");
    const text = visibleText(html);

    for (const page of rendered) {
      expect(page).toContain('data-surface="personal-runtime-support"');
      expect(page).not.toContain("权限诊断");
    }
    expect(text).toContain("本页只读取草稿、提交、轨迹、材料和设备状态");
    expect(text).toContain("系统判断");
    expect(text).toContain("设备已验证");
    expect(text).toContain("提交记录");
    expect(text).not.toContain("2026-05-28 18:00");
    expect(text).not.toMatch(/\bAudit\b/);
    expect(text).not.toMatch(/\b(workItemId|cardId|workspaceId|payloadHash|commandSubmissionId)\b/);
    vi.unstubAllGlobals();
  });

  it("renders feedback as a role-addressed collaboration message channel", () => {
    stubBrowser();
    const html = render("feedback", {
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: "cert.roomSetupConfirm",
      selectedWorkItemId: "wi-dorm-room-setup"
    });
    const text = visibleText(html);

    expect(html).toContain('data-surface="feedback-message-channel"');
    expect(html).toContain("data-feedback-recipient");
    expect(html).toContain("data-feedback-account");
    expect(html).toContain("data-feedback-body");
    expect(html).toContain("data-send-feedback");
    expect(text).toContain("协作消息");
    expect(text).toContain("产品/设计负责人");
    expect(text).toContain("指定账号");
    expect(text).toContain("反馈上下文");
    expect(text).toContain("新建房间和床位");
    expect(text).toContain("填写房间信息");
    expect(text).not.toMatch(/\b(workItemId|cardId|workspaceId|payloadHash|commandSubmissionId)\b/);
    vi.unstubAllGlobals();
  });

  it("renders confirmation page from a direct route without a blank fallback", () => {
    stubBrowser();
    const html = render("confirmPage");
    const text = visibleText(html);

    expect(html).toContain('data-surface="runtime-confirmation"');
    expect(text).toContain("确认当前办理");
    expect(text).toContain("保存办理结果并刷新视图");
    expect(text).toContain("返回工作台");
    vi.unstubAllGlobals();
  });
});

function render(view, overrides = {}) {
  const ctx = createCtx({
    view,
    ...overrides
  });
  return routeView(ctx);
}

function createCtx(overrides = {}) {
  const state = {
    view: "home",
    lang: "zh-CN",
    apiStatus: "online",
    query: "",
    queueDomain: "all",
    queueBadge: "mine",
    currentActor: { role: "operator", displayName: "住宿经办人" },
    currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
    pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" } },
    runtimeStore: runtimeStore(),
    ...overrides
  };
  const ctx = {
    state,
    shell: (content) => shell(content, ctx),
    tr: (key) => escape(i18n[state.lang][key] || key),
    tx: (value) => escape(typeof value === "string" ? value : value?.[state.lang] || value?.["zh-CN"] || ""),
    localTerm: (value) => escape(value?.label?.[state.lang] || value?.label?.["zh-CN"] || value?.id || value),
    escapeHtml: escape,
    escapeAttr: escape,
    metric: (value, label) => `<article><span>${label}</span><strong>${value}</strong></article>`,
    render: vi.fn()
  };
  return ctx;
}

function runtimeStore() {
  return {
    workspaces: [{
      id: "W-DORM-MAINLINE",
      domain: "stay",
      title: { "zh-CN": "新建房间和床位" },
      summary: { "zh-CN": "房间建档、确认床位信息和完成基础检查" },
      next: { "zh-CN": "填写房间信息" },
      cards: [{
        id: "cert.roomSetupConfirm",
        status: "ready",
        title: { "zh-CN": "填写房间信息" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [{ id: "room-basic-info-evidence", label: { "zh-CN": "房间基础资料证据" } }],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }]
    }],
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
      reason: "填写房间信息"
    }],
    operationWorkItems: [],
    homeSurface: [],
    learningCatalog: [],
    searchResultsByQuery: {}
  };
}

function stubBrowser() {
  vi.stubGlobal("window", { location: { protocol: "http:", hostname: "localhost", port: "5175", origin: "http://localhost:5175" } });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
}

function visibleText(html) {
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
