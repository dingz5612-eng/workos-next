import { describe, expect, it } from "vitest";
import { openWorkItem, setView } from "../navigationController.js";
import { buildSearchResultVM, rankSearchResults } from "../searchIntentHub.js";
import { searchView } from "../views/searchView.js";
import { DORMITORY_MAINLINE_WORKSPACE_ID, DORMITORY_SCENARIO1_STEPS } from "../capabilityProjection.js";
import { createSurfaceCtx, internalPilotAdmissionFixture, runtimeStore, visibleText } from "./surfaceContractTestHelpers.js";

describe("OAM Surface search intent hub contract", () => {
  it("renders the accepted capability start command through Search Kernel admission", () => {
    const ctx = withSearchKernelAdmission(createSurfaceCtx({ view: "search", query: "房源建档" }));
    const html = searchView(ctx);

    expect(html).toContain("主动办理");
    expect(html).toContain("房源建档与基础就绪");
    expect(html).not.toContain("工作内容");
    expect(html).not.toContain("处理：");
    expect(html).toContain("发起房源建档与基础就绪");
    expect(html).toContain(`data-start-operations-workspace="${DORMITORY_MAINLINE_WORKSPACE_ID}"`);
    expect(html).toContain(`data-first-card-id="${DORMITORY_SCENARIO1_STEPS[0].cardId}"`);
    expect(html).not.toContain('data-start-operations-workspace="W-STAY-RESOURCE"');
    expect(html).toContain(">开始办理</button>");
  });

  it("routes the explicit current capability wording to the Operations start command", () => {
    const html = searchView(withSearchKernelAdmission(createSurfaceCtx({ view: "search", query: "房源建档" })));
    const text = visibleText(html);

    expect(html).toContain('data-search-section="activeCommands"');
    expect(html).toContain(`data-start-operations-workspace="${DORMITORY_MAINLINE_WORKSPACE_ID}"`);
    expect(text).toContain("房源建档与基础就绪");
    expect(text).toContain("开始办理");
  });

  it("uses Search Kernel admission for active commands without local command admission", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房源建档" });
    ctx.state.runtimeStore.commandAdmission = null;
    ctx.state.runtimeStore.businessLineAdmission = null;
    ctx.state.runtimeStore.searchResultsByQuery = {
      "房源建档": [{
        resultType: "workspaceCardCompatibility",
        workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
        cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
        admission: {
          ...internalPilotAdmissionFixture(),
          confirmAllowed: false,
          admissionDecisionRef: "admission:test:search-kernel-prepare"
        },
        sourceRefs: {
          source: "SearchKernelService",
          sourceType: "workspaceCardProjection",
          admissionDecisionRef: "admission:test:search-kernel-prepare"
        }
      }]
    };

    const html = searchView(ctx);
    const text = visibleText(html);

    expect(html).toContain(`data-start-operations-workspace="${DORMITORY_MAINLINE_WORKSPACE_ID}"`);
    expect(text).toContain("开始办理");
  });

  it("keeps generated mainline active commands startable when no backend Search Kernel admission exists", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房源建档" });
    ctx.state.runtimeStore.commandAdmission = internalPilotAdmissionFixture();
    ctx.state.runtimeStore.businessLineAdmission = null;
    ctx.state.runtimeStore.searchResultsByQuery = {};

    const html = searchView(ctx);

    expect(html).toContain(`data-start-operations-workspace="${DORMITORY_MAINLINE_WORKSPACE_ID}"`);
    expect(html).not.toContain('data-view="learning"');
    expect(visibleText(html)).toContain("开始办理");
  });

  it("renders account recent searches and registered common intent suggestions", () => {
    const html = searchView(createSurfaceCtx({
      view: "search",
      query: "",
      recentSearches: ["基础就绪", "21 号房间"]
    }));
    const text = visibleText(html);

    expect(html).toContain('data-search-query="房源建档"');
    expect(html).toContain('data-search-query="基础就绪"');
    expect(text).toContain("常用搜索");
    expect(text).toContain("最近搜索");
  });

  it("routes object results while keeping evidence activity log out of Search", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });
    const html = searchView(ctx);

    expect(html).not.toContain('data-evidence-id="room-duplicate-check"');
    expect(html).not.toContain('data-search-section="searchEvidence"');
    expect(html).toContain(`data-workspace="${DORMITORY_MAINLINE_WORKSPACE_ID}"`);

    setView("learning", ctx);
    expect(ctx.state.view).toBe("learning");
  });

  it("keeps submission traces out of Search activity log sections", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "提交" });
    const html = searchView(ctx);

    expect(html).not.toContain('data-trace-id="trace-room"');
    expect(html).not.toContain('data-search-section="searchSubmissionTrace"');
    expect(visibleText(html)).toContain("记录、证据和学习内容请到我的查看");
  });

  it("keeps learning results in Me / Learning Center instead of Search", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "证据" });
    const html = searchView(ctx);

    expect(html).not.toContain('data-learning-id="learnEvidenceFix"');
    expect(html).not.toContain('data-search-section="searchLearning"');
    expect(visibleText(html)).toContain("记录、证据和学习内容请到我的查看");
  });

  it("ranks room filing before generic object results", () => {
    const ctx = createSurfaceCtx({ query: "房源建档" });
    const vm = rankSearchResults([
      { resultType: "room", title: "房间对象", workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID },
      { resultType: "workItem", title: "房源建档", workItemId: "wi-room-setup", workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID, cardId: DORMITORY_SCENARIO1_STEPS[0].cardId, workItemType: DORMITORY_SCENARIO1_STEPS[0].workItemType }
    ], ctx.state.query);

    expect(vm[0].resultType).toBe("workItem");
  });

  it("keeps create-room intent focused on room setup instead of checkout inspection evidence", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房源建档" });
    ctx.state.runtimeStore.workspaces.push({
      id: "W-STAY-CHECKOUT-SETTLEMENT",
      domain: "stay",
      title: { "zh-CN": "我要办理退住结算" },
      summary: { "zh-CN": "退住查房与结算" },
      next: { "zh-CN": "先发起退住并完成查房。" },
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

    expect(text).toContain("房源建档与基础就绪");
    expect(text).toContain("发起房源建档与基础就绪");
    expect(text).not.toContain("我要办理退住结算");
    expect(text).not.toContain("人工处理记录");
  });

  it("does not dump unrelated queue records for a narrow numeric query", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "21" });
    ctx.state.runtimeStore.workQueue.push({
      queueItemId: "q-unrelated",
      workItemId: "wi-dorm-unrelated",
      workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
      cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      workItemType: "Dorm.Other",
      lifecycleState: "ready",
      badges: ["mine"],
      reason: "无关任务"
    });

    const html = searchView(ctx);

    expect(html).not.toContain("wi-dorm-unrelated");
    expect(visibleText(html)).toContain("这条结果暂时没有可跳转目标");
  });

  it("keeps ordinary object search readonly and does not show start handling", () => {
    const html = searchView(createSurfaceCtx({
      view: "search",
      query: "D01",
      recentSearches: ["房源建档"]
    }));
    const text = visibleText(html);

    expect(html).not.toContain('data-search-section="activeCommands"');
    expect(html).not.toContain(`data-start-operations-workspace="${DORMITORY_MAINLINE_WORKSPACE_ID}"`);
    expect(html).not.toContain('data-search-query="房源建档"');
    expect(text).not.toContain("常用搜索");
    expect(text).not.toContain("最近搜索");
    expect(text).not.toContain("开始办理");
    expect(text).toContain("这条结果暂时没有可跳转目标");
  });

  it("recovers an unfinished room workflow by object number and continues on the paused card", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "21" });
    ctx.state.runtimeStore.workspaces[0].cards = [
      {
        id: DORMITORY_SCENARIO1_STEPS[0].cardId,
        status: "done",
        title: { "zh-CN": "房间建档确认" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: false }
      },
      {
        id: DORMITORY_SCENARIO1_STEPS[1].cardId,
        status: "ready",
        title: { "zh-CN": "床位组确认" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: false }
      },
      {
        id: DORMITORY_SCENARIO1_STEPS[2].cardId,
        status: "notStarted",
        title: { "zh-CN": "基础就绪确认" },
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
        workItemId: "wi-dorm-bed-21",
        workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
        cardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
        caseId: `case:${DORMITORY_MAINLINE_WORKSPACE_ID}`,
        workItemType: DORMITORY_SCENARIO1_STEPS[1].workItemType,
        lifecycleState: "ready",
        ownerRole: "operator",
        badges: ["mine", "ready"],
        businessObject: "21 号房间",
        objectId: "ROOM-21",
        reason: "流程停在床位组确认",
        admission: internalPilotAdmissionFixture()
      },
      {
        queueItemId: "q-unrelated",
        workItemId: "wi-dorm-unrelated",
        workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
        cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
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
    expect(html).toContain('data-work-item-id="wi-dorm-bed-21"');
    expect(html).toContain(`data-card-id="${DORMITORY_SCENARIO1_STEPS[1].cardId}"`);
    expect(html).not.toContain("wi-dorm-unrelated");
    expect(text).toContain("未办完业务");
    expect(text).toContain("21 号房间");
    expect(text).toContain("床位组确认");
    expect(html).toContain(">继续填写</button>");

    openWorkItem("wi-dorm-bed-21", ctx);

    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.selectedWorkItemId).toBe("wi-dorm-bed-21");
    expect(ctx.state.selectedCardId).toBe(DORMITORY_SCENARIO1_STEPS[1].cardId);
  });

  it("does not render completed WorkItems or completed activity log as processable search results", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });
    ctx.state.runtimeStore.workQueue = [{
      queueItemId: "q-completed-room",
      workItemId: "wi-dorm-completed-room",
      workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
      cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "confirmed",
      badges: ["mine"],
      reason: "已完成"
    }];

    const html = searchView(ctx);

    expect(html).not.toContain('data-work-item-id="wi-dorm-completed-room"');
    expect(html).toContain(`data-workspace="${DORMITORY_MAINLINE_WORKSPACE_ID}"`);
    expect(html).not.toContain('data-search-section="completedWorkItems"');
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
    expect(text).toContain("房间");
    expect(text).toContain("房间建档确认");
  });

  it("preserves Search Kernel admission state in the surface view model", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "房间" });
    const vm = buildSearchResultVM({
      resultType: "workspaceCardCompatibility",
      workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
      cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      admission: {
        visibleAllowed: true,
        prepareAllowed: true,
        confirmAllowed: false,
        productionAllowed: false,
        mode: "internal_pilot_observation",
        reason: "L1 observation only",
        admissionDecisionRef: "admission:dormitory-room-setup:internal"
      },
      sourceRefs: {
        source: "SearchKernelService",
        sourceType: "workspaceCardProjection",
        projectionAdapter: "LensQueryService.Search",
        admissionDecisionRef: "admission:dormitory-room-setup:internal"
      },
      gateResult: {
        status: "visible_readonly",
        source: "SearchKernelService",
        sourceType: "workspaceCardProjection",
        checkedAt: "2026-06-06T00:00:00.0000000Z",
        policyVersion: "oam.search-permission-policy.v1",
        admissionDecisionRef: "admission:dormitory-room-setup:internal",
        writeThroughSearchAllowed: false,
        writeBusinessFactAllowed: false
      }
    }, ctx);

    expect(vm.visibleAllowed).toBe(true);
    expect(vm.prepareAllowed).toBe(true);
    expect(vm.confirmAllowed).toBe(false);
    expect(vm.productionAllowed).toBe(false);
    expect(vm.admissionReason).toBe("L1_observation_only");
    expect(vm.admission.admissionDecisionRef).toBe("admission:dormitory-room-setup:internal");
    expect(vm.gateResult.status).toBe("visible_readonly");
    expect(vm.gateResult.admissionDecisionRef).toBe("admission:dormitory-room-setup:internal");
    expect(vm.gateResult.writeThroughSearchAllowed).toBe(false);
    expect(vm.gateResult.writeBusinessFactAllowed).toBe(false);
    expect(vm.sourceRefs.admissionDecisionRef).toBeUndefined();
    expect(vm.sourceRefs.sourceType).toBe("workspaceCardProjection");
    expect(vm.sourceRefs.projectionAdapter).toBe("LensQueryService.Search");
  });

  it("renders admission explainability on search cards without ordinary-user raw refs", () => {
    const ctx = withSearchKernelAdmission(createSurfaceCtx({ view: "search", query: "房源建档" }));
    const html = searchView(ctx);
    const text = visibleText(html);

    expect(html).toContain("data-search-admission-state");
    expect(text).not.toContain("工作内容");
    expect(text).not.toContain("处理：");
    expect(text).not.toContain("准入状态");
    expect(text).toContain("当前可进入填写，但最终提交仍需再次校验。");
    expect(text).not.toContain("admissionDecisionRef");
    expect(text).not.toContain("blockedAdapter");
    expect(text).not.toContain("definitionId");
    expect(text).not.toContain("raw reason");
    expect(text).not.toContain("raw code");
  });

  it("does not use process wording when explicit search admission denies confirm", () => {
    const store = runtimeStore();
    const blockedItem = {
      resultType: "workItem",
      workItemId: "wi-dorm-blocked",
      workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
      cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      businessObject: "拒绝准入房间",
      actionLabel: "处理",
      lifecycleState: "ready",
      admission: {
        visibleAllowed: true,
        prepareAllowed: true,
        confirmAllowed: false,
        productionAllowed: false,
        mode: "contract_preview"
      }
    };
    store.workQueue = [blockedItem];
    store.operationWorkItems = [blockedItem];
    const ctx = createSurfaceCtx({ view: "search", query: "拒绝准入", runtimeStore: store });
    const html = searchView(ctx);
    const text = visibleText(html);

    expect(text).toContain("当前不能确认");
    expect(html).not.toContain(">处理</button>");
    expect(html).toContain(">查看记录</button>");
  });

  it("keeps Search items without Admission contract readonly", () => {
    const ctx = createSurfaceCtx({ view: "search", query: "缺准入" });
    const vm = buildSearchResultVM({
      resultType: "workItem",
      workItemId: "wi-missing-admission",
      workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
      cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      actionLabel: "处理",
      lifecycleState: "ready",
      title: { "zh-CN": "缺准入工作项" }
    }, ctx);

    expect(vm.visibleAllowed).toBe(true);
    expect(vm.prepareAllowed).toBe(false);
    expect(vm.confirmAllowed).toBe(false);
    expect(vm.productionAllowed).toBe(false);
    expect(vm.admission.reason).toBe("missing_admission_contract");
    expect(vm.actionLabel).toBe("查看记录");
    expect(vm.gateResult.writeThroughSearchAllowed).toBe(false);
    expect(vm.gateResult.writeBusinessFactAllowed).toBe(false);
  });

  it("renders Operations Search Kernel work items found by lead customer anchor", () => {
    const store = runtimeStore();
    const workspaceId = "W-STAY-LEAD-RESERVATION-DING";
    const result = {
      resultId: "operations:evt-ding:wi-lead-follow-ding",
      resultType: "workItem",
      workItemId: "wi-lead-follow-ding",
      workspaceId,
      cardId: "leadFollowUp",
      caseId: workspaceId,
      workItemType: "leadFollowUp",
      title: { "zh-CN": "线索跟进卡" },
      summary: { "zh-CN": "登记咨询和预订" },
      status: "available",
      nextAction: { "zh-CN": "继续当前办理" },
      score: 300,
      businessAnchor: {
        leadName: "DING",
        phone: "13812341234"
      }
    };
    store.workspaces = [{
      id: workspaceId,
      domain: "stay",
      title: { "zh-CN": "登记咨询和预订" },
      summary: { "zh-CN": "咨询、跟进和预订。" },
      next: { "zh-CN": "继续跟进线索" },
      cards: [
        { id: "leadCapture", status: "confirmed", title: { "zh-CN": "线索捕获卡" }, fields: { business: [], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } },
        { id: "leadFollowUp", status: "ready", title: { "zh-CN": "线索跟进卡" }, fields: { business: [], system: [], analytics: [] }, evidence: [], checks: [], blockerRules: [], confirmation: { required: true, requiredRole: "operator" } }
      ]
    }];
    store.searchResultsByQuery = { ding: [result] };
    store.operationWorkItems = [result];
    store.workQueue = [result];

    const ctx = createSurfaceCtx({ view: "search", query: "DING", runtimeStore: store });
    const html = searchView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-work-item-id="wi-lead-follow-ding"');
    expect(text).toContain("线索跟进卡");
    expect(text).toContain("DING");
    expect(text).toContain("138****1234");
    expect(text).toContain("继续当前办理");
    expect(text).not.toContain("没有匹配结果");
  });

  it("localizes active room commands without English fallback", () => {
    const ru = visibleText(searchView(withSearchKernelAdmission(createSurfaceCtx({ view: "search", lang: "ru-RU", query: "добавить комнату" }))));
    const ky = visibleText(searchView(withSearchKernelAdmission(createSurfaceCtx({ view: "search", lang: "ky-KG", query: "бөлмө кошуу" }))));

    expect(ru).toContain("Можно начать самому");
    expect(ru).toContain("Паспорт жилья и базовая готовность");
    expect(ru).not.toContain("Что сделать");
    expect(ru).toContain("Начать заполнение");
    expect(ru).not.toContain("Commands");
    expect(ru).not.toContain("Create room");
    expect(ru).not.toContain("Start resource setup");
    expect(ru).not.toContain("Start from room setup");

    expect(ky).toContain("Өзүңүз баштай турган иштер");
    expect(ky).toContain("Турак жайды каттоо жана базалык даярдык");
    expect(ky).toContain("Толтурууну баштоо");
    expect(ky).not.toContain("Commands");
    expect(ky).not.toContain("Create room");
  });

  it("does not leak localized learning activity log into ordinary Search", () => {
    const ru = visibleText(searchView(createSurfaceCtx({ view: "search", lang: "ru-RU", query: "устройство" })));
    const ky = visibleText(searchView(createSurfaceCtx({ view: "search", lang: "ky-KG", query: "түзмөк" })));

    expect(ru).not.toContain("Доверие устройства");
    expect(ru).not.toContain("Обучение");
    expect(ru).not.toMatch(/\b(rejection|device|permission|finance|role)\b/);
    expect(ky).not.toContain("Түзмөк ишеними");
    expect(ky).not.toContain("Окуу мазмуну");
    expect(ky).not.toMatch(/\b(rejection|device|permission|finance|role)\b/);
  });
});

function withSearchKernelAdmission(ctx, options = {}) {
  const query = options.query || ctx.state.query;
  const workspaceId = options.workspaceId || DORMITORY_MAINLINE_WORKSPACE_ID;
  const cardId = options.cardId || DORMITORY_SCENARIO1_STEPS[0].cardId;
  const admission = {
    ...internalPilotAdmissionFixture(),
    ...(options.admission || {})
  };
  ctx.state.runtimeStore.searchResultsByQuery = {
    ...(ctx.state.runtimeStore.searchResultsByQuery || {}),
    [normalizeQuery(query)]: [{
      resultType: "workspaceCardCompatibility",
      workspaceId,
      cardId,
      admission,
      sourceRefs: {
        source: "SearchKernelService",
        sourceType: "workspaceCardProjection",
        admissionDecisionRef: admission.admissionDecisionRef
      },
      gateResult: {
        status: "visible_readonly",
        source: "SearchKernelService",
        sourceType: "workspaceCardProjection",
        admissionDecisionRef: admission.admissionDecisionRef,
        writeThroughSearchAllowed: false,
        writeBusinessFactAllowed: false
      }
    }]
  };
  return ctx;
}

function normalizeQuery(value = "") {
  return String(value || "").trim().toLocaleLowerCase();
}
