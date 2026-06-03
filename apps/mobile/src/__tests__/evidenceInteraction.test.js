import { describe, expect, it, vi } from "vitest";
import { collectEvidenceIds, systemEvidenceDraftsFor, toggleEvidenceSelection } from "../operationController.js";

describe("evidence interaction", () => {
  it("toggles evidence selection and submits evidence ids", () => {
    const storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    });
    vi.stubGlobal("crypto", { randomUUID: () => "evidence-uuid" });

    const button = evidenceButton("deposit-proof");
    vi.stubGlobal("document", {
      querySelectorAll: (selector) => {
        if (selector === "[data-evidence-id].selected" && button.classList.contains("selected")) return [button];
        return [];
      },
      querySelector: () => null
    });

    toggleEvidenceSelection({ target: button }, {
      state: { selectedCardIndex: -1, selectedCardId: "" },
      workspace: () => ({
        id: "W-STAY-DEPOSIT-LEDGER",
        cards: [{ id: "depositReceipt", status: "ready" }]
      })
    });

    expect(button.classList.contains("selected")).toBe(true);
    expect(collectEvidenceIds()).toEqual(["evidence-deposit-proof-evidence-uuid"]);

    vi.unstubAllGlobals();
  });

  it("materializes required evidence drafts as a system action before submit", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "system-evidence-uuid" });
    const drafts = systemEvidenceDraftsFor({
      evidence: [
        { id: "room-duplicate-check" },
        { id: "config-operator-record" }
      ]
    }, []);

    expect(drafts).toEqual([
      {
        requirementId: "room-duplicate-check",
        evidenceId: "evidence-room-duplicate-check-system-evidence-uuid",
        source: "system",
        status: undefined
      },
      {
        requirementId: "config-operator-record",
        evidenceId: "evidence-config-operator-record-system-evidence-uuid",
        source: "system",
        status: undefined
      }
    ]);

    vi.unstubAllGlobals();
  });

  it("upgrades selected evidence drafts to system evidence before submit", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "system-evidence-uuid" });
    const drafts = systemEvidenceDraftsFor({
      evidence: [
        { id: "checkin-handover-record" },
        { id: "identity-check-record" }
      ]
    }, [
      {
        requirementId: "checkin-handover-record",
        evidenceId: "evidence-checkin-handover-record-manual-draft"
      }
    ]);

    expect(drafts).toEqual([
      {
        requirementId: "checkin-handover-record",
        evidenceId: "evidence-checkin-handover-record-system-evidence-uuid",
        source: "system",
        status: undefined
      },
      {
        requirementId: "identity-check-record",
        evidenceId: "evidence-identity-check-record-system-evidence-uuid",
        source: "system",
        status: undefined
      }
    ]);

    vi.unstubAllGlobals();
  });
});

function evidenceButton(evidenceId) {
  const classes = new Set();
  return {
    dataset: { evidenceId },
    matches: (selector) => selector === "[data-evidence-id]",
    classList: {
      toggle: (name) => classes.has(name) ? classes.delete(name) : classes.add(name),
      contains: (name) => classes.has(name)
    }
  };
}
