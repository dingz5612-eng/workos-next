using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.ControlPlaneRunners;

namespace WorkOS.DatabaseSecurityTests;

[TestClass]
public sealed class ShadowPollutionIntegrationTests
{
    [TestMethod]
    public void ShadowRunnerRowsDoNotBecomeOfficialProjectionCheckpoints()
    {
        DatabaseSecurityTestSupport.ApplyMigrations();
        var suffix = Guid.NewGuid().ToString("N");
        var officialBefore = DatabaseSecurityTestSupport.ScalarOwner<long>(
            "select count(*) from projection_checkpoints where source_namespace = 'shadow_runtime'");

        DatabaseSecurityTestSupport.ExecuteOwner($$"""
            insert into projection_rebuild_audits(
                rebuild_id, tenant_id, lens_name, dry_run, status, requested_by,
                before_hash, after_hash, mismatch_count, checkpoint_ids, details, created_at_utc)
            values('rebuild-rtdb-{{suffix}}', 'tenant-rtdb', 'StayBalance', false,
                'matched', 'official-projector', 'before-{{suffix}}', 'after-{{suffix}}',
                0, '[]'::jsonb, '{}'::jsonb, now())
            """);

        DatabaseSecurityTestSupport.ExecuteAsRole(
            "workos_official_projector",
            $$"""
            insert into projection_checkpoints(
                checkpoint_id, rebuild_id, tenant_id, lens_name, payload_hash,
                row_count, body, created_at_utc, source_namespace)
            values('checkpoint-rtdb-{{suffix}}', 'rebuild-rtdb-{{suffix}}', 'tenant-rtdb',
                'StayBalance', 'payload-{{suffix}}', 1, '[]'::jsonb, now(),
                'official_runtime')
            """);

        DatabaseSecurityTestSupport.ExecuteAsRole(
            "workos_shadow_runner",
            $$"""
            insert into shadow_runtime.command_submissions(
                command_submission_id, release_id, tenant_id, slice_id, idempotency_key,
                actor_ref, command_payload)
            values('shadow-sub-rtdb-{{suffix}}', null, 'tenant-rtdb', 'Accommodation.Stay',
                'shadow-idem-{{suffix}}', '{}'::jsonb, '{}'::jsonb);

            insert into shadow_runtime.lens_snapshots(
                lens_snapshot_id, tenant_id, slice_id, lens_id, lens_payload, payload_hash)
            values('shadow-lens-rtdb-{{suffix}}', 'tenant-rtdb', 'Accommodation.Stay',
                'StayBalance', '{"balance": 100}'::jsonb, 'shadow-payload-{{suffix}}');
            """);

        var officialAfter = DatabaseSecurityTestSupport.ScalarOwner<long>(
            "select count(*) from projection_checkpoints where source_namespace = 'shadow_runtime'");
        Assert.AreEqual(officialBefore, officialAfter, "shadow rows must not enter official projection checkpoints.");

        var invariant = new ControlPlaneDatabase(DatabaseSecurityTestSupport.ConnectionString())
            .ProjectionCheckpointShadowNamespaceCheck();
        Assert.AreEqual(0, invariant.ViolationCount);
    }

    [TestMethod]
    public void ProjectionCheckpointRejectsShadowRuntimeSourceNamespace()
    {
        DatabaseSecurityTestSupport.ApplyMigrations();
        var suffix = Guid.NewGuid().ToString("N");
        DatabaseSecurityTestSupport.ExecuteOwner($$"""
            insert into projection_rebuild_audits(
                rebuild_id, tenant_id, lens_name, dry_run, status, requested_by,
                before_hash, after_hash, mismatch_count, checkpoint_ids, details, created_at_utc)
            values('rebuild-rtdb-reject-{{suffix}}', 'tenant-rtdb', 'StayBalance', false,
                'matched', 'official-projector', 'before-{{suffix}}', 'after-{{suffix}}',
                0, '[]'::jsonb, '{}'::jsonb, now())
            """);

        DatabaseSecurityTestSupport.AssertSqlState(
            DatabaseSecurityTestSupport.CheckViolation,
            () => DatabaseSecurityTestSupport.ExecuteAsRole(
                "workos_official_projector",
                $$"""
                insert into projection_checkpoints(
                    checkpoint_id, rebuild_id, tenant_id, lens_name, payload_hash,
                    row_count, body, created_at_utc, source_namespace)
                values('checkpoint-rtdb-shadow-{{suffix}}', 'rebuild-rtdb-reject-{{suffix}}',
                    'tenant-rtdb', 'StayBalance', 'payload-{{suffix}}', 1,
                    '[]'::jsonb, now(), 'shadow_runtime')
                """));
    }

    [TestMethod]
    public void RedShadowCompareReportBlocksGateDecision()
    {
        var decision = GateDecisionCalculator.Calculate(new GateDecisionInput(
            [
                new InvariantCheckEvidence(
                    "inv-rtdb-ok",
                    "release-rtdb",
                    "tenant-rtdb",
                    "Accommodation.Stay",
                    "runtime.control_plane_tables_exist",
                    "Control Plane tables exist",
                    "blocking",
                    "P0",
                    "sql",
                    null,
                    null,
                    "passed",
                    new Dictionary<string, object>(),
                    new Dictionary<string, object>(),
                    0,
                    [],
                    "invariant-runner",
                    "local",
                    DateTimeOffset.UtcNow)
            ],
            [
                new ShadowCompareEvidence(
                    "scr-rtdb-red",
                    "release-rtdb",
                    "tenant-rtdb",
                    "Accommodation.Stay",
                    new Dictionary<string, object>(),
                    null,
                    null,
                    "shadow_runtime.lens_snapshots",
                    DateTimeOffset.UtcNow,
                    "red",
                    1,
                    0,
                    1,
                    0,
                    0,
                    [new Dictionary<string, object> { ["reason"] = "shadow mismatch" }],
                    new Dictionary<string, object>(),
                    "shadow-compare-runner",
                    "local")
            ],
            ["business-signoff-rtdb"],
            new HashSet<string>(),
            true));

        Assert.AreEqual("blocked", decision.Status);
        Assert.AreEqual("P0", decision.Severity);
        Assert.IsTrue(decision.NoGoItems.Any(item => item.Contains("Red shadow compare report", StringComparison.Ordinal)));
    }
}
