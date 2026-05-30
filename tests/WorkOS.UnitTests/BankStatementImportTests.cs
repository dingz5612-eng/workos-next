using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class BankStatementImportTests
{
    [TestMethod]
    public void bank_statement_import_creates_transactions()
    {
        var writer = new CapturingWriter();
        var service = new BankStatementImportService(writer);

        var result = service.Confirm(Request("""
            occurredAt,amount,currency,direction,externalRef,description
            2026-05-01T10:00:00Z,1200.50,KGS,credit,MB-001,Rent payment
            2026-05-01T11:00:00Z,700,KGS,debit,MB-002,Refund paid
            """), "finance-1");

        Assert.AreEqual("imported", result.Status);
        Assert.AreEqual(2, result.ParsedCount);
        Assert.AreEqual(0, result.RejectedCount);
        Assert.AreEqual(2, result.Transactions.Count);
        Assert.AreEqual("MB-001", result.Transactions[0].ExternalRef);
        Assert.AreEqual("credit", result.Transactions[0].Direction);
        Assert.AreEqual(1200.50m, result.Transactions[0].Amount);
        Assert.IsNotNull(writer.LastWrite);
        Assert.AreEqual(2, writer.LastWrite!.Transactions.Count);
    }

    [TestMethod]
    public void invalid_rows_rejected()
    {
        var writer = new CapturingWriter();
        var service = new BankStatementImportService(writer);

        var result = service.Confirm(Request("""
            occurredAt,amount,currency,direction,externalRef,description
            bad-date,1200,KGS,credit,MB-001,Rent payment
            2026-05-01T11:00:00Z,-1,KGS,sideways,MB-002,Refund paid
            2026-05-01T12:00:00Z,900,KGS,credit,,Generated ref payment
            """), "finance-1");

        Assert.AreEqual("partially_rejected", result.Status);
        Assert.AreEqual(1, result.ParsedCount);
        Assert.AreEqual(2, result.RejectedCount);
        Assert.AreEqual(1, result.Transactions.Count);
        Assert.AreEqual("generated-row-4", result.Transactions[0].ExternalRef);
        Assert.IsTrue(result.RejectedRows.Any(row => row.Errors.Contains("invalid_occurredAt")));
        Assert.IsTrue(result.RejectedRows.Any(row => row.Errors.Contains("invalid_amount")));
        Assert.IsTrue(result.RejectedRows.Any(row => row.Errors.Contains("invalid_direction")));
    }

    [TestMethod]
    public void import_does_not_create_payment_fact()
    {
        var writer = new CapturingWriter();
        var service = new BankStatementImportService(writer);

        service.Confirm(Request("""
            occurredAt,amount,currency,direction,externalRef,description
            2026-05-01T10:00:00Z,1200,KGS,credit,MB-001,Rent payment
            """), "finance-1");

        Assert.IsNotNull(writer.LastWrite);
        Assert.AreEqual(1, writer.LastWrite!.Transactions.Count);
        Assert.AreEqual(0, writer.PaymentFactWrites);

        var storage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeBankStatementImportStorage.cs"));
        Assert.IsFalse(storage.Contains("hostel_payments", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(storage.Contains("finance_reconciliations", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(storage.Contains("payment_matches", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void import_does_not_write_payment_confirmed_event()
    {
        var serviceSource = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "BankStatementImportService.cs"));
        var storageSource = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeBankStatementImportStorage.cs"));
        var program = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Program.cs"));

        Assert.IsFalse(serviceSource.Contains("PaymentConfirmed", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(storageSource.Contains("PaymentConfirmed", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(program.Contains("/api/payment/confirm", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void import_file_access_audited()
    {
        var storage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeBankStatementImportStorage.cs"));
        Assert.IsTrue(storage.Contains("content_sha256", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("audit_trail", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(storage.Contains("bank_statement_import_file_accessed", StringComparison.OrdinalIgnoreCase));

        var writer = new CapturingWriter();
        var service = new BankStatementImportService(writer);
        service.Confirm(Request("""
            occurredAt,amount,currency,direction,externalRef,description
            2026-05-01T10:00:00Z,1200,KGS,credit,MB-001,Rent payment
            """) with { OriginalFileId = "evd-bank-import" }, "finance-1");
        Assert.AreEqual("evd-bank-import", writer.LastWrite?.OriginalFileId);
    }

    private static BankStatementImportRequest Request(string csv) =>
        new("tenant-1", "manual_csv", csv, ImportedBy: "finance-1", ImportId: "bank-import-test");

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

    private sealed class CapturingWriter : IBankStatementImportWriter
    {
        public BankStatementImportWrite? LastWrite { get; private set; }

        public int PaymentFactWrites { get; private set; }

        public BankStatementImportResult Save(BankStatementImportWrite import)
        {
            LastWrite = import;
            return new BankStatementImportResult(
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
}
