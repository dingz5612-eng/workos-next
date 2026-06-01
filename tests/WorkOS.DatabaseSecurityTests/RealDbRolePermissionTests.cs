using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.DatabaseSecurityTests;

[TestClass]
public sealed class RealDbRolePermissionTests
{
    [TestMethod]
    public void OfficialProjectorCannotReadOrWriteShadowRuntime()
    {
        DatabaseSecurityTestSupport.ApplyMigrations();

        DatabaseSecurityTestSupport.AssertSqlState(
            DatabaseSecurityTestSupport.PermissionDenied,
            () => DatabaseSecurityTestSupport.ExecuteAsRole(
                "workos_official_projector",
                "select count(*) from shadow_runtime.command_submissions"));

        DatabaseSecurityTestSupport.AssertSqlState(
            DatabaseSecurityTestSupport.PermissionDenied,
            () => DatabaseSecurityTestSupport.ExecuteAsRole(
                "workos_official_projector",
                """
                insert into shadow_runtime.command_submissions(
                    command_submission_id, tenant_id, slice_id, idempotency_key, actor_ref, command_payload)
                values('shadow-official-denied', 'tenant-rtdb', 'Accommodation.Stay', 'idem-denied',
                    '{}'::jsonb, '{}'::jsonb)
                """));
    }

    [TestMethod]
    public void ShadowRunnerAndGateRunnerCannotWriteOfficialBusinessFacts()
    {
        DatabaseSecurityTestSupport.ApplyMigrations();

        DatabaseSecurityTestSupport.AssertSqlState(
            DatabaseSecurityTestSupport.PermissionDenied,
            () => DatabaseSecurityTestSupport.ExecuteAsRole(
                "workos_shadow_runner",
                """
                insert into operations_domain_events(
                    event_id, submission_id, tenant_id, case_id, work_item_id, event_type,
                    causation_id, correlation_id, occurred_at_utc, payload)
                values('evt-shadow-denied', 'sub-shadow-denied', 'tenant-rtdb', 'case-rtdb',
                    'wi-rtdb', 'ShadowShouldNotWriteOfficial', 'sub-shadow-denied',
                    'case-rtdb', now(), '{}'::jsonb)
                """));

        DatabaseSecurityTestSupport.AssertSqlState(
            DatabaseSecurityTestSupport.PermissionDenied,
            () => DatabaseSecurityTestSupport.ExecuteAsRole(
                "workos_gate_runner",
                """
                insert into operations_domain_events(
                    event_id, submission_id, tenant_id, case_id, work_item_id, event_type,
                    causation_id, correlation_id, occurred_at_utc, payload)
                values('evt-gate-denied', 'sub-gate-denied', 'tenant-rtdb', 'case-rtdb',
                    'wi-rtdb', 'GateShouldNotWriteOfficial', 'sub-gate-denied',
                    'case-rtdb', now(), '{}'::jsonb)
                """));
    }

