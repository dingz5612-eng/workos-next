import { describe, expect, it } from "vitest";
import { queueTasks } from "../selectors/queueSelectors.js";
import { runtimeStore } from "./surfaceContractTestHelpers.js";

describe("Stage B ordinary queue scope contract", () => {
  it("filters engineering diagnostic and runtime audit WorkItems from ordinary mobile queue", () => {
    const store = runtimeStore();
    store.workQueue = [
      ...store.workQueue,
      { workItemId: "runtimeAudit-001", workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup", domain: "diagnostic", badges: ["mine"] },
      { workItemId: "rf-guard-001", workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup", domain: "engineering", badges: ["mine"] },
      { workItemId: "retired-projection-001", workspaceId: "W-STAY-RESOURCE", cardId: "roomSetup", source: "retired_projection_shadow", badges: ["mine"] }
    ];

    const tasks = queueTasks({ runtimeStore: store, queueDomain: "all", queueBadge: "mine", sort: "smartSort" });

    expect(tasks.map((item) => item.workItemId)).toContain("W-STAY-RESOURCE:roomSetup");
    expect(tasks.map((item) => item.workItemId).join(" ")).not.toMatch(/runtimeAudit|rf-guard|retired-projection-001/);
  });
});
