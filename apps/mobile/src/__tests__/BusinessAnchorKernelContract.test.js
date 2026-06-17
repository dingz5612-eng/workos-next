import { describe, expect, it } from "vitest";
import { buildBusinessAnchor, businessAnchorHtml } from "../businessAnchorKernel.js";
import { routeView } from "../appRouter.js";
import { createSurfaceCtx, runtimeStore, visibleText } from "./surfaceContractTestHelpers.js";

describe("Business Anchor Kernel contract", () => {
  it("renders human-memory anchors while keeping phone display masked", () => {
    const ctx = createSurfaceCtx();
    const anchor = buildBusinessAnchor({
      cardId: "depositConfirmation",
      payload: {
        fieldValues: {
          buildingName: "D02",
          roomNo: "22",
          bedLabel: "01",
          bedType: "upper",
          residentName: "张三",
          residentPhone: "13812341234"
        }
      }
    }, ctx);

    expect(anchor.label).toBe("D02 / 22 · 01 上铺 · 张三 · 138****1234 · 押金待确认");
    expect(anchor.searchText).toContain("13812341234");
    expect(anchor.label).not.toContain("13812341234");
    expect(anchor.privacy.personAndPhoneAreDisplaySearchOnly).toBe(true);
    expect(anchor.privacy.phoneMasked).toBe(true);
  });

  it("reads direct Operations WorkItem payload anchors from workspace start context", () => {
    const ctx = createSurfaceCtx();
    const anchor = buildBusinessAnchor({
      cardId: "paymentReceipt",
      payload: {
        startContextSource: "operations-start-context",
        buildingName: "D02",
        roomNo: "22",
        bedNo: "01",
        bedTypeLabel: "上铺",
        residentName: "真实浏览器验收",
        phone: "13800001234",
        paymentStatus: "普通收款待登记"
      }
    }, ctx);

    expect(anchor.label).toBe("D02 / 22 · 01 上铺 · 真实浏览器验收 · 138****1234 · 普通收款待登记");
    expect(anchor.searchText).toContain("13800001234");
    expect(anchor.label).not.toContain("13800001234");
  });

  it("uses the same anchor across Workbench, Search, Learning, and Operation Panel", () => {
    const store = runtimeStore();
    const workspaceId = "W-STAY-DEPOSIT-ANCHOR-001";
    const anchor = {
      buildingName: "D02",
      roomNo: "22",
      bedLabel: "01",
      bedType: "upper",
      residentName: "张三",
      residentPhone: "13812341234"
    };
    store.workspaces[0] = {
      ...store.workspaces[0],
      id: workspaceId,
      title: { "zh-CN": "处理押金" },
      summary: { "zh-CN": "押金评估、收取、确认和关闭。" },
      next: { "zh-CN": "先确认押金" },
      businessAnchor: anchor,
      cards: [{
        id: "depositConfirmation",
        status: "ready",
        title: { "zh-CN": "押金财务确认卡" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [],
        checks: [],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "finance" }
      }]
    };
    store.operationWorkItems = [{
      workItemId: "wi-anchor-deposit-confirm",
      workspaceId,
      cardId: "depositConfirmation",
      lifecycleState: "ready",
      ownerRole: "finance",
      businessAnchor: anchor
    }];
    store.workQueue = [{
      queueItemId: "q-anchor-deposit-confirm",
      workItemId: "wi-anchor-deposit-confirm",
      workspaceId,
      cardId: "depositConfirmation",
      lifecycleState: "ready",
      ownerRole: "finance",
      domain: "stay",
      badges: ["mine", "ready"],
      businessAnchor: anchor
    }];
    const base = {
      runtimeStore: store,
      currentActor: { role: "admin", displayName: "治理管理员", token: "admin-token", capabilities: ["operations.confirm", "search.read"] },
      selectedWorkItemId: "wi-anchor-deposit-confirm",
      selectedWorkspace: workspaceId,
      selectedCardId: "depositConfirmation"
    };

    const workbench = visibleText(routeView(createSurfaceCtx({ ...base, view: "workbench" })));
    const search = visibleText(routeView(createSurfaceCtx({ ...base, view: "search", query: "13812341234" })));
    const learning = visibleText(routeView(createSurfaceCtx({ ...base, view: "learning", learningQuery: "张三" })));
    const operation = visibleText(routeView(createSurfaceCtx({ ...base, view: "operationPanel" })));

    for (const text of [workbench, search, learning, operation]) {
      expect(text).toContain("张三");
      expect(text).toContain("138****1234");
      expect(text).not.toContain("13812341234 ·");
    }
    expect(workbench).toContain("房间 D02 / 22");
    expect(workbench).toContain("床位 01 上铺");
    expect(workbench).toContain("客户/入住人 张三");
    expect(workbench).toContain("联系方式 138****1234");
    expect(workbench).toContain("押金 待确认");
    expect(operation).toContain("D02 / 22 · 01 上铺 · 张三 · 138****1234");
    expect(search).toContain("押金 待确认");
    expect(operation).toContain("押金待确认");
  });

  it("localizes active command anchor values instead of rendering objects", () => {
    const ctx = createSurfaceCtx();
    const html = businessAnchorHtml({
      resultType: "command",
      cardId: "cert.roomSetupConfirm",
      nextAction: { "zh-CN": "填写房间建档资料", "ru-RU": "Начать с номера комнаты" }
    }, ctx);

    expect(visibleText(html)).toContain("填写房间信息");
    expect(visibleText(html)).not.toContain("[object Object]");
  });

  it("treats leadName as a display-search business anchor", () => {
    const ctx = createSurfaceCtx();
    const anchor = buildBusinessAnchor({
      cardId: "leadFollowUp",
      payload: {
        fieldValues: {
          leadName: "DING",
          phone: "13812341234"
        }
      }
    }, ctx);

    expect(anchor.label).toContain("DING");
    expect(anchor.label).toContain("138****1234");
    expect(anchor.searchText).toContain("13812341234");
    expect(anchor.searchText).toContain("DING");
  });
});
