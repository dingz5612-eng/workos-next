using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class ProjectionRebuildToolTests
{
    [TestMethod]
    public void projection_rebuild_recreates_work_queue()
    {
        var store = FakeStore(("WorkQueueLens", """{"workItemId":"WI-1","sourceEventId":"EVT-1"}"""));
        var result = new ProjectionRebuildService(store).Rebuild(AuthorizedRequest("T1", "WorkQueueLens"));

        Assert.AreEqual("matched", result.Status);
        CollectionAssert.Contains(result.LensNames.ToArray(), "WorkQueueLens");
        Assert.AreEqual(1, store.Checkpoints.Count);
        Assert.AreEqual("WorkQueueLens", store.Checkpoints.Single().LensName);
        Assert.AreEqual(1, store.Audits.Count);
    }

    [TestMethod]
    public void projection_rebuild_recreates_stay_balance()
    {
        var store = FakeStore(("StayBalanceLens", """{"stayId":"S-1","balance":100,"sourceEventId":"EVT-2"}"""));
        var result = new ProjectionRebuildService(store).Rebuild(AuthorizedRequest("T1", "StayBalanceLens"));

        Assert.AreEqual("StayBalanceLens", result.Lenses.Single().LensName);
        Assert.AreEqual(1, result.Lenses.Single().AfterRowCount);
        Assert.AreEqual(result.Lenses.Single().AfterHash, store.Checkpoints.Single().PayloadHash);
    }

    [TestMethod]
    public void projection_rebuild_recreates_deposit_balance()
    {
        var store = FakeStore(("DepositBalanceLens", """{"depositId":"D-1","amount":3000,"sourceEventId":"EVT-3"}"""));
        var result = new ProjectionRebuildService(store).Rebuild(AuthorizedRequest("T1", "DepositBalanceLens"));

        Assert.AreEqual("matched", result.Status);
        Assert.AreEqual("DepositBalanceLens", store.Checkpoints.Single().LensName);
    }

    [TestMethod]
    public void projection_rebuild_recreates_risk_command()
    {
        var store = FakeStore(("RiskCommandLens", """{"riskId":"risk-debt","sourceEventId":"EVT-4"}"""));
        var result = new ProjectionRebuildService(store).Rebuild(AuthorizedRequest("T1", "RiskCommandLens"));

        Assert.AreEqual("RiskCommandLens", result.Lenses.Single().LensName);
        Assert.AreEqual(0, result.MismatchCount);
        Assert.AreEqual(1, store.Checkpoints.Count);
    }

    [TestMethod]
    public void rebuild_does_not_create_domain_event()
    {
        var source = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "ProjectionRebuildTool.cs"));

        Assert.IsFalse(source.Contains("insert into audit_events", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(source.Contains("insert into domain_events", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(source.Contains("AppendAuditEventAndOutbox", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void dry_run_compares_before_after_without_checkpoint()
    {
        var store = FakeStore(("StayBalanceLens", """{"stayId":"S-1","sourceEventId":"EVT-2"}"""));
        var result = new ProjectionRebuildService(store).Rebuild(AuthorizedRequest("T1", "StayBalanceLens", dryRun: true));

        Assert.IsTrue(result.DryRun);
        Assert.AreEqual(0, result.CheckpointIds.Count);
        Assert.AreEqual(0, store.Checkpoints.Count);
        Assert.AreEqual(1, store.Audits.Count);
        Assert.AreEqual(result.BeforeHash, result.AfterHash);
    }

    [TestMethod]
    public void event_range_rebuild_filters_rows_and_records_checkpoint_range()
    {
        var store = FakeStore(
            ("StayBalanceLens", """{"stayId":"S-1","sourceEventId":"EVT-1"}"""),
            ("StayBalanceLens", """{"stayId":"S-2","sourceEventId":"EVT-2"}"""),
            ("StayBalanceLens", """{"stayId":"S-3","sourceEventId":"EVT-3"}"""));
        store.RangeEventIds.Add("EVT-2");

        var result = new ProjectionRebuildService(store).Rebuild(AuthorizedRequest("T1", "StayBalanceLens", fromEventId: "EVT-2", toEventId: "EVT-2"));

        Assert.AreEqual(1, result.Lenses.Single().AfterRowCount);
        Assert.AreEqual("EVT-2", store.Checkpoints.Single().FromEventId);
        Assert.AreEqual("EVT-2", store.Checkpoints.Single().ToEventId);
        Assert.AreEqual("EVT-2", store.Checkpoints.Single().SourceEventHighWatermark);
    }

    [TestMethod]
    public void projection_rebuild_catalog_includes_required_final_ops_lenses()
    {
        CollectionAssert.AreEqual(new[]
        {
            "WorkQueueLens",
            "CaseTimelineLens",
            "BedInventoryLens",
            "RoomReadinessLens",
            "StayBalanceLens",
            "PaymentRiskLens",
            "DepositBalanceLens",
            "DepositLiabilityLens",
            "CheckoutQueueLens",
            "ServiceTaskQueueLens",
            "RiskCommandLens",
            "PeriodPerformanceLens"
        }, ProjectionRebuildLensCatalog.RequiredLensNames.ToArray());
    }

    [TestMethod]
    public void projection_rebuild_migration_declares_checkpoint_and_audit_tables()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "022_projection_rebuild_ops.sql"));

        foreach (var term in new[]
        {
            "create table if not exists projection_rebuild_audits",
            "create table if not exists projection_checkpoints",
            "source_event_high_watermark",
            "payload_hash",
            "dry_run boolean not null"
        })
        {
            Assert.IsTrue(migration.Contains(term, StringComparison.OrdinalIgnoreCase), $"projection rebuild migration missing {term}");
        }
    }

    [TestMethod]
    public void projection_rebuild_script_exposes_required_command_options()
    {
        var script = File.ReadAllText(RepoPath("scripts", "projection", "rebuild"));
        var parsed = ProjectionRebuildCli.Parse(new[]
        {
            "--tenant", "T1",
            "--lens", "StayBalanceLens",
            "--from-event", "EVT-1",
            "--to-event", "EVT-100",
            "--requested-by", "ops-user",
            "--reason", "production rebuild verification",
            "--actor-role", "operator",
            "--capabilities", "projection.rebuild",
            "--device-id", "pc-1",
            "--device-trust", "trusted",
            "--dry-run"
        });

        Assert.IsTrue(script.Contains("WorkOS.ProjectionTools.csproj"));
        Assert.AreEqual("T1", parsed.Request.TenantId);
        Assert.AreEqual("StayBalanceLens", parsed.Request.LensName);
        Assert.AreEqual("EVT-1", parsed.Request.FromEventId);
        Assert.AreEqual("EVT-100", parsed.Request.ToEventId);
        Assert.IsTrue(parsed.Request.DryRun);
        CollectionAssert.Contains(parsed.Request.ActorCapabilities!.ToArray(), "projection.rebuild");
        Assert.AreEqual("trusted", parsed.Request.DeviceTrustStatus);
    }

    [TestMethod]
    public void projection_rebuild_requires_capability_trusted_device_and_audit_reason()
    {
        var store = FakeStore(("StayBalanceLens", """{"stayId":"S-1","sourceEventId":"EVT-2"}"""));
        var service = new ProjectionRebuildService(store);

        AssertInvalidOperation(() => service.Rebuild(new ProjectionRebuildRequest(
            "T1",
            "StayBalanceLens",
            RequestedBy: "ops-user",
            Reason: "production repair",
            ActorRole: "operator",
            ActorCapabilities: Array.Empty<string>(),
            DeviceId: "pc-1",
            DeviceTrustStatus: "trusted")));

        AssertInvalidOperation(() => service.Rebuild(new ProjectionRebuildRequest(
            "T1",
            "StayBalanceLens",
            RequestedBy: "ops-user",
            Reason: "production repair",
            ActorRole: "operator",
            ActorCapabilities: ["projection.rebuild"],
            DeviceId: "pc-1",
            DeviceTrustStatus: "untrusted")));
    }

    private static FakeProjectionRebuildStore FakeStore(params (string Lens, string Row)[] rows)
    {
        var store = new FakeProjectionRebuildStore();
        foreach (var group in rows.GroupBy(item => item.Lens))
        {
            store.Rows[group.Key] = group.Select(item => item.Row).ToArray();
        }

        return store;
    }

    private static ProjectionRebuildRequest AuthorizedRequest(
        string tenantId,
        string? lensName = null,
        string? fromEventId = null,
        string? toEventId = null,
        bool dryRun = false) =>
        new(
            tenantId,
            lensName,
            fromEventId,
            toEventId,
            dryRun,
            RequestedBy: "ops-user",
            Reason: "production rebuild verification",
            ActorRole: "operator",
            ActorCapabilities: ["projection.rebuild"],
            DeviceId: "pc-1",
            DeviceTrustStatus: "trusted",
            Surface: "pc");

    private static void AssertInvalidOperation(Action action)
    {
        try
        {
            action();
        }
        catch (InvalidOperationException)
        {
            return;
        }

        Assert.Fail("Expected InvalidOperationException.");
    }

    private static string RepoPath(params string[] parts)
    {
        var cursor = new DirectoryInfo(AppContext.BaseDirectory);
        while (cursor is not null && !File.Exists(Path.Combine(cursor.FullName, "WorkOSNext.sln")))
        {
            cursor = cursor.Parent;
        }

        if (cursor is null)
        {
            throw new DirectoryNotFoundException("Could not locate WorkOSNext repo root.");
        }

        return Path.Combine(new[] { cursor.FullName }.Concat(parts).ToArray());
    }

    private sealed class FakeProjectionRebuildStore : IProjectionRebuildStore
    {
        public Dictionary<string, IReadOnlyList<string>> Rows { get; } = new(StringComparer.OrdinalIgnoreCase);

        public List<string> RangeEventIds { get; } = new();

        public List<ProjectionCheckpointWrite> Checkpoints { get; } = new();

        public List<ProjectionRebuildResult> Audits { get; } = new();

        public ProjectionLensSnapshot ReadCurrentLens(string tenantId, string lensName) =>
            Snapshot(lensName);

        public ProjectionLensSnapshot RebuildLensFromFacts(string tenantId, string lensName) =>
            Snapshot(lensName);

        public IReadOnlyList<string> ReadEventIdsInRange(string tenantId, string? fromEventId, string? toEventId) =>
            RangeEventIds;

        public void WriteCheckpoint(ProjectionCheckpointWrite checkpoint) =>
            Checkpoints.Add(checkpoint);

        public void WriteAudit(ProjectionRebuildResult result, ProjectionRebuildRequest request) =>
            Audits.Add(result);

        private ProjectionLensSnapshot Snapshot(string lensName) =>
            ProjectionRebuildService.Snapshot(
                lensName,
                Rows.TryGetValue(lensName, out var rows) ? rows : Array.Empty<string>(),
                RangeEventIds.LastOrDefault());
    }
}
