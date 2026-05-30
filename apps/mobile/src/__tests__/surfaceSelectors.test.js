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
  it("keeps Accommodation runtime slices visible on Home and Learning", () => {
    const state = runtimeState([firstWorkspace, secondWorkspace]);

    expect(selectHomeSurface(state).map((item) => item.workspaceId)).toEqual(expect.arrayContaining([
      firstProduction.workspaceId,
      secondProduction.workspaceId
    ]));
    expect(selectLearningCatalog(state).map((item) => item.id)).toEqual(expect.arrayContaining([
      firstProduction.workspaceId,
      secondProduction.workspaceId
    ]));
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
    const state = runtimeState(manifestWorkspaces);

    const homeIds = selectHomeSurface(state).map((item) => item.workspaceId);
    const queueIds = selectWorkbenchQueue(state).map((item) => item.workspaceId);
    const learningIds = selectLearningCatalog(state).map((item) => item.id);

    for (const slice of manifest.slices) {
      expect(homeIds).toContain(slice.workspaceId);
      expect(queueIds).toContain(slice.workspaceId);
      expect(selectSearchSurfaceResults(state, slice.workspaceId).map((item) => item.id)).toContain(slice.workspaceId);
      expect(learningIds).toContain(slice.workspaceId);
      expect(selectWorkspaceById(state, slice.workspaceId)?.cards.map((card) => card.id)).toContain(slice.cards[0]);
    }
  });

  it("uses runtime queue items with workspaceId/cardId for Workbench", () => {
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

    const queue = selectWorkbenchQueue(state);
    expect(queue).toHaveLength(1);
    expect(queue[0].workspace.id).toBe(secondProduction.workspaceId);
    expect(queue[0].card.id).toBe(secondProduction.cards[0]);
    expect(queue[0].source).not.toBe("offline-demo-fallback");
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
    expect(online.every((item) => item.source !== "offline-demo-fallback")).toBe(true);

    const offline = { apiStatus: "checking", runtimeStore: createRuntimeStore() };
    applyRuntimeOfflineFallback(offline);
    expect(selectWorkbenchQueue(offline)).toEqual([]);
    expect(selectHomeSurface(offline)).toEqual([]);
    expect(JSON.stringify(offline)).not.toMatch(/张三|A301|A301-02|3000|PAY-2026-009|unknown-room|unknown-bed/u);
  });

  it("keeps real cached runtime queue data during API failure", () => {
    const offline = runtimeState([firstWorkspace], {
      workQueue: [{
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

  it("opens workspace from queue with card preselection", () => {
    const state = runtimeState([secondWorkspace]);
    const ctx = { state: { ...state, currentActor: { role: "operator" } }, render: () => {} };

    openWorkspace(secondProduction.workspaceId, ctx, secondProduction.cards[0]);

    expect(ctx.state.selectedWorkspace).toBe(secondProduction.workspaceId);
    expect(ctx.state.selectedCardId).toBe(secondProduction.cards[0]);
    expect(ctx.state.view).toBe("workspace");
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
