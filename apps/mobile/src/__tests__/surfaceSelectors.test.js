import { describe, expect, it } from "vitest";
import { openWorkspace } from "../navigationController.js";
import {
  selectHomeSurface,
  selectLearningCatalog,
  selectSearchSurfaceResults,
  selectWorkbenchQueue
} from "../selectors/surfaceSelectors.js";

const depositWorkspace = workspace("W-STAY-DEPOSIT-LEDGER", "stay", "depositReceipt", "ready", "押金账本");
const checkinWorkspace = workspace("W-STAY-CHECKIN", "stay", "lead", "ready", "入住押金");
const paymentWorkspace = workspace("W-STAY-PAYMENT-LEDGER", "stay", "paymentReceipt", "ready", "收款账本");

describe("runtime surface selectors", () => {
  it("keeps Accommodation runtime slices visible on Home and Learning", () => {
    const state = runtimeState([depositWorkspace, paymentWorkspace]);

    expect(selectHomeSurface(state).map((item) => item.workspaceId)).toContain("W-STAY-DEPOSIT-LEDGER");
    expect(selectLearningCatalog(state).map((item) => item.id)).toEqual(expect.arrayContaining([
      "W-STAY-DEPOSIT-LEDGER",
      "W-STAY-PAYMENT-LEDGER"
    ]));
  });

  it("uses runtime queue items with workspaceId/cardId for Workbench", () => {
    const state = runtimeState([paymentWorkspace], {
      workQueue: [{
        queueItemId: "q-W-STAY-PAYMENT-LEDGER-paymentReceipt",
        workspaceId: "W-STAY-PAYMENT-LEDGER",
        cardId: "paymentReceipt",
        domain: "stay",
        badges: ["mine", "ready"],
        priority: 90,
        reason: paymentWorkspace.next
      }]
    });

    const queue = selectWorkbenchQueue(state);
    expect(queue).toHaveLength(1);
    expect(queue[0].workspace.id).toBe("W-STAY-PAYMENT-LEDGER");
    expect(queue[0].card.id).toBe("paymentReceipt");
    expect(queue[0].source).not.toBe("offline-demo-fallback");
  });

  it("prefers the current DepositLedger surface for deposit search intent", () => {
    const results = selectSearchSurfaceResults(runtimeState([checkinWorkspace, depositWorkspace]), "押金");
    expect(results[0].id).toBe("W-STAY-DEPOSIT-LEDGER");
    expect(results.findIndex((item) => item.id === "W-STAY-DEPOSIT-LEDGER"))
      .toBeLessThan(results.findIndex((item) => item.id === "W-STAY-CHECKIN"));
  });

  it("allows demo queue only as explicit offline fallback", () => {
    const online = selectWorkbenchQueue(runtimeState([depositWorkspace]));
    expect(online.every((item) => item.source !== "offline-demo-fallback")).toBe(true);

    const offline = runtimeState([depositWorkspace]);
    offline.apiStatus = "offline";
    offline.runtimeStore.apiStatus = "offline";
    expect(selectWorkbenchQueue(offline).some((item) => item.source === "offline-demo-fallback")).toBe(true);
  });

  it("opens workspace from queue with card preselection", () => {
    const state = runtimeState([paymentWorkspace]);
    const ctx = { state: { ...state, currentActor: { role: "operator" } }, render: () => {} };

    openWorkspace("W-STAY-PAYMENT-LEDGER", ctx, "paymentReceipt");

    expect(ctx.state.selectedWorkspace).toBe("W-STAY-PAYMENT-LEDGER");
    expect(ctx.state.selectedCardId).toBe("paymentReceipt");
    expect(ctx.state.view).toBe("workspace");
  });
});

function runtimeState(workspaces, overrides = {}) {
  return {
    apiStatus: "online",
    runtimeStore: {
      workspaces,
      workQueue: [],
      homeSurface: [],
      learningCatalog: [],
      searchResultsByQuery: {},
      ...overrides
    },
    queueDomain: "all",
    queueBadge: "mine",
    sort: "smartSort"
  };
}

function workspace(id, domain, cardId, status, zhTitle) {
  return {
    id,
    domain,
    taskId: `task-${id}`,
    title: { "zh-CN": zhTitle, "ru-RU": zhTitle },
    summary: { "zh-CN": `${zhTitle}摘要`, "ru-RU": `${zhTitle}摘要` },
    next: { "zh-CN": `${zhTitle}下一步`, "ru-RU": `${zhTitle}下一步` },
    blockers: [],
    cards: [{
      id: cardId,
      status,
      title: { "zh-CN": zhTitle, "ru-RU": zhTitle },
      fields: { business: [], system: [], analytics: [] },
      evidence: [],
      checks: [],
      blockerRules: [],
      confirmation: { required: false }
    }]
  };
}

