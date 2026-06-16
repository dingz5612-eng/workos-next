import { describe, expect, it } from "vitest";
import {
  activeCardForWorkspace,
  activeWorkspaceCard,
  isCardActionDisabled,
  isTerminalCardStatus,
  localList,
  localTerm,
  metric,
  task,
  terminalCardStatuses,
  tr,
  tx,
  txFor,
  workspace
} from "../selectors/workspaceSelectors.js";

describe("workspace selectors", () => {
  it("localizes strings, objects, event labels, and lists with safe fallbacks", () => {
    const state = { lang: "zh-CN" };

    expect(tr(state, "search")).toBe("搜索");
    expect(tr(state, "missing.key")).toBe("missing.key");
    expect(tx(state, null)).toBe("");
    expect(tx(state, { "zh-CN": "押金", "ru-RU": "Депозит" })).toBe("押金");
    expect(txFor({ "ru-RU": "Депозит", "zh-CN": "押金" }, "ru-RU")).toBe("Депозит");
    expect(localTerm(state, { eventType: "Accommodation.DepositConfirmed" })).toBe("Accommodation.DepositConfirmed");
    expect(localTerm(state, { label: { "zh-CN": "床位" } })).toBe("床位");
    expect(localList(state, [{ label: { "zh-CN": "证据" } }, "押金"])).toBe("证据 · 押金");
  });

  it("selects current tasks and workspaces with selected-id fallback", () => {
    const state = {
      selectedTask: "q-selected",
      selectedWorkspace: "W-SELECTED",
      currentActor: { role: "manager" },
      runtimeStore: {
        workspaces: [
          runtimeWorkspace("W-FIRST", "firstCard", "notStarted"),
          runtimeWorkspace("W-SELECTED", "selectedCard", "ready")
        ],
        workQueue: [
          runtimeTask("q-first", "W-FIRST", "firstCard"),
          runtimeTask("q-selected", "W-SELECTED", "selectedCard")
        ]
      }
    };

    expect(task(state).queueItemId).toBe("q-selected");
    expect(workspace(state).id).toBe("W-SELECTED");
    expect(task({ ...state, selectedTask: "missing" }).queueItemId).toBe("q-first");
    expect(workspace({ ...state, selectedWorkspace: "missing" }).id).toBe("W-FIRST");
  });

  it("resolves active cards, terminal states, disabled actions, and metric markup", () => {
    const item = runtimeWorkspace("W-STAY", "firstCard", "notStarted");
    item.cards.push({ ...item.cards[0], id: "readyCard", status: "ready" });
    item.cards.push({ ...item.cards[0], id: "doneCard", status: "done" });

    expect(terminalCardStatuses.has("done")).toBe(true);
    expect(isTerminalCardStatus("confirmed")).toBe(true);
    expect(isTerminalCardStatus("ready")).toBe(false);
    expect(activeWorkspaceCard(item, -1).id).toBe("readyCard");
    expect(activeWorkspaceCard(item, 0, "doneCard").id).toBe("doneCard");
    expect(activeWorkspaceCard(item, 99).id).toBe("firstCard");
    expect(activeCardForWorkspace(item).id).toBe("readyCard");
    expect(isCardActionDisabled({ status: "notStarted" })).toBe(true);
    expect(isCardActionDisabled({ status: "done" })).toBe(true);
    expect(isCardActionDisabled({ status: "ready" })).toBe(false);
    expect(metric(3, "search", { tr: (key) => key })).toContain("<strong>3</strong>");
  });

  it("treats available runtime cards as actionable ready cards", () => {
    const item = runtimeWorkspace("W-STAY", "firstCard", "notStarted");
    item.cards.push({ ...item.cards[0], id: "availableCard", status: "available" });

    expect(activeWorkspaceCard(item, -1).id).toBe("availableCard");
    expect(activeCardForWorkspace(item).id).toBe("availableCard");
    expect(isCardActionDisabled({ status: "available" })).toBe(false);
  });
});

function runtimeWorkspace(id, cardId, status) {
  return {
    id,
    domain: "stay",
    title: { "zh-CN": id },
    summary: { "zh-CN": `${id} 摘要` },
    next: { "zh-CN": `${id} 下一步` },
    cards: [{
      id: cardId,
      status,
      title: { "zh-CN": cardId },
      fields: { business: [], system: [], analytics: [] },
      evidence: [],
      checks: [],
      confirmation: { required: false }
    }]
  };
}

function runtimeTask(queueItemId, workspaceId, cardId) {
  return {
    queueItemId,
    workItemId: `wi-${queueItemId}`,
    workspaceId,
    cardId,
    lifecycleState: "ready",
    ownerRole: "manager",
    badges: ["mine"]
  };
}
