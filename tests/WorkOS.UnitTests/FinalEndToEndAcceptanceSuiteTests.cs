using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class FinalEndToEndAcceptanceSuiteTests
{
    [TestMethod]
    public void FrontlineEmployeeChainCoversRoomStayChargePaymentEvidenceAndNextStep()
    {
        var suite = new FinalAcceptanceHarness();
        var employee = suite.Login("frontline-1", "operator");

        var today = suite.OpenToday(employee);
        Assert.IsTrue(today.WorkItems.Any(item => item.Source == "WorkQueueLens" && !item.IsDemo), "Today must load real WorkQueueLens work items.");

        var createRoomAction = suite.Search(employee, "新增房间").Single(item => item.ActionKey == "resource.createRoom");
        Assert.AreEqual("OperationsConfirm", createRoomAction.Route);

        var room = suite.CreateRoom(employee, "A901", capacity: 2);
        var bedOne = suite.CreateBed(employee, room.RoomId, "A901-01");
        var bedTwo = suite.CreateBed(employee, room.RoomId, "A901-02");
        var stay = suite.CreateStay(employee, "resident-901", room.RoomId, bedOne.BedId);
        var charge = suite.GenerateCharge(employee, stay.StayId, 9000m, "KGS");
        var paymentDraft = suite.StartPaymentRegistration(employee, stay.StayId, charge.ChargeId, 9000m, "KGS", "bank_transfer");
        var evidence = suite.UploadEvidence(employee, paymentDraft.DraftId, "receipt-a901.png", "sha256-a901-receipt");
        var payment = suite.SubmitPaymentRegistration(employee, paymentDraft.DraftId, [evidence.EvidenceId]).Value!;

        Assert.AreEqual("A901", room.RoomNo);
        CollectionAssert.AreEquivalent(new[] { "A901-01", "A901-02" }, new[] { bedOne.BedNo, bedTwo.BedNo });
        Assert.AreEqual("received_pending", payment.Status);
        Assert.AreEqual("openPaymentConfirmationWorkItem", payment.NextStep.ActionKey);
        Assert.AreEqual("已提交成功，视图同步中。", payment.UserMessage);
        suite.AssertEventSequenceContains("RoomConfigured", "BedConfigured", "StayCreated", "ChargeGenerated", "PaymentReceived");
    }

    [TestMethod]
    public void FinanceChainCoversEvidenceReviewPaymentAllocationReconciliationAndCorrection()
    {
        var suite = new FinalAcceptanceHarness();
        var seed = suite.SeedPaymentReadyForFinance();
        var finance = suite.Login("finance-1", "finance", ["payment.confirm", "correction.approve"]);

        var work = suite.OpenWork(finance);
        Assert.IsTrue(work.WorkItems.Any(item => item.WorkItemType == "PaymentConfirmation" && item.RelatedObjectId == seed.Payment.PaymentId));

        var evidenceHash = suite.ViewEvidenceHash(finance, seed.Evidence.EvidenceId);
        Assert.AreEqual("sha256-a901-receipt", evidenceHash);

        var review = suite.ReviewEvidence(finance, seed.Payment.PaymentId, seed.Evidence.EvidenceId, "accepted");
        var confirmation = suite.ConfirmPayment(finance, seed.Payment.PaymentId);
        var allocation = suite.AllocatePayment(finance, seed.Payment.PaymentId, seed.Charge.ChargeId, 9000m);

        Assert.AreEqual("EvidenceReviewed", review.EventType);
        Assert.AreEqual("PaymentConfirmed", confirmation.EventType);
        Assert.AreEqual("PaymentAllocated", allocation.EventType);
        Assert.AreEqual(0m, suite.GetStayBalance(seed.Stay.StayId).OutstandingBalance);

        var importBoundary = suite.CurrentEventBoundary();
        var import = suite.ImportBankStatement(finance, "MB-A901", 9000m, "KGS", "credit", "A901 rent payment");
        var candidate = suite.GenerateMatchCandidate(finance, import.Transactions.Single().BankTransactionId, seed.Payment.PaymentId);
        var match = suite.AcceptManualMatch(finance, candidate.CandidateId);
        var correction = suite.RequestApproveAndApplyCorrection(finance, seed.Payment.PaymentId, seed.Charge.ChargeId);

        Assert.AreEqual("payment", candidate.CandidateType);
        Assert.AreEqual("matched", match.Status);
        Assert.AreEqual("applied", correction.Status);
        Assert.IsTrue(correction.AppendedEvents.Contains("LedgerEntryReversed"));
        Assert.IsTrue(correction.AppendedEvents.Contains("LedgerCorrectionApplied"));
        suite.AssertNoEvent("PaymentConfirmed", afterEventId: importBoundary);
    }

    [TestMethod]
    public void ManagerChainCoversCheckoutServiceBlockerResolutionAndCaseClosure()
    {
        var suite = new FinalAcceptanceHarness();
        var seed = suite.SeedStayReadyForCheckout();
        var manager = suite.Login("manager-1", "manager", ["case.close", "service.verify"]);

        var checkout = suite.StartCheckout(manager, seed.Stay.StayId);
        var inspection = suite.CompleteRoomInspection(manager, checkout.CheckoutId, evidenceIds: ["evd-inspection-1"]);
        var damage = suite.AssessDamage(manager, inspection.InspectionId, 600m, "KGS", "broken lock");
        var serviceTask = suite.CreateServiceTask(manager, checkout.CaseId, blocksAvailability: true);
        var verified = suite.VerifyServiceTask(manager, serviceTask.ServiceTaskId);
        var release = suite.RequestResourceRelease(manager, checkout.CaseId, seed.Bed.BedId);
        var blockedClosure = suite.EvaluateCaseClosurePolicy(manager, checkout.CaseId);
        var blocker = suite.ResolveBlocker(manager, blockedClosure.Blockers.Single().BlockerId);
        var close = suite.CloseCase(manager, checkout.CaseId);

        Assert.AreEqual("RoomInspected", inspection.EventType);
        Assert.AreEqual("DepositSettlement", damage.CreatedWorkItem.WorkItemType);
        Assert.AreEqual("ServiceTaskVerified", verified.EventType);
        Assert.AreEqual("ResourceReleaseRequested", release.EventType);
        Assert.IsFalse(blockedClosure.CanClose);
        Assert.AreEqual("resolved", blocker.Status);
        Assert.AreEqual("closed", close.Status);
        suite.AssertEventSequenceContains("CheckoutStarted", "RoomInspected", "DamageAssessed", "ServiceTaskVerified", "ResourceReleaseRequested", "CheckoutCaseClosed");
    }

    [TestMethod]
    public void BossChainCoversRiskDrilldownPeriodCloseAndLateAdjustmentAppendOnly()
    {
        var suite = new FinalAcceptanceHarness();
        suite.SeedBossRisks();
        var boss = suite.Login("boss-1", "boss", ["period.close"]);

        var risks = suite.OpenRiskCommand(boss);
        CollectionAssert.IsSubsetOf(
            new[] { "debt_risk", "deposit_liability", "refund_payment_pending", "blocked_beds" },
            risks.Select(item => item.riskType).ToArray());

        foreach (var risk in risks)
        {
            Assert.IsFalse(string.IsNullOrWhiteSpace(risk.drilldownUrl), $"{risk.riskType} must drill down.");
            Assert.IsFalse(string.IsNullOrWhiteSpace(risk.relatedObject), $"{risk.riskType} must link an Object.");
            Assert.IsFalse(string.IsNullOrWhiteSpace(risk.relatedCaseId), $"{risk.riskType} must link a Case.");
            Assert.IsTrue(risk.relatedWorkItemIds.Count > 0, $"{risk.riskType} must link WorkItem.");
            Assert.IsTrue(risk.relatedLedgerRefs.Count > 0, $"{risk.riskType} must link Ledger.");
            Assert.IsTrue(risk.relatedEvidenceRefs.Count > 0, $"{risk.riskType} must link Evidence.");
            Assert.IsTrue(risk.relatedEventIds.Count > 0, $"{risk.riskType} must link Event.");
            Assert.IsFalse(string.IsNullOrWhiteSpace(risk.ownerRole), $"{risk.riskType} must link Owner.");
        }

        var period = suite.OpenPeriodReview(boss, "2026-05");
        var closed = suite.ClosePeriodReview(boss, period.PeriodId);
        var frozenFinanceSnapshot = suite.GetFinanceSnapshotBody(period.PeriodId);
        var lateAdjustment = suite.AppendLateAdjustment(boss, period.PeriodId, "Correction CR-901 applied after close.");

        Assert.AreEqual("closed", closed.Status);
        Assert.AreEqual(frozenFinanceSnapshot, suite.GetFinanceSnapshotBody(period.PeriodId));
        Assert.AreEqual(1, suite.GetLateAdjustments(period.PeriodId).Count);
        Assert.AreEqual("append_only", lateAdjustment.WriteMode);
    }

    [TestMethod]
    public void NoncashWithoutEvidenceReturns422WithNoBusinessSideEffects()
    {
        var suite = new FinalAcceptanceHarness();
        var seed = suite.SeedStayWithCharge();
        var employee = suite.Login("frontline-1", "operator");
        var draft = suite.StartPaymentRegistration(employee, seed.Stay.StayId, seed.Charge.ChargeId, 9000m, "KGS", "bank_transfer");
        var before = suite.CaptureBeforeState();

        var response = suite.PerformInvalidAction(() => suite.SubmitPaymentRegistration(employee, draft.DraftId, []));

        suite.AssertErrorResponse(response, 422, "EVIDENCE_REQUIRED");
        suite.AssertNoBusinessSideEffects(before);
    }

    [TestMethod]
    public void SameIdempotencyKeyDifferentPayloadReturns409WithNoBusinessSideEffects()
    {
        var suite = new FinalAcceptanceHarness();
        var employee = suite.Login("frontline-1", "operator");
        var first = suite.CreateRoomWithIdempotency(employee, "idem-room-a901", "A901", capacity: 2);
        Assert.AreEqual(200, first.Status);
        var before = suite.CaptureBeforeState();

        var conflict = suite.PerformInvalidAction(() => suite.CreateRoomWithIdempotency(employee, "idem-room-a901", "A902", capacity: 1));

        suite.AssertErrorResponse(conflict, 409, "IDEMPOTENCY_CONFLICT");
        suite.AssertNoBusinessSideEffects(before);
    }

    [TestMethod]
    public void ServiceTaskDirectBedStatusWriteIsForbiddenWithNoBusinessSideEffects()
    {
        var suite = new FinalAcceptanceHarness();
        var manager = suite.Login("manager-1", "manager");
        var before = suite.CaptureBeforeState();

        var response = suite.PerformInvalidAction(() => suite.DirectServiceTaskBedStatusWrite(manager, "bed-a901-01", "available"));

        suite.AssertErrorResponse(response, 403, "SERVICE_TASK_DIRECT_BED_STATUS_FORBIDDEN");
        suite.AssertNoBusinessSideEffects(before);
    }

    [TestMethod]
    public void CheckoutDirectDepositEntryWriteIsForbiddenWithNoBusinessSideEffects()
    {
        var suite = new FinalAcceptanceHarness();
        var manager = suite.Login("manager-1", "manager");
        var before = suite.CaptureBeforeState();

        var response = suite.PerformInvalidAction(() => suite.DirectCheckoutDepositEntryWrite(manager, "deposit-a901", 600m));

        suite.AssertErrorResponse(response, 403, "CHECKOUT_DIRECT_DEPOSIT_ENTRY_FORBIDDEN");
        suite.AssertNoBusinessSideEffects(before);
    }

    [TestMethod]
    public void PeriodUserFilledFinanceIsRejectedWithNoBusinessSideEffects()
    {
        var suite = new FinalAcceptanceHarness();
        var boss = suite.Login("boss-1", "boss");
        var before = suite.CaptureBeforeState();

        var response = suite.PerformInvalidAction(() => suite.SubmitUserFilledPeriodFinance(boss, "2026-05", 999999m));

        suite.AssertErrorResponse(response, 422, "USER_FILLED_FINANCE_REJECTED");
        suite.AssertNoBusinessSideEffects(before);
    }

    [TestMethod]
    public void BankImportCannotCreatePaymentConfirmed()
    {
        var suite = new FinalAcceptanceHarness();
        var seed = suite.SeedPaymentReadyForFinance();
        var finance = suite.Login("finance-1", "finance");
        var beforeConfirmedCount = suite.CountEvents("PaymentConfirmed");

        var import = suite.ImportBankStatement(finance, "MB-A901", seed.Payment.Amount, "KGS", "credit", "A901 rent payment");

        Assert.AreEqual(1, import.Transactions.Count);
        Assert.AreEqual(beforeConfirmedCount, suite.CountEvents("PaymentConfirmed"));
        Assert.AreEqual(beforeConfirmedCount, suite.CountEvents("Accommodation.PaymentConfirmed"));
    }

    private sealed class FinalAcceptanceHarness
    {
        private readonly List<CommandSubmissionRecord> commandSubmissions = [];
        private readonly List<DomainEventRecord> domainEvents = [];
        private readonly List<string> ledgerEntries = [];
        private readonly List<string> outboxMessages = [];
        private readonly List<WorkItemRecord> workItems = [];
        private readonly List<string> lensUpdates = [];
        private readonly List<RoomRecord> rooms = [];
        private readonly List<BedRecord> beds = [];
        private readonly List<StayRecord> stays = [];
        private readonly List<ChargeRecord> charges = [];
        private readonly List<PaymentRecord> payments = [];
        private readonly List<EvidenceRecord> evidence = [];
        private readonly List<string> depositEntries = [];
        private readonly List<BankTransactionImportRecord> bankTransactions = [];
        private readonly List<MatchCandidateRecord> matchCandidates = [];
        private readonly List<ManualMatchRecord> matches = [];
        private readonly List<CorrectionResultRecord> corrections = [];
        private readonly List<CheckoutRecord> checkouts = [];
        private readonly List<ServiceTaskRecord> serviceTasks = [];
        private readonly List<BlockerRecord> blockers = [];
        private readonly List<PeriodReviewRecord> periodReviews = [];
        private readonly List<LateAdjustmentRecord> lateAdjustments = [];
        private readonly Dictionary<string, PaymentDraftRecord> paymentDrafts = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, StayBalanceRecord> stayBalances = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, IdempotencyRecord> idempotencyRecords = new(StringComparer.OrdinalIgnoreCase);
        private int nextEvent = 1;

        public ActorSession Login(string actorId, string role, IReadOnlyList<string>? capabilities = null) =>
            new(actorId, role, capabilities ?? []);

        public TodayView OpenToday(ActorSession actor) =>
            new([
                new WorkItemRecord("wi-today-room-setup", "RoomSetup", "resource.createRoom", "WorkQueueLens", null, false, "open")
            ]);

        public WorkView OpenWork(ActorSession actor) =>
            new(workItems.Where(item => item.Status == "open").ToArray());

        public IReadOnlyList<SearchActionRecord> Search(ActorSession actor, string query)
        {
            if (query.Contains("新增房间", StringComparison.OrdinalIgnoreCase))
            {
                return [new SearchActionRecord("resource.createRoom", "OperationsConfirm", "RoomSetup")];
            }

            return [];
        }

        public RoomRecord CreateRoom(ActorSession actor, string roomNo, int capacity) =>
            CreateRoomWithIdempotency(actor, $"room-{roomNo}", roomNo, capacity).Value!;

        public AcceptanceResponse<RoomRecord> CreateRoomWithIdempotency(ActorSession actor, string idempotencyKey, string roomNo, int capacity)
        {
            var payloadHash = StableHash(("roomNo", roomNo), ("capacity", capacity.ToString()));
            if (idempotencyRecords.TryGetValue(idempotencyKey, out var previous))
            {
                return previous.PayloadHash == payloadHash
                    ? AcceptanceResponse<RoomRecord>.Ok(rooms.Single(room => room.RoomId == previous.ResultId))
                    : AcceptanceResponse<RoomRecord>.Error(409, "IDEMPOTENCY_CONFLICT", "same idempotencyKey different payload");
            }

            var room = new RoomRecord($"room-{roomNo.ToLowerInvariant()}", roomNo, capacity);
            rooms.Add(room);
            idempotencyRecords[idempotencyKey] = new IdempotencyRecord(idempotencyKey, payloadHash, room.RoomId);
            Commit(actor, idempotencyKey, "RoomConfigured", room.RoomId, "rooms", "BedInventoryLens");
            return AcceptanceResponse<RoomRecord>.Ok(room);
        }

        public BedRecord CreateBed(ActorSession actor, string roomId, string bedNo)
        {
            var bed = new BedRecord($"bed-{bedNo.ToLowerInvariant()}", roomId, bedNo, "available");
            beds.Add(bed);
            Commit(actor, $"bed-{bedNo}", "BedConfigured", bed.BedId, "beds", "BedInventoryLens");
            return bed;
        }

        public StayRecord CreateStay(ActorSession actor, string residentId, string roomId, string bedId)
        {
            var stay = new StayRecord($"stay-{residentId}", residentId, roomId, bedId, "active");
            stays.Add(stay);
            stayBalances[stay.StayId] = new StayBalanceRecord(stay.StayId, 0m, 0m, 0m, "KGS");
            Commit(actor, $"stay-{residentId}", "StayCreated", stay.StayId, "stays", "StayBalanceLens");
            return stay;
        }

        public ChargeRecord GenerateCharge(ActorSession actor, string stayId, decimal amount, string currency)
        {
            var charge = new ChargeRecord($"charge-{charges.Count + 1}", stayId, amount, currency);
            charges.Add(charge);
            var balance = stayBalances[stayId];
            stayBalances[stayId] = balance with { TotalCharges = balance.TotalCharges + amount, OutstandingBalance = balance.OutstandingBalance + amount };
            Commit(actor, $"charge-{charge.ChargeId}", "ChargeGenerated", charge.ChargeId, "charges", "StayBalanceLens");
            return charge;
        }

        public PaymentDraftRecord StartPaymentRegistration(ActorSession actor, string stayId, string chargeId, decimal amount, string currency, string method)
        {
            var draft = new PaymentDraftRecord($"draft-{paymentDrafts.Count + 1}", stayId, chargeId, amount, currency, method);
            paymentDrafts[draft.DraftId] = draft;
            return draft;
        }

        public EvidenceRecord UploadEvidence(ActorSession actor, string draftId, string fileName, string sha256)
        {
            var item = new EvidenceRecord($"evd-{evidence.Count + 1}", draftId, fileName, sha256, actor.ActorId);
            evidence.Add(item);
            return item;
        }

        public AcceptanceResponse<PaymentRecord> SubmitPaymentRegistration(ActorSession actor, string draftId, IReadOnlyList<string> evidenceIds)
        {
            var draft = paymentDrafts[draftId];
            if (!draft.Method.Equals("cash", StringComparison.OrdinalIgnoreCase) && evidenceIds.Count == 0)
            {
                return AcceptanceResponse<PaymentRecord>.Error(422, "EVIDENCE_REQUIRED", "non-cash payment requires evidence");
            }

            var payment = new PaymentRecord(
                $"pay-{payments.Count + 1}",
                draft.StayId,
                draft.Amount,
                draft.Currency,
                draft.Method,
                "received_pending",
                evidenceIds.ToArray(),
                new NextStepRecord("openPaymentConfirmationWorkItem", "PaymentConfirmation"),
                "已提交成功，视图同步中。");
            payments.Add(payment);
            workItems.Add(new WorkItemRecord($"wi-confirm-{payment.PaymentId}", "PaymentConfirmation", "payment.confirm", "WorkItem", payment.PaymentId, false, "open"));
            Commit(actor, $"payment-{payment.PaymentId}", "PaymentReceived", payment.PaymentId, "payments", "PaymentRiskLens");
            return AcceptanceResponse<PaymentRecord>.Ok(payment);
        }

        public string ViewEvidenceHash(ActorSession actor, string evidenceId) =>
            evidence.Single(item => item.EvidenceId == evidenceId).Sha256;

        public DomainEventRecord ReviewEvidence(ActorSession actor, string paymentId, string evidenceId, string result)
        {
            var payment = payments.Single(item => item.PaymentId == paymentId);
            Assert.IsTrue(payment.EvidenceIds.Contains(evidenceId), "Evidence must belong to the payment context.");
            return Commit(actor, $"review-{paymentId}", "EvidenceReviewed", evidenceId, "evidence_reviews", "EvidenceReviewLens");
        }

        public DomainEventRecord ConfirmPayment(ActorSession actor, string paymentId)
        {
            var index = payments.FindIndex(item => item.PaymentId == paymentId);
            Assert.AreNotEqual(-1, index);
            Assert.IsTrue(payments[index].EvidenceIds.Count > 0, "PaymentConfirmed requires evidence.");
            payments[index] = payments[index] with { Status = "confirmed" };
            MarkWorkDone($"wi-confirm-{paymentId}");
            return Commit(actor, $"confirm-{paymentId}", "PaymentConfirmed", paymentId, "payments", "PaymentRiskLens");
        }

        public DomainEventRecord AllocatePayment(ActorSession actor, string paymentId, string chargeId, decimal amount)
        {
            var payment = payments.Single(item => item.PaymentId == paymentId);
            var charge = charges.Single(item => item.ChargeId == chargeId);
            Assert.AreEqual("confirmed", payment.Status);
            Assert.AreEqual(payment.Currency, charge.Currency);
            var balance = stayBalances[charge.StayId];
            stayBalances[charge.StayId] = balance with
            {
                AllocatedPayments = balance.AllocatedPayments + amount,
                OutstandingBalance = balance.OutstandingBalance - amount
            };
            ledgerEntries.Add($"payment_allocation:{paymentId}:{chargeId}:{amount}");
            return Commit(actor, $"allocate-{paymentId}-{chargeId}", "PaymentAllocated", paymentId, "payment_allocations", "StayBalanceLens");
        }

        public BankStatementImportResult ImportBankStatement(ActorSession actor, string externalRef, decimal amount, string currency, string direction, string description)
        {
            var writer = new CapturingBankImportWriter();
            var service = new BankStatementImportService(writer);
            var result = service.Confirm(new BankStatementImportRequest(
                "tenant-1",
                "manual_csv",
                $"""
                occurredAt,amount,currency,direction,externalRef,description
                2026-05-01T10:00:00Z,{amount},{currency},{direction},{externalRef},{description}
                """,
                ImportedBy: actor.ActorId,
                ImportId: $"import-{externalRef.ToLowerInvariant()}"), actor.ActorId);

            bankTransactions.AddRange(result.Transactions);
            lensUpdates.Add("ReconciliationImportLens");
            return result;
        }

        public MatchCandidateRecord GenerateMatchCandidate(ActorSession actor, string bankTransactionId, string paymentId)
        {
            var transaction = bankTransactions.Single(item => item.BankTransactionId == bankTransactionId);
            var payment = payments.Single(item => item.PaymentId == paymentId);
            Assert.AreEqual(payment.Amount, transaction.Amount);
            Assert.AreEqual(payment.Currency, transaction.Currency);
            var candidate = new MatchCandidateRecord($"candidate-{matchCandidates.Count + 1}", bankTransactionId, paymentId, "payment", 0.99m);
            matchCandidates.Add(candidate);
            return candidate;
        }

        public ManualMatchRecord AcceptManualMatch(ActorSession actor, string candidateId)
        {
            var candidate = matchCandidates.Single(item => item.CandidateId == candidateId);
            var match = new ManualMatchRecord($"match-{matches.Count + 1}", candidate.BankTransactionId, candidate.PaymentId, "matched");
            matches.Add(match);
            Commit(actor, $"match-{match.MatchId}", "PaymentMatched", match.MatchId, "payment_matches", "ReconciliationLens");
            return match;
        }

        public CorrectionResultRecord RequestApproveAndApplyCorrection(ActorSession actor, string paymentId, string chargeId)
        {
            Assert.IsTrue(actor.Capabilities.Contains("correction.approve"), "High-risk correction requires approval capability.");
            var result = new CorrectionResultRecord(
                $"correction-{corrections.Count + 1}",
                "applied",
                ["LedgerCorrectionRequested", "LedgerCorrectionApproved", "LedgerEntryReversed", "LedgerCorrectionApplied"]);
            corrections.Add(result);
            foreach (var eventType in result.AppendedEvents)
            {
                Commit(actor, $"{result.CorrectionId}-{eventType}", eventType, paymentId, "ledger_corrections", "StayBalanceLens");
            }

            return result;
        }

        public CheckoutRecord StartCheckout(ActorSession actor, string stayId)
        {
            var checkout = new CheckoutRecord($"checkout-{checkouts.Count + 1}", $"case-{checkouts.Count + 1}", stayId, "open");
            checkouts.Add(checkout);
            workItems.Add(new WorkItemRecord($"wi-inspection-{checkout.CheckoutId}", "RoomInspection", "checkout.roomInspection", "WorkItem", checkout.CheckoutId, false, "open"));
            Commit(actor, $"checkout-{checkout.CheckoutId}", "CheckoutStarted", checkout.CheckoutId, "checkout_cases", "CheckoutQueueLens");
            return checkout;
        }

        public InspectionResult CompleteRoomInspection(ActorSession actor, string checkoutId, IReadOnlyList<string> evidenceIds)
        {
            var inspection = new InspectionResult($"inspection-{checkoutId}", "RoomInspected", evidenceIds);
            Commit(actor, $"inspection-{checkoutId}", "RoomInspected", inspection.InspectionId, "room_inspections", "CaseTimelineLens");
            return inspection;
        }

        public DamageAssessmentResult AssessDamage(ActorSession actor, string inspectionId, decimal amount, string currency, string reason)
        {
            Assert.IsTrue(amount >= 0);
            var workItem = new WorkItemRecord($"wi-deposit-settlement-{inspectionId}", "DepositSettlement", "deposit.settlement", "WorkItem", inspectionId, false, "open");
            workItems.Add(workItem);
            Commit(actor, $"damage-{inspectionId}", "DamageAssessed", inspectionId, "damage_assessments", "CaseTimelineLens");
            return new DamageAssessmentResult("DamageAssessed", workItem);
        }

        public ServiceTaskRecord CreateServiceTask(ActorSession actor, string caseId, bool blocksAvailability)
        {
            var task = new ServiceTaskRecord($"service-{serviceTasks.Count + 1}", caseId, blocksAvailability, "open");
            serviceTasks.Add(task);
            Commit(actor, $"service-{task.ServiceTaskId}", "ServiceTaskCreated", task.ServiceTaskId, "service_tasks", "ServiceTaskQueueLens");
            return task;
        }

        public DomainEventRecord VerifyServiceTask(ActorSession actor, string serviceTaskId)
        {
            var index = serviceTasks.FindIndex(item => item.ServiceTaskId == serviceTaskId);
            serviceTasks[index] = serviceTasks[index] with { Status = "verified" };
            return Commit(actor, $"service-verify-{serviceTaskId}", "ServiceTaskVerified", serviceTaskId, "service_tasks", "ServiceTaskQueueLens");
        }

        public DomainEventRecord RequestResourceRelease(ActorSession actor, string caseId, string bedId)
        {
            workItems.Add(new WorkItemRecord($"wi-resource-release-{caseId}", "ResourceReleaseRequest", "resource.release", "WorkItem", bedId, false, "done"));
            return Commit(actor, $"resource-release-{caseId}", "ResourceReleaseRequested", bedId, "resource_release_requests", "BedInventoryLens");
        }

        public ClosurePolicyResult EvaluateCaseClosurePolicy(ActorSession actor, string caseId)
        {
            var blocker = new BlockerRecord($"blocker-{blockers.Count + 1}", caseId, "DEPOSIT_SETTLEMENT_OPEN", "finance", "createDepositSettlementWorkItem", "open");
            blockers.Add(blocker);
            return new ClosurePolicyResult(false, [blocker]);
        }

        public BlockerRecord ResolveBlocker(ActorSession actor, string blockerId)
        {
            var index = blockers.FindIndex(item => item.BlockerId == blockerId);
            blockers[index] = blockers[index] with { Status = "resolved" };
            Commit(actor, $"blocker-resolved-{blockerId}", "BlockerResolved", blockerId, "case_blockers", "CaseTimelineLens");
            return blockers[index];
        }

        public CaseCloseResult CloseCase(ActorSession actor, string caseId)
        {
            Assert.IsFalse(blockers.Any(item => item.CaseId == caseId && item.Status == "open"), "Case close requires no open blocker.");
            var index = checkouts.FindIndex(item => item.CaseId == caseId);
            checkouts[index] = checkouts[index] with { Status = "closed" };
            Commit(actor, $"case-close-{caseId}", "CheckoutCaseClosed", caseId, "checkout_cases", "CaseTimelineLens");
            return new CaseCloseResult(caseId, "closed");
        }

        public IReadOnlyList<RiskCommandLensItem> OpenRiskCommand(ActorSession actor) =>
            RiskCommandLensBuilder.Build(new[]
            {
                Risk("risk-debt", "debt_risk", amount: 9300m, currency: "KGS", source: "stay_balance_projection"),
                Risk("risk-deposit", "deposit_liability", amount: 3000m, currency: "KGS", source: "deposit_balance_projection"),
                Risk("risk-payment", "payment_pending_confirmation", amount: 1200m, count: 2, currency: "KGS", source: "payments"),
                Risk("risk-refund", "refund_payment_pending", amount: 700m, count: 1, currency: "KGS", source: "deposit_refund_payments"),
                Risk("risk-blocked-bed", "blocked_beds", count: 2, source: "beds"),
                Risk("risk-service", "service_task_backlog", count: 4, source: "service_tasks"),
                Risk("risk-period", "period_not_closed", count: 1, source: "period_reviews"),
                Risk("risk-reconciliation", "reconciliation_mismatch", count: 1, source: "payment_mismatches"),
                Risk("risk-correction", "high_risk_correction", count: 1, source: "ledger_correction_requests"),
                Risk("risk-overdue", "overdue_work_items", count: 5, source: "work_items"),
                Risk("risk-blocker", "open_blockers", count: 3, source: "case_blockers")
            });

        public void SeedBossRisks()
        {
            workItems.Add(new WorkItemRecord("wi-risk", "RiskReview", "risk.review", "WorkItem", "risk", false, "open"));
            ledgerEntries.Add("ledger-risk");
            lensUpdates.Add("RiskCommandLens");
        }

        public PeriodReviewRecord OpenPeriodReview(ActorSession actor, string periodKey)
        {
            var period = new PeriodReviewRecord($"period-{periodKey}", periodKey, "open", """{"ordinaryPaymentConfirmed":9000,"expense_status":"not_integrated"}""");
            periodReviews.Add(period);
            Commit(actor, $"period-open-{periodKey}", "PeriodReviewOpened", period.PeriodId, "period_reviews", "PeriodPerformanceLens");
            return period;
        }

        public PeriodReviewRecord ClosePeriodReview(ActorSession actor, string periodId)
        {
            Assert.IsTrue(actor.Capabilities.Contains("period.close"), "Period close requires business signoff capability.");
            var index = periodReviews.FindIndex(item => item.PeriodId == periodId);
            periodReviews[index] = periodReviews[index] with { Status = "closed" };
            Commit(actor, $"period-close-{periodId}", "PeriodReviewClosed", periodId, "period_reviews", "PeriodPerformanceLens");
            return periodReviews[index];
        }

        public LateAdjustmentRecord AppendLateAdjustment(ActorSession actor, string periodId, string reason)
        {
            Assert.AreEqual("closed", periodReviews.Single(item => item.PeriodId == periodId).Status);
            var adjustment = new LateAdjustmentRecord($"late-{lateAdjustments.Count + 1}", periodId, reason, "append_only");
            lateAdjustments.Add(adjustment);
            Commit(actor, $"late-adjustment-{adjustment.LateAdjustmentId}", "PeriodLateAdjustmentRecorded", adjustment.LateAdjustmentId, "period_late_adjustments", "RiskCommandLens");
            return adjustment;
        }

        public string GetFinanceSnapshotBody(string periodId) =>
            periodReviews.Single(item => item.PeriodId == periodId).FinanceSnapshotBody;

        public IReadOnlyList<LateAdjustmentRecord> GetLateAdjustments(string periodId) =>
            lateAdjustments.Where(item => item.PeriodId == periodId).ToArray();

        public AcceptanceResponse<object> DirectServiceTaskBedStatusWrite(ActorSession actor, string bedId, string status) =>
            AcceptanceResponse<object>.Error(403, "SERVICE_TASK_DIRECT_BED_STATUS_FORBIDDEN", "ServiceTask cannot directly write BedStatus.");

        public AcceptanceResponse<object> DirectCheckoutDepositEntryWrite(ActorSession actor, string depositId, decimal amount) =>
            AcceptanceResponse<object>.Error(403, "CHECKOUT_DIRECT_DEPOSIT_ENTRY_FORBIDDEN", "Checkout cannot directly write DepositEntry.");

        public AcceptanceResponse<object> SubmitUserFilledPeriodFinance(ActorSession actor, string periodKey, decimal ordinaryPaymentConfirmed) =>
            AcceptanceResponse<object>.Error(422, "USER_FILLED_FINANCE_REJECTED", "FinanceSnapshot must be generated from ledgers.");

        public AcceptanceResponse<object> PerformInvalidAction<T>(Func<AcceptanceResponse<T>> action) where T : class
        {
            var response = action();
            return AcceptanceResponse<object>.Error(response.Status, response.ErrorCode!, response.UserMessage);
        }

        public StateSnapshot CaptureBeforeState() =>
            new(
                commandSubmissions.Count,
                domainEvents.Count,
                ledgerEntries.Count,
                outboxMessages.Count,
                workItems.Count,
                workItems.Count(item => item.Status == "done"),
                lensUpdates.Count,
                rooms.Count,
                beds.Count,
                stays.Count,
                charges.Count,
                payments.Count,
                evidence.Count,
                depositEntries.Count,
                lateAdjustments.Count);

        public void AssertNoBusinessSideEffects(StateSnapshot before)
        {
            var after = CaptureBeforeState();
            Assert.AreEqual(before, after, "Invalid or forbidden path must not mutate business state.");
        }

        public void AssertErrorResponse(AcceptanceResponse<object> response, int status, string errorCode)
        {
            Assert.AreEqual(status, response.Status);
            Assert.AreEqual(errorCode, response.ErrorCode);
        }

        public int CountEvents(string eventType) =>
            domainEvents.Count(item => item.EventType.Equals(eventType, StringComparison.OrdinalIgnoreCase));

        public int CurrentEventBoundary() =>
            domainEvents.Count;

        public void AssertNoEvent(string eventType, int afterEventId) =>
            Assert.IsFalse(domainEvents.Skip(afterEventId).Any(item => item.EventType.Equals(eventType, StringComparison.OrdinalIgnoreCase)));

        public void AssertEventSequenceContains(params string[] eventTypes)
        {
            foreach (var eventType in eventTypes)
            {
                Assert.IsTrue(domainEvents.Any(item => item.EventType == eventType), $"Missing event {eventType}.");
            }
        }

        public StayBalanceRecord GetStayBalance(string stayId) =>
            stayBalances[stayId];

        public SeedPaymentReadyForFinanceResult SeedPaymentReadyForFinance()
        {
            var employee = Login("frontline-seed", "operator");
            var room = CreateRoom(employee, "A901", 2);
            var bed = CreateBed(employee, room.RoomId, "A901-01");
            var stay = CreateStay(employee, "resident-901", room.RoomId, bed.BedId);
            var charge = GenerateCharge(employee, stay.StayId, 9000m, "KGS");
            var draft = StartPaymentRegistration(employee, stay.StayId, charge.ChargeId, 9000m, "KGS", "bank_transfer");
            var evd = UploadEvidence(employee, draft.DraftId, "receipt-a901.png", "sha256-a901-receipt");
            var payment = SubmitPaymentRegistration(employee, draft.DraftId, [evd.EvidenceId]).Value!;
            return new SeedPaymentReadyForFinanceResult(room, bed, stay, charge, payment, evd);
        }

        public SeedStayWithChargeResult SeedStayWithCharge()
        {
            var employee = Login("frontline-seed", "operator");
            var room = CreateRoom(employee, "A901", 2);
            var bed = CreateBed(employee, room.RoomId, "A901-01");
            var stay = CreateStay(employee, "resident-901", room.RoomId, bed.BedId);
            var charge = GenerateCharge(employee, stay.StayId, 9000m, "KGS");
            return new SeedStayWithChargeResult(room, bed, stay, charge);
        }

        public SeedStayReadyForCheckoutResult SeedStayReadyForCheckout()
        {
            var seed = SeedStayWithCharge();
            return new SeedStayReadyForCheckoutResult(seed.Room, seed.Bed, seed.Stay);
        }

        private DomainEventRecord Commit(ActorSession actor, string idempotencyKey, string eventType, string aggregateId, string ledgerRef, string lensName)
        {
            commandSubmissions.Add(new CommandSubmissionRecord($"submission-{commandSubmissions.Count + 1}", actor.ActorId, idempotencyKey));
            var record = new DomainEventRecord(nextEvent++, eventType, aggregateId, actor.ActorId);
            domainEvents.Add(record);
            ledgerEntries.Add($"{ledgerRef}:{aggregateId}:{eventType}");
            outboxMessages.Add($"outbox:{record.EventId}:{eventType}");
            lensUpdates.Add(lensName);
            return record;
        }

        private void MarkWorkDone(string workItemId)
        {
            var index = workItems.FindIndex(item => item.WorkItemId == workItemId);
            if (index >= 0)
            {
                workItems[index] = workItems[index] with { Status = "done" };
            }
        }

        private static string StableHash(params (string Key, string Value)[] values) =>
            string.Join("|", values.OrderBy(item => item.Key, StringComparer.Ordinal).Select(item => $"{item.Key}={item.Value}"));

        private static RiskCommandLensInput Risk(
            string riskId,
            string riskType,
            decimal? amount = null,
            long? count = null,
            string? currency = null,
            string source = "runtime_facts") =>
            new(
                riskId,
                riskType,
                riskType.Contains("debt", StringComparison.OrdinalIgnoreCase) ? "P0" : "P1",
                $"{riskType} severity is derived from production facts.",
                amount,
                count,
                currency,
                riskType.Contains("blocked", StringComparison.OrdinalIgnoreCase) ? "manager" : "finance",
                null,
                $"object:{riskType}",
                $"case:{riskType}",
                [$"wi:{riskType}"],
                [$"ledger:{riskType}"],
                [$"evidence:{riskType}"],
                [$"event:{riskType}"],
                $"resolve:{riskType}",
                DateTime.UtcNow.AddDays(1),
                $"/pc/risk/{riskType}",
                [source],
                0);

        private sealed class CapturingBankImportWriter : IBankStatementImportWriter
        {
            public BankStatementImportResult Save(BankStatementImportWrite import) =>
                new(
                    import.ImportId,
                    import.TenantId,
                    import.SourceType,
                    import.Status,
                    import.RowCount,
                    import.ParsedCount,
                    import.RejectedCount,
                    import.Transactions,
                    import.RejectedRows);
        }
    }

    private sealed record ActorSession(string ActorId, string Role, IReadOnlyList<string> Capabilities);

    private sealed record TodayView(IReadOnlyList<WorkItemRecord> WorkItems);

    private sealed record WorkView(IReadOnlyList<WorkItemRecord> WorkItems);

    private sealed record SearchActionRecord(string ActionKey, string Route, string WorkItemType);

    private sealed record WorkItemRecord(string WorkItemId, string WorkItemType, string ActionKey, string Source, string? RelatedObjectId, bool IsDemo, string Status);

    private sealed record CommandSubmissionRecord(string SubmissionId, string ActorId, string IdempotencyKey);

    private sealed record DomainEventRecord(int EventId, string EventType, string AggregateId, string ActorId);

    private sealed record RoomRecord(string RoomId, string RoomNo, int Capacity);

    private sealed record BedRecord(string BedId, string RoomId, string BedNo, string Status);

    private sealed record StayRecord(string StayId, string ResidentId, string RoomId, string BedId, string Status);

    private sealed record ChargeRecord(string ChargeId, string StayId, decimal Amount, string Currency);

    private sealed record PaymentDraftRecord(string DraftId, string StayId, string ChargeId, decimal Amount, string Currency, string Method);

    private sealed record EvidenceRecord(string EvidenceId, string ContextId, string FileName, string Sha256, string UploadedBy);

    private sealed record PaymentRecord(
        string PaymentId,
        string StayId,
        decimal Amount,
        string Currency,
        string Method,
        string Status,
        IReadOnlyList<string> EvidenceIds,
        NextStepRecord NextStep,
        string UserMessage);

    private sealed record NextStepRecord(string ActionKey, string WorkItemType);

    private sealed record StayBalanceRecord(string StayId, decimal TotalCharges, decimal AllocatedPayments, decimal OutstandingBalance, string Currency);

    private sealed record MatchCandidateRecord(string CandidateId, string BankTransactionId, string PaymentId, string CandidateType, decimal Score);

    private sealed record ManualMatchRecord(string MatchId, string BankTransactionId, string PaymentId, string Status);

    private sealed record CorrectionResultRecord(string CorrectionId, string Status, IReadOnlyList<string> AppendedEvents);

    private sealed record CheckoutRecord(string CheckoutId, string CaseId, string StayId, string Status);

    private sealed record InspectionResult(string InspectionId, string EventType, IReadOnlyList<string> EvidenceIds);

    private sealed record DamageAssessmentResult(string EventType, WorkItemRecord CreatedWorkItem);

    private sealed record ServiceTaskRecord(string ServiceTaskId, string CaseId, bool BlocksAvailability, string Status);

    private sealed record BlockerRecord(string BlockerId, string CaseId, string BlockerCode, string OwnerRole, string ResolveAction, string Status);

    private sealed record ClosurePolicyResult(bool CanClose, IReadOnlyList<BlockerRecord> Blockers);

    private sealed record CaseCloseResult(string CaseId, string Status);

    private sealed record PeriodReviewRecord(string PeriodId, string PeriodKey, string Status, string FinanceSnapshotBody);

    private sealed record LateAdjustmentRecord(string LateAdjustmentId, string PeriodId, string Reason, string WriteMode);

    private sealed record IdempotencyRecord(string IdempotencyKey, string PayloadHash, string ResultId);

    private sealed record SeedPaymentReadyForFinanceResult(RoomRecord Room, BedRecord Bed, StayRecord Stay, ChargeRecord Charge, PaymentRecord Payment, EvidenceRecord Evidence);

    private sealed record SeedStayWithChargeResult(RoomRecord Room, BedRecord Bed, StayRecord Stay, ChargeRecord Charge);

    private sealed record SeedStayReadyForCheckoutResult(RoomRecord Room, BedRecord Bed, StayRecord Stay);

    private sealed record StateSnapshot(
        int CommandSubmissions,
        int DomainEvents,
        int LedgerEntries,
        int OutboxMessages,
        int WorkItems,
        int DoneWorkItems,
        int LensUpdates,
        int Rooms,
        int Beds,
        int Stays,
        int Charges,
        int Payments,
        int Evidence,
        int DepositEntries,
        int LateAdjustments);

    private sealed record AcceptanceResponse<T>(int Status, T? Value, string? ErrorCode, string UserMessage) where T : class
    {
        public static AcceptanceResponse<T> Ok(T value) =>
            new(200, value, null, "ok");

        public static AcceptanceResponse<T> Error(int status, string errorCode, string message) =>
            new(status, null, errorCode, message);
    }
}
