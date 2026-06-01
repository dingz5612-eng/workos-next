import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("SURFACE-C PC Release Flight Deck contract", () => {
  it("does not allow manual GateResult passed updates", () => {
    const contract = source("../../../../docs/surface/pc-governance-plane-contract.yml");
    const gateMigration = source("../../../../infra/db/migrations/029_v5_5_gate_result_hardening.sql");

    expect(contract).toContain('"manualGateResultPassedUpdateAllowed": false');
    expect(gateMigration).toContain("prevent_gate_results_immutable_update");
    expect(gateMigration).toContain("before update or delete on control_plane.gate_results");
  });
});

function source(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
