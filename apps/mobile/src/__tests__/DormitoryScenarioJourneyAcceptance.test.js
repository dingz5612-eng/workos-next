import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

describe("OAM dormitory scenario journey acceptance", () => {
  it("keeps dormitory capabilities bound to current OAM modules", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const contract = JSON.parse(readFileSync(resolve(root, "docs/contracts/oam.current.json"), "utf8"));
    const accommodation = JSON.parse(readFileSync(resolve(root, "modules/accommodation/oam-module.manifest.json"), "utf8"));
    const maintenance = JSON.parse(readFileSync(resolve(root, "modules/maintenance/oam-module.manifest.json"), "utf8"));

    const capabilityIds = contract.productCapabilities.map((item) => item.id);
    expect(capabilityIds).toContain("accommodation.lead-reservation");
    expect(capabilityIds).toContain("accommodation.checkin");
    expect(capabilityIds).toContain("accommodation.checkout");
    expect(capabilityIds).toContain("accommodation.service-task");
    expect(accommodation.domainInvariant).toContain("线索预订不能创建正式 stayId");
    expect(maintenance.domainInvariant).toContain("任务对象只能在创建任务时确定");
  });
});
