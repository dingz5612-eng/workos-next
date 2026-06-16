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
});
