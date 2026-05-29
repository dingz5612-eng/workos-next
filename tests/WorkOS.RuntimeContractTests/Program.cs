using WorkOS.Api.Runtime;
using Npgsql;
using System.Text.Json;
using System.Text.RegularExpressions;

var connectionString = Environment.GetEnvironmentVariable("WORKOS_TEST_CONNECTION")
    ?? "Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev";

AssertTestDatabaseAllowed(connectionString);
EnsureTestDatabaseExists(connectionString);
ResetPostgres(connectionString);

{
    var runtime = ProjectionRuntime.OpenPostgres(connectionString, RuntimeAuthOptions.Development);
    var projection = runtime.GetAll();
    var cards = projection.Workspaces.SelectMany(workspace => workspace.Cards).ToArray();

    ValidateProjectionContractFiles();
    ValidateGeneratedDtos();
    ValidateSliceManifest(projection);
    ValidateProjectionEnvelopeAgainstContract(projection);

    foreach (var card in cards)
    {
        Assert(card.Fields.Business.Count > 0, $"{card.Id} missing business fields");
        Assert(card.Fields.System.Count > 0, $"{card.Id} missing system fields");
        Assert(card.Fields.Analytics.Count > 0, $"{card.Id} missing analytics fields");
        Assert(card.Evidence.Count > 0, $"{card.Id} missing evidence");
        Assert(card.Checks.Count > 0, $"{card.Id} missing system checks");
        Assert(card.Events.Count > 0, $"{card.Id} missing events");
        Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnPrepare), $"{card.Id} missing prepare transition");
        Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnConfirm), $"{card.Id} missing confirm transition");
        Assert(card.Confirmation.ForbiddenForAi, $"{card.Id} must forbid AI confirmation");
    }

    var resource = projection.Workspaces.Single(workspace => workspace.Id == "W-STAY-RESOURCE");
    AssertSequence(resource, "roomSetup", "bedSetup", "rateSetup", "roomReadiness", "roomBlock", "roomRelease");
    ValidateFieldContracts(resource);

    var checkin = projection.Workspaces.Single(workspace => workspace.Id == "W-STAY-CHECKIN");
    AssertSequence(checkin, "lead", "booking", "resident", "bedAssign", "tariff", "depositRequirement", "payment", "finance", "checkin", "operatingDashboard");
    ValidateFieldContracts(checkin);
    ValidateAccommodationWorkOS20Contracts(projection);
    ValidateAccommodationFactOwnership();
    ValidatePeriodAnalyticsContract();
    ValidateStableOptionValues(projection);
    ValidateRuntimeSurfaceLenses(runtime);

    var prepared = runtime.Prepare("W-STAY-RESOURCE", "roomSetup");
    Assert(prepared is not null, "prepare should return room setup card payload");
    Assert(runtime.Login(new LoginRequest("operator", "wrong-password")) is null, "login must reject invalid password");

    var operatorToken = LoginToken(runtime, "operator");
    var financeToken = LoginToken(runtime, "finance");
    var managerToken = LoginToken(runtime, "manager");
    var aiToken = LoginToken(runtime, "ai");

    var missingToken = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-CHECKIN", "finance", Human("missing-token-finance"), ""));
    Assert(missingToken.Status == ConfirmStatus.Forbidden, "confirm must require a trusted backend session token");
    Assert(missingToken.Reason == "actor_session_required", "missing actor session must use auth-specific reason");
    var missingIdempotencyKey = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-RESOURCE", "roomSetup", new ConfirmCardRequest("zh-CN", "", new Dictionary<string, string>(), Array.Empty<string>()), operatorToken));
    Assert(missingIdempotencyKey.Status == ConfirmStatus.Invalid, "confirm must require idempotency key");
    var localizedPayloadKey = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-RESOURCE", "roomSetup", new ConfirmCardRequest("zh-CN", "localized-field-key", new Dictionary<string, string> { ["房间号"] = "A999" }, Array.Empty<string>(), "submission-localized-field-key", "card-instance-localized-field-key"), operatorToken));
    Assert(localizedPayloadKey.Status == ConfirmStatus.Invalid, "confirm must reject localized label keys as malformed input");
    Assert(localizedPayloadKey.Reason == "canonical_field_id_required", "localized label key rejection must use stable reason");

    var aiFinance = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-CHECKIN", "finance", Human("ai-finance"), aiToken));
    Assert(aiFinance.Status == ConfirmStatus.Forbidden, "AI finance confirmation must be rejected");
    Assert(aiFinance.Reason?.StartsWith("ai_confirmation_forbidden:") == true, "AI rejection must use stable policy decision code");

    var operatorFinance = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-CHECKIN", "finance", Human("operator-finance"), operatorToken));
    Assert(operatorFinance.Status == ConfirmStatus.Forbidden, "operator must not confirm finance card");
    Assert(operatorFinance.Reason?.StartsWith("role_confirmation_forbidden:") == true, "role rejection must use stable policy decision code");

    var contractOnlyPrepare = runtime.Prepare("W-STAY-CHECKOUT", "checkoutStart");
    Assert(contractOnlyPrepare is not null, "contract-only slices should still allow prepare");
    var contractOnlyConfirm = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-CHECKOUT", "checkoutStart", Human("contract-only-checkout-start"), managerToken));
    Assert(contractOnlyConfirm.Status == ConfirmStatus.Forbidden, "contract-only slice confirm must be forbidden until runtime status is upgraded");
    Assert(contractOnlyConfirm.Reason == "slice_runtime_forbidden:Accommodation.CheckOut:contract-only", "contract-only rejection must name the owning slice");
    ValidateAllContractOnlySlicesAreGated(runtime, connectionString, projection, managerToken);

    var financeRoomSetup = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-RESOURCE", "roomSetup", Human("resource-finance-role"), financeToken));
    Assert(financeRoomSetup.Status == ConfirmStatus.Forbidden, "finance actor must not confirm ResourceSetup operator-owned cards");
    var aiRoomSetup = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-RESOURCE", "roomSetup", Human("resource-ai"), aiToken));
    Assert(aiRoomSetup.Status == ConfirmStatus.Forbidden, "AI must not confirm ResourceSetup cards");

    var humanRoom = runtime.Confirm("W-STAY-RESOURCE", "roomSetup", Human("resource-room", new Dictionary<string, string>
    {
        ["roomId"] = "room-phase7-001",
        ["roomNo"] = "A302",
        ["roomType"] = "four_bed",
        ["bedCount"] = "4",
        ["genderPolicy"] = "unrestricted",
        ["furnitureStatus"] = "complete",
        ["technicalState"] = "ready"
    }), operatorToken);
    Assert(humanRoom.Status == ConfirmStatus.Confirmed, "human room setup confirmation should pass");
    AssertConfirmPayloadProjected(humanRoom, "W-STAY-RESOURCE", "roomSetup");
    AssertOutboxProcessedForPayload(connectionString, humanRoom);
    Assert(LensContains(runtime, "room-readiness", "room-phase7-001"), "room setup confirm must update aggregate lens before the frontend refreshes");
    runtime.ProcessPendingOutbox();

    var auditBeforeDuplicate = CountRows(connectionString, "audit_events");
    var outboxBeforeDuplicate = CountRows(connectionString, "outbox_messages");
    var roomBeforeDuplicate = CountRows(connectionString, "accommodation_rooms");
    var duplicateRoom = runtime.Confirm("W-STAY-RESOURCE", "roomSetup", Human("resource-room"), operatorToken);
    Assert(duplicateRoom.Status == ConfirmStatus.Duplicate, "same idempotency key should return duplicate instead of writing another event");
    Assert(CountRows(connectionString, "audit_events") == auditBeforeDuplicate, "duplicate confirm must not append audit events");
    Assert(CountRows(connectionString, "outbox_messages") == outboxBeforeDuplicate, "duplicate confirm must not append outbox messages");
    Assert(CountRows(connectionString, "accommodation_rooms") == roomBeforeDuplicate, "duplicate confirm must not rewrite aggregate rows");

    foreach (var (cardId, key, values) in new[]
    {
        ("bedSetup", "resource-bed", new Dictionary<string, string> { ["roomId"] = "room-phase7-001", ["bedId"] = "bed-phase7-001", ["bedNo"] = "A302-01", ["bedType"] = "lower", ["bedStatus"] = "available" }),
        ("rateSetup", "resource-rate", new Dictionary<string, string> { ["roomId"] = "room-phase7-001", ["ratePlanId"] = "rate-phase7-001", ["dailyRatePerBed"] = "350", ["weeklyRatePerBed"] = "2100", ["monthlyRatePerBed"] = "9300", ["currency"] = "KGS", ["effectiveFrom"] = "2026-06-01T00:00:00Z" }),
        ("roomReadiness", "resource-readiness", new Dictionary<string, string> { ["roomId"] = "room-phase7-001", ["roomNo"] = "A302", ["bedCount"] = "4", ["availabilityStatus"] = "available", ["furnitureStatus"] = "complete", ["technicalState"] = "ready" }),
        ("roomBlock", "resource-block", new Dictionary<string, string> { ["roomId"] = "room-phase7-001", ["roomNo"] = "A302", ["resourceScope"] = "room", ["blockReason"] = "maintenance", ["blockStartAt"] = "2026-06-02T09:00:00Z", ["expectedReleaseAt"] = "2026-06-02T18:00:00Z" }),
        ("roomRelease", "resource-release", new Dictionary<string, string> { ["roomId"] = "room-phase7-001", ["roomNo"] = "A302", ["resourceScope"] = "room", ["releaseAvailableAt"] = "2026-06-02T18:30:00Z" })
    })
    {
        Assert(runtime.Confirm("W-STAY-RESOURCE", cardId, Human(key, values), operatorToken).Status == ConfirmStatus.Confirmed, $"{cardId} confirmation should pass");
        runtime.ProcessPendingOutbox();
    }

    foreach (var cardId in new[] { "lead", "booking", "resident", "bedAssign", "tariff", "depositRequirement", "payment", "finance", "checkin", "operatingDashboard" })
    {
        var token = cardId == "finance" ? financeToken : operatorToken;
        var result = runtime.Confirm("W-STAY-CHECKIN", cardId, Human($"checkin-{cardId}"), token);
        Assert(result.Status == ConfirmStatus.Confirmed, $"{cardId} confirmation should pass");
        runtime.ProcessPendingOutbox();
    }
    Assert(CountRows(connectionString, "deposit_liabilities") == 0, "legacy CheckIn must not write DepositLedger authoritative liability facts");
    Assert(CountRows(connectionString, "hostel_payments") == 0, "legacy CheckIn must not write PaymentLedger authoritative payment facts");
    Assert(CountRows(connectionString, "finance_reconciliations") == 0, "legacy CheckIn must not write PaymentLedger finance reconciliation facts");
    Assert(CountRows(connectionString, "accommodation_deposits") == 0, "legacy CheckIn must not write legacy deposit facts after ledger ownership migration");
    Assert(CountRows(connectionString, "finance_confirmations") == 0, "legacy CheckIn finance confirmation is transitional read-only after ledger ownership migration");

    var financeLeadCapture = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-LEAD-RESERVATION", "leadCapture", Human("lead-reservation-finance-role"), financeToken));
    Assert(financeLeadCapture.Status == ConfirmStatus.Forbidden, "finance actor must not confirm operator-owned lead capture");
    var aiLeadCapture = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-LEAD-RESERVATION", "leadCapture", Human("lead-reservation-ai"), aiToken));
    Assert(aiLeadCapture.Status == ConfirmStatus.Forbidden, "AI must not confirm LeadReservation cards");

    Assert(runtime.Confirm("W-STAY-LEAD-RESERVATION", "leadCapture", Human("lead-reservation-capture", new Dictionary<string, string>
    {
        ["leadId"] = "lead-phase6-001",
        ["leadName"] = "Phase Six Guest",
        ["phone"] = "+996 555 660001",
        ["requestedBedCount"] = "1",
        ["stayDurationText"] = "1个月",
        ["leadSource"] = "whatsapp",
        ["leadStatus"] = "new"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "LeadReservation lead capture should pass after runtime upgrade");
    runtime.ProcessPendingOutbox();
    Assert(runtime.Confirm("W-STAY-LEAD-RESERVATION", "leadCapture", Human("lead-reservation-capture"), operatorToken).Status == ConfirmStatus.Duplicate, "LeadReservation duplicate confirm should be idempotent");

    foreach (var (cardId, key, values) in new[]
    {
        ("leadFollowUp", "lead-reservation-follow-up", new Dictionary<string, string> { ["leadId"] = "lead-phase6-001", ["leadStatus"] = "negotiating" }),
        ("reservationCreate", "lead-reservation-create", new Dictionary<string, string> { ["leadId"] = "lead-phase6-001", ["reservationId"] = "reservation-phase6-001", ["reservedBedCount"] = "1", ["reservedBedIds"] = "A301-02", ["plannedCheckInDate"] = "2026-06-01T12:00:00Z", ["reservationHoldUntil"] = "2026-05-31T12:00:00Z" }),
        ("reservationCancel", "lead-reservation-cancel", new Dictionary<string, string> { ["leadId"] = "lead-phase6-001", ["reservationId"] = "reservation-phase6-001" }),
        ("reservationConvert", "lead-reservation-convert", new Dictionary<string, string> { ["leadId"] = "lead-phase6-001", ["reservationId"] = "reservation-phase6-001", ["stayId"] = "stay-phase6-001" })
    })
    {
        Assert(runtime.Confirm("W-STAY-LEAD-RESERVATION", cardId, Human(key, values), operatorToken).Status == ConfirmStatus.Confirmed, $"{cardId} should pass after LeadReservation runtime upgrade");
        runtime.ProcessPendingOutbox();
    }

    var financeResidentProfile = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-LIFECYCLE", "residentProfile", Human("stay-lifecycle-finance-role"), financeToken));
    Assert(financeResidentProfile.Status == ConfirmStatus.Forbidden, "finance actor must not confirm operator-owned resident profile");
    var aiResidentProfile = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-LIFECYCLE", "residentProfile", Human("stay-lifecycle-ai"), aiToken));
    Assert(aiResidentProfile.Status == ConfirmStatus.Forbidden, "AI must not confirm StayLifecycle cards");

    foreach (var (cardId, key, values) in new[]
    {
        ("residentProfile", "stay-lifecycle-resident", new Dictionary<string, string> { ["residentId"] = "resident-phase6-001", ["residentName"] = "Phase Six Guest", ["phone"] = "+996 555 660001", ["identityType"] = "passport", ["gender"] = "unspecified", ["nationality"] = "KG" }),
        ("checkInBedAssign", "stay-lifecycle-checkin-bed", new Dictionary<string, string> { ["residentId"] = "resident-phase6-001", ["stayId"] = "stay-phase6-001", ["roomId"] = "A301", ["bedId"] = "A301-02", ["checkInDate"] = "2026-06-01T12:00:00Z", ["plannedCheckOutDate"] = "2026-07-01T12:00:00Z" }),
        ("chargeAssessment", "stay-lifecycle-charge", new Dictionary<string, string> { ["stayId"] = "stay-phase6-001", ["chargeId"] = "charge-phase6-001", ["chargeType"] = "rent", ["periodStart"] = "2026-06-01T00:00:00Z", ["periodEnd"] = "2026-07-01T00:00:00Z", ["amount"] = "9300", ["currency"] = "KGS", ["chargeReason"] = "monthly rent" }),
        ("stayExtension", "stay-lifecycle-extension", new Dictionary<string, string> { ["stayId"] = "stay-phase6-001", ["residentName"] = "Phase Six Guest", ["phone"] = "+996 555 660001", ["roomId"] = "A301", ["bedId"] = "A301-02", ["plannedCheckOutDate"] = "2026-08-01T12:00:00Z" })
    })
    {
        Assert(runtime.Confirm("W-STAY-LIFECYCLE", cardId, Human(key, values), operatorToken).Status == ConfirmStatus.Confirmed, $"{cardId} should pass after StayLifecycle runtime upgrade");
        runtime.ProcessPendingOutbox();
    }

    Assert(runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositAssessment", Human("deposit-assessment", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["requiredDepositAmount"] = "3000",
        ["currency"] = "KGS"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "deposit assessment should pass after DepositLedger runtime upgrade");
    runtime.ProcessPendingOutbox();

    var missingDepositEvidence = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositReceipt", Human("deposit-receipt-missing-evidence", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-ledger-001",
        ["receivedAmount"] = "3000",
        ["paymentMethod"] = "bank_transfer"
    }), operatorToken));
    Assert(missingDepositEvidence.Status == ConfirmStatus.Forbidden, "non-cash deposit receipt without evidence must be forbidden");
    Assert(missingDepositEvidence.Reason == "evidence_object_required", "deposit evidence policy must require a real evidence object");

    var fakeDepositEvidence = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositReceipt", HumanWithEvidence("deposit-receipt-fake-evidence", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-ledger-001",
        ["receivedAmount"] = "3000",
        ["currency"] = "KGS",
        ["paymentMethod"] = "bank_transfer"
    }, "evidence-fake-deposit"), operatorToken));
    Assert(fakeDepositEvidence.Status == ConfirmStatus.Forbidden, "non-cash deposit receipt with fake evidence must be forbidden");
    Assert(fakeDepositEvidence.Reason == "evidence_object_not_found", "fake deposit evidence must not satisfy the evidence runtime");

    var missingDepositAmount = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositReceipt", Human("deposit-receipt-missing-amount", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-ledger-001",
        ["currency"] = "KGS",
        ["paymentMethod"] = "cash"
    }), operatorToken));
    Assert(missingDepositAmount.Status == ConfirmStatus.Forbidden, "deposit receipt missing canonical amount must be forbidden");
    Assert(missingDepositAmount.Reason == "missing_required_field:receivedAmount", "missing deposit amount must use stable reason");

    var depositReceiptRequest = Human("deposit-receipt", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-ledger-001",
        ["receivedAmount"] = "3000",
        ["currency"] = "KGS",
        ["paymentMethod"] = "bank_transfer"
    });
    var depositEvidenceId = EvidenceFor(runtime, depositReceiptRequest, "W-STAY-DEPOSIT-LEDGER", "depositReceipt");
    var depositReceipt = runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositReceipt", depositReceiptRequest with { EvidenceIds = new[] { depositEvidenceId } }, operatorToken);
    Assert(depositReceipt.Status == ConfirmStatus.Confirmed, "deposit receipt with evidence should pass");
    AssertConfirmEvents(depositReceipt, "Accommodation.DepositReceived", "Accommodation.DepositEvidenceSubmitted");
    runtime.ProcessPendingOutbox();
    Assert(runtime.GetAuditEvents("W-STAY-DEPOSIT-LEDGER").Any(item => item.CardId == "depositReceipt" && item.EvidenceIds?.Contains(depositEvidenceId) == true), "confirmed events must persist submitted evidenceIds");
    Assert(ScalarInt(connectionString, $"select count(*) from audit_events a join evidence_objects e on a.body->'evidenceIds' ? e.evidence_id where e.evidence_id = '{depositEvidenceId}'") > 0, "audit evidenceIds must join to evidence_objects");
    Assert(ScalarDecimal(connectionString, "select coalesce(sum(amount), 0) from deposit_transactions where deposit_id = 'deposit-ledger-001' and transaction_type = 'received'") == 3000m, "DepositReceived must persist the received amount once");
    Assert(ScalarDecimal(connectionString, "select coalesce(sum(amount), 0) from deposit_transactions where deposit_id = 'deposit-ledger-001' and transaction_type = 'evidence_submitted'") == 0m, "DepositEvidenceSubmitted must not change amount facts");
    Assert(ScalarText(connectionString, $"select status from card_instances where card_instance_id = '{depositReceiptRequest.CardInstanceId}'") == "confirmed", "confirmed deposit receipt must advance card instance status");

    Assert(runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositAssessment", Human("deposit-assessment-second", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-002",
        ["depositId"] = "deposit-ledger-002",
        ["requiredDepositAmount"] = "1000",
        ["currency"] = "KGS"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "second deposit assessment should pass");
    Assert(runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositReceipt", Human("deposit-receipt-second", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-ledger-002",
        ["receivedAmount"] = "1000",
        ["currency"] = "KGS",
        ["paymentMethod"] = "cash"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "same depositReceipt card should support a second aggregate instance");
    runtime.ProcessPendingOutbox();
    Assert(ScalarInt(connectionString, "select count(distinct aggregate_ref) from card_instances where workspace_id = 'W-STAY-DEPOSIT-LEDGER' and card_id = 'depositReceipt'") >= 2, "same card must create independent card instances for different deposit aggregateRefs");

    var depositConfirmation = runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositConfirmation", Human("deposit-confirmation", new Dictionary<string, string>
    {
        ["depositReceiptId"] = "deposit-ledger-001",
        ["confirmedAmount"] = "3000",
        ["confirmationResult"] = "confirmed"
    }), financeToken);
    Assert(depositConfirmation.Status == ConfirmStatus.Confirmed, "finance should confirm deposit receipt");
    AssertConfirmEvents(depositConfirmation, "Accommodation.DepositConfirmed");
    runtime.ProcessPendingOutbox();

    var missingDepositLedger = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositRefundApproval", Human("deposit-refund-missing-ledger", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-missing-ledger",
        ["heldAmount"] = "999999",
        ["refundAmount"] = "1"
    }), operatorToken));
    Assert(missingDepositLedger.Status == ConfirmStatus.Forbidden, "deposit settlement policies must require backend ledger state");
    Assert(missingDepositLedger.Reason == "deposit_ledger_state_required", "deposit missing ledger reason must be stable");

    var overRefund = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositRefundApproval", Human("deposit-refund-over-held", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-ledger-001",
        ["heldAmount"] = "999999",
        ["deductionAmount"] = "0",
        ["applyToBalanceAmount"] = "0",
        ["refundAmount"] = "3001"
    }), operatorToken));
    Assert(overRefund.Status == ConfirmStatus.Forbidden, "deposit refund approval must reject more than backend-held deposit");

    var depositDeduction = runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositDeduction", Human("deposit-deduction", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-ledger-001",
        ["deductionAmount"] = "500",
        ["applyToBalanceAmount"] = "500"
    }), operatorToken);
    Assert(depositDeduction.Status == ConfirmStatus.Confirmed, "deposit deduction/apply-to-balance should be a separate ledger card");
    AssertConfirmEvents(depositDeduction, "Accommodation.DepositDeducted", "Accommodation.DepositAppliedToBalance");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositRefundApproval", Human("deposit-refund-approval", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-ledger-001",
        ["refundAmount"] = "2000"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "deposit refund approval within held amount should pass");
    runtime.ProcessPendingOutbox();

    var refundPaymentRequest = Human("deposit-refund-payment", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-ledger-001",
        ["refundAmount"] = "2000",
        ["refundMethod"] = "bank_transfer",
        ["paymentTime"] = "2026-05-29T18:00"
    });
    var refundEvidenceId = EvidenceFor(runtime, refundPaymentRequest, "W-STAY-DEPOSIT-LEDGER", "depositRefundPayment");
    Assert(runtime.Confirm("W-STAY-DEPOSIT-LEDGER", "depositRefundPayment", refundPaymentRequest with { EvidenceIds = new[] { refundEvidenceId } }, operatorToken).Status == ConfirmStatus.Confirmed, "deposit refund payment should pass");
    runtime.ProcessPendingOutbox();
    Assert(ScalarDecimal(connectionString, "select coalesce(sum(amount), 0) from deposit_transactions where deposit_id = 'deposit-ledger-001' and transaction_type = 'confirmed'") == 3000m, "DepositLedger held amount must come from confirmed deposit transactions");
    Assert(ScalarDecimal(connectionString, "select coalesce(sum(amount), 0) from deposit_transactions where deposit_id = 'deposit-ledger-001' and transaction_type = 'refund_paid'") == 2000m, "DepositRefundPaid must persist liability-release transaction amount");

    var missingPaymentEvidence = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentReceipt", Human("payment-receipt-missing-evidence", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["paymentId"] = "payment-ledger-001",
        ["paymentAmount"] = "9300",
        ["currency"] = "KGS",
        ["paymentMethod"] = "bank_transfer"
    }), operatorToken));
    Assert(missingPaymentEvidence.Status == ConfirmStatus.Forbidden, "non-cash payment receipt without evidence must be forbidden");
    Assert(missingPaymentEvidence.Reason == "evidence_object_required", "payment evidence policy must require a real evidence object");

    var fakePaymentEvidence = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentReceipt", HumanWithEvidence("payment-receipt-fake-evidence", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["paymentId"] = "payment-ledger-001",
        ["payerName"] = "Ledger Guest",
        ["paymentAmount"] = "9300",
        ["currency"] = "KGS",
        ["paymentMethod"] = "bank_transfer",
        ["paymentPurpose"] = "rent"
    }, "evidence-fake-payment"), operatorToken));
    Assert(fakePaymentEvidence.Status == ConfirmStatus.Forbidden, "non-cash payment receipt with fake evidence must be forbidden");
    Assert(fakePaymentEvidence.Reason == "evidence_object_not_found", "fake payment evidence must not satisfy the evidence runtime");

    var depositPurposeInPaymentLedger = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentReceipt", Human("payment-receipt-deposit-purpose", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["paymentId"] = "payment-ledger-deposit-purpose",
        ["payerName"] = "Ledger Guest",
        ["paymentAmount"] = "3000",
        ["currency"] = "KGS",
        ["paymentMethod"] = "cash",
        ["paymentPurpose"] = "deposit"
    }), operatorToken));
    Assert(depositPurposeInPaymentLedger.Status == ConfirmStatus.Forbidden, "ordinary PaymentLedger must reject deposit purpose");
    Assert(depositPurposeInPaymentLedger.Reason == "payment_deposit_purpose_forbidden", "deposit purpose rejection must use stable reason");

    var paymentReceiptRequest = Human("payment-receipt", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["paymentId"] = "payment-ledger-001",
        ["payerName"] = "Ledger Guest",
        ["paymentAmount"] = "9300",
        ["currency"] = "KGS",
        ["paymentMethod"] = "bank_transfer",
        ["paymentPurpose"] = "rent"
    });
    var paymentEvidenceId = EvidenceFor(runtime, paymentReceiptRequest, "W-STAY-PAYMENT-LEDGER", "paymentReceipt");
    var paymentReceipt = runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentReceipt", paymentReceiptRequest with { EvidenceIds = new[] { paymentEvidenceId } }, operatorToken);
    Assert(paymentReceipt.Status == ConfirmStatus.Confirmed, "payment receipt with evidence should pass");
    AssertConfirmEvents(paymentReceipt, "Accommodation.PaymentReceived", "Accommodation.PaymentEvidenceSubmitted");
    runtime.ProcessPendingOutbox();

    var paymentConfirmation = runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentConfirmation", Human("payment-confirmation", new Dictionary<string, string>
    {
        ["paymentId"] = "payment-ledger-001",
        ["confirmedAmount"] = "9300",
        ["confirmationResult"] = "confirmed"
    }), financeToken);
    Assert(paymentConfirmation.Status == ConfirmStatus.Confirmed, "finance should confirm ordinary payment");
    AssertConfirmEvents(paymentConfirmation, "Accommodation.PaymentConfirmed");
    runtime.ProcessPendingOutbox();

    var missingPaymentLedger = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentAllocation", Human("payment-allocation-missing-ledger", new Dictionary<string, string>
    {
        ["paymentId"] = "payment-missing-ledger",
        ["confirmedAmount"] = "999999",
        ["allocatedAmount"] = "1"
    }), operatorToken));
    Assert(missingPaymentLedger.Status == ConfirmStatus.Forbidden, "payment allocation policies must require backend ledger state");
    Assert(missingPaymentLedger.Reason == "payment_ledger_state_required", "payment missing ledger reason must be stable");

    var overAllocation = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentAllocation", Human("payment-allocation-over", new Dictionary<string, string>
    {
        ["paymentId"] = "payment-ledger-001",
        ["confirmedAmount"] = "999999",
        ["allocatedAmount"] = "10000"
    }), operatorToken));
    Assert(overAllocation.Status == ConfirmStatus.Forbidden, "payment allocation must reject more than backend-confirmed amount");

    var paymentAllocation = runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentAllocation", Human("payment-allocation", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["paymentId"] = "payment-ledger-001",
        ["confirmedAmount"] = "9300",
        ["allocatedAmount"] = "9300",
        ["totalCharges"] = "999999"
    }), operatorToken);
    Assert(paymentAllocation.Status == ConfirmStatus.Confirmed, "payment allocation within confirmed amount should pass");
    AssertConfirmEvents(paymentAllocation, "Accommodation.PaymentAllocated", "Accommodation.BalanceRecalculated");
    runtime.ProcessPendingOutbox();
    Assert(ScalarDecimal(connectionString, "select coalesce(sum(allocated_amount), 0) from payment_allocations where payment_id = 'payment-ledger-001'") == 9300m, "PaymentLedger allocation must persist allocatedAmount");
    Assert(ScalarDecimal(connectionString, "select coalesce(max(total_charges), 0) from stay_balances where stay_id = 'stay-ledger-001'") == 0m, "StayBalance total charges must be recalculated from backend charge facts, not request payload");
    Assert(ScalarDecimal(connectionString, "select coalesce(max(balance), 0) from stay_balances where stay_id = 'stay-ledger-001'") == 0m, "StayBalance must be recalculated by backend ledger facts");

    Assert(runtime.Confirm("W-STAY-PAYMENT-LEDGER", "paymentReceipt", Human("payment-receipt-pending-risk", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["paymentId"] = "payment-ledger-pending-risk",
        ["payerName"] = "Ledger Guest",
        ["paymentAmount"] = "100",
        ["currency"] = "KGS",
        ["paymentMethod"] = "cash",
        ["paymentPurpose"] = "rent"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "pending ordinary payment receipt should remain visible to PaymentRiskLens");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "checkoutStart", Human("checkout-start", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["currentBalance"] = "0",
        ["heldAmount"] = "2000"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "checkout start should pass after runtime upgrade");
    runtime.ProcessPendingOutbox();

    var roomInspectionRequest = Human("room-inspection", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["roomCondition"] = "cleaning_required",
        ["bedStatus"] = "available",
        ["cleaningRequired"] = "true"
    });
    var roomInspectionEvidenceId = EvidenceFor(runtime, roomInspectionRequest, "W-STAY-CHECKOUT-SETTLEMENT", "roomInspection");
    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "roomInspection", roomInspectionRequest with { EvidenceIds = new[] { roomInspectionEvidenceId } }, operatorToken).Status == ConfirmStatus.Confirmed, "room inspection should pass");
    runtime.ProcessPendingOutbox();

    var depositTransactionCountBeforeCheckoutSettlement = CountRows(connectionString, "deposit_transactions");
    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "depositSettlement", Human("deposit-settlement-request", new Dictionary<string, string>
    {
        ["depositId"] = "deposit-ledger-001",
        ["deductionAmount"] = "500",
        ["applyToBalanceAmount"] = "500"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "checkout should request deposit settlement without owning deposit transaction");
    runtime.ProcessPendingOutbox();
    Assert(CountRows(connectionString, "deposit_transactions") == depositTransactionCountBeforeCheckoutSettlement + 1, "DepositLedger must consume checkout settlement requests as ledger workflow entries");
    Assert(ScalarDecimal(connectionString, "select coalesce(sum(amount), 0) from deposit_transactions where deposit_id = 'deposit-ledger-001' and transaction_type = 'settlement_requested'") == 0m, "checkout settlement request must not create a money-moving deposit transaction");

    var checkoutWithoutDepositSettlement = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "finalBalanceClose", Human("checkout-close-without-deposit", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["depositSettlementRequested"] = "false"
    }), operatorToken));
    Assert(checkoutWithoutDepositSettlement.Status == ConfirmStatus.Forbidden, "checkout final balance must require deposit settlement request");

    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "finalBalanceClose", Human("checkout-final-balance", new Dictionary<string, string>
    {
        ["stayId"] = "stay-ledger-001",
        ["depositSettlementRequested"] = "true",
        ["settlementResult"] = "closed"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "checkout final balance should pass after deposit settlement request");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "bedRelease", Human("checkout-bed-release", new Dictionary<string, string>
    {
        ["checkoutStarted"] = "true",
        ["bedId"] = "A301-02",
        ["releaseBed"] = "true"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "checkout bed release should pass after checkout start");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-CHECKOUT-SETTLEMENT", "postCheckoutCleaning", Human("checkout-cleaning", new Dictionary<string, string>
    {
        ["roomId"] = "room-phase7-001",
        ["bedId"] = "bed-phase7-001",
        ["taskType"] = "cleaning"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "post-checkout cleaning request should pass");
    runtime.ProcessPendingOutbox();

    var bedCountBeforeServiceTask = CountRows(connectionString, "accommodation_beds");
    var serviceTaskCreateRequest = Human("service-task-create", new Dictionary<string, string>
    {
        ["taskId"] = "task-phase3-001",
        ["taskType"] = "cleaning",
        ["roomId"] = "room-phase7-001",
        ["bedId"] = "bed-phase7-001",
        ["blocksAvailability"] = "true"
    });
    var serviceTaskEvidenceId = EvidenceFor(runtime, serviceTaskCreateRequest, "W-STAY-SERVICE-TASK", "serviceTaskCreate");
    Assert(runtime.Confirm("W-STAY-SERVICE-TASK", "serviceTaskCreate", serviceTaskCreateRequest with { EvidenceIds = new[] { serviceTaskEvidenceId } }, operatorToken).Status == ConfirmStatus.Confirmed, "service task create should pass after runtime upgrade");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-SERVICE-TASK", "serviceTaskAssign", Human("service-task-assign", new Dictionary<string, string>
    {
        ["taskId"] = "task-phase3-001",
        ["ownerName"] = "operator"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "service task assign should pass");
    runtime.ProcessPendingOutbox();

    var serviceTaskCompleteRequest = Human("service-task-complete", new Dictionary<string, string>
    {
        ["taskId"] = "task-phase3-001",
        ["completionResult"] = "done",
        ["actualCostAmount"] = "800"
    });
    var completionEvidenceId = EvidenceFor(runtime, serviceTaskCompleteRequest, "W-STAY-SERVICE-TASK", "serviceTaskComplete");
    Assert(runtime.Confirm("W-STAY-SERVICE-TASK", "serviceTaskComplete", serviceTaskCompleteRequest with { EvidenceIds = new[] { completionEvidenceId } }, operatorToken).Status == ConfirmStatus.Confirmed, "service task complete should pass without releasing room");
    runtime.ProcessPendingOutbox();

    var releaseBeforeVerify = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-SERVICE-TASK", "roomReleaseAfterService", Human("service-release-before-verify", new Dictionary<string, string>
    {
        ["taskId"] = "task-phase3-001",
        ["serviceTaskVerified"] = "false"
    }), operatorToken));
    Assert(releaseBeforeVerify.Status == ConfirmStatus.Forbidden, "service release must require verification first");

    Assert(runtime.Confirm("W-STAY-SERVICE-TASK", "serviceTaskVerify", Human("service-task-verify", new Dictionary<string, string>
    {
        ["taskId"] = "task-phase3-001",
        ["verificationResult"] = "approved"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "service task verify should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-SERVICE-TASK", "roomReleaseAfterService", Human("service-release-after-verify", new Dictionary<string, string>
    {
        ["taskId"] = "task-phase3-001",
        ["serviceTaskVerified"] = "true",
        ["roomId"] = "room-phase7-001",
        ["bedId"] = "bed-phase7-001"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "service release request should pass after verification");
    runtime.ProcessPendingOutbox();
    Assert(CountRows(connectionString, "accommodation_beds") == bedCountBeforeServiceTask, "ServiceTask request must be consumed without creating duplicate BedStatus facts");
    Assert(ScalarText(connectionString, "select status from accommodation_beds where bed_id = 'bed-phase7-001'") == "available", "ResourceSetup must consume service release request and restore BedStatus");

    var expenseWithoutEvidence = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-EXPENSE-LEDGER", "expenseRecord", Human("expense-without-evidence", new Dictionary<string, string>
    {
        ["expenseId"] = "expense-phase3-001",
        ["expenseAmount"] = "800",
        ["currency"] = "KGS",
        ["paymentMethod"] = "bank_transfer"
    }), operatorToken));
    Assert(expenseWithoutEvidence.Status == ConfirmStatus.Forbidden, "non-cash expense without evidence must be forbidden");

    var expenseRecordRequest = Human("expense-record", new Dictionary<string, string>
    {
        ["expenseId"] = "expense-phase3-001",
        ["expenseCategory"] = "cleaning",
        ["expenseAmount"] = "800",
        ["currency"] = "KGS",
        ["paymentMethod"] = "bank_transfer"
    });
    var expenseEvidenceId = EvidenceFor(runtime, expenseRecordRequest, "W-STAY-EXPENSE-LEDGER", "expenseRecord");
    Assert(runtime.Confirm("W-STAY-EXPENSE-LEDGER", "expenseRecord", expenseRecordRequest with { EvidenceIds = new[] { expenseEvidenceId } }, operatorToken).Status == ConfirmStatus.Confirmed, "expense record with evidence should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-EXPENSE-LEDGER", "expenseApproval", Human("expense-approval", new Dictionary<string, string>
    {
        ["expenseId"] = "expense-phase3-001",
        ["confirmedAmount"] = "800",
        ["approvalResult"] = "approved"
    }), financeToken).Status == ConfirmStatus.Confirmed, "expense approval should pass by finance");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-EXPENSE-LEDGER", "expenseLink", Human("expense-link", new Dictionary<string, string>
    {
        ["expenseId"] = "expense-phase3-001",
        ["roomId"] = "A301",
        ["bedId"] = "A301-02",
        ["taskId"] = "task-phase3-001"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "expense link should pass");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodScope", Human("period-scope", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["periodYear"] = "2026",
        ["periodNo"] = "15",
        ["periodStartAt"] = "2026-05-01T00:00:00Z",
        ["periodEndAt"] = "2026-05-10T23:59:59Z"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "period scope should pass after PeriodAnalytics runtime upgrade");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodMetricsReview", Human("period-metrics-zero-denominator", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["availableBedNight"] = "0",
        ["bedNightSold"] = "0",
        ["newLeadCount"] = "0",
        ["reservationCount"] = "0",
        ["checkInCount"] = "0"
    }), financeToken).Status == ConfirmStatus.Confirmed, "period metrics should allow zero denominator and freeze a snapshot");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodMetricsReview", Human("period-metrics-late-replay", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["availableBedNight"] = "100",
        ["bedNightSold"] = "99",
        ["newLeadCount"] = "20",
        ["reservationCount"] = "10",
        ["checkInCount"] = "9"
    }), financeToken).Status == ConfirmStatus.Confirmed, "late metric replay should not mutate the frozen snapshot");
    runtime.ProcessPendingOutbox();

    var periodDepositRevenue = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodFinanceReview", Human("period-finance-deposit-as-revenue", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["depositReceivedIncludedInRevenue"] = "true"
    }), financeToken));
    Assert(periodDepositRevenue.Status == ConfirmStatus.Forbidden, "period finance must reject deposit received as revenue");
    Assert(periodDepositRevenue.Reason == "period_deposit_revenue_forbidden", "period finance deposit revenue rejection must use stable reason");

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodFinanceReview", Human("period-finance", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["rentRevenue"] = "9300",
        ["otherRevenue"] = "200",
        ["confirmedPaymentAmount"] = "9300",
        ["pendingPaymentAmount"] = "0",
        ["depositReceivedAmount"] = "3000",
        ["depositRefundedAmount"] = "2000",
        ["depositDeductedAmount"] = "500",
        ["depositAppliedToBalanceAmount"] = "500",
        ["approvedExpenseAmount"] = "800",
        ["pendingExpenseAmount"] = "0",
        ["endingDebtAmount"] = "0",
        ["financeExceptionCount"] = "0"
    }), financeToken).Status == ConfirmStatus.Confirmed, "period finance review should pass without counting deposit as revenue or expense");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodOperationsDiagnosis", Human("period-operations-diagnosis", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["issueCategory"] = "occupancy",
        ["issueSummary"] = "weekday vacancy high",
        ["rootCause"] = "reservation conversion slow",
        ["blockedBedDays"] = "2",
        ["unfinishedTaskCount"] = "1",
        ["overdueTaskCount"] = "0",
        ["debtorCount"] = "0"
    }), operatorToken).Status == ConfirmStatus.Confirmed, "period operations diagnosis should pass");
    runtime.ProcessPendingOutbox();

    var periodCloseWithoutActionPlan = AssertNoSideEffects(connectionString, () => runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodClose", Human("period-close-without-action-plan", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["metricsReviewed"] = "true",
        ["financeReviewed"] = "true",
        ["operationsDiagnosed"] = "true",
        ["blockingIssueCount"] = "1",
        ["actionPlanCount"] = "0"
    }), managerToken));
    Assert(periodCloseWithoutActionPlan.Status == ConfirmStatus.Forbidden, "high-risk period close must require an action plan");
    Assert(periodCloseWithoutActionPlan.Reason == "period_close_requires_action_plan_for_high_risk", "period close high-risk rejection must use stable reason");

    var periodActionPlan = runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodActionPlan", Human("period-action-plan", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["actionPlanId"] = "period-plan-001",
        ["actionTitle"] = "increase weekday reservation conversion",
        ["actionType"] = "increase_occupancy",
        ["targetMetric"] = "average_occupancy_rate",
        ["targetValue"] = "0.75",
        ["ownerName"] = "manager",
        ["priority"] = "high",
        ["actionStatus"] = "in_progress"
    }), operatorToken);
    Assert(periodActionPlan.Status == ConfirmStatus.Confirmed, "period action plan should pass");
    AssertConfirmEvents(periodActionPlan, "Accommodation.PeriodActionPlanCommitted");
    runtime.ProcessPendingOutbox();

    var periodActionPlanComplete = runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodActionPlanComplete", Human("period-action-plan-complete", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["actionPlanId"] = "period-plan-001",
        ["completionDate"] = "2026-05-29T20:00:00Z",
        ["completionResult"] = "done",
        ["completionNote"] = "reservation conversion actions shipped",
        ["ownerName"] = "manager"
    }), operatorToken);
    Assert(periodActionPlanComplete.Status == ConfirmStatus.Confirmed, $"period action plan completion should pass on its own card: {periodActionPlanComplete.Status} {periodActionPlanComplete.Reason}");
    AssertConfirmEvents(periodActionPlanComplete, "Accommodation.PeriodActionPlanCompleted");
    runtime.ProcessPendingOutbox();

    Assert(runtime.Confirm("W-STAY-PERIOD-ANALYTICS", "periodClose", Human("period-close", new Dictionary<string, string>
    {
        ["periodId"] = "PER-2026-05-01",
        ["metricsReviewed"] = "true",
        ["financeReviewed"] = "true",
        ["operationsDiagnosed"] = "true",
        ["blockingIssueCount"] = "1",
        ["actionPlanCount"] = "1",
        ["closeResult"] = "closed"
    }), managerToken).Status == ConfirmStatus.Confirmed, "period close should pass after required reviews and action plan");
    runtime.ProcessPendingOutbox();

    var behavior = runtime.AppendBehaviorEvent(new BehaviorEventRecord("beh-test", "WorkspaceOpened", "workspace", "W-STAY-CHECKIN", "zh-CN", "contract-test", DateTimeOffset.UtcNow));
    Assert(behavior.EventId == "beh-test", "behavior event should append");

    var reloaded = ProjectionRuntime.OpenPostgres(connectionString).GetAll();
    var reloadedResource = reloaded.Workspaces.Single(workspace => workspace.Id == "W-STAY-RESOURCE");
    Assert(reloaded.Events.Any(item => item.EventType == "Accommodation.RoomConfigured"), "RoomConfigured event should be persisted");
    Assert(reloaded.Events.All(item => !string.IsNullOrWhiteSpace(item.CorrelationId)), "audit events must include correlationId");
    Assert(reloaded.Events.All(item => !string.IsNullOrWhiteSpace(item.RequestId)), "audit events must include requestId");
    Assert(reloaded.Events.SelectMany(item => item.Payload.Keys).All(IsStableFactKey), "audit event payload keys must be canonical field ids, not localized labels");
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-RESOURCE").Select(item => item.EventType).ToArray(), "Accommodation.RoomConfigured", "Accommodation.BedConfigured", "Accommodation.RateConfigured", "Accommodation.RoomReadinessChanged", "Accommodation.RoomBlocked", "Accommodation.BedBlocked", "Accommodation.RoomReleased", "Accommodation.BedReleased");
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-CHECKIN").Select(item => item.EventType).ToArray(), "LeadCaptured", "BookingConfirmed", "ResidentRegistered", "BedAssigned", "TariffAssigned", "DepositRequired", "PaymentRecordedByFrontDesk", "PaymentConfirmedByFinance", "StayCheckedIn", "OperatingMetricsReviewed");
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-LEAD-RESERVATION").Select(item => item.EventType).ToArray(), "Accommodation.LeadCaptured", "Accommodation.LeadStatusChanged", "Accommodation.ReservationCreated", "Accommodation.ReservationCancelled", "Accommodation.ReservationExpired", "Accommodation.ReservationConvertedToStay");
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-LIFECYCLE").Select(item => item.EventType).ToArray(), "Accommodation.ResidentProfileCaptured", "Accommodation.ResidentCheckedIn", "Accommodation.BedAssigned", "Accommodation.StayChargeAssessed", "Accommodation.StayExtended", "Accommodation.StayRateChanged");
    Assert(reloadedResource.Cards.Single(card => card.Id == "roomSetup").Status == "done", "room setup status should persist as done");
    Assert(reloadedResource.Cards.All(card => card.Status == "done"), "resource cards should all be done");

    var reloadedCheckin = reloaded.Workspaces.Single(workspace => workspace.Id == "W-STAY-CHECKIN");
    Assert(reloadedCheckin.Cards.All(card => card.Status == "done"), "check-in cards should all be done");
    var reloadedRuntime = ProjectionRuntime.OpenPostgres(connectionString);
    Assert(CountRows(connectionString, "schema_migrations") >= 11, "schema migrations should be recorded in PostgreSQL");
    Assert(CountRows(connectionString, "accommodation_rooms") >= 1, "Room aggregate should persist in accommodation_rooms");
    Assert(CountRows(connectionString, "accommodation_beds") >= 1, "Bed aggregate should persist in accommodation_beds");
    Assert(CountRows(connectionString, "accommodation_rate_plans") >= 1, "RatePlan aggregate should persist in accommodation_rate_plans");
    Assert(CountRows(connectionString, "accommodation_deposits") == 0, "legacy accommodation_deposits must stay read-only after DepositLedger ownership migration");
    Assert(CountRows(connectionString, "finance_confirmations") == 0, "legacy finance_confirmations must stay read-only after PaymentLedger ownership migration");
    Assert(CountRows(connectionString, "hostel_leads") >= 1, "Hostel lead should persist in hostel_leads");
    Assert(CountRows(connectionString, "hostel_bookings") >= 1, "Hostel booking should persist in hostel_bookings");
    Assert(CountRows(connectionString, "hostel_residents") >= 1, "StayLifecycle should persist hostel_residents");
    Assert(CountRows(connectionString, "hostel_stays") >= 1, "Hostel stay should persist in hostel_stays");
    Assert(CountRows(connectionString, "hostel_charges") >= 1, "StayLifecycle should persist hostel_charges");
    Assert(CountRows(connectionString, "guest_folios") >= 1, "Guest folio should persist in guest_folios");
    Assert(ScalarText(connectionString, "select status from hostel_bookings where booking_id = 'reservation-phase6-001'") == "converted_to_stay", "LeadReservation should update reservation status through conversion");
    Assert(ScalarDecimal(connectionString, "select amount from hostel_charges where charge_id = 'charge-phase6-001'") == 9300m, "StayLifecycle should persist assessed charge amount");
    Assert(ScalarText(connectionString, "select status from accommodation_rooms where room_id = 'room-phase7-001'") == "available", "ResourceSetup should own final room availability status");
    Assert(ScalarDecimal(connectionString, "select monthly_rate_per_bed from accommodation_rate_plans where rate_plan_id = 'rate-phase7-001'") == 9300m, "ResourceSetup should persist monthly rate per bed");
    Assert(CountRows(connectionString, "deposit_liabilities") >= 1, "Deposit liability should persist in deposit_liabilities");
    Assert(CountRows(connectionString, "hostel_payments") >= 1, "Payment should persist in hostel_payments");
    Assert(CountRows(connectionString, "finance_reconciliations") >= 1, "Finance reconciliation should persist in finance_reconciliations");
    Assert(CountRows(connectionString, "hostel_operating_metrics") >= 1, "Operating metrics should persist in hostel_operating_metrics");
    Assert(CountRows(connectionString, "deposit_transactions") >= 4, "DepositLedger transactions should persist in deposit_transactions");
    Assert(CountRows(connectionString, "payment_allocations") >= 1, "PaymentLedger allocations should persist in payment_allocations");
    Assert(CountRows(connectionString, "stay_balances") >= 1, "PaymentLedger balances should persist in stay_balances");
    Assert(CountRows(connectionString, "checkout_settlements") >= 1, "CheckOutSettlement should persist checkout_settlements");
    Assert(CountRows(connectionString, "room_inspections") >= 1, "CheckOutSettlement should persist room_inspections");
    Assert(CountRows(connectionString, "service_tasks") >= 1, "ServiceTask should persist service_tasks");
    Assert(CountRows(connectionString, "expenses") >= 1, "ExpenseLedger should persist expenses");
    Assert(CountRows(connectionString, "expense_links") >= 1, "ExpenseLedger should persist expense_links");
    Assert(ScalarDecimal(connectionString, "select coalesce(max(actual_cost_amount), 0) from service_tasks") == 0m, "ServiceTask must not be a cost fact source");
    Assert(ScalarDecimal(connectionString, "select amount from expenses where expense_id = 'expense-phase3-001'") == 800m, "ExpenseLedger must be the persisted cost fact source");
    Assert(CountRows(connectionString, "period_reviews") >= 1, "PeriodAnalytics should persist period_reviews");
    Assert(CountRows(connectionString, "period_metric_snapshots") >= 1, "PeriodAnalytics should persist frozen metric snapshots");
    Assert(CountRows(connectionString, "period_finance_snapshots") >= 1, "PeriodAnalytics should persist finance snapshots");
    Assert(CountRows(connectionString, "period_operation_diagnoses") >= 1, "PeriodAnalytics should persist operation diagnoses");
    Assert(CountRows(connectionString, "period_action_plans") >= 1, "PeriodAnalytics should persist action plans");
    Assert(CountRows(connectionString, "period_late_adjustments") >= 3, "PeriodAnalytics late adjustments should append events");
    Assert(ScalarDecimal(connectionString, "select average_occupancy_rate from period_metric_snapshots where period_id = 'PER-2026-05-01'") == 0m, "zero denominator should produce numeric zero");
    Assert(ScalarText(connectionString, "select average_occupancy_rate_status from period_metric_snapshots where period_id = 'PER-2026-05-01'") == "not_applicable", "zero denominator should mark formula not_applicable");
    Assert(ScalarText(connectionString, "select snapshot_frozen::text from period_metric_snapshots where period_id = 'PER-2026-05-01'") == "true", "PeriodAnalytics metric snapshot must be marked frozen");
    Assert(ScalarDecimal(connectionString, "select bed_night_sold from period_metric_snapshots where period_id = 'PER-2026-05-01'") == 0m, "frozen period snapshot must not be mutated by a late metric replay");
    Assert(ScalarDecimal(connectionString, "select period_net_cash_flow from period_finance_snapshots where period_id = 'PER-2026-05-01'") == 8500m, "period net cash flow must be generated from PaymentLedger minus ExpenseLedger state");
    Assert(ScalarDecimal(connectionString, "select deposit_liability_end from period_finance_snapshots where period_id = 'PER-2026-05-01'") == 1000m, "deposit liability end formula should be generated from backend DepositLedger state");
    Assert(LensContains(reloadedRuntime, "bed-inventory", "BedInventoryLens"), "BedInventoryLens should expose persisted bed inventory");
    Assert(LensContains(reloadedRuntime, "room-readiness", "RoomReadinessLens"), "RoomReadinessLens should expose persisted room readiness");
    Assert(LensContains(reloadedRuntime, "rate-plan", "RatePlanLens"), "RatePlanLens should expose persisted rate plans");
    Assert(LensContains(reloadedRuntime, "room-revenue-potential", "RoomRevenuePotentialLens"), "RoomRevenuePotentialLens should expose rate-derived room revenue potential");
    Assert(LensContains(reloadedRuntime, "room-revenue-potential", "37200"), "RoomRevenuePotentialLens should calculate capacity times monthly rate");
    Assert(LensContains(reloadedRuntime, "today-operations", "TodayOperationsLens"), "TodayOperationsLens should expose cross-slice daily operations counters");
    Assert(LensContains(reloadedRuntime, "lead-funnel", "LeadFunnelLens"), "LeadFunnelLens should expose lead and reservation conversion facts");
    Assert(LensContains(reloadedRuntime, "active-stay", "ActiveStayLens"), "ActiveStayLens should expose active or reserved stays");
    Assert(LensContains(reloadedRuntime, "deposit-liability", "DepositLiabilityLens"), "DepositLiabilityLens should expose deposit liabilities");
    Assert(LensContains(reloadedRuntime, "payment-risk", "PaymentRiskLens"), "PaymentRiskLens should expose pending ordinary payments");
    Assert(LensContains(reloadedRuntime, "stay-balance", "StayBalanceLens"), "StayBalanceLens should expose stay balances");
    Assert(LensContains(reloadedRuntime, "checkout-queue", "CheckoutQueueLens"), "CheckoutQueueLens should expose checkout settlement queue state");
    Assert(LensContains(reloadedRuntime, "service-task-queue", "ServiceTaskQueueLens"), "ServiceTaskQueueLens should expose open service tasks");
    Assert(LensContains(reloadedRuntime, "expense-analytics", "ExpenseAnalyticsLens"), "ExpenseAnalyticsLens should expose approved expense totals");
    Assert(LensContains(reloadedRuntime, "period-performance", "PeriodPerformanceLens"), "PeriodPerformanceLens should expose period performance");
    Assert(LensContains(reloadedRuntime, "period-performance", "8500"), "PeriodPerformanceLens should expose net cash flow from the frozen period review");
    Assert(LensContains(reloadedRuntime, "risk-command", "RiskCommandLens"), "RiskCommandLens should expose owner risk counters");
    Assert(CountRows(connectionString, "repair_stations") >= 2, "RepairStation aggregate roots should persist in repair_stations");
    Assert(CountRows(connectionString, "repair_technicians") >= 2, "Technician aggregate roots should persist in repair_technicians");
    Assert(CountRows(connectionString, "repair_vehicles") >= 2, "Vehicle aggregate roots should persist in repair_vehicles");
    Assert(reloadedRuntime.GetAuditEvents("W-STAY-CHECKIN").Count == 10, "check-in audit events should persist in PostgreSQL");
    Assert(reloadedRuntime.GetBehaviorEvents().Any(item => item.EventId == "beh-test"), "behavior event should persist in PostgreSQL");
    var outbox = reloadedRuntime.GetOutboxMessages();
    Assert(outbox.Count == reloaded.Events.Count, $"outbox count should match successful audit events, got {outbox.Count} outbox and {reloaded.Events.Count} audit events");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.CorrelationId)), "outbox messages must include correlationId");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.RequestId)), "outbox messages must include requestId");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.CausationId)), "outbox messages must include causationId");
    Assert(outbox.All(item => item.AttemptCount >= 1), "outbox messages must be claimed before processing");
    Assert(outbox.All(item => item.DeadLetteredAtUtc is null), "successful outbox messages must not be dead-lettered");
    Assert(outbox.All(item => item.ProcessedAtUtc is not null), "all outbox messages should be processed by projector");
    Assert(reloadedRuntime.ProcessPendingOutbox() == 0, "outbox projector should be idempotent after processing");
    var observation = reloadedRuntime.Observe();
    Assert(observation.WorkspaceCount == reloaded.Workspaces.Count, $"observability workspaceCount should match projection, got {observation.WorkspaceCount}");
    Assert(observation.CardCount == reloaded.Workspaces.Sum(workspace => workspace.Cards.Count), $"observability cardCount should match projection, got {observation.CardCount}");
    Assert(observation.AuditEventCount == reloaded.Events.Count, $"observability auditEventCount should match successful audit events, got {observation.AuditEventCount}");
    Assert(observation.OutboxCount == outbox.Count, $"observability outboxCount should match persisted outbox messages, got {observation.OutboxCount}");
    Assert(observation.PendingOutboxCount == 0, "observability pending outbox count should be zero after processing");
    Assert(observation.DeadLetterOutboxCount == 0, "observability deadLetterOutboxCount should be zero for successful projection");
    Assert(observation.BehaviorEventCount >= 1, "observability behavior event count should include persisted behavior events");

    Console.WriteLine("WorkOS.RuntimeContractTests: PASS");
}

