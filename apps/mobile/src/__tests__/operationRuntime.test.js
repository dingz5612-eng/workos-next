import { describe, expect, it, vi } from "vitest";
import { loadDraft, saveDraft } from "../operationDrafts.js";
import { aggregateRefFor, cardInstanceIdFor, createSubmissionProtocol, operationIdempotencyKey, operationSubmissionId } from "../operationRuntime.js";

describe("operationRuntime submit protocol", () => {
  it("uses submit-level UUIDs for idempotency and submission", () => {
    const randomUUID = vi.fn()
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    vi.stubGlobal("crypto", { randomUUID });

    expect(operationIdempotencyKey()).toBe("11111111-1111-4111-8111-111111111111");
    expect(operationSubmissionId()).toBe("22222222-2222-4222-8222-222222222222");

    vi.unstubAllGlobals();
  });

  it("derives card instance and aggregate scope without actor identity", () => {
    expect(cardInstanceIdFor({ id: "W-STAY-RESOURCE" }, { id: "roomSetup", status: "ready" }))
      .toBe("W-STAY-RESOURCE:roomSetup:ready");
    expect(aggregateRefFor({ roomId: "R-1", actorId: "not-trusted" })).toBe("roomId:R-1");
  });

  it("persists submit protocol identifiers in the operation draft", () => {
    const storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    });
    const randomUUID = vi.fn()
      .mockReturnValueOnce("33333333-3333-4333-8333-333333333333")
      .mockReturnValueOnce("44444444-4444-4444-8444-444444444444");
    vi.stubGlobal("crypto", { randomUUID });

    const protocol = createSubmissionProtocol({ id: "W-STAY-DEPOSIT-LEDGER" }, { id: "depositReceipt", status: "ready" });
    saveDraft("W-STAY-DEPOSIT-LEDGER", "depositReceipt", { depositId: "D-1" }, [], protocol);
    saveDraft("W-STAY-DEPOSIT-LEDGER", "depositReceipt", { depositId: "D-1", receivedAmount: "100" }, []);

    expect(loadDraft("W-STAY-DEPOSIT-LEDGER", "depositReceipt").submissionProtocol).toEqual({
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      submissionId: "44444444-4444-4444-8444-444444444444",
      cardInstanceId: "W-STAY-DEPOSIT-LEDGER:depositReceipt:ready"
    });

    vi.unstubAllGlobals();
  });
});
