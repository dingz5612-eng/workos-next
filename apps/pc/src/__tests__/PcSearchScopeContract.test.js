import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("SURFACE-C PC Search Scope contract", () => {
  it("keeps PC raw records out of ordinary mobile search scope", () => {
    const searchContract = source("../../../../docs/surface/mobile-search-contract.yml");
    const searchView = source("../../../../apps/mobile/src/views/searchView.js");

    expect(searchContract).toContain('"pcRawRecordsVisible": false');
    expect(searchContract).toContain('"adminRecordsVisibleToOrdinaryMobile": false');
    expect(searchView).not.toContain("pcGovernance");
    expect(searchView).not.toContain("releaseControl");
  });
});

function source(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