static void AssertSequence(WorkspaceProjection workspace, params string[] expected)
{
    var actual = workspace.Cards.Select(card => card.Id).ToArray();
    Assert(actual.SequenceEqual(expected), $"{workspace.Id} sequence expected {string.Join(" -> ", expected)}, got {string.Join(" -> ", actual)}");
}

static void AssertEventSequence(string[] actual, params string[] expected)
{
    Assert(actual.SequenceEqual(expected), $"event sequence expected {string.Join(" -> ", expected)}, got {string.Join(" -> ", actual)}");
}

static bool IsStableFactKey(string key) =>
    key.All(ch => ch <= 127 && (char.IsLetterOrDigit(ch) || ch == '_' || ch == '-'));

static void ValidateFieldContracts(WorkspaceProjection workspace)
{
    foreach (var card in workspace.Cards)
    {
        foreach (var field in card.Fields.Business)
        {
            var label = field.Label["zh-CN"];
            if (new[] { "房间号", "床位号", "凭证编号", "付款人", "姓名", "电话" }.Contains(label))
            {
                Assert(field.Type != "searchSelect", $"{workspace.Id}.{card.Id}.{label} creates or records data and must not be searchSelect");
                Assert(field.Ui.Control != "searchSelect", $"{workspace.Id}.{card.Id}.{label} must not render as searchSelect");
                Assert(field.Source == "userInput", $"{workspace.Id}.{card.Id}.{label} must come from userInput");
            }

            if (field.Type == "readonly" || field.Ui.Readonly)
            {
                Assert(field.Source is "system" or "projection", $"{workspace.Id}.{card.Id}.{label} readonly field must declare system or projection source");
                Assert(field.Ui.Control == "readonly", $"{workspace.Id}.{card.Id}.{label} readonly field must render with readonly control");
            }

            if (IsDateLabel(label))
            {
                Assert(field.Type == "dateTime", $"{workspace.Id}.{card.Id}.{label} must use dateTime type");
                Assert(field.Ui.Control is "dateTime" or "dateTimeRange", $"{workspace.Id}.{card.Id}.{label} must render with date/time control");
            }

            if (field.Ui.Control == "select")
            {
                Assert(!string.IsNullOrWhiteSpace(field.Ui.OptionSet), $"{workspace.Id}.{card.Id}.{label} select must declare optionSet");
                Assert(field.Ui.Options.Count > 0, $"{workspace.Id}.{card.Id}.{label} select must include options");
            }
        }
    }

    var room = workspace.Cards.FirstOrDefault(card => card.Id == "roomSetup");
    if (room is not null)
    {
        Assert(Field(room, "房间号").Ui.Control == "text", "房间号 must be text on room creation");
        Assert(Field(room, "床位数").Ui.Control == "number", "床位数 must be numeric on room setup");
    }

    var bed = workspace.Cards.FirstOrDefault(card => card.Id == "bedSetup");
    if (bed is not null)
    {
        Assert(Field(bed, "所属房间").Ui.Control == "searchSelect", "所属房间 must select an existing room");
        Assert(Field(bed, "床位号").Ui.Control == "text", "床位号 must be text on bed creation");
    }
}

