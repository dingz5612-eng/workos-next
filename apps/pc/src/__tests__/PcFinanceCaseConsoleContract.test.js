import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("SURFACE-C PC Finance Case Console contract", () => {
  it("keeps finance actions audited and routed through PC operations confirm", () => {
    const contract = source("../../../../docs/surface/pc-governance-plane-contract.yml");
    const pcApi = source("../../../../apps/mobile/src/pcApiClient.js");

    expect(contract).toContain('"financeActionRequiredFields": ["reason", "owner", "audit", "trace"]');
    expect(pcApi).toContain("confirmBankStatementImport");
    expect(pcApi).toContain("postPcOperationsConfirm");
    expect(pcApi).toContain('"X-WorkOS-Operation-Confirm": "true"');
    expect(pcApi).not.toContain("/api/payment/confirm");
  });
});

function source(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
