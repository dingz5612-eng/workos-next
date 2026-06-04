import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { openWorkspace } from "../navigationController.js";
import { applyRuntimeOfflineFallback, createRuntimeStore } from "../runtime/runtimeStore.js";
import {
  selectHomeSurface,
  selectLearningCatalog,
  selectSearchSurfaceResults,
  selectWorkspaceById,
  selectWorkbenchQueue
} from "../selectors/surfaceSelectors.js";
import { workspace as currentWorkspace } from "../selectors/workspaceSelectors.js";

const manifest = JSON.parse(fs.readFileSync(new URL("../../../../docs/contracts/slice-manifest.json", import.meta.url), "utf8"));
const surfacePolicy = JSON.parse(fs.readFileSync(new URL("../../../../docs/contracts/runtime-surface-policy.json", import.meta.url), "utf8"));
const productionSlices = manifest.slices.filter((slice) => slice.status === "production-slice");
const firstProduction = productionSlices[0];
const secondProduction = productionSlices[1];
const firstWorkspace = workspace(firstProduction.workspaceId, domainFor(firstProduction.workspaceId), firstProduction.cards[0], "ready", firstProduction.id);
const secondWorkspace = workspace(secondProduction.workspaceId, domainFor(secondProduction.workspaceId), secondProduction.cards[0], "ready", secondProduction.id);