static void ValidateAccommodationWorkOS20Contracts(ProjectionEnvelope projection)
{
    var expected = new Dictionary<string, string[]>
    {
        ["W-STAY-RESOURCE"] = new[] { "roomSetup", "bedSetup", "rateSetup", "roomReadiness", "roomBlock", "roomRelease" },
        ["W-STAY-LEAD-RESERVATION"] = new[] { "leadCapture", "leadFollowUp", "reservationCreate", "reservationCancel", "reservationConvert" },
        ["W-STAY-LIFECYCLE"] = new[] { "residentProfile", "checkInBedAssign", "chargeAssessment", "stayExtension" },
        ["W-STAY-DEPOSIT-LEDGER"] = new[] { "depositAssessment", "depositReceipt", "depositConfirmation", "depositDeduction", "depositRefundApproval", "depositRefundPayment", "depositClose" },
        ["W-STAY-PAYMENT-LEDGER"] = new[] { "paymentReceipt", "paymentConfirmation", "paymentAllocation", "paymentAdjustment", "debtFollowUp" },
        ["W-STAY-CHECKOUT-SETTLEMENT"] = new[] { "checkoutStart", "roomInspection", "depositSettlement", "finalBalanceClose", "bedRelease", "postCheckoutCleaning" },
        ["W-STAY-SERVICE-TASK"] = new[] { "serviceTaskCreate", "serviceTaskAssign", "serviceTaskComplete", "serviceTaskVerify", "roomReleaseAfterService" },
        ["W-STAY-EXPENSE-LEDGER"] = new[] { "expenseRecord", "expenseApproval", "expenseLink" },
        ["W-STAY-PERIOD-ANALYTICS"] = new[] { "periodScope", "periodMetricsReview", "periodFinanceReview", "periodOperationsDiagnosis", "periodActionPlan", "periodActionPlanComplete", "periodClose" }
    };

    foreach (var (workspaceId, cardIds) in expected)
    {
        var workspace = projection.Workspaces.Single(item => item.Id == workspaceId);
        AssertSequence(workspace, cardIds);
        ValidateFieldContracts(workspace);
        foreach (var card in workspace.Cards)
        {
            Assert(card.BlockerRules.Count > 0, $"{workspaceId}.{card.Id} must declare blocker rules");
            Assert(card.Confirmation.ForbiddenForAi, $"{workspaceId}.{card.Id} must forbid AI confirmation");
            foreach (var field in card.Fields.Business)
            {
                if (field.Ui.Control == "select")
                {
                    Assert(!string.IsNullOrWhiteSpace(field.Ui.OptionSet), $"{workspaceId}.{card.Id}.{field.Id} select must bind optionSet");
                    Assert(field.Ui.Options.Count > 0, $"{workspaceId}.{card.Id}.{field.Id} select must expose options");
                }

                if (field.Ui.Readonly || field.Type == "readonly")
                {
                    Assert(field.Source is "system" or "projection", $"{workspaceId}.{card.Id}.{field.Id} readonly source must be system/projection");
                }
            }
        }
    }

    AssertEventTypes(projection, "W-STAY-DEPOSIT-LEDGER",
        "Accommodation.DepositAssessed",
        "Accommodation.DepositReceived",
        "Accommodation.DepositEvidenceSubmitted",
        "Accommodation.DepositConfirmed",
        "Accommodation.DepositRejected",
        "Accommodation.DepositDeducted",
        "Accommodation.DepositAppliedToBalance",
        "Accommodation.DepositRefundApproved",
        "Accommodation.DepositRefundPaid",
        "Accommodation.DepositClosed");
    AssertEventTypes(projection, "W-STAY-PAYMENT-LEDGER",
        "Accommodation.PaymentReceived",
        "Accommodation.PaymentEvidenceSubmitted",
        "Accommodation.PaymentConfirmed",
        "Accommodation.PaymentRejected",
        "Accommodation.PaymentAllocated",
        "Accommodation.PaymentAdjusted",
        "Accommodation.DebtFollowUpRecorded",
        "Accommodation.BalanceRecalculated");
    AssertEventTypes(projection, "W-STAY-RESOURCE",
        "Accommodation.RoomConfigured",
        "Accommodation.BedConfigured",
        "Accommodation.RateConfigured",
        "Accommodation.RoomReadinessChanged",
        "Accommodation.RoomBlocked",
        "Accommodation.RoomReleased",
        "Accommodation.BedBlocked",
        "Accommodation.BedReleased");

    var periodFinance = projection.Workspaces.Single(item => item.Id == "W-STAY-PERIOD-ANALYTICS").Cards.Single(card => card.Id == "periodFinanceReview");
    Assert(periodFinance.Checks.Any(check => check.Label["zh-CN"].Contains("押金不计收入")), "period finance contract must guard deposit revenue separation");
    Assert(periodFinance.Checks.Any(check => check.Label["zh-CN"].Contains("押金退款不计支出")), "period finance contract must guard deposit refund expense separation");
    Assert(periodFinance.BlockerRules.Any(rule => rule.Id.Contains("cannot_count_deposit_received_as_revenue")), "period finance blockers must prevent deposit as revenue");
    Assert(periodFinance.BlockerRules.Any(rule => rule.Id.Contains("cannot_count_deposit_refund_as_expense")), "period finance blockers must prevent deposit refund as expense");

    var depositRefundApproval = projection.Workspaces.Single(item => item.Id == "W-STAY-DEPOSIT-LEDGER").Cards.Single(card => card.Id == "depositRefundApproval");
    var depositRefundPayment = projection.Workspaces.Single(item => item.Id == "W-STAY-DEPOSIT-LEDGER").Cards.Single(card => card.Id == "depositRefundPayment");
    Assert(depositRefundApproval.Events.Any(item => item.EventType == "Accommodation.DepositRefundApproved"), "deposit refund approval card must emit only approval");
    Assert(!depositRefundApproval.Events.Any(item => item.EventType == "Accommodation.DepositRefundPaid"), "deposit refund approval card must not emit payment");
    Assert(depositRefundPayment.Events.Any(item => item.EventType == "Accommodation.DepositRefundPaid"), "deposit refund payment card must emit payment");
    Assert(!depositRefundPayment.Events.Any(item => item.EventType == "Accommodation.DepositRefundApproved"), "deposit refund payment card must not emit approval");
    Assert(depositRefundApproval.Checks.Any(check => check.Label["zh-CN"].Contains("不超过持有押金")), "deposit refund contract must guard held amount");
    Assert(depositRefundApproval.BlockerRules.Any(rule => rule.Id.Contains("cannot_refund_more_than_held_deposit")), "deposit refund blocker must prevent over-refund");

    var paymentAllocation = projection.Workspaces.Single(item => item.Id == "W-STAY-PAYMENT-LEDGER").Cards.Single(card => card.Id == "paymentAllocation");
    Assert(paymentAllocation.Checks.Any(check => check.Label["zh-CN"].Contains("不超过确认金额")), "payment allocation contract must guard confirmed amount");
    Assert(paymentAllocation.BlockerRules.Any(rule => rule.Id.Contains("cannot_allocate_payment_more_than_confirmed_amount")), "payment allocation blocker must prevent over-allocation");

    var periodClose = projection.Workspaces.Single(item => item.Id == "W-STAY-PERIOD-ANALYTICS").Cards.Single(card => card.Id == "periodClose");
    foreach (var blocker in new[] { "cannot_close_period_without_metrics_review", "cannot_close_period_without_finance_review", "cannot_close_period_with_blocking_finance_exceptions" })
    {
        Assert(periodClose.BlockerRules.Any(rule => rule.Id.Contains(blocker)), $"period close blocker missing {blocker}");
    }

    var checkoutSettlement = projection.Workspaces.Single(item => item.Id == "W-STAY-CHECKOUT-SETTLEMENT");
    AssertEventTypes(projection, "W-STAY-CHECKOUT-SETTLEMENT", "Accommodation.DepositSettlementRequested");
    Assert(!checkoutSettlement.Cards.SelectMany(card => card.Events).Any(item => item.EventType == "Accommodation.DepositSettledForCheckout"), "checkout settlement must not emit actual deposit settlement transactions");

    var serviceTask = projection.Workspaces.Single(item => item.Id == "W-STAY-SERVICE-TASK");
    var serviceTaskComplete = serviceTask.Cards.Single(card => card.Id == "serviceTaskComplete");
    Assert(!serviceTaskComplete.Fields.Business.Any(field => field.Label["zh-CN"] == "完成后释放房间"), "serviceTaskComplete must not release room directly");
    var roomReleaseAfterService = serviceTask.Cards.Single(card => card.Id == "roomReleaseAfterService");
    Assert(roomReleaseAfterService.Checks.Any(check => check.Label["zh-CN"].Contains("服务任务已验收")), "roomReleaseAfterService must require ServiceTaskVerified first");
    Assert(roomReleaseAfterService.Events.All(item => item.EventType.EndsWith("Requested", StringComparison.Ordinal)), "service task release card must request resource release, not mutate bed status");
}

