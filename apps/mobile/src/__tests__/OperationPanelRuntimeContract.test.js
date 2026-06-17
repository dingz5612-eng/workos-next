import { describe, expect, it } from "vitest";
import { routeView } from "../appRouter.js";
import { saveCompletedRecordSnapshot, saveDraft } from "../operationDrafts.js";
import { withSystemGeneratedOperationValues } from "../operationSystemValues.js";
import { createSurfaceCtx, runtimeStore, source, visibleText } from "./surfaceContractTestHelpers.js";
import { DORMITORY_MAINLINE_WORKSPACE_ID, DORMITORY_SCENARIO1_STEPS } from "../capabilityProjection.js";

describe("SURFACE-C Operation Panel runtime contract", () => {
  it("normalizes non-persisted task ids and renders only persisted WorkItem runtime identity", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel", selectedWorkItemId: "T-ROOM-CREATE" });
    const html = routeView(ctx);

    expect(ctx.state.selectedWorkItemId).toBe("wi-dorm-room-setup");
    expect(html).toContain("wi-dorm-room-setup");
    expect(html).not.toContain("T-ROOM-CREATE");
    expect(visibleText(html)).not.toMatch(/\b(commandSubmissionId|payloadHash|workItemId|caseId|OperationPanelView|TrustedConfirmSheet|ActionResult)\b/);
    expect(visibleText(html)).not.toContain("载荷指纹");
    expect(visibleText(html)).not.toContain("operationsPrepare");
    expect(visibleText(html)).not.toContain("operationsConfirm");
  });

  it("keeps runtime proof details available only for debug or audit surfaces", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel", selectedWorkItemId: "T-ROOM-CREATE", debugSurface: true });
    const html = routeView(ctx);

    expect(html).toContain('data-surface="operation-runtime-proof"');
    expect(html).toContain("提交记录");
    expect(html).toContain("载荷指纹");
  });

  it("blocks submit when a persisted WorkItem is missing", () => {
    const runtime = source("../operationRuntime.js");
    const panel = source("../views/operationPanelView.js");

    expect(runtime).toContain("persisted_work_item_required");
    expect(runtime).not.toContain("allowBlockedFallback");
    expect(runtime).not.toContain("submitCardOperationBlockedFallback");
    expect(runtime).not.toContain("prepareCard");
    expect(runtime).not.toContain("confirmCard");
    expect(panel).toContain("state.selectedWorkItemId = persistedWorkItemId");
    expect(panel).not.toContain("ctx.workspace()");
  });

  it("publishes machine-readable admission and runtime decisions for browser evidence", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-admission-decision="confirm_allowed_production_blocked"');
    expect(html).toContain('data-runtime-decision="work_item_confirm_ready:production_blocked"');
    expect(html).toContain('data-lifecycle-state="ready"');
    expect(html).toContain('data-surface="operation-admission"');
    expect(text).toContain("办理状态");
    expect(text).toContain("可以开始填写；提交前还会检查必填项、材料、权限和设备。");
    expect(text).toContain("填写房间信息");
  });

  it("renders route metadata on the progress rail without a repeated context container", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    const html = routeView(ctx);
    const text = visibleText(html);
    const saveDraftActionRow = html.match(/<div class="operation-actions">[\s\S]*?data-save-draft[\s\S]*?<\/div>/)?.[0] || "";

    expect(html).toContain('class="operation-step-rail"');
    expect(html).toContain('data-surface="operation-panel-route"');
    expect(html).toContain('data-component="operation-card-shell"');
    expect(html).toContain('class="feedback-fab"');
    expect(html).not.toContain('class="operation-feedback-link secondary"');
    expect(saveDraftActionRow).not.toContain("feedback");
    expect(html).not.toContain('class="operation-panel-page"');
    expect(html).not.toContain('class="operation-context-title"');
    expect(html).not.toContain("intent-card");
    expect(text).toContain("新建房间和床位");
    expect(text).toContain("填写房间信息");
    expect(text).not.toContain("办理进度");
    expect(text).not.toContain("当前办理 我要创建住宿资源");
    expect(text).not.toContain("当前可处理");
    expect(text).not.toContain("先配置房间和床位，再配置价格");
  });

  it("renders a runtime hydration state before WorkItems load instead of a false blocker", () => {
    const store = runtimeStore();
    store.workQueue = [];
    store.operationWorkItems = [];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeHydrating: true,
      runtimeStore: store,
      selectedWorkItemId: "wi-loading",
      selectedWorkspace: DORMITORY_MAINLINE_WORKSPACE_ID,
      selectedCardId: DORMITORY_SCENARIO1_STEPS[0].cardId
    });

    const html = routeView(ctx);

    expect(html).toContain('data-surface="runtime-hydration"');
    expect(visibleText(html)).toContain("正在同步真实任务");
    expect(visibleText(html)).not.toContain("暂不能直接办理");
    expect(ctx.state.lastActionResult).toBeUndefined();
  });

  it("does not render editable fields or submit checks for a not-started step", () => {
    const store = runtimeStore();
    store.workspaces[0].cards = [
      { ...store.workspaces[0].cards[0], id: DORMITORY_SCENARIO1_STEPS[0].cardId, status: "ready", title: { "zh-CN": "填写房间信息" } },
      {
        id: DORMITORY_SCENARIO1_STEPS[1].cardId,
        status: "notStarted",
        title: { "zh-CN": "确认床位信息" },
        fields: { business: [field("bedNo", "床位号")], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }
    ];
    store.operationWorkItems = [{
      workItemId: "wi-bed-not-started",
      workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
      cardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
      lifecycleState: "notStarted",
      ownerRole: "operator"
    }];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-bed-not-started",
      selectedWorkspace: DORMITORY_MAINLINE_WORKSPACE_ID,
      selectedCardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
      runtimeStore: store
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(text).toContain("这张卡还没轮到办理");
    expect(text).toContain("第 2/2 步");
    expect(text).not.toContain("填写信息");
    expect(text).not.toContain("提交前检查");
    expect((text.match(/确认床位信息/g) || []).length).toBeGreaterThanOrEqual(1);
    expect((text.match(/这张卡还没轮到办理。请先完成前一张卡。/g) || []).length).toBe(1);
    expect(html).not.toContain('data-operation-field="bedNo"');
  });

  it("does not report ready-to-submit while required fields are still missing", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0] = {
      ...store.workspaces[0].cards[0],
      fields: { business: [field("buildingName", "楼栋")], system: [], analytics: [] }
    };
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeStore: store
    });

    const text = visibleText(routeView(ctx));

    expect(text).toContain("还需填写: 楼栋/区域、楼层、房间号、床位数");
    expect(text).toContain("提交状态: 暂不能提交: 还需填写");
    expect(text).not.toContain("提交状态: 可以提交");
  });

  it("does not treat a required building context selector as filled just because the control exists", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0] = {
      ...store.workspaces[0].cards[0],
      fields: {
        business: [{
          ...field("roomType", "房型"),
          type: "select",
          ui: {
            control: "select",
            optionSet: "roomType",
            options: [
              { value: "four_bed", label: { "zh-CN": "四人间" } },
              { value: "six_bed", label: { "zh-CN": "六人间" } }
            ],
            defaultValue: "",
            derivedFrom: "",
            readonly: false
          }
        }],
        system: [],
        analytics: []
      }
    };
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeStore: store
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('list="buildingContextRefOptions"');
    expect(text).toContain("还需填写: 楼栋/区域、楼层、房间号、床位数");
    expect(text).toContain("提交状态: 暂不能提交: 还需填写");
    expect(text).not.toContain("提交状态: 可以提交");
  });

  it("hides backend-default actor fields while keeping upstream object context readonly", () => {
    const store = runtimeStore();
    const workspaceId = "W-STAY-DEPOSIT-CONTEXT-001";
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: workspaceId,
      title: { "zh-CN": "押金账本" },
      cards: [{
        id: "depositConfirmation",
        status: "ready",
        title: { "zh-CN": "押金财务确认卡" },
        fields: {
          business: [
            field("depositReceiptId", "押金收款记录"),
            field("confirmedAmount", "确认金额"),
            field("confirmationResult", "确认结果"),
            field("financeReviewer", "财务确认人")
          ],
          system: [],
          analytics: []
        },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "finance" }
      }]
    };
    store.operationWorkItems = [{ workItemId: "wi-deposit-confirm", workspaceId, cardId: "depositConfirmation", lifecycleState: "ready", ownerRole: "finance" }];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-deposit-confirm",
      selectedWorkspace: workspaceId,
      selectedCardId: "depositConfirmation",
      runtimeStore: store,
      projectionEvents: [{
        workspaceId,
        cardId: "depositReceipt",
        eventType: "Accommodation.DepositReceiptRecorded",
        payload: { depositReceiptId: "drec-001" }
      }]
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-operation-field="depositReceiptId"');
    expect(html).toContain('data-operation-field="depositReceiptId" value="drec-001"');
    expect(html).not.toContain('data-operation-field="financeReviewer"');
    expect(text).not.toContain("财务确认人");
    expect(text).not.toContain("还需填写: 押金收款记录");
  });

  it("uses operations-start-context payload as readonly upstream context for direct ledger starts", () => {
    const store = runtimeStore();
    const workspaceId = "W-STAY-DEPOSIT-LEDGER-DIRECT-001";
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: workspaceId,
      title: { "zh-CN": "押金账本" },
      cards: [{
        id: "depositAssessment",
        status: "ready",
        title: { "zh-CN": "押金评估卡" },
        fields: {
          business: [
            field("stayId", "入住单"),
            field("depositType", "押金类型"),
            field("requiredDepositAmount", "应收押金金额")
          ],
          system: [],
          analytics: []
        },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "finance" }
      }]
    };
    store.operationWorkItems = [{
      workItemId: "wi-deposit-direct-start",
      workspaceId,
      cardId: "depositAssessment",
      lifecycleState: "ready",
      ownerRole: "finance",
      payload: {
        cardId: "depositAssessment",
        templateWorkspaceId: "W-STAY-DEPOSIT-LEDGER",
        startContextSource: "operations-start-context",
        stayId: "stay-direct-001",
        residentName: "真实浏览器验收",
        phone: "13800001234",
        buildingName: "D02",
        roomNo: "22",
        bedNo: "01",
        bedTypeLabel: "上铺",
        depositStatus: "押金待评估"
      }
    }];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-deposit-direct-start",
      selectedWorkspace: workspaceId,
      selectedCardId: "depositAssessment",
      runtimeStore: store
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-operation-field="stayId" value="stay-direct-001"');
    expect(text).toContain("系统已带入，不需要重复填写。");
    expect(text).not.toContain("还需填写: 入住单");
    expect(text).toContain("还需填写: 押金类型、应收押金金额");
  });

  it("generates hidden object ids for the first step before Operations Runtime submit", () => {
    const values = withSystemGeneratedOperationValues(
      { id: "W-STAY-LEAD-RESERVATION-001" },
      { id: "leadCapture" },
      {
        contactDate: "2026-06-05",
        leadName: "测试住客",
        phone: "13800000000",
        leadStatus: "new"
      }
    );

    expect(values.leadId).toMatch(/^lead-/);
  });

  it("carries a generated lead context into follow-up instead of showing a missing upstream blocker", () => {
    const store = runtimeStore();
    const workspaceId = "W-STAY-LEAD-RESERVATION-CARRY-001";
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: workspaceId,
      title: { "zh-CN": "我要管理线索预订" },
      cards: [
        {
          id: "leadCapture",
          status: "done",
          title: { "zh-CN": "线索捕获卡" },
          fields: { business: [field("leadName", "线索姓名"), field("phone", "电话"), field("contactDate", "联系日期")], system: [], analytics: [] },
          evidence: [],
          checks: [],
          blockerRules: [],
          confirmation: { required: true, requiredRole: "operator" }
        },
        {
          id: "leadFollowUp",
          status: "ready",
          title: { "zh-CN": "线索跟进卡" },
          fields: {
            business: [
              field("leadId", "线索"),
              field("followUpDate", "跟进日期"),
              field("followUpResult", "跟进结果"),
              field("nextFollowUpAt", "下一次跟进时间"),
              field("leadStatus", "线索状态")
            ],
            system: [],
            analytics: []
          },
          evidence: [],
          checks: [],
          blockerRules: [],
          confirmation: { required: true, requiredRole: "operator" }
        }
      ]
    };
    store.operationWorkItems = [{
      workItemId: "wi-lead-follow-up",
      workspaceId,
      cardId: "leadFollowUp",
      lifecycleState: "ready",
      ownerRole: "operator"
    }];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-lead-follow-up",
      selectedWorkspace: workspaceId,
      selectedCardId: "leadFollowUp",
      runtimeStore: store,
      projectionEvents: [{
        workspaceId,
        cardId: "leadCapture",
        eventType: "OperationsWorkItemConfirmed",
        payload: {
          input: {
            fieldValues: {
              contactDate: "2026-06-05",
              leadName: "测试住客",
              phone: "13800000000",
              leadStatus: "新线索"
            }
          }
        }
      }]
    });
    ctx.state.runtimeStore.events = ctx.state.projectionEvents;

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-operation-field="leadId" value="lead-');
    expect(html).toContain('value="测试住客 · 13800000000 · 新线索"');
    expect(text).not.toContain("缺少上游信息: 线索");
    expect(text).toContain("还需填写: 跟进日期、跟进结果、下一次跟进时间、线索状态");
  });

  it("uses the current projection card state over stale WorkItem snapshots after commit", () => {
    const store = runtimeStore();
    store.workspaces[0].cards[0].status = "done";
    store.operationWorkItems[0] = {
      ...store.operationWorkItems[0],
      lifecycleState: "ready",
      card: {
        ...store.workspaces[0].cards[0],
        status: "ready"
      }
    };
    store.workQueue[0] = {
      ...store.workQueue[0],
      lifecycleState: "ready"
    };
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      runtimeStore: store,
      lastActionResult: {
        status: "committed_projection_pending",
        workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
        cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
        message: "已提交成功，视图同步中。"
      }
    });

    const html = routeView(ctx);

    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(html).toContain('data-surface="completed-workspace-route"');
    expect(html).not.toContain("data-submit-card");
    expect(visibleText(html)).not.toContain("提交处理");
    expect(visibleText(html)).not.toContain("完成后");
    expect(html).not.toContain('data-surface="completed-operation-record"');
  });

  it("deduplicates projection pending success copy across operation message and result card", () => {
    const message = "已提交成功，视图同步中。";
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      operationMessage: message,
      lastActionResult: {
        status: "committed_projection_pending",
        workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
        cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
        message
      }
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect((text.match(/已提交成功，视图同步中。/g) || []).length).toBe(1);
    expect(html).toContain('data-surface="projection-pending"');
    expect(html).not.toContain('class="operation-message"');
  });

  it("renders completed operation records directly as the readonly record before correction", () => {
    const ctx = createSurfaceCtx({ view: "operationPanel" });
    ctx.state.runtimeStore.workspaces[0].cards[0].status = "done";

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(html).toContain('data-surface="completed-workspace-route"');
    expect(html).toContain('data-correction-work-item="true"');
    expect(html).not.toContain('data-view-completed-record="true"');
    expect(html).not.toContain('data-surface="completed-operation-record"');
    expect(text).toContain("只读记录");
    expect(text).toContain("请先核对已提交的业务内容");
    expect(text).not.toContain("对象摘要");
    expect(text).not.toContain("不能重复提交");
    expect(html).not.toContain("data-submit-card");
  });

  it("shows submitted values on the readonly completed record before offering correction", () => {
    const store = runtimeStore();
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: `${DORMITORY_MAINLINE_WORKSPACE_ID}-READONLY-001`,
      cards: [{
        ...store.workspaces[0].cards[0],
        id: DORMITORY_SCENARIO1_STEPS[0].cardId,
        status: "done",
        fields: { business: [field("buildingName", "楼栋"), field("roomNo", "房间号"), field("bedCount", "床位数")], system: [], analytics: [] }
      }]
    };
    saveCompletedRecordSnapshot({
      workspaceId: `${DORMITORY_MAINLINE_WORKSPACE_ID}-READONLY-001`,
      cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      values: {
        buildingName: "A栋",
        roomNo: "301",
        bedCount: "4"
      }
    });
    const ctx = createSurfaceCtx({
      view: "workspace",
      selectedWorkspace: `${DORMITORY_MAINLINE_WORKSPACE_ID}-READONLY-001`,
      selectedCardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      selectedWorkItemId: "",
      runtimeStore: store
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-surface="completed-workspace-record"');
    expect(text).toContain("只读记录");
    expect(text).not.toContain("对象摘要");
    expect(text).toContain("A栋");
    expect(text).toContain("301");
    expect(text).toContain("4");
    expect(html).toContain('data-correction-work-item="true"');
    expect(text).toContain("请先核对已提交的业务内容");
  });

  it("summarizes scenario 1 completed room, generated bed group, and readiness conclusion", () => {
    const workspaceId = `${DORMITORY_MAINLINE_WORKSPACE_ID}-READONLY-SC1-001`;
    const store = runtimeStore();
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: workspaceId,
      cards: [
        {
          ...store.workspaces[0].cards[0],
          id: DORMITORY_SCENARIO1_STEPS[0].cardId,
          status: "done",
          fields: { business: [field("roomNo", "房间号"), field("bedCount", "床位数")], system: [], analytics: [] }
        },
        {
          id: DORMITORY_SCENARIO1_STEPS[1].cardId,
          status: "done",
          title: { "zh-CN": "确认床位信息" },
          fields: { business: [field("bedType", "床铺生成方式")], system: [], analytics: [] },
          evidence: [],
          checks: [],
          blockerRules: [],
          confirmation: { required: true, requiredRole: "operator" }
        },
        {
          id: DORMITORY_SCENARIO1_STEPS[2].cardId,
          status: "done",
          title: { "zh-CN": "完成基础检查" },
          fields: { business: [field("readinessState", "基础就绪结论"), field("roomId", "所属房间"), field("bedId", "床位")], system: [], analytics: [] },
          evidence: [],
          checks: [],
          blockerRules: [],
          confirmation: { required: true, requiredRole: "operator" }
        }
      ]
    };
    saveCompletedRecordSnapshot({
      workspaceId,
      cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      values: { roomNo: "A301", bedCount: "4" }
    });
    saveCompletedRecordSnapshot({
      workspaceId,
      cardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
      values: { bedType: "bunk_pair" }
    });
    saveCompletedRecordSnapshot({
      workspaceId,
      cardId: DORMITORY_SCENARIO1_STEPS[2].cardId,
      values: { readinessState: "passed" }
    });
    const ctx = createSurfaceCtx({
      view: "workspace",
      selectedWorkspace: workspaceId,
      selectedCardId: DORMITORY_SCENARIO1_STEPS[2].cardId,
      selectedWorkItemId: "",
      runtimeStore: store
    });

    const text = visibleText(routeView(ctx));

    expect(text).toContain("房间和床位已新建");
    expect(text).toContain("A301");
    expect(text).toContain("4 个床位 01, 02, 03, 04");
    expect(text).toContain("通过");
    expect(text).not.toContain("所属房间 未填写");
    expect(text).not.toContain("床位 未填写");
  });

  it("renders bed setup as a room-capacity batch instead of one single-bed input", () => {
    const store = runtimeStore();
    const bedCount = {
      ...field("bedCount", "床位数"),
      type: "number",
      ui: { control: "number", optionSet: "", options: [], defaultValue: "", derivedFrom: "", readonly: false }
    };
    const bedLabels = {
      ...field("bedLabels", "床位标签"),
      ui: { control: "textarea", optionSet: "", options: [], defaultValue: "", derivedFrom: "", readonly: false }
    };
    const bedType = {
      ...field("bedType", "床位类型"),
      type: "select",
      ui: {
        control: "select",
        optionSet: "bunkType",
        options: [
          { value: "bunk_pair", label: { "zh-CN": "上下铺：两上两下" } },
          { value: "upper", label: { "zh-CN": "全部上铺" } },
          { value: "lower", label: { "zh-CN": "全部下铺" } },
          { value: "whole", label: { "zh-CN": "全部平铺" } }
        ],
        defaultValue: "bunk_pair",
        derivedFrom: "",
        readonly: false
      }
    };
    store.workspaces[0].cards = [
      { ...store.workspaces[0].cards[0], id: DORMITORY_SCENARIO1_STEPS[0].cardId, status: "done", title: { "zh-CN": "填写房间信息" } },
      {
        id: DORMITORY_SCENARIO1_STEPS[1].cardId,
        status: "ready",
        title: { "zh-CN": "确认床位信息" },
        fields: { business: [field("roomRef", "所属房间"), bedCount, bedLabels, bedType, field("bedStatus", "初始床位状态")], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }
    ];
    store.operationWorkItems = [{
      workItemId: "wi-bed-batch",
      workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
      cardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
      lifecycleState: "ready",
      ownerRole: "operator"
    }];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-bed-batch",
      selectedWorkspace: DORMITORY_MAINLINE_WORKSPACE_ID,
      selectedCardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
      runtimeStore: store,
      projectionEvents: [{
        workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
        cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
        eventType: "Accommodation.RoomConfigured",
        payload: { roomRef: "room-401", roomNo: "401", bedCount: "4" }
      }]
    });

    const html = routeView(ctx);

    expect(html).toContain('data-operation-field="bedCount"');
    expect(html).toContain('value="4"');
    expect(html).toContain('value="401" readonly aria-readonly="true"');
    expect(html).toContain('data-operation-field="roomRef" value="room-401"');
    expect(html).not.toContain('data-operation-field="roomId"');
    expect(html).toContain('value="4" readonly aria-readonly="true"');
    expect(visibleText(html)).toContain("系统已带入，不需要重复填写。");
    expect(visibleText(html)).not.toContain("所属房间 · 可搜索选择");
    expect(visibleText(html)).not.toContain("已从本案带入");
    expect(html).not.toContain('<textarea data-operation-field="bedLabels"');
    expect(html).toContain('type="hidden" data-operation-field="bedLabels"');
    expect(html).toContain('value="01, 02, 03, 04"');
    expect(html).toContain('data-operation-field="bedLayout"');
    expect(html).toContain("01 · 上铺");
    expect(html).toContain("02 · 下铺");
    expect(html).toContain("03 · 上铺");
    expect(html).toContain("04 · 下铺");
    expect(visibleText(html)).toContain("床铺生成方式");
    expect(visibleText(html)).toContain("将生成的床位");
    expect(visibleText(html)).toContain("必填项: 已完成");
    expect(visibleText(html)).toContain("材料核对: 无需补材料");
    expect(visibleText(html)).not.toContain("还需填写: 所属房间");
    expect(visibleText(html)).not.toContain("还需填写: 床位数");
    expect(visibleText(html)).not.toContain("还需填写: 床位标签");
    expect(visibleText(html)).not.toContain("初始床位状态");
    expect(html).not.toContain('data-operation-field="bedStatus"');
    expect(html).not.toContain('data-operation-field="bedNo"');
    expect(html).not.toContain('data-operation-field="bedLabel"');
  });

  it("ignores suppressed single-bed validation after bed setup switches to generated room-capacity beds", () => {
    const store = runtimeStore();
    const workspaceId = `${DORMITORY_MAINLINE_WORKSPACE_ID}-BED-SUPPRESSED-001`;
    const bedCount = {
      ...field("bedCount", "床位数"),
      type: "number",
      ui: { control: "number", optionSet: "", options: [], defaultValue: "", derivedFrom: "", readonly: false }
    };
    const bedLabels = {
      ...field("bedLabels", "床位标签"),
      ui: { control: "textarea", optionSet: "", options: [], defaultValue: "", derivedFrom: "", readonly: false }
    };
    const bedType = {
      ...field("bedType", "床位类型"),
      type: "select",
      ui: {
        control: "select",
        optionSet: "bunkType",
        options: [{ value: "bunk_pair", label: { "zh-CN": "上下铺：两上两下" } }],
        defaultValue: "bunk_pair",
        derivedFrom: "",
        readonly: false
      }
    };
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: workspaceId,
      cards: [
        { ...store.workspaces[0].cards[0], id: DORMITORY_SCENARIO1_STEPS[0].cardId, status: "done", title: { "zh-CN": "填写房间信息" } },
        {
          id: DORMITORY_SCENARIO1_STEPS[1].cardId,
          status: "ready",
          title: { "zh-CN": "确认床位信息" },
          fields: {
            business: [
              field("roomRef", "所属房间"),
              bedCount,
              bedLabels,
              bedType,
              field("bedNo", "床位号"),
              field("bedLabel", "床位标签")
            ],
            system: [],
            analytics: []
          },
          evidence: [],
          checks: [],
          blockerRules: [],
          confirmation: { required: true, requiredRole: "operator" }
        }
      ]
    };
    store.operationWorkItems = [{
      workItemId: "wi-bed-suppressed-validation",
      workspaceId,
      cardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
      lifecycleState: "ready",
      ownerRole: "operator"
    }];
    store.workQueue = [...store.operationWorkItems];
    saveCompletedRecordSnapshot({
      workspaceId,
      cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      values: { roomRef: "room-a9888", buildingName: "真实浏览器验收", roomNo: "A9888", bedCount: "2" }
    });
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-bed-suppressed-validation",
      selectedWorkspace: workspaceId,
      selectedCardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
      runtimeStore: store,
      fieldValidation: {
        workspaceId,
        cardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
        missingFieldIds: ["bedNo"],
        missingLabels: ["床位号"]
      },
      lastActionResult: {
        workspaceId,
        cardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
        status: "business_blocked_422",
        reason: "required_field_missing",
        message: "提交校验未通过"
      }
    });

    const html = routeView(ctx);
    const text = visibleText(html);

    expect(html).not.toContain('data-operation-field="bedNo"');
    expect(html).not.toContain('data-operation-field="bedLabel"');
    expect(text).toContain("将生成的床位");
    expect(text).toContain("01 · 上铺");
    expect(text).toContain("02 · 下铺");
    expect(text).toContain("提交状态: 可以提交");
    expect(text).not.toContain("还需填写: 床位号");
    expect(text).not.toContain("补齐必填项");
    expect(text).not.toContain("提交校验未通过");
  });

  it("regenerates bed labels from the carried bed count instead of stale bed setup draft values", () => {
    const store = runtimeStore();
    const bedCount = {
      ...field("bedCount", "床位数"),
      type: "number",
      ui: { control: "number", optionSet: "", options: [], defaultValue: "", derivedFrom: "", readonly: false }
    };
    const bedLabels = {
      ...field("bedLabels", "床位标签"),
      ui: { control: "textarea", optionSet: "", options: [], defaultValue: "", derivedFrom: "", readonly: false }
    };
    const bedType = {
      ...field("bedType", "床位类型"),
      type: "select",
      ui: {
        control: "select",
        optionSet: "bunkType",
        options: [{ value: "bunk_pair", label: { "zh-CN": "上下铺：两上两下" } }],
        defaultValue: "bunk_pair",
        derivedFrom: "",
        readonly: false
      }
    };
    store.workspaces[0].cards = [
      { ...store.workspaces[0].cards[0], id: DORMITORY_SCENARIO1_STEPS[0].cardId, status: "done", title: { "zh-CN": "填写房间信息" } },
      {
        id: DORMITORY_SCENARIO1_STEPS[1].cardId,
        status: "ready",
        title: { "zh-CN": "确认床位信息" },
        fields: { business: [field("roomRef", "所属房间"), bedCount, bedLabels, bedType], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }
    ];
    store.operationWorkItems = [{ workItemId: "wi-bed-stale-draft", workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID, cardId: DORMITORY_SCENARIO1_STEPS[1].cardId, lifecycleState: "ready", ownerRole: "operator" }];
    store.workQueue = [...store.operationWorkItems];
    saveDraft(DORMITORY_MAINLINE_WORKSPACE_ID, DORMITORY_SCENARIO1_STEPS[1].cardId, { roomRef: "room-401", bedCount: "2", bedLabels: "01, 02", bedType: "bunk_pair" });
    saveCompletedRecordSnapshot({
      workspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
      cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      values: { roomRef: "room-401", roomNo: "401", bedCount: "4" }
    });
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-bed-stale-draft",
      selectedWorkspace: DORMITORY_MAINLINE_WORKSPACE_ID,
      selectedCardId: DORMITORY_SCENARIO1_STEPS[1].cardId,
      runtimeStore: store
    });

    const html = routeView(ctx);

    expect(html).toContain('value="01, 02, 03, 04"');
    expect(html).toContain("03 · 上铺");
    expect(html).toContain("04 · 下铺");
    expect(html).not.toContain('value="01, 02"');
  });

  it("uses service scope to reveal only the relevant room or bed target", () => {
    const store = runtimeStore();
    const workspaceId = "W-STAY-SERVICE-TASK-SCOPE-001";
    const scopeField = {
      ...field("resourceScope", "服务范围"),
      type: "select",
      ui: {
        control: "select",
        optionSet: "resourceScope",
        options: [
          { value: "room", label: { "zh-CN": "房间" } },
          { value: "bed", label: { "zh-CN": "床位" } },
          { value: "room_beds", label: { "zh-CN": "房间全部床位" } }
        ],
        defaultValue: "",
        derivedFrom: "",
        readonly: false
      }
    };
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: workspaceId,
      title: { "zh-CN": "清洁维修任务" },
      cards: [{
        id: "serviceTaskCreate",
        status: "ready",
        title: { "zh-CN": "服务任务创建卡" },
        fields: { business: [scopeField, field("roomId", "房间"), field("bedId", "床位"), field("blocksAvailability", "是否阻断可售")], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" }
      }]
    };
    store.operationWorkItems = [{
      workItemId: "wi-service-scope",
      workspaceId,
      cardId: "serviceTaskCreate",
      lifecycleState: "ready",
      ownerRole: "operator"
    }];
    store.workQueue = [...store.operationWorkItems];
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-service-scope",
      selectedWorkspace: workspaceId,
      selectedCardId: "serviceTaskCreate",
      runtimeStore: store
    });

    const initialHtml = routeView(ctx);
    expect(initialHtml).toContain('data-operation-field="resourceScope"');
    expect(initialHtml).toContain('data-operation-field-button="resourceScope"');
    expect(initialHtml).not.toContain('<select data-operation-field="resourceScope"');
    expect(initialHtml).not.toContain('data-operation-field="roomId"');
    expect(initialHtml).not.toContain('data-operation-field="bedId"');

    saveDraft(workspaceId, "serviceTaskCreate", { resourceScope: "room" });
    const roomHtml = routeView(ctx);
    expect(roomHtml).toContain('data-value="room" aria-pressed="true"');
    expect(roomHtml).toContain('data-operation-field="roomId"');
    expect(roomHtml).toContain('data-required-field="true"');
    expect(roomHtml).not.toContain('data-operation-field="bedId"');

    saveDraft(workspaceId, "serviceTaskCreate", { resourceScope: "bed" });
    const bedHtml = routeView(ctx);
    expect(bedHtml).toContain('data-value="bed" aria-pressed="true"');
    expect(bedHtml).toContain('data-operation-field="bedId"');
    expect(bedHtml).not.toContain('data-operation-field="roomId"');
  });

  it("binds service scope segmented buttons to the operation field contract", () => {
    const binder = source("../eventBinder.js");
    const controller = source("../operationController.js");

    expect(binder).toContain("setSegmentedOperationField");
    expect(binder).toContain("button[data-operation-field-button]");
    expect(binder).toContain("setSegmentedOperationField(node, ctx)");
    expect(controller).toContain("export function setSegmentedOperationField");
    expect(controller).toContain('button.dataset.operationFieldButton');
    expect(controller).toContain('collectDraftingValuesOnInput({ target: input }, ctx)');
  });

  it("reads nested OperationsWorkItemConfirmed payload values for completed records", () => {
    const store = runtimeStore();
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: `${DORMITORY_MAINLINE_WORKSPACE_ID}-READONLY-002`,
      cards: [{
        ...store.workspaces[0].cards[0],
        id: DORMITORY_SCENARIO1_STEPS[0].cardId,
        status: "done",
        fields: { business: [field("roomNo", "房间号")], system: [], analytics: [] }
      }]
    };
    const ctx = createSurfaceCtx({
      view: "workspace",
      selectedWorkspace: `${DORMITORY_MAINLINE_WORKSPACE_ID}-READONLY-002`,
      selectedCardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
      selectedWorkItemId: "",
      runtimeStore: store,
      projectionEvents: [{
        workspaceId: `${DORMITORY_MAINLINE_WORKSPACE_ID}-READONLY-002`,
        cardId: DORMITORY_SCENARIO1_STEPS[0].cardId,
        eventType: "OperationsWorkItemConfirmed",
        payload: {
          input: {
            fieldValues: {
              roomNo: "302"
            }
          }
        }
      }]
    });
    ctx.state.runtimeStore.events = ctx.state.projectionEvents;

    const text = visibleText(routeView(ctx));

    expect(text).toContain("302");
    expect(text).not.toContain("提交内容还没有同步");
  });
});

function field(id, zh) {
  return {
    id,
    label: { "zh-CN": zh },
    layer: "business",
    type: "text",
    required: true,
    source: "userInput",
    visibleToUser: true,
    ui: { control: "text", optionSet: "", options: [], defaultValue: "", derivedFrom: "", readonly: false },
    help: { "zh-CN": "请输入本步需要的信息。" }
  };
}