describe("runtime surface selectors", () => {
  it("keeps role-scoped runtime slices visible on Home while Learning remains searchable", () => {
    const state = runtimeState([firstWorkspace, secondWorkspace]);

    expect(selectHomeSurface({ ...state, currentActor: { role: "operator" } }).every((item) => item.workspace.domain === "stay")).toBe(true);
    expect(selectLearningCatalog(state).map((item) => item.id)).toEqual(expect.arrayContaining([
      firstProduction.workspaceId,
      secondProduction.workspaceId
    ]));
  });

  it("does not put Finance or Repair scenario focus on an accommodation operator home", () => {
    const stay = workspace("W-STAY-RESOURCE", "stay", "roomSetup", "ready", "住宿资源");
    const finance = workspace("W-FINANCE-DEPOSIT", "finance", "depositReview", "ready", "押金异常");
    const repair = workspace("W-REPAIR-TICKET", "repair", "arrival", "ready", "报修处理");
    const state = runtimeState([stay, finance, repair], {
      homeSurface: [
        { workspaceId: stay.id, cardId: "roomSetup", domainGroup: "Accommodation", priority: 90 },
        { workspaceId: finance.id, cardId: "depositReview", domainGroup: "Finance", priority: 80 },
        { workspaceId: repair.id, cardId: "arrival", domainGroup: "Repair", priority: 70 }
      ]
    });

    const home = selectHomeSurface({ ...state, currentActor: { role: "operator" } });

    expect(home.map((item) => item.workspaceId)).toEqual(["W-STAY-RESOURCE"]);
    expect(home.map((item) => item.domainGroup)).not.toContain("Finance");
    expect(home.map((item) => item.domainGroup)).not.toContain("Repair");
  });

  it("keeps stay-domain finance scenarios off the accommodation operator home", () => {
    const resource = workspace("W-STAY-RESOURCE", "stay", "roomSetup", "ready", "住宿资源");
    const ledger = workspace("W-STAY-DEPOSIT-LEDGER", "stay", "depositClose", "ready", "我要管理押金账本");
    const state = runtimeState([resource, ledger], {
      homeSurface: [
        { workspaceId: ledger.id, cardId: "depositClose", domainGroup: "Accommodation", priority: 90 },
        { workspaceId: resource.id, cardId: "roomSetup", domainGroup: "Accommodation", priority: 80 }
      ]
    });

    const operatorHome = selectHomeSurface({ ...state, currentActor: { role: "operator" } });
    const financeHome = selectHomeSurface({ ...state, currentActor: { role: "finance" } });

    expect(operatorHome.map((item) => item.workspaceId)).toEqual(["W-STAY-RESOURCE"]);
    expect(financeHome.map((item) => item.workspaceId)).toContain("W-STAY-DEPOSIT-LEDGER");
  });

  it("filters finance-like titles carried by homeSurface payloads for operators", () => {
    const resource = workspace("W-STAY-RESOURCE", "stay", "roomSetup", "ready", "住宿资源");
    const state = runtimeState([resource], {
      homeSurface: [
        {
          workspaceId: resource.id,
          cardId: "roomSetup",
          domainGroup: "Accommodation",
          priority: 90,
          title: { "zh-CN": "我要管理押金账本" },
          next: { "zh-CN": "押金永远是负债账本，不进入普通收入。" }
        }
      ]
    });

    expect(selectHomeSurface({ ...state, currentActor: { role: "operator" } })).toEqual([]);
    expect(selectHomeSurface({ ...state, currentActor: { role: "finance" } }).map((item) => item.workspaceId)).toEqual(["W-STAY-RESOURCE"]);
  });

  it("does not use completed workspaces as today scenario focus", () => {
    const done = workspace("W-STAY-DONE-RESOURCE", "stay", "roomSetup", "done", "已完成住宿资源");
    const ready = workspace("W-STAY-READY-RESOURCE", "stay", "bedSetup", "ready", "可办理住宿资源");
    const state = runtimeState([done, ready], {
      homeSurface: [
        { workspaceId: done.id, cardId: "roomSetup", domainGroup: "Accommodation", priority: 90 },
        { workspaceId: ready.id, cardId: "bedSetup", domainGroup: "Accommodation", priority: 80 }
      ]
    });

    const home = selectHomeSurface({ ...state, currentActor: { role: "operator" } });

    expect(home.map((item) => item.workspaceId)).toEqual(["W-STAY-READY-RESOURCE"]);
  });

  it("uses backend learningCatalog before projection fallback", () => {
    const state = runtimeState([firstWorkspace, secondWorkspace], {
      learningCatalog: [{
        workspaceId: firstProduction.workspaceId,
        cardId: firstProduction.cards[0],
        title: firstWorkspace.cards[0].title,
        fields: [{ id: "runtimeField", label: { "zh-CN": "运行时字段", "ru-RU": "Поле runtime" } }],
        evidence: [],
        checks: [],
        blockers: []
      }],
      learningSource: "runtime-api"
    });

    const catalog = selectLearningCatalog(state);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].id).toBe(firstProduction.workspaceId);
    expect(catalog[0]._learningSource).toBe("runtime-api");
    expect(catalog[0].cards.map((card) => card.id)).toEqual([firstProduction.cards[0]]);
  });

  it("covers manifest workspaces across Home Workbench Search Learning and Workspace selectors", () => {
    const manifestWorkspaces = manifest.slices.map((slice) =>
      workspace(slice.workspaceId, domainFor(slice.workspaceId), slice.cards[0], "ready", slice.id));
    const state = runtimeState(manifestWorkspaces, {
      workQueue: manifest.slices.map((slice) => ({
        workItemId: `WI-${slice.workspaceId}-${slice.cards[0]}`,
        workspaceId: slice.workspaceId,
        cardId: slice.cards[0],
        domain: domainFor(slice.workspaceId),
        lifecycleState: "ready",
        ownerRole: "operator",
        badges: ["mine", "ready"]
      }))
    });

    const homeIds = selectHomeSurface({ ...state, currentActor: { role: "manager" } }).map((item) => item.workspaceId);
    const queueIds = selectWorkbenchQueue({ ...state, currentActor: { role: "manager" } }).map((item) => item.workspaceId);
    const learningIds = selectLearningCatalog(state).map((item) => item.id);

    for (const slice of manifest.slices) {
      expect(homeIds).toContain(slice.workspaceId);
      expect(queueIds).toContain(slice.workspaceId);
      expect(selectSearchSurfaceResults(state, slice.workspaceId).map((item) => item.id)).toContain(slice.workspaceId);
      expect(learningIds).toContain(slice.workspaceId);
      expect(selectWorkspaceById(state, slice.workspaceId)?.cards.map((card) => card.id)).toContain(slice.cards[0]);
    }
  });

  it("uses persisted runtime queue items with workspaceId/cardId for Workbench", () => {
    const state = runtimeState([secondWorkspace], {
      workQueue: [{
        workItemId: `WI-${secondProduction.workspaceId}-${secondProduction.cards[0]}`,
        queueItemId: `q-${secondProduction.workspaceId}-${secondProduction.cards[0]}`,
        workspaceId: secondProduction.workspaceId,
        cardId: secondProduction.cards[0],
        domain: secondWorkspace.domain,
        badges: ["mine", "ready"],
        priority: 90,
        reason: secondWorkspace.next
      }]
    });

    const queue = selectWorkbenchQueue({ ...state, currentActor: { role: "manager" } });
    expect(queue).toHaveLength(1);
    expect(queue[0].workspace.id).toBe(secondProduction.workspaceId);
    expect(queue[0].card.id).toBe(secondProduction.cards[0]);
    expect(queue[0].source).not.toBe("offline-demo-fallback");
  });

  it("does not promote workspace/card lens rows into active Workbench tasks without a persisted WorkItem", () => {
    const state = runtimeState([secondWorkspace], {
      workQueue: [{
        queueItemId: `q-${secondProduction.workspaceId}-${secondProduction.cards[0]}`,
        workspaceId: secondProduction.workspaceId,
        cardId: secondProduction.cards[0],
        domain: secondWorkspace.domain,
        badges: ["mine", "ready"],
        priority: 90,
        reason: secondWorkspace.next
      }]
    });

    expect(selectWorkbenchQueue({ ...state, currentActor: { role: "manager" } })).toEqual([]);
  });

  it("preserves backend runtime lens search results instead of local business boosts", () => {
    const query = "runtime";
    const state = runtimeState([firstWorkspace, secondWorkspace], {
      searchResultsByQuery: {
        [query]: [
          { workspaceId: firstProduction.workspaceId, cardId: firstProduction.cards[0], score: 10 },
          { workspaceId: secondProduction.workspaceId, cardId: secondProduction.cards[0], score: 90 }
        ]
      }
    });
    const results = selectSearchSurfaceResults(state, query);
    expect(results.map((item) => item.id)).toEqual([firstProduction.workspaceId, secondProduction.workspaceId]);
    expect(results.map((item) => item.score)).toEqual([10, 90]);
  });

  it("returns a true empty state instead of demo business objects when offline without cache", () => {
    const online = selectWorkbenchQueue(runtimeState([firstWorkspace]));
    expect(online).toEqual([]);

    const offline = { apiStatus: "checking", runtimeStore: createRuntimeStore() };
    applyRuntimeOfflineFallback(offline);
    expect(selectWorkbenchQueue(offline)).toEqual([]);
    expect(selectHomeSurface(offline)).toEqual([]);
    expect(JSON.stringify(offline)).not.toMatch(/张三|A301|A301-02|3000|PAY-2026-009|unknown-room|unknown-bed/u);
  });

  it("keeps real cached runtime queue data during API failure", () => {
    const offline = runtimeState([firstWorkspace], {
      workQueue: [{
        workItemId: `WI-${firstProduction.workspaceId}-${firstProduction.cards[0]}`,
        queueItemId: `q-${firstProduction.workspaceId}-${firstProduction.cards[0]}`,
        workspaceId: firstProduction.workspaceId,
        cardId: firstProduction.cards[0],
        domain: firstWorkspace.domain,
        badges: ["mine"],
        priority: 70,
        source: "runtime-api"
      }]
    });
    applyRuntimeOfflineFallback(offline);

    const queue = selectWorkbenchQueue(offline);
    expect(queue).toHaveLength(1);
    expect(queue[0].workspace.id).toBe(firstProduction.workspaceId);
    expect(queue[0].source).toBe("runtime-api");
  });

  it("blocks workspace/card direct processing when no persisted WorkItem exists", () => {
    const state = runtimeState([secondWorkspace]);
    const ctx = { state: { ...state, currentActor: { role: "operator" } }, render: () => {} };

    openWorkspace(secondProduction.workspaceId, ctx, secondProduction.cards[0]);

    expect(ctx.state.selectedWorkspace).toBe(secondProduction.workspaceId);
    expect(ctx.state.selectedCardId).toBe(secondProduction.cards[0]);
    expect(ctx.state.view).toBe("operationPanel");
    expect(ctx.state.operationRouteIssue.reason).toBe("missing_persisted_work_item");
  });

  it("resolves workspace view from runtimeStore without a business-id fallback", () => {
    const state = runtimeState([secondWorkspace]);
    state.selectedWorkspace = "missing-workspace";

    expect(selectWorkspaceById(state, "missing-workspace")).toBeUndefined();
    expect(currentWorkspace(state).id).toBe(secondProduction.workspaceId);
  });

  it("keeps every production slice backed by a surface policy", () => {
    const policies = new Map(surfacePolicy.policies.map((policy) => [policy.sliceId, policy]));
    for (const slice of productionSlices) {
      const policy = policies.get(slice.id);
      expect(policy?.workspaceId).toBe(slice.workspaceId);
      expect(policy?.cards.map((card) => card.cardId).sort()).toEqual([...slice.cards].sort());
      expect(policy?.home.visible || policy?.hiddenReason).toBeTruthy();
      expect(policy?.workbench.visible || policy?.hiddenReason).toBeTruthy();
      expect(policy?.search.visible || policy?.hiddenReason).toBeTruthy();
      expect(policy?.learning.visible || policy?.hiddenReason).toBeTruthy();
    }
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

function domainFor(workspaceId) {
  if (workspaceId.includes("STAY")) return "stay";
  if (workspaceId.includes("REPAIR")) return "repair";
  if (workspaceId.includes("FINANCE")) return "finance";
  return "ops";
}
