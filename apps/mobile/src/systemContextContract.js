const runtimeTruthPriority = ["latest-runtime-event-or-projection", "operations-start-context", "completed-record-snapshot", "non-conflicting-draft-fallback"];

const stepContracts = [
  contract("Accommodation.ResourceSetup", "roomSetup", [], {
    inherited: [],
    user: ["buildingName", "roomNo", "roomType", "bedCount", "genderPolicy", "furnitureStatus", "technicalState", "roomNote"],
    derived: [{ fieldId: "roomId", from: ["buildingName", "roomNo"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.ResourceSetup", "bedSetup", ["roomSetup"], {
    inherited: ["roomId", "bedCount"],
    user: ["bedType"],
    derived: [{ fieldId: "bedLabels", from: ["bedCount"] }, { fieldId: "bedLayout", from: ["bedCount", "bedType"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "bedStatus", defaultValue: "available", source: "runtime-default" }],
    suppressed: ["bedId", "bedNo", "bedLabel", "note"]
  }),
  contract("Accommodation.ResourceSetup", "rateSetup", ["roomSetup", "bedSetup"], {
    inherited: ["roomId"],
    user: ["ratePlan", "dailyRatePerBed", "weeklyRatePerBed", "monthlyRatePerBed", "currency", "effectiveFrom", "rateNote"],
    derived: [],
    backend: []
  }),
  contract("Accommodation.ResourceSetup", "roomReadiness", ["roomSetup", "bedSetup", "rateSetup"], {
    inherited: ["roomId"],
    user: ["furnitureStatus", "technicalState", "availabilityStatus", "readinessNote"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.ResourceSetup", "roomBlock", ["roomReadiness"], {
    inherited: ["roomId"],
    user: ["resourceScope", "bedId", "blockedReason", "blockStartAt", "expectedReleaseAt", "blockNote"],
    derived: [{ fieldId: "blockId", from: ["roomId", "resourceScope"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.ResourceSetup", "roomRelease", ["roomBlock"], {
    inherited: ["roomId", "bedId"],
    user: ["resourceScope", "releaseAvailableAt", "releaseReason", "releaseNote"],
    derived: [{ fieldId: "releaseId", from: ["roomId", "resourceScope"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.ServiceTask", "serviceTaskCreate", ["roomSetup", "bedSetup"], {
    inherited: [],
    user: ["taskDate", "taskType", "resourceScope", "roomId", "bedId", "area", "issueDescription", "resolutionAction", "urgency", "blocksAvailability", "targetCompletionDate", "taskEvidenceId"],
    derived: [{ fieldId: "taskId", from: ["taskDate", "taskType"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }, { fieldId: "ownerName", source: "assignment-chain" }]
  }),
  contract("Accommodation.ServiceTask", "serviceTaskAssign", ["serviceTaskCreate"], {
    inherited: ["taskId", "roomId", "bedId"],
    user: ["ownerName", "priority", "targetCompletionDate", "assignmentNote"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.ServiceTask", "serviceTaskComplete", ["serviceTaskAssign"], {
    inherited: ["taskId", "roomId", "bedId"],
    user: ["completedAt", "completionResult", "actualCostAmount", "expenseId", "completionEvidenceId"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.ServiceTask", "serviceTaskVerify", ["serviceTaskComplete"], {
    inherited: ["taskId", "roomId", "bedId"],
    user: ["verificationResult", "verificationNote", "handlingOpinion"],
    derived: [],
    backend: [{ fieldId: "managerId", source: "approval-chain" }]
  }),
  contract("Accommodation.ServiceTask", "roomReleaseAfterService", ["serviceTaskVerify"], {
    inherited: ["taskId", "roomId", "bedId"],
    user: ["resourceScope", "releaseAvailableAt", "releaseNote"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.LeadReservation", "leadCapture", [], {
    inherited: [],
    user: ["contactDate", "leadName", "phone", "contactChannel", "requestedBedCount", "expectedCheckInDate", "stayDurationText", "leadSource", "budgetAmount", "leadStatus", "leadNote"],
    derived: [{ fieldId: "leadId", from: ["leadName", "phone", "contactDate"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.LeadReservation", "leadFollowUp", ["leadCapture"], {
    inherited: ["leadId"],
    user: ["followUpDate", "followUpResult", "nextFollowUpAt", "leadStatus", "leadNote"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.LeadReservation", "reservationCreate", ["leadFollowUp"], {
    inherited: ["leadId"],
    user: ["reservedBedCount", "reservedRoomId", "reservedBedIds", "plannedCheckInDate", "reservationHoldUntil", "reservationDepositRequired", "reservationDepositAmount", "reservationNextAction", "reservationNote"],
    derived: [{ fieldId: "reservationId", from: ["leadId", "plannedCheckInDate"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.LeadReservation", "reservationCancel", ["reservationCreate"], {
    inherited: ["reservationId"],
    user: ["cancelReason", "releaseBed", "cancelNote"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.LeadReservation", "reservationConvert", ["reservationCreate"], {
    inherited: ["reservationId"],
    user: ["stayId", "convertedAt", "conversionNote"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Checkin", "bedAssign", ["residentProfile"], {
    inherited: ["residentId"],
    user: ["roomBed", "stayPeriod", "bedLockNote"],
    derived: [
      { fieldId: "roomId", from: ["roomBed"], surface: "hidden-submit-only" },
      { fieldId: "bedId", from: ["roomBed"], surface: "hidden-submit-only" },
      { fieldId: "stayId", from: ["residentId", "roomBed"], surface: "hidden-submit-only" }
    ],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Checkin", "lead", [], {
    inherited: [],
    user: ["contactDate", "guestName", "phone", "requestedBedCount", "stayDurationText", "leadSource", "leadStatus", "note"],
    derived: [{ fieldId: "leadId", from: ["phone", "contactDate"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Checkin", "booking", ["lead"], {
    inherited: ["leadId"],
    user: ["checkInDate", "reservedBedCount", "reservedBedIds", "leadStatus", "note"],
    derived: [{ fieldId: "bookingId", from: ["leadId", "checkInDate"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Checkin", "resident", ["booking"], {
    inherited: ["bookingId"],
    user: ["guestName", "phone", "checkInDate", "plannedCheckOutDate", "residentStatus", "note"],
    derived: [{ fieldId: "residentId", from: ["phone", "bookingId"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Checkin", "tariff", ["bedAssign"], {
    inherited: ["stayId"],
    user: ["tariffType", "unitRate", "tariffQuantity", "chargeNote"],
    derived: [
      { fieldId: "folioId", from: ["stayId", "tariffType"], surface: "hidden-submit-only" },
      { fieldId: "amount", from: ["unitRate", "tariffQuantity"] }
    ],
    backend: [{ fieldId: "operatorId", source: "actor-session" }],
    suppressed: ["depositPolicyName"]
  }),
  contract("Accommodation.DepositLedger", "depositAssessment", ["tariff"], {
    inherited: ["stayId"],
    user: ["depositType", "requiredDepositAmount", "currency", "depositDueAt", "depositPolicyNote"],
    derived: [{ fieldId: "depositId", from: ["stayId"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.DepositLedger", "depositRequirement", ["tariff"], {
    inherited: ["folioId"],
    user: ["depositPolicyName", "requiredDepositAmount", "currency", "depositDueAt", "depositWaiverAllowed", "depositWaiverReason"],
    derived: [{ fieldId: "depositId", from: ["folioId"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.DepositLedger", "depositReceipt", ["depositAssessment"], {
    inherited: ["depositId"],
    user: ["receivedAmount", "paymentMethod", "payerName", "receivedDate", "depositEvidenceId", "depositReceiptNote"],
    derived: [{ fieldId: "depositReceiptId", from: ["depositId", "receivedDate", "receivedAmount"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "receivedBy", source: "actor-session" }]
  }),
  contract("Accommodation.DepositLedger", "depositConfirmation", ["depositReceipt"], {
    inherited: ["depositId", "depositReceiptId"],
    user: ["confirmedAmount", "confirmationResult", "differenceReason", "financeNote"],
    derived: [],
    backend: [{ fieldId: "financeReviewer", source: "actor-session" }]
  }),
  contract("Accommodation.DepositLedger", "depositDeduction", ["depositConfirmation"], {
    inherited: ["depositId"],
    user: ["deductionAmount", "deductionReason", "handlingOpinion"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.DepositLedger", "depositRefundApproval", ["depositDeduction"], {
    inherited: ["depositId"],
    user: ["deductionAmount", "deductionReason", "applyToBalanceAmount", "handlingOpinion"],
    derived: [{ fieldId: "refundAmount", from: ["depositId", "deductionAmount", "applyToBalanceAmount"] }],
    backend: [{ fieldId: "approverId", source: "approval-chain" }]
  }),
  contract("Accommodation.DepositLedger", "depositRefundPayment", ["depositRefundApproval"], {
    inherited: ["depositId"],
    user: ["refundAmount", "refundMethod", "refundReceiver", "refundEvidenceId", "paymentTime", "manualConfirmSummary"],
    derived: [],
    backend: [{ fieldId: "financeReviewer", source: "actor-session" }]
  }),
  contract("Accommodation.DepositLedger", "depositClose", ["depositRefundPayment", "depositConfirmation"], {
    inherited: ["depositId"],
    user: ["closeResult", "manualConfirmSummary", "note"],
    derived: [],
    backend: [{ fieldId: "financeReviewer", source: "actor-session" }]
  }),
  contract("Accommodation.PaymentLedger", "paymentReceipt", ["tariff"], {
    inherited: ["stayId"],
    user: ["paymentAmount", "paymentMethod", "payerName", "receivedDate", "paymentPurpose", "coverageStart", "coverageEnd", "currency", "paymentEvidenceId"],
    derived: [{ fieldId: "paymentId", from: ["stayId", "paymentAmount"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "receivedBy", source: "actor-session" }]
  }),
  contract("Accommodation.PaymentLedger", "paymentConfirmation", ["paymentReceipt"], {
    inherited: ["stayId", "paymentId"],
    user: ["confirmedAmount", "confirmationResult", "differenceReason", "financeNote"],
    derived: [],
    backend: [{ fieldId: "financeReviewer", source: "actor-session" }]
  }),
  contract("Accommodation.PaymentLedger", "paymentAllocation", ["paymentConfirmation"], {
    inherited: ["paymentId"],
    user: ["allocationMode", "coveredChargeIds", "allocatedAmount", "allocationNote"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.PaymentLedger", "paymentAdjustment", ["paymentAllocation"], {
    inherited: ["paymentId"],
    user: ["adjustmentAmount", "adjustmentReason", "handlingOpinion", "note"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.PaymentLedger", "payment", ["depositRequirement", "tariff"], {
    inherited: ["folioId", "depositId"],
    user: ["payerName", "paymentTime", "paymentAmount", "currency", "paymentMethod", "paymentPurpose", "evidenceNo", "note"],
    derived: [{ fieldId: "paymentId", from: ["folioId", "paymentAmount"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "receivedBy", source: "actor-session" }]
  }),
  contract("Accommodation.PaymentLedger", "finance", ["payment"], {
    inherited: ["folioId", "paymentId", "depositId"],
    user: ["paymentChannel", "confirmedAmount", "confirmedAt", "matchResult", "differenceReason", "handlingOpinion"],
    derived: [],
    backend: [{ fieldId: "financeReviewer", source: "actor-session" }]
  }),
  contract("Accommodation.PaymentLedger", "debtFollowUp", ["paymentConfirmation"], {
    inherited: ["stayId"],
    user: ["debtReason", "followUpDate", "followUpResult", "nextFollowUpAt"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Checkin", "checkin", ["finance", "bedAssign"], {
    inherited: ["bedId", "stayId", "folioId", "depositId"],
    user: ["checkInDate", "handoverStatus", "manualConfirmSummary"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.CheckinControl", "operatingDashboard", ["checkin"], {
    inherited: ["folioId", "depositId"],
    user: ["reviewConclusion", "nextAction", "ownerName", "processingStatus"],
    derived: [],
    backend: [{ fieldId: "managerId", source: "actor-session" }]
  }),
  contract("Accommodation.Lifecycle", "residentProfile", [], {
    inherited: [],
    user: ["residentName", "phone", "identityType", "identityNo", "gender", "nationality", "emergencyContactName", "emergencyContactPhone", "residentNote"],
    derived: [{ fieldId: "residentId", from: ["residentName", "phone"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Lifecycle", "checkInBedAssign", ["residentProfile", "reservationCreate"], {
    inherited: ["residentId"],
    user: ["reservationId", "checkInDate", "plannedCheckOutDate", "roomId", "bedId", "tariffType", "unitRate", "tariffQuantity", "discountAmount"],
    derived: [{ fieldId: "stayId", from: ["residentId", "bedId"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Lifecycle", "chargeAssessment", ["checkInBedAssign"], {
    inherited: ["stayId"],
    user: ["chargeType", "periodStart", "periodEnd", "chargeReason", "chargeNote"],
    derived: [
      { fieldId: "amount", from: ["unitRate", "tariffQuantity"] },
      { fieldId: "chargeId", from: ["stayId", "chargeType"], surface: "hidden-submit-only" }
    ],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Lifecycle", "stayExtension", ["chargeAssessment"], {
    inherited: ["stayId"],
    user: ["plannedCheckOutDate", "tariffType", "unitRate", "extensionReason", "extensionNote"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.CheckoutSettlement", "checkoutStart", [], {
    inherited: ["stayId", "roomId", "bedId", "depositId"],
    user: ["actualCheckOutDate", "checkoutReason"],
    derived: [{ fieldId: "checkoutId", from: ["stayId", "actualCheckOutDate"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Checkout", "roomInspection", ["checkoutStart"], {
    inherited: ["checkoutId", "stayId", "roomId", "bedId", "depositId"],
    user: ["roomCondition", "bedCondition", "damageFound", "damageDescription", "damageChargeAmount", "cleaningRequired", "inspectionEvidenceId"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Checkout", "feeSettlement", ["roomInspection"], {
    inherited: ["checkoutId", "stayId", "depositId"],
    user: ["stayFeeAmount", "extraFeeAmount", "depositDeductionAmount", "depositApplyToBalanceAmount", "note"],
    derived: [{ fieldId: "refundOrSupplementAmount", from: ["stayFeeAmount", "extraFeeAmount", "depositDeductionAmount", "depositApplyToBalanceAmount"] }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.Checkout", "checkoutFinance", ["feeSettlement"], {
    inherited: ["checkoutId"],
    user: ["refundOrSupplementConfirmation", "financeEvidenceId", "note"],
    derived: [],
    backend: [{ fieldId: "confirmer", source: "actor-session" }]
  }),
  contract("Accommodation.CheckoutSettlement", "finalBalanceClose", ["roomInspection", "depositSettlement"], {
    inherited: ["checkoutId", "stayId", "depositId", "roomId", "bedId"],
    user: ["depositDeductionAmount", "depositApplyToBalanceAmount", "finalBalanceAmount", "settlementResult", "note"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.CheckoutSettlement", "bedRelease", ["finalBalanceClose"], {
    inherited: ["checkoutId", "roomId", "bedId"],
    user: ["releaseBed", "releaseAvailableAt", "releaseNote", "note"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.CheckoutSettlement", "depositSettlement", ["roomInspection"], {
    inherited: ["depositId"],
    user: ["deductionAmount", "applyToBalanceAmount", "handlingOpinion"],
    derived: [{ fieldId: "refundAmount", from: ["depositId", "deductionAmount", "applyToBalanceAmount"] }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.CheckoutSettlement", "postCheckoutCleaning", ["bedRelease"], {
    inherited: ["roomId", "bedId"],
    user: ["taskType", "targetCompletionDate", "resolutionAction"],
    derived: [{ fieldId: "taskId", from: ["roomId", "bedId", "taskType"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.ExpenseLedger", "expenseRecord", [], {
    inherited: [],
    user: ["expenseDate", "expenseCategory", "expenseDescription", "expenseAmount", "currency", "paymentMethod", "expenseEvidenceId"],
    derived: [{ fieldId: "expenseId", from: ["expenseDate", "expenseCategory"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "payerId", source: "actor-session" }, { fieldId: "payerName", source: "actor-session" }],
    suppressed: ["roomId", "bedId", "taskId"]
  }),
  contract("Accommodation.ExpenseLedger", "expenseApproval", ["expenseRecord"], {
    inherited: ["expenseId"],
    user: ["confirmedAmount", "approvalResult", "differenceReason", "approvalNote"],
    derived: [],
    backend: [{ fieldId: "reviewerId", source: "approval-chain" }]
  }),
  contract("Accommodation.ExpenseLedger", "expenseLink", ["expenseApproval"], {
    inherited: ["expenseId"],
    user: ["roomId", "bedId", "taskId", "linkNote"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  }),
  contract("Accommodation.CorrectionLedger", "ledgerCorrectionApply", ["correctionRequest"], {
    inherited: ["correctionRequestId"],
    user: ["adjustmentAmount", "correctionReason", "note"],
    derived: [],
    backend: [{ fieldId: "approverId", source: "approval-chain" }]
  }),
  contract("Accommodation.PeriodAnalytics", "periodScope", [], {
    inherited: [],
    user: ["periodYear", "periodNo", "periodStartAt", "periodEndAt", "periodDescription"],
    derived: [{ fieldId: "periodId", from: ["periodYear", "periodNo"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "managerId", source: "actor-session" }]
  }),
  contract("Accommodation.PeriodAnalytics", "periodMetricsReview", ["periodScope"], {
    inherited: ["periodId"],
    user: ["metricsSnapshotNote"],
    derived: [],
    backend: [{ fieldId: "managerId", source: "actor-session" }]
  }),
  contract("Accommodation.PeriodAnalytics", "periodFinanceReview", ["periodMetricsReview"], {
    inherited: ["periodId"],
    user: ["financeReviewResult", "financeReviewNote"],
    derived: [],
    backend: [{ fieldId: "financeReviewer", source: "actor-session" }]
  }),
  contract("Accommodation.PeriodAnalytics", "periodOperationsDiagnosis", ["periodFinanceReview"], {
    inherited: ["periodId"],
    user: ["primaryIssueCategory", "primaryIssue", "rootCauseAnalysis", "diagnosisConfidence"],
    derived: [],
    backend: [{ fieldId: "managerId", source: "actor-session" }]
  }),
  contract("Accommodation.PeriodAnalytics", "periodActionPlan", ["periodOperationsDiagnosis"], {
    inherited: ["periodId"],
    user: ["actionTitle", "actionType", "targetMetric", "targetValue", "dueAt", "ownerName", "priority", "actionStatus"],
    derived: [{ fieldId: "actionPlanId", from: ["periodId", "actionTitle"], surface: "hidden-submit-only" }],
    backend: [{ fieldId: "managerId", source: "actor-session" }]
  }),
  contract("Accommodation.PeriodAnalytics", "periodActionPlanComplete", ["periodActionPlan"], {
    inherited: ["actionPlanId", "periodId"],
    user: ["completedAt", "completionResult", "completionNote", "ownerName"],
    derived: [],
    backend: [{ fieldId: "managerId", source: "actor-session" }]
  }),
  contract("Accommodation.PeriodAnalytics", "periodClose", ["periodScope", "periodDiagnosis", "periodActionPlan"], {
    inherited: ["periodId"],
    user: ["closeResult", "managementConclusion", "nextPeriodFocus"],
    derived: [],
    backend: [{ fieldId: "operatorId", source: "actor-session" }]
  })
];

const contractsByCard = new Map(stepContracts.map((item) => [item.workItemId, item]));

export function allStepContextContracts() {
  return stepContracts;
}

export function stepContextContract(cardId = "") {
  return contractsByCard.get(cardId) || null;
}

export function fieldContextRole(cardId = "", fieldId = "") {
  const contract = stepContextContract(cardId);
  if (!contract || !fieldId) return { kind: "user", fieldId, contract: null };
  const inherited = contract.inheritedFields.find((item) => item.fieldId === fieldId);
  if (inherited) return { kind: "inherited", fieldId, contract, entry: inherited };
  const derived = contract.derivedFields.find((item) => item.fieldId === fieldId);
  if (derived) return { kind: "derived", fieldId, contract, entry: derived };
  const backend = contract.backendDefaultFields.find((item) => item.fieldId === fieldId) ||
    contract.hiddenBackendDefaults.find((item) => item.fieldId === fieldId);
  if (backend) return { kind: "backendDefault", fieldId, contract, entry: backend };
  const suppressed = contract.suppressedFields.find((item) => item.fieldId === fieldId);
  if (suppressed) return { kind: "suppressed", fieldId, contract, entry: suppressed };
  const user = contract.userSelectableFields.find((item) => item.fieldId === fieldId);
  if (user) return { kind: "user", fieldId, contract, entry: user };
  return { kind: "user", fieldId, contract };
}

export function fieldVisibleByContext(cardId = "", fieldId = "") {
  const role = fieldContextRole(cardId, fieldId);
  if (role.kind === "suppressed") return false;
  if (role.kind === "backendDefault") return false;
  if (role.kind === "derived" && role.entry?.surface === "hidden-submit-only") return false;
  return true;
}

export function fieldRequiresUserAction(cardId = "", fieldId = "", fallbackRequired = false) {
  const role = fieldContextRole(cardId, fieldId);
  if (["inherited", "derived", "backendDefault", "suppressed"].includes(role.kind)) return false;
  if (role.entry?.required === true) return true;
  if (role.entry?.required === false) return false;
  return fallbackRequired;
}

export function fieldParticipatesInUserValidation(cardId = "", fieldId = "") {
  return fieldContextRole(cardId, fieldId).kind === "user";
}

export function isContextCarriedField(cardId = "", fieldId = "") {
  return fieldContextRole(cardId, fieldId).kind === "inherited";
}

export function isDerivedContextField(cardId = "", fieldId = "") {
  return fieldContextRole(cardId, fieldId).kind === "derived";
}

export function isBackendDefaultField(cardId = "", fieldId = "") {
  return fieldContextRole(cardId, fieldId).kind === "backendDefault";
}

export function isSuppressedContextField(cardId = "", fieldId = "") {
  return fieldContextRole(cardId, fieldId).kind === "suppressed";
}

export function contextContractSummary(cardId = "") {
  const contract = stepContextContract(cardId);
  if (!contract) return { inherited: [], user: [], derived: [], backend: [], suppressed: [] };
  return {
    inherited: contract.inheritedFields.map((item) => item.fieldId),
    user: contract.userSelectableFields.map((item) => item.fieldId),
    derived: contract.derivedFields.map((item) => item.fieldId),
    backend: [...contract.backendDefaultFields, ...contract.hiddenBackendDefaults].map((item) => item.fieldId),
    suppressed: contract.suppressedFields.map((item) => item.fieldId)
  };
}

function contract(caseType, workItemId, dependsOn, fields) {
  return {
    caseType,
    workItemId,
    contractKind: "dormitory-system-context",
    dependsOn,
    inheritedFields: (fields.inherited || []).map((fieldId) => ({
      fieldId,
      sourceWorkItemId: dependsOn[dependsOn.length - 1] || "operations-start-context",
      surface: "readonly-hidden-submit",
      priority: runtimeTruthPriority
    })),
    userSelectableFields: (fields.user || []).map((fieldId) => ({ fieldId, surface: "editable" })),
    derivedFields: (fields.derived || []).map((entry) => ({
      fieldId: entry.fieldId,
      derivedFrom: entry.from,
      surface: entry.surface || "preview-hidden-submit",
      staleDraftPolicy: "always-recompute"
    })),
    backendDefaultFields: (fields.backend || []).map((entry) => ({
      fieldId: entry.fieldId,
      source: entry.source || "runtime-default",
      surface: "hidden-no-client-trust",
      defaultValue: entry.defaultValue || "runtime-owned"
    })),
    hiddenBackendDefaults: (fields.backend || [])
      .filter((entry) => entry.defaultValue)
      .map((entry) => ({
        fieldId: entry.fieldId,
        defaultValue: entry.defaultValue,
        reason: "backend runtime owns this default; client must not ask the user to type it"
      })),
    suppressedFields: (fields.suppressed || []).map((fieldId) => ({
      fieldId,
      reason: "suppressed by current step dependency contract; blocks stale WorkItem fields"
    }))
  };
}
