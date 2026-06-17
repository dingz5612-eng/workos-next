import { describe, expect, it } from "vitest";
import { queueTasks } from "../selectors/queueSelectors.js";
import { runtimeStore } from "./surfaceContractTestHelpers.js";

describe("Stage B ordinary queue scope contract", () => {
  it("filters engineering diagnostic and runtime audit WorkItems from ordinary mobile queue", () => {
    const store = runtimeStore();
    store.workQueue = [
      ...store.workQueue,
      { workItemId: "runtimeAudit-001", workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm", domain: "diagnostic", badges: ["mine"] },
      { workItemId: "rf-guard-001", workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm", domain: "engineering", badges: ["mine"] },
      { workItemId: "projection-guard-001", workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm", source: "projection_guard_shadow", badges: ["mine"] }
    ];

    const tasks = queueTasks({ runtimeStore: store, queueDomain: "all", queueBadge: "mine", sort: "smartSort" });

    expect(tasks.map((item) => item.workItemId)).toContain("wi-dorm-room-setup");
    expect(tasks.map((item) => item.workItemId).join(" ")).not.toMatch(/runtimeAudit|rf-guard|projection-guard-001/);
  });

  it("filters legacy Dormitory FirstGoldenChain WorkItems from the ordinary mobile queue", () => {
    const store = runtimeStore();
    store.workQueue = [
      ...store.workQueue,
      {
        workItemId: "wi-legacy-dorm-readiness",
        workspaceId: "Dormitory.FirstGoldenChain-20260615144153-legacy",
        cardId: "Dorm.ResourceReadinessConfirm",
        workItemType: "Dorm.ResourceReadinessConfirm",
        lifecycleState: "ready",
        ownerRole: "operator",
        badges: ["mine"]
      },
      {
        workItemId: "wi-mainline-readiness",
        workspaceId: "W-DORM-MAINLINE-20260616104450-mainline",
        cardId: "cert.resourceReadinessConfirm",
        workItemType: "Dorm.ResourceReadinessConfirm",
        lifecycleState: "ready",
        ownerRole: "operator",
        badges: ["mine"]
      }
    ];

    const ids = queueTasks({ runtimeStore: store, queueDomain: "all", queueBadge: "mine", sort: "smartSort" }).map((item) => item.workItemId);

    expect(ids).toContain("wi-dorm-room-setup");
    expect(ids).toContain("wi-mainline-readiness");
    expect(ids).not.toContain("wi-legacy-dorm-readiness");
  });
});