    [TestMethod]
    public void ControlPlaneRolesCanOnlyWriteTheirOwnedEvidenceTables()
    {
        DatabaseSecurityTestSupport.ApplyMigrations();
        var suffix = Guid.NewGuid().ToString("N");
        var releaseId = $"release-rtdb-{suffix}";
        var gateId = $"gate-rtdb-{suffix}";
        DatabaseSecurityTestSupport.SeedRelease(releaseId);
        DatabaseSecurityTestSupport.ExecuteOwner($"""
            insert into control_plane.gate_results(
                gate_result_id, release_id, mr_id, tenant_id, slice_id, gate_name,
                gate_type, status, severity, ci_run_id, automated_test_refs,
                invariant_check_refs, shadow_compare_report_refs, business_signoff_refs,
                no_go_items, go_items, known_risks, generated_by, generated_at_utc,
                input_hash, result_hash)
            values(
                '{gateId}', '{releaseId}', 'RT-DB', 'tenant-rtdb', 'Accommodation.Stay',
                'rt-db-seed', 'automated', 'blocked', 'P0', 'local',
                '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
                '["seed"]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'gate-runner',
                now(), 'input-seed', 'result-seed')
            """);

        DatabaseSecurityTestSupport.ExecuteAsRole(
            "workos_gate_runner",
            $"""
            insert into control_plane.gate_results(
                gate_result_id, release_id, mr_id, tenant_id, slice_id, gate_name,
                gate_type, status, severity, ci_run_id, automated_test_refs,
                invariant_check_refs, shadow_compare_report_refs, business_signoff_refs,
                no_go_items, go_items, known_risks, generated_by, generated_at_utc,
                input_hash, result_hash)
            values(
                'gate-rtdb-allowed-{suffix}', '{releaseId}', 'RT-DB', 'tenant-rtdb',
                'Accommodation.Stay', 'rt-db-allowed', 'automated', 'blocked', 'P0',
                'local', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
                '["allowed blocked gate"]'::jsonb, '[]'::jsonb, '[]'::jsonb,
                'gate-runner', now(), 'input-{suffix}', 'result-{suffix}')
            """);

        DatabaseSecurityTestSupport.AssertSqlState(
            DatabaseSecurityTestSupport.PermissionDenied,
            () => DatabaseSecurityTestSupport.ExecuteAsRole(
                "workos_release_operator",
                $"update control_plane.gate_results set status = 'passed' where gate_result_id = '{gateId}'"));

        DatabaseSecurityTestSupport.AssertSqlState(
            DatabaseSecurityTestSupport.PermissionDenied,
            () => DatabaseSecurityTestSupport.ExecuteAsRole(
                "workos_invariant_runner",
                $"""
                insert into control_plane.gate_results(
                    gate_result_id, release_id, mr_id, gate_name, gate_type, status,
                    severity, ci_run_id, generated_by, input_hash, result_hash)
                values('gate-invariant-denied-{suffix}', '{releaseId}', 'RT-DB',
                    'rt-db-denied', 'automated', 'blocked', 'P0', 'local',
                    'gate-runner', 'input-denied', 'result-denied')
                """));
    }

    [TestMethod]
    public void ShadowCompareRunnerWritesOnlyShadowCompareReports()
    {
        DatabaseSecurityTestSupport.ApplyMigrations();
        var suffix = Guid.NewGuid().ToString("N");
        var releaseId = $"release-rtdb-shadow-{suffix}";
        DatabaseSecurityTestSupport.SeedRelease(releaseId);

        DatabaseSecurityTestSupport.ExecuteAsRole(
            "workos_shadow_compare_runner",
            $$"""
            insert into control_plane.shadow_compare_reports(
                shadow_compare_report_id, release_id, tenant_id, slice_id, compare_scope,
                source_shadow_ref, grade, total_compared, matched_count, mismatch_count,
                missing_in_shadow_count, extra_in_shadow_count, mismatch_examples,
                summary, generated_by, ci_run_id)
            values(
                'scr-rtdb-allowed-{{suffix}}', '{{releaseId}}', 'tenant-rtdb',
                'Accommodation.Stay', '{}'::jsonb, 'shadow_runtime.domain_events',
                'green', 1, 1, 0, 0, 0, '[]'::jsonb, '{}'::jsonb,
                'shadow-compare-runner', 'local')
            """);

        DatabaseSecurityTestSupport.AssertSqlState(
            DatabaseSecurityTestSupport.PermissionDenied,
            () => DatabaseSecurityTestSupport.ExecuteAsRole(
                "workos_shadow_compare_runner",
                $"""
                insert into control_plane.gate_results(
                    gate_result_id, release_id, mr_id, gate_name, gate_type, status,
                    severity, ci_run_id, generated_by, input_hash, result_hash)
                values('gate-shadow-compare-denied-{suffix}', '{releaseId}', 'RT-DB',
                    'rt-db-denied', 'automated', 'blocked', 'P0', 'local',
                    'gate-runner', 'input-denied', 'result-denied')
                """));
    }
}
