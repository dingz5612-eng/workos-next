using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class CorrectionCenterReversalTests
{
    [TestMethod]
    public void payment_allocation_reversal_from_correction_center()
    {
        var storage = ReadRuntimeFile("RuntimeCorrectionCenterStorage.cs");
        var ledgerState = ReadRuntimeFile("RuntimeAccommodationLedgerStorage.cs");
        var contract = ReadRuntimeContract();

        AssertContains(storage, "AppendPaymentAllocationReversal");
        AssertContains(storage, "insert into payment_allocations");
        AssertContains(storage, "'correction_reversal'");
        AssertContains(storage, "CorrectionCenterEvents.PaymentAllocationReversed");
        AssertContains(storage, "-Math.Abs(target.Amount)");
        AssertContains(ledgerState, "sum(confirmed_amount)");
        AssertContains(ledgerState, "sum(allocated_amount)");
        AssertContains(contract, "payment_allocation_reversal_from_correction_center");
        AssertContains(contract, "availablePaymentAmount recalculated");
    }

    [TestMethod]
    public void deposit_entry_reversal_from_correction_center()
    {
        var storage = ReadRuntimeFile("RuntimeCorrectionCenterStorage.cs");
        var contract = ReadRuntimeContract();

        AssertContains(storage, "\"deposit\" or \"refund\" => LoadDepositTransactionTarget");
        AssertContains(storage, "AppendDepositTransactionReversal");
        AssertContains(storage, "insert into deposit_transactions");
        AssertContains(storage, "CorrectionCenterEvents.DepositEntryReversed");
        AssertContains(storage, "-Math.Abs(target.Amount)");
        AssertContains(contract, "deposit_entry_reversal_from_correction_center");
        AssertContains(contract, "availableRefund recalculated");
    }

    [TestMethod]
    public void charge_adjustment_from_correction_center()
    {
        var storage = ReadRuntimeFile("RuntimeCorrectionCenterStorage.cs");
        var contract = ReadRuntimeContract();

        AssertContains(storage, "AppendChargeAdjustment");
        AssertContains(storage, "insert into hostel_charges");
        AssertContains(storage, "'correction_adjustment'");
        AssertContains(storage, "CorrectionCenterEvents.ChargeAdjusted");
        AssertContains(contract, "charge_adjustment_from_correction_center");
        AssertContains(contract, "charge_correction_entry rebuilds charge total");
    }

    [TestMethod]
    public void stay_balance_rebuild_after_correction()
    {
        var storage = ReadRuntimeFile("RuntimeCorrectionCenterStorage.cs");
        var contract = ReadRuntimeContract();

        AssertContains(storage, "RebuildStayBalance");
        AssertContains(storage, "insert into stay_balances");
        AssertContains(storage, "confirmed_payments = excluded.confirmed_payments");
        AssertContains(storage, "allocated_payments = excluded.allocated_payments");
        AssertContains(contract, "stay_balance_rebuild_after_correction");
        AssertContains(contract, "StayBalanceLens");
    }

    [TestMethod]
    public void deposit_balance_rebuild_after_correction()
    {
        var storage = ReadRuntimeFile("RuntimeCorrectionCenterStorage.cs");
        var contract = ReadRuntimeContract();

        AssertContains(storage, "RebuildDepositBalance");
        AssertContains(storage, "update deposit_liabilities");
        AssertContains(storage, "liability_balance = greatest");
        AssertContains(contract, "deposit_balance_rebuild_after_correction");
        AssertContains(contract, "DepositLiabilityLens");
    }

    [TestMethod]
    public void correction_does_not_delete_original_event()
    {
        var storage = ReadRuntimeFile("RuntimeCorrectionCenterStorage.cs");
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "020_correction_center_schema.sql"));
        var contract = ReadRuntimeContract();

        AssertContains(storage, "InsertEventsForApply");
        AssertContains(storage, "InsertReversalEntry");
        AssertContains(storage, "InsertCorrectionEntry");
        Assert.IsFalse(storage.Contains("delete from audit_events", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(storage.Contains("delete from payment_allocations", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(storage.Contains("delete from deposit_transactions", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(storage.Contains("delete from hostel_charges", StringComparison.OrdinalIgnoreCase));
        AssertContains(migration, "ledger_entry_update_forbidden_or_guarded");
        AssertContains(contract, "correction_does_not_delete_original_event");
    }

    private static string ReadRuntimeFile(string fileName) =>
        File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", fileName));

    private static string ReadRuntimeContract() =>
        File.ReadAllText(RepoPath("tests", "WorkOS.RuntimeContractTests", "Program.cs"));

    private static void AssertContains(string text, string expected) =>
        Assert.IsTrue(text.Contains(expected, StringComparison.OrdinalIgnoreCase), $"Expected to find '{expected}'.");

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
}
