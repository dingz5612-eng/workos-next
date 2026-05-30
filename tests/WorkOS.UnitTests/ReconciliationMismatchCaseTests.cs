using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class ReconciliationMismatchCaseTests
{
    [TestMethod]
    public void unmatched_bank_transaction_creates_reconciliation_case()
    {
        var storage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeReconciliationMismatchCaseStorage.cs"));
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "019_reconciliation_mismatch_cases.sql"));

        Assert.IsTrue(storage.Contains("'unmatched_bank_transaction'", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("not exists", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("payment_match_candidates", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("insert into reconciliation_cases", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("PaymentMismatchDetected", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(migration.Contains("bank_transaction_id text null", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void confirmed_payment_without_bank_match_creates_mismatch_after_threshold()
    {
        var storage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeReconciliationMismatchCaseStorage.cs"));

        Assert.IsTrue(storage.Contains("'confirmed_payment_without_bank_match'", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("payment.status = 'confirmed'", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("payment.updated_at_utc <= now() - (@paymentThresholdDays * interval '1 day')", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("active_match.payment_id = payment.payment_id", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void amount_mismatch_creates_case()
    {
        var storage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeReconciliationMismatchCaseStorage.cs"));

        Assert.IsTrue(storage.Contains("'amount_mismatch'", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("transaction.amount <> payment.amount", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("transaction.currency = payment.currency", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("CreateCasesForOpenMismatches", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void mismatch_case_resolve_action_creates_correction_request()
    {
        var storage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeReconciliationMismatchCaseStorage.cs"));

        Assert.IsTrue(storage.Contains("acceptManualMatch", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("markBankTransactionIgnored", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("requestPaymentCorrection", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("requestEvidenceCorrection", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("createCorrectionRequest", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("closeAsExplained", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void process_manager_dedupes_reconciliation_work_item()
    {
        var manager = new ReconciliationProcessManager();
        var sink = new DedupeSink();
        var workspaceEvent = new WorkspaceEvent(
            "evt-mismatch-1",
            "tenant-1",
            "reconciliation-case",
            "PaymentMismatchDetected",
            "bank-tx-1",
            "mismatch-1",
            "rcase-1",
            "system",
            "runtime",
            DateTimeOffset.UtcNow,
            new Dictionary<string, string>
            {
                ["caseId"] = "reconciliation-case-1",
                ["reconciliationCaseId"] = "rcase-1",
                ["mismatchId"] = "mismatch-1",
                ["mismatchType"] = "amount_mismatch",
                ["bankTransactionId"] = "bank-tx-1",
                ["relatedObjectType"] = "payment",
                ["relatedObjectId"] = "payment-1",
                ["ownerRole"] = "finance",
                ["resolveActions"] = "requestPaymentCorrection,createCorrectionRequest",
                ["dueAtUtc"] = DateTimeOffset.UtcNow.AddHours(48).ToString("O"),
                ["blockerSeverity"] = "P0"
            },
            new[] { "ReconciliationCase" });

        var first = manager.Handle(workspaceEvent, sink);
        var second = manager.Handle(workspaceEvent, sink);

        Assert.HasCount(1, first.ProcessRuns);
        Assert.HasCount(1, first.WorkItemIntents);
        Assert.IsEmpty(second.ProcessRuns);
        Assert.IsEmpty(second.WorkItemIntents);
        Assert.HasCount(1, sink.WorkItemIntents);
        Assert.AreEqual("finance", sink.WorkItemIntents.Single().OwnerRole);
        Assert.AreEqual("reconciliationReview", sink.WorkItemIntents.Single().WorkItemType);
    }

    private static string RepoPath(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate repository root.");
        return Path.Combine(new[] { current!.FullName }.Concat(segments).ToArray());
    }

    private sealed class DedupeSink : ICheckoutServiceProcessRunSink
    {
        private readonly HashSet<string> keys = new(StringComparer.OrdinalIgnoreCase);

        public List<ProcessWorkItemIntentRecord> WorkItemIntents { get; } = new();

        public bool TryRecordProcessRun(
            ProcessRunRecord processRun,
            IReadOnlyList<ProcessWorkItemIntentRecord> workItemIntents,
            IReadOnlyList<ProcessRequestEventIntentRecord> requestEventIntents)
        {
            var key = $"{processRun.TenantId}|{processRun.TriggerEventId}|{processRun.ProcessRuleId}";
            if (!keys.Add(key))
            {
                return false;
            }

            WorkItemIntents.AddRange(workItemIntents);
            return true;
        }
    }
}
