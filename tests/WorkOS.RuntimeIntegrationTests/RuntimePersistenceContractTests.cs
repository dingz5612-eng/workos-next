using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class RuntimePersistenceContractTests
{
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

    [TestMethod]
    public void ConfirmUnitOfWorkOwnsAuditOutboxAndAggregateBoundary()
    {
        var unitOfWork = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "ConfirmUnitOfWork.cs"));
        Assert.IsTrue(unitOfWork.Contains("InsertAuditEventAndOutbox"));
        Assert.IsTrue(unitOfWork.Contains("sliceAggregates.Apply"));
        Assert.IsTrue(unitOfWork.Contains("db.Commit()"));
    }

    [TestMethod]
    public void OutboxMigrationDeclaresClaimAndAttemptFields()
    {
        var claimMigration = File.ReadAllText(RepoPath("infra", "db", "migrations", "012_outbox_claim_dead_letter.sql"));
        var attemptMigration = File.ReadAllText(RepoPath("infra", "db", "migrations", "013_outbox_attempt_count.sql"));
        Assert.IsTrue(claimMigration.Contains("claimed_by"));
        Assert.IsTrue(claimMigration.Contains("dead_lettered_at_utc"));
        Assert.IsTrue(claimMigration.Contains("attempt_count"));
        Assert.IsFalse(claimMigration.Contains("retry_count"), "claim/dead-letter migration must declare attempt_count directly");
        Assert.IsTrue(attemptMigration.Contains("attempt_count"));

        var outboxStorage = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeOutboxStorage.cs"));
        Assert.IsTrue(outboxStorage.Contains("attempt_count"));
        Assert.IsFalse(outboxStorage.Contains("retry_count"), "runtime outbox code must not update retry_count");
    }

    [TestMethod]
    public void RuntimeContractTestsProtectDestructiveReset()
    {
        var testProgram = File.ReadAllText(RepoPath("tests", "WorkOS.RuntimeContractTests", "Program.cs"));
        Assert.IsTrue(testProgram.Contains("AssertTestDatabaseAllowed"));
        Assert.IsTrue(testProgram.Contains("TEST_DATABASE"));
        Assert.IsTrue(testProgram.Contains("_test"));
    }

    [TestMethod]
    public void EvidenceAndCardInstanceMigrationDeclaresRuntimeOwnershipTables()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "014_runtime_evidence_card_instances.sql"));
        foreach (var term in new[]
        {
            "card_instances",
            "evidence_objects",
            "evidence_attachments",
            "evidence_requirements",
            "card_instance_id",
            "submission_id",
            "requirement_id"
        })
        {
            Assert.IsTrue(migration.Contains(term), $"migration must declare {term}");
        }

        var unitOfWork = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "ConfirmUnitOfWork.cs"));
        Assert.IsTrue(unitOfWork.Contains("MarkSubmitted"));
        Assert.IsTrue(unitOfWork.Contains("MarkConfirmed"));
        Assert.IsTrue(unitOfWork.Contains("MarkUsed"));
    }
}
