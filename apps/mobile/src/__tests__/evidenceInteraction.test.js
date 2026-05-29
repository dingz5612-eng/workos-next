import { describe, expect, it, vi } from "vitest";
import { collectEvidenceIds, toggleEvidenceSelection } from "../operationController.js";

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

