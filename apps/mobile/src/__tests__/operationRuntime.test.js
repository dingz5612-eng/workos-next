import { describe, expect, it, vi } from "vitest";
import { aggregateRefFor, cardInstanceIdFor, operationIdempotencyKey, operationSubmissionId } from "../operationRuntime.js";

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
});

