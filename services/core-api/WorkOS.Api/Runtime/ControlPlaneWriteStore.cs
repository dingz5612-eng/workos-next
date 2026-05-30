using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

public sealed class ControlPlaneWriteStore
{
    private readonly string connectionString;

    public ControlPlaneWriteStore(string connectionString)
    {
        this.connectionString = connectionString;
    }

    public void WriteGateResult(GateResultWrite result)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into control_plane.gate_results(
                gate_result_id, release_id, mr_id, tenant_id, slice_id, gate_name,
                gate_type, status, severity, ci_run_id, automated_test_refs,
                invariant_check_refs, shadow_compare_report_refs, business_signoff_refs,
                no_go_items, go_items, known_risks, generated_by, generated_at_utc,
                input_hash, result_hash)
            values(
                @gateResultId, @releaseId, @mrId, @tenantId, @sliceId, @gateName,
                @gateType, @status, @severity, @ciRunId, @automatedTestRefs::jsonb,
                @invariantCheckRefs::jsonb, @shadowCompareReportRefs::jsonb,
                @businessSignoffRefs::jsonb, @noGoItems::jsonb, @goItems::jsonb,
                @knownRisks::jsonb, @generatedBy, @generatedAtUtc, @inputHash,
                @resultHash)
            on conflict(gate_result_id) do update set
                status = excluded.status,
                severity = excluded.severity,
                ci_run_id = excluded.ci_run_id,
                automated_test_refs = excluded.automated_test_refs,
                invariant_check_refs = excluded.invariant_check_refs,
                shadow_compare_report_refs = excluded.shadow_compare_report_refs,
                business_signoff_refs = excluded.business_signoff_refs,
                no_go_items = excluded.no_go_items,
                go_items = excluded.go_items,
                known_risks = excluded.known_risks,
                generated_by = excluded.generated_by,
                generated_at_utc = excluded.generated_at_utc,
                input_hash = excluded.input_hash,
                result_hash = excluded.result_hash
            """;
        command.Parameters.AddWithValue("gateResultId", result.GateResultId);
        command.Parameters.AddWithValue("releaseId", result.ReleaseId);
        command.Parameters.AddWithValue("mrId", result.MrId);
        command.Parameters.AddWithValue("tenantId", (object?)result.TenantId ?? DBNull.Value);
        command.Parameters.AddWithValue("sliceId", (object?)result.SliceId ?? DBNull.Value);
        command.Parameters.AddWithValue("gateName", result.GateName);
        command.Parameters.AddWithValue("gateType", result.GateType);
        command.Parameters.AddWithValue("status", result.Status);
        command.Parameters.AddWithValue("severity", result.Severity);
        command.Parameters.AddWithValue("ciRunId", (object?)result.CiRunId ?? DBNull.Value);
        AddJson(command, "automatedTestRefs", result.AutomatedTestRefs);
        AddJson(command, "invariantCheckRefs", result.InvariantCheckRefs);
        AddJson(command, "shadowCompareReportRefs", result.ShadowCompareReportRefs);
        AddJson(command, "businessSignoffRefs", result.BusinessSignoffRefs);
        AddJson(command, "noGoItems", result.NoGoItems);
        AddJson(command, "goItems", result.GoItems);
        AddJson(command, "knownRisks", result.KnownRisks);
        command.Parameters.AddWithValue("generatedBy", result.GeneratedBy);
        command.Parameters.AddWithValue("generatedAtUtc", result.GeneratedAtUtc);
        command.Parameters.AddWithValue("inputHash", result.InputHash);
        command.Parameters.AddWithValue("resultHash", result.ResultHash);
        command.ExecuteNonQuery();
    }

    public void WriteRuntimeInvariantCheck(RuntimeInvariantCheckWrite check)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into control_plane.runtime_invariant_checks(
                invariant_check_id, release_id, tenant_id, slice_id, invariant_key,
                description, mode, severity, source_type, check_sql, check_ref,
                status, observed_value, threshold, violation_count, sample_violations,
                generated_by, ci_run_id, checked_at_utc)
            values(
                @invariantCheckId, @releaseId, @tenantId, @sliceId, @invariantKey,
                @description, @mode, @severity, @sourceType, @checkSql, @checkRef,
                @status, @observedValue::jsonb, @threshold::jsonb, @violationCount,
                @sampleViolations::jsonb, @generatedBy, @ciRunId, @checkedAtUtc)
            on conflict(invariant_check_id) do update set
                description = excluded.description,
                mode = excluded.mode,
                severity = excluded.severity,
                source_type = excluded.source_type,
                check_sql = excluded.check_sql,
                check_ref = excluded.check_ref,
                status = excluded.status,
                observed_value = excluded.observed_value,
                threshold = excluded.threshold,
                violation_count = excluded.violation_count,
                sample_violations = excluded.sample_violations,
                generated_by = excluded.generated_by,
                ci_run_id = excluded.ci_run_id,
                checked_at_utc = excluded.checked_at_utc
            """;
        command.Parameters.AddWithValue("invariantCheckId", check.InvariantCheckId);
        command.Parameters.AddWithValue("releaseId", check.ReleaseId);
        command.Parameters.AddWithValue("tenantId", check.TenantId);
        command.Parameters.AddWithValue("sliceId", check.SliceId);
        command.Parameters.AddWithValue("invariantKey", check.InvariantKey);
        command.Parameters.AddWithValue("description", check.Description);
        command.Parameters.AddWithValue("mode", check.Mode);
        command.Parameters.AddWithValue("severity", check.Severity);
        command.Parameters.AddWithValue("sourceType", check.SourceType);
        command.Parameters.AddWithValue("checkSql", (object?)check.CheckSql ?? DBNull.Value);
        command.Parameters.AddWithValue("checkRef", (object?)check.CheckRef ?? DBNull.Value);
        command.Parameters.AddWithValue("status", check.Status);
        AddJson(command, "observedValue", check.ObservedValue);
        AddJson(command, "threshold", check.Threshold);
        command.Parameters.AddWithValue("violationCount", check.ViolationCount);
        AddJson(command, "sampleViolations", check.SampleViolations);
        command.Parameters.AddWithValue("generatedBy", check.GeneratedBy);
        command.Parameters.AddWithValue("ciRunId", (object?)check.CiRunId ?? DBNull.Value);
        command.Parameters.AddWithValue("checkedAtUtc", check.CheckedAtUtc);
        command.ExecuteNonQuery();
    }

    public void WriteShadowCompareReport(ShadowCompareReportWrite report)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = $"""
            insert into control_plane.shadow_compare_reports(
                shadow_compare_report_id, release_id, tenant_id, slice_id, compare_scope,
                {ControlPlaneDbMapping.SourceBaselineRefColumn}, source_active_ref, source_shadow_ref, compared_at_utc,
                grade, total_compared, matched_count, mismatch_count,
                missing_in_shadow_count, extra_in_shadow_count, mismatch_examples,
                summary, generated_by, ci_run_id)
            values(
                @shadowCompareReportId, @releaseId, @tenantId, @sliceId,
                @compareScope::jsonb, @sourceLegacyRef, @sourceActiveRef,
                @sourceShadowRef, @comparedAtUtc, @grade, @totalCompared,
                @matchedCount, @mismatchCount, @missingInShadowCount,
                @extraInShadowCount, @mismatchExamples::jsonb, @summary::jsonb,
                @generatedBy, @ciRunId)
            on conflict(shadow_compare_report_id) do update set
                compare_scope = excluded.compare_scope,
                {ControlPlaneDbMapping.SourceBaselineRefColumn} = excluded.{ControlPlaneDbMapping.SourceBaselineRefColumn},
                source_active_ref = excluded.source_active_ref,
                source_shadow_ref = excluded.source_shadow_ref,
                compared_at_utc = excluded.compared_at_utc,
                grade = excluded.grade,
                total_compared = excluded.total_compared,
                matched_count = excluded.matched_count,
                mismatch_count = excluded.mismatch_count,
                missing_in_shadow_count = excluded.missing_in_shadow_count,
                extra_in_shadow_count = excluded.extra_in_shadow_count,
                mismatch_examples = excluded.mismatch_examples,
                summary = excluded.summary,
                generated_by = excluded.generated_by,
                ci_run_id = excluded.ci_run_id
            """;
        command.Parameters.AddWithValue("shadowCompareReportId", report.ShadowCompareReportId);
        command.Parameters.AddWithValue("releaseId", report.ReleaseId);
        command.Parameters.AddWithValue("tenantId", report.TenantId);
        command.Parameters.AddWithValue("sliceId", report.SliceId);
        AddJson(command, "compareScope", report.CompareScope);
        command.Parameters.AddWithValue("sourceLegacyRef", (object?)report.SourceLegacyRef ?? DBNull.Value);
        command.Parameters.AddWithValue("sourceActiveRef", (object?)report.SourceActiveRef ?? DBNull.Value);
        command.Parameters.AddWithValue("sourceShadowRef", (object?)report.SourceShadowRef ?? DBNull.Value);
        command.Parameters.AddWithValue("comparedAtUtc", report.ComparedAtUtc);
        command.Parameters.AddWithValue("grade", report.Grade);
        command.Parameters.AddWithValue("totalCompared", report.TotalCompared);
        command.Parameters.AddWithValue("matchedCount", report.MatchedCount);
        command.Parameters.AddWithValue("mismatchCount", report.MismatchCount);
        command.Parameters.AddWithValue("missingInShadowCount", report.MissingInShadowCount);
        command.Parameters.AddWithValue("extraInShadowCount", report.ExtraInShadowCount);
        AddJson(command, "mismatchExamples", report.MismatchExamples);
        AddJson(command, "summary", report.Summary);
        command.Parameters.AddWithValue("generatedBy", report.GeneratedBy);
        command.Parameters.AddWithValue("ciRunId", (object?)report.CiRunId ?? DBNull.Value);
        command.ExecuteNonQuery();
    }

    private NpgsqlConnection Open()
    {
        var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        return connection;
    }

    private static void AddJson<T>(NpgsqlCommand command, string name, T value)
    {
        command.Parameters.AddWithValue(name, NpgsqlDbType.Jsonb, JsonSerializer.Serialize(value, PostgresProjectionStore.JsonOptions));
    }
}

