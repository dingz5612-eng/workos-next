import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("SURFACE-C PC Governance Plane contract", () => {
  it("keeps governance surfaces in the PC plane and outside ordinary mobile APIs", () => {
    const pcContract = source("../../../../docs/surface/pc-governance-plane-contract.yml");
    const mobileApi = source("../../../../apps/mobile/src/apiClient.js");
    const pcApi = source("../../../../apps/mobile/src/pcApiClient.js");

    expect(pcContract).toContain('"plane": "pc"');
    expect(pcContract).toContain("pcGovernance");
    expect(pcContract).toContain('"directBusinessFactWriteAllowed": false');
    expect(mobileApi).not.toContain("recordGovernanceAuditEvent");
    expect(pcApi).toContain("recordGovernanceAuditEvent");
  });
});

function source(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