static void ValidateAccommodationFactOwnership()
{
    var expected = new Dictionary<string, string>
    {
        ["Deposit"] = "Accommodation.DepositLedger",
        ["Payment"] = "Accommodation.PaymentLedger",
        ["StayBalance"] = "Accommodation.PaymentLedger",
        ["BedStatus"] = "Accommodation.ResourceSetup",
        ["Expense"] = "Accommodation.ExpenseLedger",
        ["PeriodSnapshot"] = "Accommodation.PeriodAnalytics"
    };

    foreach (var (fact, owner) in expected)
    {
        Assert(AccommodationFactOwnershipCatalog.OwnerOf(fact) == owner, $"{fact} owner slice must be {owner}");
        Assert(AccommodationFactOwnershipCatalog.IsOwner(fact, owner), $"{owner} must own {fact}");
    }

    Assert(!AccommodationFactOwnershipCatalog.IsOwner("Deposit", "Accommodation.CheckOutSettlement"), "checkout settlement must not own Deposit facts");
    Assert(!AccommodationFactOwnershipCatalog.IsOwner("Payment", "Accommodation.DepositLedger"), "deposit ledger must not own Payment facts");
    Assert(!AccommodationFactOwnershipCatalog.IsOwner("BedStatus", "Accommodation.ServiceTask"), "service task must not own BedStatus facts");
}

