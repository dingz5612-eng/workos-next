using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class OperationsUnitOfWorkTests
{
    [TestMethod]
    public void command_submission_is_written_before_domain_event()
    {
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, _ => HandlerResult("RoomPrepared"));

        var result = unitOfWork.Commit(Request("idem-order"));

        Assert.AreEqual("committed", result.CommitStatus);
        Assert.IsTrue(store.WriteLog[0].StartsWith("CommandSubmission:", StringComparison.Ordinal));
        Assert.IsTrue(store.WriteLog.Any(item => item.StartsWith("DomainEvent:", StringComparison.Ordinal)));
        Assert.IsTrue(
            store.WriteLog.FindIndex(item => item.StartsWith("CommandSubmission:", StringComparison.Ordinal)) <
            store.WriteLog.FindIndex(item => item.StartsWith("DomainEvent:", StringComparison.Ordinal)),
            "CommandSubmission must be recorded before DomainEvent.");
    }

    [TestMethod]
    public void same_scope_key_and_payload_returns_stored_stable_response()
    {
        var handlerCalls = 0;
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, _ =>
        {
            handlerCalls++;
            return HandlerResult("RoomPrepared", eventId: "evt-stable");
        });
        var request = Request("idem-stable", roomNo: "A101");

        var first = unitOfWork.Commit(request);
        var duplicate = unitOfWork.Commit(request);

        Assert.AreEqual(1, handlerCalls);
        Assert.AreEqual(first.SubmissionId, duplicate.SubmissionId);
        Assert.AreEqual(first.PayloadHash, duplicate.PayloadHash);
        CollectionAssert.AreEqual(first.DomainEventIds.ToArray(), duplicate.DomainEventIds.ToArray());
        Assert.IsTrue(duplicate.Duplicate);
        Assert.AreEqual(1, store.DomainEvents.Count);
    }

    [TestMethod]
    public void same_scope_key_and_different_payload_returns_409_without_domain_event()
    {
        var handlerCalls = 0;
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, _ =>
        {
            handlerCalls++;
            return HandlerResult("RoomPrepared");
        });

        var first = unitOfWork.Commit(Request("idem-conflict", roomNo: "A101"));
        var conflict = unitOfWork.Commit(Request("idem-conflict", roomNo: "B202"));

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.AreEqual("same_idempotency_different_payload", conflict.Reason);
        Assert.AreEqual(1, handlerCalls);
        Assert.AreEqual(1, store.DomainEvents.Count);
    }

    [TestMethod]
    public void projection_pending_does_not_rollback_business_commit()
    {
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, _ => HandlerResult("RoomPrepared", projectionStatus: "pending"));

        var result = unitOfWork.Commit(Request("idem-projection-pending"));

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual("committed", result.CommitStatus);
        Assert.AreEqual("pending", result.ProjectionStatus);
        Assert.AreEqual(1, store.DomainEvents.Count);
        Assert.AreEqual(1, store.OutboxMessages.Count);
    }

    [TestMethod]
    public void fact_trace_links_case_work_item_submission_event()
    {
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, _ => HandlerResult("RoomPrepared", eventId: "evt-trace"));

        var result = unitOfWork.Commit(Request("idem-trace"));
        var trace = store.GetFactTrace("tenant-001", result.SubmissionId);

        Assert.IsNotNull(trace);
        Assert.AreEqual("case-001", trace!.CaseRef);
        Assert.AreEqual("work-001", trace.WorkItemRef);
        Assert.AreEqual(result.SubmissionId, trace.SubmissionRef);
        CollectionAssert.Contains(trace.DomainEventRefs.ToArray(), "evt-trace");
    }

    [TestMethod]
    public void ledger_entry_without_transaction_is_rejected_before_fact_write()
    {
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, _ => new SliceCommandHandlerResult(
            "committed",
            "projected",
            StatusCodes.Status200OK,
            new Dictionary<string, object> { ["accepted"] = true },
            new[] { new OperationsDomainEventDraft("MoneyTouched", new Dictionary<string, object>()) },
            Array.Empty<OperationsWorkItemEventDraft>(),
            Array.Empty<OperationsOutboxMessageDraft>(),
            Array.Empty<LedgerTransactionV1>(),
            new[] { new LedgerEntryV1("tenant-001", "entry-001", "missing-tx", "debit", 10m, "KGS") }));

        var result = unitOfWork.Commit(Request("idem-ledger-guard"));

        Assert.AreEqual(StatusCodes.Status500InternalServerError, result.StatusCode);
        Assert.AreEqual("handler_failure", result.ResponseBody["error"]);
        Assert.AreEqual(0, store.Submissions.Count);
        Assert.AreEqual(0, store.DomainEvents.Count);
    }

    [TestMethod]
    public void deposit_receipt_generates_balanced_deposit_liability_transaction()
    {
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, CanonicalOperationsApiService.HandleConfirmCommand);

        var result = unitOfWork.Commit(MoneyRequest("idem-deposit-receipt", "depositReceipt", "1200.00"));
        var trace = store.GetFactTrace("tenant-001", result.SubmissionId);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual("committed", result.CommitStatus);
        Assert.AreEqual(1, store.LedgerTransactions.Count);
        Assert.AreEqual("balanced", store.LedgerTransactions[0].BalanceStatus);
        Assert.AreEqual(result.SubmissionId, store.LedgerTransactions[0].SubmissionId);
        Assert.AreEqual(2, store.LedgerEntries.Count);
        Assert.AreEqual(
            store.LedgerEntries.Where(item => item.DebitCredit == "debit").Sum(item => item.Amount),
            store.LedgerEntries.Where(item => item.DebitCredit == "credit").Sum(item => item.Amount));
        CollectionAssert.Contains(store.LedgerEntries.Select(item => item.AccountType).ToArray(), "liability");
        CollectionAssert.DoesNotContain(store.LedgerEntries.Select(item => item.AccountType).ToArray(), "revenue");
        CollectionAssert.Contains(trace!.LedgerTransactionRefs.ToArray(), store.LedgerTransactions[0].LedgerTransactionId);
        CollectionAssert.Contains(trace.LedgerEntryRefs.ToArray(), store.LedgerEntries[0].EntryId);
    }

    [TestMethod]
    public void ordinary_payment_receipt_does_not_mix_with_deposit_liability()
    {
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, CanonicalOperationsApiService.HandleConfirmCommand);

        var result = unitOfWork.Commit(MoneyRequest("idem-payment-receipt", "paymentReceipt", "900.00"));

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual("balanced", result.ResponseBody["ledgerBalanceStatus"]);
        CollectionAssert.DoesNotContain(store.LedgerEntries.Select(item => item.AccountId).ToArray(), "liability.deposit");
        CollectionAssert.Contains(store.LedgerEntries.Select(item => item.AccountType).ToArray(), "receivable");
    }

    [TestMethod]
    public void unbalanced_ledger_transaction_is_rejected_before_domain_event()
    {
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, _ => new SliceCommandHandlerResult(
            "committed",
            "projected",
            StatusCodes.Status200OK,
            new Dictionary<string, object> { ["accepted"] = true },
            new[] { new OperationsDomainEventDraft("MoneyTouched", new Dictionary<string, object>()) },
            Array.Empty<OperationsWorkItemEventDraft>(),
            Array.Empty<OperationsOutboxMessageDraft>(),
            new[] { new LedgerTransactionV1("tenant-001", "ltx-unbalanced", "case-001", "work-001", "", "KGS", "balanced") },
            new[]
            {
                new LedgerEntryV1("tenant-001", "entry-debit", "ltx-unbalanced", "debit", 10m, "KGS"),
                new LedgerEntryV1("tenant-001", "entry-credit", "ltx-unbalanced", "credit", 9m, "KGS")
            }));

        var result = unitOfWork.Commit(Request("idem-unbalanced"));

        Assert.AreEqual(StatusCodes.Status500InternalServerError, result.StatusCode);
        Assert.AreEqual(0, store.Submissions.Count);
        Assert.AreEqual(0, store.DomainEvents.Count);
        Assert.AreEqual(0, store.LedgerEntries.Count);
    }

    [TestMethod]
    public void ledger_currency_mismatch_is_rejected_before_domain_event()
    {
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, _ => new SliceCommandHandlerResult(
            "committed",
            "projected",
            StatusCodes.Status200OK,
            new Dictionary<string, object> { ["accepted"] = true },
            new[] { new OperationsDomainEventDraft("MoneyTouched", new Dictionary<string, object>()) },
            Array.Empty<OperationsWorkItemEventDraft>(),
            Array.Empty<OperationsOutboxMessageDraft>(),
            new[] { new LedgerTransactionV1("tenant-001", "ltx-currency", "case-001", "work-001", "", "KGS", "balanced") },
            new[]
            {
                new LedgerEntryV1("tenant-001", "entry-debit", "ltx-currency", "debit", 10m, "KGS"),
                new LedgerEntryV1("tenant-001", "entry-credit", "ltx-currency", "credit", 10m, "USD")
            }));

        var result = unitOfWork.Commit(Request("idem-currency"));

        Assert.AreEqual(StatusCodes.Status500InternalServerError, result.StatusCode);
        Assert.AreEqual(0, store.DomainEvents.Count);
        Assert.AreEqual(0, store.LedgerTransactions.Count);
    }

    private static OperationsUnitOfWork UnitOfWork(
        InMemoryOperationsStore store,
        Func<CommandEnvelopeV1, SliceCommandHandlerResult> handler)
    {
        var router = new SliceCommandHandlerRouter()
            .Register("resource.room.prepare", handler)
            .Register(CanonicalOperationsApiService.ConfirmCommandType, handler);
        return new OperationsUnitOfWork(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            router);
    }

    private static OperationsCommandRequest Request(string idempotencyKey, string roomNo = "A101") =>
        new(
            "tenant-001",
            "case-001",
            "work-001",
            "resource.room.prepare",
            "CommandEnvelope.v1",
            "definition-v1",
            idempotencyKey,
            new Dictionary<string, object> { ["roomNo"] = roomNo },
            "operator-001");

    private static OperationsCommandRequest MoneyRequest(string idempotencyKey, string cardId, string amount) =>
        new(
            "tenant-001",
            "case-money-001",
            $"work-{cardId}",
            CanonicalOperationsApiService.ConfirmCommandType,
            "CommandEnvelope.v1",
            $"work-item:{cardId}:v1",
            idempotencyKey,
            new Dictionary<string, object>
            {
                ["workspaceId"] = "tenant-001",
                ["cardId"] = cardId,
                ["fieldValues"] = new Dictionary<string, object>
                {
                    ["amount"] = amount,
                    ["currency"] = "KGS",
                    ["paymentMethod"] = "cash"
                },
                ["evidenceIds"] = new[] { "ev-001" },
                ["source"] = "operations_unit_of_work"
            },
            "operator-001",
            $"tenant-001:work-{cardId}:confirm");

    private static SliceCommandHandlerResult HandlerResult(
        string eventType,
        string eventId = "evt-001",
        string projectionStatus = "projected") =>
        SliceCommandHandlerResult.Committed(
            new Dictionary<string, object> { ["accepted"] = true },
            new[] { new OperationsDomainEventDraft(eventType, new Dictionary<string, object> { ["roomNo"] = "A101" }, eventId) },
            new[] { new OperationsWorkItemEventDraft("WorkItemConfirmed", "ready", "done", new Dictionary<string, object>()) },
            new[] { new OperationsOutboxMessageDraft("project-domain-event", new Dictionary<string, object> { ["eventId"] = eventId }, eventId) },
            projectionStatus);
}
