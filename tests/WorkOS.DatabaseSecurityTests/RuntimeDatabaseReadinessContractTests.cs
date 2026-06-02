using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.DatabaseSecurityTests;

[TestClass]
public sealed class RuntimeDatabaseReadinessContractTests
{
    [TestMethod]
    public void RuntimeMigrationRunnerUsesPostgresAdvisoryLock()
    {
        var runner = File.ReadAllText(DatabaseSecurityTestSupport.RepoPath(
            "services", "core-api", "WorkOS.Api", "Runtime", "PostgresMigrationRunner.cs"));

        StringAssert.Contains(runner, "pg_advisory_lock");
        StringAssert.Contains(runner, "pg_advisory_unlock");
        StringAssert.Contains(runner, "schema_migrations");
    }

    [TestMethod]
    public void RuntimeApiDeclaresLiveReadyAndHealthReadiness()
    {
        var program = File.ReadAllText(DatabaseSecurityTestSupport.RepoPath(
            "services", "core-api", "WorkOS.Api", "Program.cs"));
        var startup = File.ReadAllText(DatabaseSecurityTestSupport.RepoPath(
            "services", "core-api", "WorkOS.Api", "Runtime", "RuntimeStartupValidator.cs"));

        StringAssert.Contains(program, "MapGet(\"/live\"");
        StringAssert.Contains(program, "MapGet(\"/ready\"");
        StringAssert.Contains(program, "RuntimeReadiness.Check(connectionString)");
        StringAssert.Contains(startup, "schema_migrations");
        StringAssert.Contains(startup, "operations_work_items");
        StringAssert.Contains(startup, "ledger_transactions");
    }
}