static void ValidatePeriodAnalyticsContract()
{
    using var contract = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "period-analytics-contract.json")));
    var root = contract.RootElement;
    Assert(root.GetProperty("sliceId").GetString() == "Accommodation.PeriodAnalytics", "period analytics contract must belong to PeriodAnalytics slice");
    Assert(root.GetProperty("zeroDenominator").GetProperty("status").GetString() == "not_applicable", "zero denominator behavior must be explicit");
    Assert(root.GetProperty("snapshotPolicy").GetProperty("snapshotType").GetString() == "frozen-period-snapshot", "period snapshot must be frozen");
    Assert(root.GetProperty("snapshotPolicy").GetProperty("lateAdjustmentPolicy").GetString() == "append-adjustment-event", "late adjustments must append events");
    Assert(root.GetProperty("snapshotPolicy").GetProperty("lateAdjustmentEvents").EnumerateArray().Any(item => item.GetString() == "Accommodation.PeriodActionPlanCompleted"), "period completed adjustments must be append-only events");

    var formulas = root.GetProperty("formulas").EnumerateArray().ToArray();
    foreach (var formula in new[] { "averageOccupancyRate", "leadToReservationRate", "reservationToCheckInRate", "periodNetCashFlow", "depositLiabilityEnd" })
    {
        Assert(formulas.Any(item => item.GetProperty("id").GetString() == formula), $"period analytics formula missing {formula}");
    }

    var netCashFlow = formulas.Single(item => item.GetProperty("id").GetString() == "periodNetCashFlow");
    var excluded = netCashFlow.GetProperty("excludes").EnumerateArray().Select(item => item.GetString()).ToHashSet();
    Assert(excluded.Contains("depositReceivedAmount"), "period net cash flow must exclude deposit received");
    Assert(excluded.Contains("depositRefundedAmount"), "period net cash flow must exclude deposit refunds");
}

