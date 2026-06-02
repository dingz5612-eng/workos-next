import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

describe("OAM-04C dormitory scenario journey acceptance", () => {
  it("keeps journey artifacts bounded to L1 observation", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const result = JSON.parse(readFileSync(resolve(root, "artifacts/surface/dormitory-scenario-journey-result.json"), "utf8"));

    expect(result.status).toBe("passed");
    expect(result.scenarioCount).toBe(10);
    expect(result.day2Started).toBe(false);
    expect(result.productionAllowed).toBe(false);
    expect(result.dormitoryL2ProductionAllowed).toBe(false);
  });
});