public sealed record GateResultWrite(
    string GateResultId,
    string ReleaseId,
    string MrId,
    string? TenantId,
    string? SliceId,
    string GateName,
    string GateType,
    string Status,
    string Severity,
    string? CiRunId,
    IReadOnlyList<string> AutomatedTestRefs,
    IReadOnlyList<string> InvariantCheckRefs,
    IReadOnlyList<string> ShadowCompareReportRefs,
    IReadOnlyList<string> BusinessSignoffRefs,
    IReadOnlyList<string> NoGoItems,
    IReadOnlyList<string> GoItems,
    IReadOnlyList<string> KnownRisks,
    string GeneratedBy,
    DateTimeOffset GeneratedAtUtc,
    string InputHash,
    string ResultHash);

public sealed record RuntimeInvariantCheckWrite(
    string InvariantCheckId,
    string ReleaseId,
    string TenantId,
    string SliceId,
    string InvariantKey,
    string Description,
    string Mode,
    string Severity,
    string SourceType,
    string? CheckSql,
    string? CheckRef,
    string Status,
    IReadOnlyDictionary<string, object> ObservedValue,
    IReadOnlyDictionary<string, object> Threshold,
    int ViolationCount,
    IReadOnlyList<IReadOnlyDictionary<string, object>> SampleViolations,
    string GeneratedBy,
    string? CiRunId,
    DateTimeOffset CheckedAtUtc);

public sealed record ShadowCompareReportWrite(
    string ShadowCompareReportId,
    string ReleaseId,
    string TenantId,
    string SliceId,
    IReadOnlyDictionary<string, object> CompareScope,
    string? SourceLegacyRef,
    string? SourceActiveRef,
    string? SourceShadowRef,
    DateTimeOffset ComparedAtUtc,
    string Grade,
    int TotalCompared,
    int MatchedCount,
    int MismatchCount,
    int MissingInShadowCount,
    int ExtraInShadowCount,
    IReadOnlyList<IReadOnlyDictionary<string, object>> MismatchExamples,
    IReadOnlyDictionary<string, object> Summary,
    string GeneratedBy,
    string? CiRunId);
