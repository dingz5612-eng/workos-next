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
        Assert.IsTrue(attemptMigration.Contains("attempt_count"));
    }

    [TestMethod]
    public void RuntimeContractTestsProtectDestructiveReset()
    {
        var testProgram = File.ReadAllText(RepoPath("tests", "WorkOS.RuntimeContractTests", "Program.cs"));
        Assert.IsTrue(testProgram.Contains("AssertTestDatabaseAllowed"));
        Assert.IsTrue(testProgram.Contains("TEST_DATABASE"));
        Assert.IsTrue(testProgram.Contains("_test"));
    }
}