static void ValidateStableOptionValues(ProjectionEnvelope projection)
{
    foreach (var field in projection.Workspaces.SelectMany(workspace => workspace.Cards).SelectMany(card => card.Fields.Business))
    {
        foreach (var option in field.Ui.Options)
        {
            Assert(!string.IsNullOrWhiteSpace(option.Value), $"{field.Id} option value must be stable and non-empty");
            Assert(!option.Value.Any(ch => ch >= 0x4e00 && ch <= 0x9fff), $"{field.Id} option value must be a stable enum key, got {option.Value}");
        }
    }

    var roomSetup = projection.Workspaces.Single(item => item.Id == "W-STAY-RESOURCE").Cards.Single(item => item.Id == "roomSetup");
    Assert(Field(roomSetup, "房间号").Id == "roomNo", "room setup must expose canonical roomNo field id");
    Assert(Field(roomSetup, "房型").Ui.Options.Any(item => item.Value == "four_bed" && item.Label["zh-CN"] == "四人间"), "roomType option must use stable enum value and localized label");
    var derivedFields = projection.Workspaces
        .SelectMany(workspace => workspace.Cards)
        .SelectMany(card => card.Fields.Business)
        .Where(field => !string.IsNullOrWhiteSpace(field.Ui.DerivedFrom))
        .ToArray();
    Assert(derivedFields.Length > 0, "projection should include derived field contracts");
    Assert(derivedFields.All(field => IsStableFactKey(field.Ui.DerivedFrom)), "derived fields must reference canonical field ids, not localized labels");
}

static void ValidateRuntimeSurfaceLenses(ProjectionRuntime runtime)
{
    var queueJson = JsonSerializer.Serialize(runtime.GetWorkQueue());
    Assert(queueJson.Contains("workspaceId", StringComparison.Ordinal), "work queue items must include workspaceId");
    Assert(queueJson.Contains("cardId", StringComparison.Ordinal), "work queue items must include cardId");
    Assert(queueJson.Contains("W-STAY-PAYMENT-LEDGER", StringComparison.Ordinal), "work queue must expose current PaymentLedger workspace");

    var searchJson = JsonSerializer.Serialize(runtime.Search("押金"));
    var depositIndex = searchJson.IndexOf("W-STAY-DEPOSIT-LEDGER", StringComparison.Ordinal);
    var checkinIndex = searchJson.IndexOf("W-STAY-CHECKIN", StringComparison.Ordinal);
    Assert(depositIndex >= 0, "search must expose current DepositLedger workspace for deposit intent");
    Assert(checkinIndex < 0 || depositIndex < checkinIndex, "search must rank DepositLedger before legacy CheckIn for deposit intent");

    var homeJson = JsonSerializer.Serialize(runtime.GetHomeSurface());
    Assert(homeJson.Contains("W-STAY-DEPOSIT-LEDGER", StringComparison.Ordinal), "home surface must expose DepositLedger");
    Assert(homeJson.Contains("W-STAY-PERIOD-ANALYTICS", StringComparison.Ordinal), "home surface must expose PeriodAnalytics");

    var learningJson = JsonSerializer.Serialize(runtime.GetLearningCatalog());
    Assert(learningJson.Contains("W-STAY-DEPOSIT-LEDGER", StringComparison.Ordinal), "learning catalog must expose DepositLedger");
    Assert(learningJson.Contains("depositReceipt", StringComparison.Ordinal), "learning catalog must expose card ids");

    ValidateManifestDrivenSurfaceCoverage(runtime);
}

static void ValidateManifestDrivenSurfaceCoverage(ProjectionRuntime runtime)
{
    using var manifest = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "slice-manifest.json")));
    var slices = manifest.RootElement.GetProperty("slices").EnumerateArray().ToArray();
    var projection = runtime.GetAll();
    var homeJson = JsonSerializer.Serialize(runtime.GetHomeSurface());
    var queueJson = JsonSerializer.Serialize(runtime.GetWorkQueue());
    var learningJson = JsonSerializer.Serialize(runtime.GetLearningCatalog());

    foreach (var slice in slices)
    {
        var workspaceId = slice.GetProperty("workspaceId").GetString()!;
        var cards = slice.GetProperty("cards").EnumerateArray().Select(item => item.GetString()).Where(item => item is not null).ToArray();
        var workspace = projection.Workspaces.SingleOrDefault(item => item.Id == workspaceId);
        Assert(workspace is not null, $"surface coverage slice references missing workspace {workspaceId}");
        Assert(homeJson.Contains(workspaceId, StringComparison.Ordinal), $"home surface must include {workspaceId}");
        Assert(queueJson.Contains(workspaceId, StringComparison.Ordinal), $"work queue surface must include {workspaceId}");
        Assert(learningJson.Contains(workspaceId, StringComparison.Ordinal), $"learning catalog must include {workspaceId}");
        Assert(JsonSerializer.Serialize(runtime.Search(workspaceId)).Contains(workspaceId, StringComparison.Ordinal), $"search surface must find {workspaceId}");

        foreach (var cardId in cards)
        {
            Assert(workspace!.Cards.Any(card => card.Id == cardId), $"workspace surface must open {workspaceId}/{cardId}");
        }
    }
}

