import { describe, expect, it } from "vitest";
import { withSystemGeneratedOperationValues } from "../operationSystemValues.js";
import { contextContractSummary, fieldContextRole } from "../systemContextContract.js";

describe("System context contract", () => {
  it("classifies lead reservation fields from the shared step contract", () => {
    expect(contextContractSummary("leadCapture").user).toEqual([
      "contactDate",
      "leadName",
      "phone",
      "contactChannel",
      "requestedBedCount",
      "expectedCheckInDate",
      "stayDurationText",
      "leadSource",
      "budgetAmount",
      "leadStatus",
      "leadNote"
    ]);
    expect(fieldContextRole("leadCapture", "leadName").kind).toBe("user");
    expect(fieldContextRole("leadFollowUp", "leadId").kind).toBe("inherited");
    expect(fieldContextRole("reservationCreate", "leadId").kind).toBe("inherited");
  });

  it("keeps deposit refund approval settlement fields aligned with user and derived sources", () => {
    const summary = contextContractSummary("depositRefundApproval");

    expect(summary.user).toEqual(["deductionAmount", "deductionReason", "applyToBalanceAmount", "handlingOpinion"]);
    expect(summary.derived).toContain("refundAmount");
    expect(fieldContextRole("depositRefundApproval", "refundAmount").kind).toBe("derived");
    expect(fieldContextRole("depositRefundApproval", "approverId").kind).toBe("backendDefault");
  });

  it("derives lifecycle charge amount instead of asking the operator to type it", () => {
    const summary = contextContractSummary("chargeAssessment");

    expect(summary.user).toEqual(["chargeType", "periodStart", "periodEnd", "chargeReason", "chargeNote"]);
    expect(summary.derived).toContain("amount");
    expect(fieldContextRole("chargeAssessment", "amount").kind).toBe("derived");

    const values = withSystemGeneratedOperationValues(
      { id: "W-STAY-LIFECYCLE" },
      { id: "chargeAssessment" },
      {
        stayId: "stay-1",
        chargeType: "rent",
        periodStart: "2026-06-01T00:00",
        periodEnd: "2026-07-01T00:00",
        chargeReason: "月租"
      },
      {
        payloads: [
          { eventType: "Accommodation.ResidentCheckedIn", payload: { unitRate: "3000", tariffQuantity: "1" } }
        ]
      }
    );

    expect(values.amount).toBe("3000");
  });

  it("derives deposit refund amount from confirmed liability and current settlement inputs", () => {
    const values = withSystemGeneratedOperationValues(
      { id: "W-STAY-DEPOSIT-LEDGER" },
      { id: "depositRefundApproval" },
      {
        depositId: "deposit-1",
        deductionAmount: "100",
        applyToBalanceAmount: "100",
        handlingOpinion: "同意退款"
      },
      {
        payloads: [
          { eventType: "Accommodation.DepositConfirmed", payload: { confirmedAmount: "1000" } },
          { eventType: "Accommodation.DepositDeducted", payload: { deductionAmount: "100" } }
        ]
      }
    );

    expect(values.refundAmount).toBe("700");
  });
});
