import { describe, expect, it } from "vitest";
import { openWorkItem, setView } from "../navigationController.js";
import { buildSearchResultVM, rankSearchResults } from "../searchIntentHub.js";
import { searchView } from "../views/searchView.js";
import { createSurfaceCtx, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM-04B search intent hub contract", () => {
  it("renders a WorkItem action button and opens the persisted operation panel", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "创建房间" });
    const html = searchView(ctx);

    expect(html).toContain("主动办理");
    expect(html).toContain("新增住宿房源");
    expect(html).toContain("先录房号和床位数");
    expect(html).toContain('data-start-operations-workspace="W-STAY-RESOURCE"');
    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
    expect(html).toContain(">处理</button>");

    openWorkItem("W-STAY-RESOURCE:roomSetup", ctx);

    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("W-STAY-RESOURCE:roomSetup");
  });

  it("routes the explicit accommodation resource wording to the Operations start command", () => {
    const html = searchView(createSurfaceCtx({ view: "search", query: "新增住宿房源" }));
    const text = visibleText(html);

    expect(html).toContain('data-search-section="activeCommands"');
    expect(html).toContain('data-start-operations-workspace="W-STAY-RESOURCE"');
    expect(text).toContain("新增住宿房源");
    expect(text).toContain("开始办理");
  });

  it("renders account recent searches and registered common intent suggestions", () => {
    const html = searchView(createSurfaceCtx({
      view: "search",
      query: "",
      recentSearches: ["我要创建住宿资源", "21 号房间"]
    }));
    const text = visibleText(html);

    expect(html).toContain('data-search-query="新增住宿房源"');
    expect(html).toContain('data-search-query="我要创建住宿资源"');
    expect(text).toContain("常用搜索");
    expect(text).toContain("最近搜索");
  });

  it("routes evidence and object results through existing data attributes", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });
    const html = searchView(ctx);

    expect(html).toContain('data-evidence-id="room-duplicate-check"');
    expect(html).toContain('data-workspace="W-STAY-RESOURCE"');

    setView("learning", ctx);
    expect(ctx.state.view).toBe("learning");
  });

  it("routes trace results when the query asks for submission traces", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "提交" });
    const html = searchView(ctx);

    expect(html).toContain('data-trace-id="trace-room"');
    expect(visibleText(html)).toContain("提交轨迹");
  });

  it("routes learning results only when the query asks for learning content", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "证据" });
    const html = searchView(ctx);

    expect(html).toContain('data-learning-id="learnEvidenceFix"');
    expect(html).toContain("证据怎么补");
  });

  it("ranks room creation before generic object results", () => {
    const ctx = createSurfaceCtx({ query: "创建房间" });
    const vm = rankSearchResults([
      { resultType: "room", title: "房间对象", workspaceId: "W-STAY-RESOURCE" },
      { resultType: "workItem", title: "创建房间", workItemId: "W-STAY-RESOURCE:roomSetup" }
    ], ctx.state.query);

    expect(vm[0].resultType).toBe("workItem");
  });

  it("keeps create-room intent focused on room setup instead of checkout inspection evidence", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "创建房间" });
    ctx.state.runtimeStore.workspaces.push({
      id: "W-STAY-CHECKOUT",
      domain: "stay",
      title: { "zh-CN": "我要办理退房" },
      summary: { "zh-CN": "退房检查" },
      next: { "zh-CN": "先发起退房并完成房间检查。" },
      cards: [{
        id: "roomInspection",
        status: "notStarted",
        title: { "zh-CN": "房间检查卡" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [{ id: "manual-note", label: { "zh-CN": "人工处理记录" } }],
        blockerRules: [],
        confirmation: { required: false }
      }]
    });

    const text = visibleText(searchView(ctx));

    expect(text).toContain("房间床位配置");
    expect(text).not.toContain("我要办理退房");
    expect(text).not.toContain("人工处理记录");
  });

  it("does not dump unrelated queue records for a narrow numeric query", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "21" });
    ctx.state.runtimeStore.workQueue.push({
      queueItemId: "q-unrelated",
      workItemId: "W-STAY-RESOURCE:unrelated",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      workItemType: "Dorm.Other",
      lifecycleState: "ready",
      badges: ["mine"],
      reason: "无关任务"
    });

    const html = searchView(ctx);

    expect(html).not.toContain("W-STAY-RESOURCE:unrelated");
    expect(visibleText(html)).toContain("这条结果暂时没有可跳转目标");
  });

  it("recovers an unfinished room workflow by object number and continues on the paused card", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "21" });
    ctx.state.runtimeStore.workspaces[0].cards = [
      {
        id: "roomSetup",
        status: "done",
        title: { "zh-CN": "房间配置卡" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: false }
      },
      {
        id: "bedSetup",
        status: "done",
        title: { "zh-CN": "床位配置卡" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: false }
      },
      {
        id: "rateSetup",
        status: "ready",
        title: { "zh-CN": "价格配置卡" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }
    ];
    ctx.state.runtimeStore.workQueue = [
      {
        queueItemId: "q-room-21-rate",
        workItemId: "W-STAY-RESOURCE:rateSetup",
        workspaceId: "W-STAY-RESOURCE",
        cardId: "rateSetup",
        caseId: "case:W-STAY-RESOURCE",
        workItemType: "Dorm.RateSetup",
        lifecycleState: "ready",
        ownerRole: "operator",
        badges: ["mine", "ready"],
        businessObject: "21 号房间",
        objectId: "ROOM-21",
        reason: "流程停在价格配置卡"
      },
      {
        queueItemId: "q-unrelated",
        workItemId: "W-STAY-RESOURCE:unrelated",
        workspaceId: "W-STAY-RESOURCE",
        cardId: "roomSetup",
        workItemType: "Dorm.Other",
        lifecycleState: "ready",
        ownerRole: "operator",
        badges: ["mine"],
        reason: "无关任务"
      }
    ];
    ctx.state.runtimeStore.operationWorkItems = [ctx.state.runtimeStore.workQueue[0]];

    const html = searchView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-search-section="unfinishedRecovery"');
    expect(html).toContain('data-work-item-id="W-STAY-RESOURCE:rateSetup"');
    expect(html).toContain('data-card-id="rateSetup"');
    expect(html).not.toContain("W-STAY-RESOURCE:unrelated");
    expect(text).toContain("未办完业务");
    expect(text).toContain("21 号房间");
    expect(text).toContain("价格配置卡");
    expect(html).toContain(">继续办理</button>");

    openWorkItem("W-STAY-RESOURCE:rateSetup", ctx);

    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("W-STAY-RESOURCE:rateSetup");
    expect(ctx.state.selectedCardId).toBe("rateSetup");
  });

  it("does not render completed WorkItems as processable search results", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });
    ctx.state.runtimeStore.workQueue = [{
      queueItemId: "q-completed-room",
      workItemId: "W-STAY-RESOURCE:roomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "confirmed",
      badges: ["mine"],
      reason: "已完成"
    }];

    const html = searchView(ctx);

    expect(html).not.toContain('data-work-item-id="W-STAY-RESOURCE:roomSetup"');
    expect(html).toContain('data-workspace="W-STAY-RESOURCE"');
    expect(visibleText(html)).toContain("状态: 已完成");
    expect(visibleText(html)).toContain("查看");
  });

  it("keeps localized visible copy and no-action reason without raw object text", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "住宿" });
    const vm = buildSearchResultVM({
      resultType: "object",
      title: { "zh-CN": "住宿资源" },
      subtitle: { "zh-CN": "房间床位" }
    }, ctx);
    const html = searchView(ctx);

    expect(vm.reasonIfNoAction).toContain("这条结果暂时没有可跳转目标");
    expect(visibleText(html)).not.toContain("[object Object]");
    expect(visibleText(html)).not.toMatch(/\b(stay|finance|lead|leadCapture)\b/);
  });

  it("does not expose runtime workspace ids in visible search result subtitles", () => {
    const text = visibleText(searchView(createSurfaceCtx({ view: "search", query: "房间" })));

    expect(text).not.toMatch(/\bW-STAY-[A-Z0-9-]+/);
    expect(text).toContain("住宿业务");
  });

  it("preserves Search Kernel admission state in the surface view model", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });
    const vm = buildSearchResultVM({
      resultType: "workspaceCardProjection",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      admission: {
        visibleAllowed: true,
        prepareAllowed: true,
        confirmAllowed: false,
        productionAllowed: false,
        mode: "internal_pilot_observation",
        reason: "L1 observation only",
        admissionDecisionRef: "admission:roomSetup:internal"
      },
      sourceRefs: {
        source: "SearchKernelService",
        projectionAdapter: "LensQueryService.Search",
        admissionDecisionRef: "admission:roomSetup:internal"
      }
    }, ctx);

    expect(vm.visibleAllowed).toBe(true);
    expect(vm.prepareAllowed).toBe(true);
    expect(vm.confirmAllowed).toBe(false);
    expect(vm.productionAllowed).toBe(false);
    expect(vm.admissionReason).toBe("L1 observation only");
    expect(vm.sourceRefs.admissionDecisionRef).toBe("admission:roomSetup:internal");
    expect(vm.sourceRefs.projectionAdapter).toBe("LensQueryService.Search");
  });

  it("localizes active room commands without English fallback", () => {
    const ru = visibleText(searchView(createSurfaceCtx({ view: "search", lang: "ru-RU", query: "комната" })));
    const ky = visibleText(searchView(createSurfaceCtx({ view: "search", lang: "ky-KG", query: "бөлмө" })));

    expect(ru).toContain("Можно начать самому");
    expect(ru).toContain("Добавить комнату");
    expect(ru).toContain("Сначала внесите номер комнаты");
    expect(ru).toContain("Статус: Можно начать");
    expect(ru).toContain("Следующее действие: Начать с номера комнаты");
    expect(ru).not.toContain("Commands");
    expect(ru).not.toContain("Create room");
    expect(ru).not.toContain("Start resource setup");
    expect(ru).not.toContain("Start from room setup");

    expect(ky).toContain("Өзүңүз баштай турган иштер");
    expect(ky).toContain("Бөлмө кошуу");
    expect(ky).toContain("Алгач бөлмө номерин");
    expect(ky).not.toContain("Commands");
    expect(ky).not.toContain("Create room");
  });

  it("localizes learning result statuses without raw runtime status labels", () => {
    const ru = visibleText(searchView(createSurfaceCtx({ view: "search", lang: "ru-RU", query: "устройство" })));
    const ky = visibleText(searchView(createSurfaceCtx({ view: "search", lang: "ky-KG", query: "түзмөк" })));

    expect(ru).toContain("Статус: Доверие устройства");
    expect(ru).not.toMatch(/\b(rejection|device|permission|finance|role)\b/);
    expect(ky).toContain("Статус: Түзмөк ишеними");
    expect(ky).not.toMatch(/\b(rejection|device|permission|finance|role)\b/);
  });
});