static void ValidateAllContractOnlySlicesAreGated(
    ProjectionRuntime runtime,
    string connectionString,
    ProjectionEnvelope projection,
    string managerToken)
{
    using var manifest = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "slice-manifest.json")));
    var contractOnlySlices = manifest.RootElement
        .GetProperty("slices")
        .EnumerateArray()
        .Where(slice => slice.GetProperty("status").GetString() == "contract-only")
        .ToArray();

    Assert(contractOnlySlices.Length > 0, "at least one contract-only slice must remain covered by the status gate tests");
    foreach (var slice in contractOnlySlices)
    {
        var sliceId = slice.GetProperty("id").GetString()!;
        var workspaceId = slice.GetProperty("workspaceId").GetString()!;
        var cardId = slice.GetProperty("cards").EnumerateArray().First().GetString()!;
        Assert(projection.Workspaces.Any(workspace => workspace.Id == workspaceId), $"contract-only slice {sliceId} must reference an existing workspace");
        Assert(runtime.Prepare(workspaceId, cardId) is not null, $"contract-only slice {sliceId} should allow prepare");
        var result = AssertNoSideEffects(connectionString, () => runtime.Confirm(workspaceId, cardId, Human($"contract-only-{workspaceId}-{cardId}"), managerToken));
        Assert(result.Status == ConfirmStatus.Forbidden, $"contract-only slice {sliceId} must forbid confirm");
        Assert(result.Reason == $"slice_runtime_forbidden:{sliceId}:contract-only", $"contract-only slice {sliceId} rejection must name status and owner");
    }
}

static void AssertEventTypes(ProjectionEnvelope projection, string workspaceId, params string[] expected)
{
    var workspace = projection.Workspaces.Single(item => item.Id == workspaceId);
    var actual = workspace.Cards.SelectMany(card => card.Events).Select(item => item.EventType).ToHashSet();
    foreach (var eventType in expected)
    {
        Assert(actual.Contains(eventType), $"{workspaceId} missing event contract {eventType}");
    }
}

static bool IsDateLabel(string label) =>
    label.Contains("日期") ||
    label.Contains("时间") ||
    new[] { "预计入住/退房", "入住周期" }.Contains(label);

static FieldProjection Field(CardProjection card, string zhLabel) =>
    card.Fields.Business.Single(field => field.Label["zh-CN"] == zhLabel);

static ConfirmCardRequest Human(string idempotencyKey, IReadOnlyDictionary<string, string>? fieldValues = null)
{
    AssertCanonicalFieldKeys(fieldValues);
    return new(
        "zh-CN",
        idempotencyKey,
        fieldValues ?? new Dictionary<string, string>(),
        Array.Empty<string>(),
        $"submission-{idempotencyKey}",
        $"card-instance-{idempotencyKey}",
        AggregateRefFrom(fieldValues));
}

static ConfirmCardRequest HumanWithEvidence(string idempotencyKey, IReadOnlyDictionary<string, string> fieldValues, params string[] evidenceIds)
{
    AssertCanonicalFieldKeys(fieldValues);
    return new(
        "zh-CN",
        idempotencyKey,
        fieldValues,
        evidenceIds,
        $"submission-{idempotencyKey}",
        $"card-instance-{idempotencyKey}",
        AggregateRefFrom(fieldValues));
}

static string EvidenceFor(ProjectionRuntime runtime, ConfirmCardRequest request, string workspaceId, string cardId, string? requirementId = null)
{
    requirementId ??= runtime.FindWorkspace(workspaceId)
        ?.Cards.Single(card => card.Id == cardId)
        .Evidence.First().Id ?? throw new InvalidOperationException($"missing evidence requirement for {workspaceId}.{cardId}");
    var draft = runtime.CreateEvidenceDraft(new EvidenceDraftRequest(
        workspaceId,
        cardId,
        request.CardInstanceId ?? throw new InvalidOperationException("test request missing cardInstanceId"),
        request.SubmissionId ?? throw new InvalidOperationException("test request missing submissionId"),
        requirementId), "operator");
    var attached = runtime.AttachEvidence(draft.EvidenceId, new EvidenceAttachmentRequest(
        $"{requirementId}.txt",
        "text/plain",
        "sha256-test-proof",
        12), "operator");
    Assert(attached.Attachments.Count > 0, "valid evidence object must have an attachment");
    return attached.EvidenceId;
}

static void AssertCanonicalFieldKeys(IReadOnlyDictionary<string, string>? fieldValues)
{
    if (fieldValues is null)
    {
        return;
    }

    foreach (var key in fieldValues.Keys)
    {
        Assert(!key.Any(IsCjkCharacter), $"Runtime contract tests must submit canonical field ids, not localized label key '{key}'");
    }
}

static bool IsCjkCharacter(char value) =>
    value is >= '\u3400' and <= '\u9fff';

static string? AggregateRefFrom(IReadOnlyDictionary<string, string>? fieldValues)
{
    if (fieldValues is null)
    {
        return null;
    }

    foreach (var key in new[] { "roomId", "bedId", "stayId", "depositId", "depositReceiptId", "paymentId", "paymentReceiptId", "leadId", "reservationId", "serviceTaskId", "expenseId", "periodId", "settlementId" })
    {
        if (fieldValues.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
        {
            return $"{key}:{value}";
        }
    }

    return null;
}

static ConfirmResult AssertNoSideEffects(string connectionString, Func<ConfirmResult> action)
{
    var auditBefore = CountRows(connectionString, "audit_events");
    var outboxBefore = CountRows(connectionString, "outbox_messages");
    var aggregateBefore = TotalAggregateRows(connectionString);
    var result = action();
    Assert(CountRows(connectionString, "audit_events") == auditBefore, $"{result.Status} confirm must not append AuditEvent");
    Assert(CountRows(connectionString, "outbox_messages") == outboxBefore, $"{result.Status} confirm must not append OutboxMessage");
    Assert(TotalAggregateRows(connectionString) == aggregateBefore, $"{result.Status} confirm must not write aggregate tables");
    return result;
}

static void ValidateProjectionContractFiles()
{
    using var projectionSchema = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "projection-contract.schema.json")));
    var required = projectionSchema.RootElement.GetProperty("required").EnumerateArray().Select(item => item.GetString()).ToHashSet();
    foreach (var field in new[] { "projection", "version", "languages", "sourceOfTruth", "workspaces", "events" })
    {
        Assert(required.Contains(field), $"projection schema must require {field}");
    }

    var eventRequired = projectionSchema.RootElement
        .GetProperty("$defs")
        .GetProperty("workspaceEvent")
        .GetProperty("required")
        .EnumerateArray()
        .Select(item => item.GetString())
        .ToHashSet();
    foreach (var field in new[] { "correlationId", "causationId", "requestId" })
    {
        Assert(eventRequired.Contains(field), $"projection schema workspaceEvent must require {field}");
    }

    using var openApi = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "workos-runtime.openapi.json")));
    var confirm = openApi.RootElement
        .GetProperty("paths")
        .GetProperty("/api/workspaces/{workspaceId}/cards/{cardId}/confirm")
        .GetProperty("post");

    var hasActorHeader = confirm.GetProperty("parameters").EnumerateArray().Any(item =>
        item.GetProperty("name").GetString() == "X-WorkOS-Actor-Token" &&
        item.GetProperty("in").GetString() == "header" &&
        item.GetProperty("required").GetBoolean());
    Assert(hasActorHeader, "OpenAPI confirm must require X-WorkOS-Actor-Token");

    var confirmRequired = openApi.RootElement
        .GetProperty("components")
        .GetProperty("schemas")
        .GetProperty("ConfirmCardRequest")
        .GetProperty("required")
        .EnumerateArray()
        .Select(item => item.GetString())
        .ToHashSet();
    foreach (var field in new[] { "language", "idempotencyKey", "submissionId", "cardInstanceId", "fieldValues", "evidenceIds" })
    {
        Assert(confirmRequired.Contains(field), $"OpenAPI ConfirmCardRequest must require {field}");
    }
    foreach (var statusCode in new[] { "200", "400", "401", "403", "409", "422", "404", "500" })
    {
        Assert(confirm.GetProperty("responses").TryGetProperty(statusCode, out _), $"OpenAPI confirm must document HTTP {statusCode}");
    }

    var observationRequired = openApi.RootElement
        .GetProperty("components")
        .GetProperty("schemas")
        .GetProperty("RuntimeObservation")
        .GetProperty("required")
        .EnumerateArray()
        .Select(item => item.GetString())
        .ToHashSet();
    Assert(observationRequired.Contains("deadLetterOutboxCount"), "OpenAPI RuntimeObservation must expose deadLetterOutboxCount");

    var behaviorEventRequest = openApi.RootElement
        .GetProperty("components")
        .GetProperty("schemas")
        .GetProperty("BehaviorEventRequest");
    var behaviorRequired = behaviorEventRequest.GetProperty("required").EnumerateArray().Select(item => item.GetString()).ToHashSet();
    Assert(behaviorRequired.SetEquals(new[] { "eventType", "language" }), "OpenAPI BehaviorEventRequest required fields must match Program.cs");
    var behaviorProperties = behaviorEventRequest.GetProperty("properties").EnumerateObject().Select(item => item.Name).ToHashSet();
    foreach (var field in new[] { "eventType", "objectType", "objectId", "language", "source" })
    {
        Assert(behaviorProperties.Contains(field), $"OpenAPI BehaviorEventRequest missing {field}");
    }
    foreach (var staleField in new[] { "workspaceId", "cardId", "actorId", "payload" })
    {
        Assert(!behaviorProperties.Contains(staleField), $"OpenAPI BehaviorEventRequest contains stale field {staleField}");
    }

    Assert(openApi.RootElement.GetProperty("paths").TryGetProperty("/api/observability/runtime", out _), "OpenAPI must include runtime observability endpoint");
    Assert(openApi.RootElement.GetProperty("paths").TryGetProperty("/api/lenses/accommodation/{lensId}", out _), "OpenAPI must include accommodation aggregate lens endpoint");

    using var policyContract = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "policy-contract.json")));
    var decisionCodes = policyContract.RootElement.GetProperty("decisionCodes").EnumerateArray().Select(item => item.GetString()).ToHashSet();
    foreach (var code in new[] { "allowed", "ai_confirmation_forbidden", "role_confirmation_forbidden", "invalid_actor_token" })
    {
        Assert(decisionCodes.Contains(code), $"policy contract must include decision code {code}");
    }

    foreach (var code in new[]
    {
        "business_rule_violation",
        "missing_required_field",
        "idempotency_duplicate",
        "idempotency_conflict",
        "slice_runtime_forbidden",
        "deposit_evidence_required",
        "deposit_ledger_state_required",
        "deposit_refund_exceeds_held_amount",
        "deposit_refund_approval_required",
        "payment_evidence_required",
        "payment_ledger_state_required",
        "payment_allocation_exceeds_confirmed_amount",
        "payment_deposit_purpose_forbidden",
        "checkout_deposit_settlement_required",
        "checkout_start_required_before_bed_release",
        "service_task_verification_required_before_release",
        "expense_evidence_required",
        "period_deposit_revenue_forbidden",
        "period_deposit_refund_expense_forbidden",
        "period_close_requires_metrics_review",
        "period_close_requires_finance_review",
        "period_close_requires_operations_diagnosis",
        "period_close_requires_action_plan_for_high_risk"
    })
    {
        Assert(decisionCodes.Contains(code), $"policy contract must include runtime decision code {code}");
    }
}

static void ValidateGeneratedDtos()
{
    var generated = File.ReadAllText(Path.Combine("apps", "mobile", "src", "generated", "workosContracts.d.ts"));
    foreach (var typeName in new[] { "ProjectionEnvelope", "WorkspaceProjection", "CardProjection", "ConfirmCardRequest", "RuntimeObservation" })
    {
        Assert(generated.Contains($"export type {typeName}"), $"generated DTOs must include {typeName}");
    }
    Assert(generated.Contains("correlationId: string"), "generated DTOs must include WorkspaceEvent correlationId");
    Assert(generated.Contains("submissionId: string"), "generated DTOs must include ConfirmCardRequest submissionId");
    Assert(generated.Contains("cardInstanceId: string"), "generated DTOs must include ConfirmCardRequest cardInstanceId");
    var runtimeApiPathsPath = Path.Combine("apps", "mobile", "src", "generated", "runtimeApiPaths.js");
    Assert(File.Exists(runtimeApiPathsPath), "generated runtime API paths module must exist");
    var runtimeApiPaths = File.ReadAllText(runtimeApiPathsPath);
    foreach (var apiPathKey in new[] { "health", "login", "workspaces", "workspace", "bootstrap", "workQueue", "search", "lensWorkQueue", "lensSearch", "homeSurface", "learningCatalog", "accommodationLens", "prepareCard", "confirmCard", "workspaceEvents", "auditEvents", "outbox", "processOutbox", "behaviorEvents", "observability" })
    {
        Assert(runtimeApiPaths.Contains($"{apiPathKey}:"), $"generated runtime API paths must include {apiPathKey}");
    }
}

static void ValidateSliceManifest(ProjectionEnvelope projection)
{
    using var manifest = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "slice-manifest.json")));
    var slices = manifest.RootElement.GetProperty("slices").EnumerateArray().ToArray();
    foreach (var slice in slices)
    {
        var required = slice.GetProperty("id").GetString()!;
        var workspaceId = slice.GetProperty("workspaceId").GetString();
        var workspace = projection.Workspaces.FirstOrDefault(item => item.Id == workspaceId);
        Assert(workspace is not null, $"slice {required} references missing workspace {workspaceId}");
        Assert(slice.GetProperty("cards").GetArrayLength() > 0, $"slice {required} must own cards");
        Assert(slice.GetProperty("events").GetArrayLength() > 0, $"slice {required} must own events");
        Assert(slice.GetProperty("ownsAggregates").GetArrayLength() > 0, $"slice {required} must declare aggregate ownership");
        Assert(new[] { "contract-only", "runtime-skeleton", "production-slice" }.Contains(slice.GetProperty("status").GetString()), $"slice {required} must declare a supported runtime status");
        if (slice.GetProperty("status").GetString() == "runtime-skeleton")
        {
            var policyPath = Path.Combine("services", "core-api", "WorkOS.Api", "Slices", Path.Combine(required.Split('.')), "Policies", $"{required.Split('.').Last()}Policy.cs");
            Assert(File.Exists(policyPath), $"runtime-skeleton slice {required} must have an explicit skeleton policy");
        }

        foreach (var cardId in slice.GetProperty("cards").EnumerateArray().Select(item => item.GetString()))
        {
            Assert(workspace!.Cards.Any(card => card.Id == cardId), $"slice {required} card {cardId} missing from projection workspace {workspaceId}");
        }
    }
}

static void ValidateProjectionEnvelopeAgainstContract(ProjectionEnvelope projection)
{
    Assert(projection.Projection == "IntentWorkspaceProjection", "projection envelope type must match contract");
    Assert(!string.IsNullOrWhiteSpace(projection.Version), "projection envelope missing version");
    Assert(projection.Languages.Contains("zh-CN") && projection.Languages.Contains("ru-RU"), "projection languages must include zh-CN and ru-RU");
    Assert(!string.IsNullOrWhiteSpace(projection.SourceOfTruth), "projection sourceOfTruth missing");
    Assert(projection.Workspaces.Count > 0, "projection workspaces missing");

    foreach (var workspace in projection.Workspaces)
    {
        Assert(workspace.ProjectionType == "IntentWorkspaceProjection", $"{workspace.Id} projectionType mismatch");
        AssertLocalized(workspace.Title, $"{workspace.Id} title");
        AssertLocalized(workspace.Summary, $"{workspace.Id} summary");
        Assert(workspace.Cards.Count > 0, $"{workspace.Id} cards missing");
        foreach (var card in workspace.Cards)
        {
            Assert(card.ProjectionType == "WorkspaceCardProjection", $"{card.Id} projectionType mismatch");
            AssertLocalized(card.Title, $"{card.Id} title");
            Assert(new[] { "notStarted", "ready", "blocked", "inProgress", "done" }.Contains(card.Status), $"{card.Id} status invalid");
            Assert(card.Fields.System.Count > 0 && card.Fields.Business.Count > 0 && card.Fields.Analytics.Count > 0, $"{card.Id} fields incomplete");
            foreach (var field in card.Fields.Business)
            {
                AssertLocalized(field.Label, $"{card.Id}.{field.Id} field label");
                AssertLocalized(field.Help, $"{card.Id}.{field.Id} field help");
                Assert(!string.IsNullOrWhiteSpace(field.Ui.Control), $"{card.Id}.{field.Id} missing ui control");
                if (field.Ui.Control is "select" or "searchSelect")
                {
                    Assert(field.Ui.Options.Count > 0, $"{card.Id}.{field.Id} selectable field missing contract options");
                    Assert(field.Ui.Options.All(option => !string.IsNullOrWhiteSpace(option.Value)), $"{card.Id}.{field.Id} option missing value");
                    foreach (var option in field.Ui.Options)
                    {
                        AssertLocalized(option.Label, $"{card.Id}.{field.Id} option {option.Value}");
                    }
                }
            }
            Assert(card.Evidence.Count > 0, $"{card.Id} evidence missing");
            Assert(card.Checks.Count > 0, $"{card.Id} checks missing");
            Assert(card.Events.Count > 0, $"{card.Id} events missing");
            Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnPrepare), $"{card.Id} onPrepare missing");
            Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnConfirm), $"{card.Id} onConfirm missing");
            Assert(!string.IsNullOrWhiteSpace(card.Confirmation.RequiredRole), $"{card.Id} confirmation requiredRole missing");
            AssertLocalized(card.Confirmation.Label, $"{card.Id} confirmation label");
        }
    }
}

static void AssertLocalized(IReadOnlyDictionary<string, string> value, string label)
{
    Assert(value.TryGetValue("zh-CN", out var zh) && !string.IsNullOrWhiteSpace(zh), $"{label} missing zh-CN");
    Assert(value.TryGetValue("ru-RU", out var ru) && !string.IsNullOrWhiteSpace(ru), $"{label} missing ru-RU");
}

static string LoginToken(ProjectionRuntime runtime, string username)
{
    var login = runtime.Login(new LoginRequest(username, "dev"));
    if (login is null)
    {
        throw new InvalidOperationException($"login should succeed for {username}");
    }

    var token = login.GetType().GetProperty("token")?.GetValue(login)?.ToString();
    Assert(!string.IsNullOrWhiteSpace(token), $"login token should be issued for {username}");
    return token!;
}

static void AssertConfirmPayloadProjected(ConfirmResult result, string workspaceId, string cardId)
{
    using var payload = ConfirmPayloadJson(result);
    var root = payload.RootElement;
    var eventIds = root.GetProperty("events")
        .EnumerateArray()
        .Select(item => item.GetProperty("eventId").GetString())
        .Where(item => !string.IsNullOrWhiteSpace(item))
        .ToArray();
    var projectedIds = root.GetProperty("projection")
        .GetProperty("events")
        .EnumerateArray()
        .Select(item => item.GetProperty("eventId").GetString())
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    Assert(eventIds.Length > 0, "confirm payload must include committed events");
    Assert(eventIds.All(projectedIds.Contains), "confirm payload projection must already contain every committed event");

    var workspace = root.GetProperty("projection")
        .GetProperty("workspaces")
        .EnumerateArray()
        .Single(item => item.GetProperty("id").GetString() == workspaceId);
    var card = workspace.GetProperty("cards")
        .EnumerateArray()
        .Single(item => item.GetProperty("id").GetString() == cardId);
    Assert(card.GetProperty("status").GetString() == "done", "confirm payload projection must include the projected card status");
}

static void AssertOutboxProcessedForPayload(string connectionString, ConfirmResult result)
{
    using var payload = ConfirmPayloadJson(result);
    var eventIds = payload.RootElement.GetProperty("events")
        .EnumerateArray()
        .Select(item => item.GetProperty("eventId").GetString())
        .Where(item => !string.IsNullOrWhiteSpace(item))
        .ToArray();

    foreach (var eventId in eventIds)
    {
        var processed = ScalarText(connectionString, $"select coalesce(bool_or(processed_at_utc is not null), false)::text from outbox_messages where event_id = '{eventId}'");
        Assert(processed == "True" || processed == "true", $"outbox message for {eventId} must be processed before confirm returns");
    }
}

static JsonDocument ConfirmPayloadJson(ConfirmResult result)
{
    Assert(result.Payload is not null, "confirm payload must not be null");
    return JsonDocument.Parse(JsonSerializer.Serialize(result.Payload, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
}

static void AssertConfirmEvents(ConfirmResult result, params string[] expectedEventTypes)
{
    using var payload = ConfirmPayloadJson(result);
    var actual = payload.RootElement.GetProperty("events")
        .EnumerateArray()
        .Select(item => item.GetProperty("eventType").GetString())
        .Where(item => !string.IsNullOrWhiteSpace(item))
        .ToArray();
    Assert(actual.SequenceEqual(expectedEventTypes), $"expected confirm events [{string.Join(", ", expectedEventTypes)}], got [{string.Join(", ", actual)}]");
}

static int CountRows(string connectionString, string tableName)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = $"select count(*) from {tableName}";
    return Convert.ToInt32(command.ExecuteScalar());
}

static bool LensContains(ProjectionRuntime runtime, string lensId, string expected)
{
    var lens = runtime.GetAccommodationLens(lensId);
    return JsonSerializer.Serialize(lens).Contains(expected, StringComparison.OrdinalIgnoreCase);
}

static int TotalAggregateRows(string connectionString)
{
    var tables = new[]
    {
        "accommodation_rooms",
        "accommodation_beds",
        "accommodation_rate_plans",
        "accommodation_deposits",
        "finance_confirmations",
        "hostel_leads",
        "hostel_bookings",
        "hostel_residents",
        "hostel_stays",
        "hostel_charges",
        "guest_folios",
        "deposit_liabilities",
        "hostel_payments",
        "finance_reconciliations",
        "hostel_operating_metrics",
        "deposit_transactions",
        "payment_allocations",
        "stay_balances",
        "checkout_settlements",
        "room_inspections",
        "service_tasks",
        "expenses",
        "expense_links",
        "period_reviews",
        "period_metric_snapshots",
        "period_finance_snapshots",
        "period_operation_diagnoses",
        "period_action_plans",
        "period_late_adjustments",
        "repair_stations",
        "repair_technicians",
        "repair_vehicles"
    };

    return tables.Sum(table => CountRows(connectionString, table));
}

static decimal ScalarDecimal(string connectionString, string sql)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = sql;
    return Convert.ToDecimal(command.ExecuteScalar());
}

static int ScalarInt(string connectionString, string sql)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = sql;
    return Convert.ToInt32(command.ExecuteScalar());
}

static string ScalarText(string connectionString, string sql)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = sql;
    return Convert.ToString(command.ExecuteScalar()) ?? string.Empty;
}

static void ResetPostgres(string connectionString)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = """
        drop table if exists evidence_attachments;
        drop table if exists evidence_requirements;
        drop table if exists evidence_objects;
        drop table if exists card_instances;
        drop table if exists finance_confirmations;
        drop table if exists accommodation_deposits;
        drop table if exists period_late_adjustments;
        drop table if exists period_action_plans;
        drop table if exists period_operation_diagnoses;
        drop table if exists period_finance_snapshots;
        drop table if exists period_metric_snapshots;
        drop table if exists period_reviews;
        drop table if exists expense_links;
        drop table if exists expenses;
        drop table if exists service_tasks;
        drop table if exists room_inspections;
        drop table if exists checkout_settlements;
        drop table if exists stay_balances;
        drop table if exists payment_allocations;
        drop table if exists deposit_transactions;
        drop table if exists hostel_operating_metrics;
        drop table if exists finance_reconciliations;
        drop table if exists hostel_payments;
        drop table if exists deposit_liabilities;
        drop table if exists guest_folios;
        drop table if exists hostel_charges;
        drop table if exists hostel_stays;
        drop table if exists hostel_residents;
        drop table if exists hostel_bookings;
        drop table if exists hostel_leads;
        drop table if exists accommodation_rate_plans;
        drop table if exists accommodation_beds;
        drop table if exists accommodation_rooms;
        drop table if exists repair_vehicles;
        drop table if exists repair_technicians;
        drop table if exists repair_stations;
        drop table if exists behavior_events;
        drop table if exists runtime_sessions;
        drop table if exists outbox_messages;
        drop table if exists audit_events;
        drop table if exists runtime_documents;
        drop table if exists schema_migrations;
        """;
    command.ExecuteNonQuery();
}

static void EnsureTestDatabaseExists(string connectionString)
{
    var builder = new NpgsqlConnectionStringBuilder(connectionString);
    var database = builder.Database ?? string.Empty;
    if (string.IsNullOrWhiteSpace(database))
    {
        throw new InvalidOperationException("Runtime contract tests require an explicit test database name.");
    }

    if (!Regex.IsMatch(database, "^[A-Za-z0-9_]+$"))
    {
        throw new InvalidOperationException("Runtime contract tests require a simple alphanumeric test database name.");
    }

    var adminBuilder = new NpgsqlConnectionStringBuilder(connectionString) { Database = "postgres" };
    using var connection = new NpgsqlConnection(adminBuilder.ToString());
    connection.Open();

    using var exists = connection.CreateCommand();
    exists.CommandText = "select 1 from pg_database where datname = @database";
    exists.Parameters.AddWithValue("database", database);
    if (exists.ExecuteScalar() is not null)
    {
        return;
    }

    using var create = connection.CreateCommand();
    create.CommandText = $"create database \"{database}\"";
    create.ExecuteNonQuery();
}

static void AssertTestDatabaseAllowed(string connectionString)
{
    var builder = new NpgsqlConnectionStringBuilder(connectionString);
    var database = builder.Database ?? string.Empty;
    var explicitTestDatabase = string.Equals(
        Environment.GetEnvironmentVariable("TEST_DATABASE"),
        "true",
        StringComparison.OrdinalIgnoreCase);
    if (database.Contains("_test", StringComparison.OrdinalIgnoreCase) || explicitTestDatabase)
    {
        return;
    }

    throw new InvalidOperationException("Runtime contract tests refuse destructive reset unless database name contains '_test' or TEST_DATABASE=true.");
}

static void Assert(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}
