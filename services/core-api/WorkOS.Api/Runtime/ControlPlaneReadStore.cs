using System.Text.Json;
using Npgsql;

namespace WorkOS.Api.Runtime;

public sealed class ControlPlaneReadStore
{
    private readonly string connectionString;

    public ControlPlaneReadStore(string connectionString)
    {
        this.connectionString = connectionString;
    }

    public IReadOnlyList<ReleaseControlSummary> GetReleases()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select release_id, mr_id, status, owners::text, gate_result_id,
                   rollback_instruction_id, acceptance_scenarios::text,
                   go_criteria::text, no_go_criteria::text
            from control_plane.release_manifests
            order by created_at_utc desc, release_id
            """;

        using var reader = command.ExecuteReader();
        var releases = new List<ReleaseControlSummary>();
        while (reader.Read())
        {
            releases.Add(BuildSummary(
                RequiredText(reader, "release_id"),
                RequiredText(reader, "mr_id"),
                RequiredText(reader, "status"),
                JsonStringArray(NullableText(reader, "owners")),
                NullableText(reader, "gate_result_id"),
                NullableText(reader, "rollback_instruction_id"),
                JsonStringArray(NullableText(reader, "acceptance_scenarios")),
                JsonStringArray(NullableText(reader, "go_criteria")),
                JsonStringArray(NullableText(reader, "no_go_criteria"))));
        }

        return releases;
    }

    public ReleaseControlDetail? GetRelease(string releaseId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select release_id, mr_id, release_name, status, owners::text, commit_sha,
                   migration_version, definition_version, api_schema_hash, ci_run_id,
                   gate_result_id, rollback_instruction_id, feature_flag_ids::text,
                   slice_cutover_state_ids::text, shadow_compare_report_ids::text,
                   invariant_check_ids::text, acceptance_scenarios::text,
                   go_criteria::text, no_go_criteria::text, known_risks::text,
                   created_at_utc, updated_at_utc, released_at_utc, locked_at_utc
            from control_plane.release_manifests
            where release_id = @releaseId
            """;
        command.Parameters.AddWithValue("releaseId", releaseId);

        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            return null;
        }

        var owners = JsonStringArray(NullableText(reader, "owners"));
        var gateResultId = NullableText(reader, "gate_result_id");
        var rollbackInstructionId = NullableText(reader, "rollback_instruction_id");
        var acceptanceScenarios = JsonStringArray(NullableText(reader, "acceptance_scenarios"));
        var goCriteria = JsonStringArray(NullableText(reader, "go_criteria"));
        var noGoCriteria = JsonStringArray(NullableText(reader, "no_go_criteria"));
        var manifest = new ReleaseManifestRead(
            RequiredText(reader, "release_id"),
            RequiredText(reader, "mr_id"),
            RequiredText(reader, "release_name"),
            RequiredText(reader, "status"),
            owners,
            NullableText(reader, "commit_sha"),
            NullableText(reader, "migration_version"),
            RequiredText(reader, "definition_version"),
            NullableText(reader, "api_schema_hash"),
            NullableText(reader, "ci_run_id"),
            gateResultId,
            rollbackInstructionId,
            JsonStringArray(NullableText(reader, "feature_flag_ids")),
            JsonStringArray(NullableText(reader, "slice_cutover_state_ids")),
            JsonStringArray(NullableText(reader, "shadow_compare_report_ids")),
            JsonStringArray(NullableText(reader, "invariant_check_ids")),
            acceptanceScenarios,
            goCriteria,
            noGoCriteria,
            JsonStringArray(NullableText(reader, "known_risks")),
            RequiredDate(reader, "created_at_utc"),
            RequiredDate(reader, "updated_at_utc"),
            NullableDate(reader, "released_at_utc"),
            NullableDate(reader, "locked_at_utc"));

        var summary = BuildSummary(
            manifest.ReleaseId,
            manifest.MrId,
            manifest.Status,
            manifest.Owners,
            manifest.GateResultId,
            manifest.RollbackInstructionId,
            manifest.AcceptanceScenarios,
            manifest.GoCriteria,
            manifest.NoGoCriteria);

        var gateResult = gateResultId is null ? LatestGateResult(manifest.ReleaseId) : GetGateResult(gateResultId);
        var shadowReports = GetShadowCompareReports(manifest.ReleaseId);
        var invariantChecks = GetInvariantChecks(manifest.ReleaseId);
        var featureFlags = GetFeatureFlags(manifest.ReleaseId);
        var cutoverStates = GetSliceCutoverStates(manifest.ReleaseId);
        var rollbackInstruction = rollbackInstructionId is null ? null : GetRollbackInstruction(rollbackInstructionId);
        return new ReleaseControlDetail(
            summary,
            manifest,
            gateResult,
            shadowReports,
            invariantChecks,
            featureFlags,
            cutoverStates,
            rollbackInstruction,
            ReleaseAdmissionPolicy.Evaluate(gateResult, shadowReports, invariantChecks, rollbackInstruction));
    }

    public GateResultRead? GetGateResult(string gateResultId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select gate_result_id, release_id, mr_id, tenant_id, slice_id, gate_name,
                   gate_type, status, severity, ci_run_id, automated_test_refs::text,
                   invariant_check_refs::text, shadow_compare_report_refs::text,
                   business_signoff_refs::text, no_go_items::text, go_items::text,
                   known_risks::text, generated_by, generated_at_utc, input_hash,
                   result_hash
            from control_plane.gate_results
            where gate_result_id = @gateResultId
            """;
        command.Parameters.AddWithValue("gateResultId", gateResultId);

        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadGateResult(reader) : null;
    }

    public ShadowCompareReportRead? GetShadowCompareReport(string id)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = ShadowCompareSelect("shadow_compare_report_id = @id");
        command.Parameters.AddWithValue("id", id);

        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadShadowCompareReport(reader) : null;
    }

    public IReadOnlyList<RuntimeInvariantCheckRead> GetInvariantChecks(string releaseId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select invariant_check_id, release_id, tenant_id, slice_id, invariant_key,
                   description, mode, severity, source_type, check_sql, check_ref,
                   status, observed_value::text, threshold::text, violation_count,
                   sample_violations::text, generated_by, ci_run_id, checked_at_utc
            from control_plane.runtime_invariant_checks
            where release_id = @releaseId
            order by severity, invariant_key
            """;
        command.Parameters.AddWithValue("releaseId", releaseId);

        using var reader = command.ExecuteReader();
        var checks = new List<RuntimeInvariantCheckRead>();
        while (reader.Read())
        {
            checks.Add(ReadInvariantCheck(reader));
        }

        return checks;
    }

    public RollbackInstructionRead? GetRollbackInstruction(string id)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select rollback_instruction_id, release_id, instruction_type,
                   rollback_kind, title, scope::text, allowed_before_status::text,
                   allowed_after_status::text, steps::text, validation_steps::text,
                   owner, risk_level, requires_business_approval,
                   requires_architecture_approval, requires_finance_approval,
                   created_at_utc, updated_at_utc
            from control_plane.rollback_instructions
            where rollback_instruction_id = @id
            """;
        command.Parameters.AddWithValue("id", id);

        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadRollbackInstruction(reader) : null;
    }

    private ReleaseControlSummary BuildSummary(
        string releaseId,
        string mrId,
        string status,
        IReadOnlyList<string> owners,
        string? gateResultId,
        string? rollbackInstructionId,
        IReadOnlyList<string> acceptanceScenarios,
        IReadOnlyList<string> goCriteria,
        IReadOnlyList<string> noGoCriteria)
    {
        var gate = gateResultId is null ? LatestGateResult(releaseId) : GetGateResult(gateResultId);
        var latestShadow = LatestShadowCompareReport(releaseId);
        var invariants = GetInvariantChecks(releaseId);
        var flags = GetFeatureFlags(releaseId);
        var cutovers = GetSliceCutoverStates(releaseId);
        return new ReleaseControlSummary(
            releaseId,
            mrId,
            status,
            owners.FirstOrDefault() ?? string.Empty,
            gate?.GateResultId,
            gate?.Status ?? "not_run",
            latestShadow?.ShadowCompareReportId,
            latestShadow?.Grade ?? "green",
            CountInvariants(invariants),
            flags.FirstOrDefault()?.Status ?? "none",
            cutovers.FirstOrDefault()?.RuntimeMode ?? "legacy",
            rollbackInstructionId,
            AcceptanceProgress.From(acceptanceScenarios, goCriteria, noGoCriteria));
    }

    private GateResultRead? LatestGateResult(string releaseId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select gate_result_id, release_id, mr_id, tenant_id, slice_id, gate_name,
                   gate_type, status, severity, ci_run_id, automated_test_refs::text,
                   invariant_check_refs::text, shadow_compare_report_refs::text,
                   business_signoff_refs::text, no_go_items::text, go_items::text,
                   known_risks::text, generated_by, generated_at_utc, input_hash,
                   result_hash
            from control_plane.gate_results
            where release_id = @releaseId
            order by generated_at_utc desc, gate_result_id
            limit 1
            """;
        command.Parameters.AddWithValue("releaseId", releaseId);

        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadGateResult(reader) : null;
    }

    private IReadOnlyList<ShadowCompareReportRead> GetShadowCompareReports(string releaseId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = ShadowCompareSelect("release_id = @releaseId") + " order by compared_at_utc desc, shadow_compare_report_id";
        command.Parameters.AddWithValue("releaseId", releaseId);

        using var reader = command.ExecuteReader();
        var reports = new List<ShadowCompareReportRead>();
        while (reader.Read())
        {
            reports.Add(ReadShadowCompareReport(reader));
        }

        return reports;
    }

    private ShadowCompareReportRead? LatestShadowCompareReport(string releaseId) =>
        GetShadowCompareReports(releaseId).FirstOrDefault();

    private IReadOnlyList<FeatureFlagRead> GetFeatureFlags(string releaseId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select feature_flag_id, release_id, flag_key, description, status,
                   scope_rules::text, default_behavior::text, created_by,
                   created_at_utc, updated_at_utc, expires_at_utc
            from control_plane.feature_flags
            where release_id = @releaseId
            order by flag_key
            """;
        command.Parameters.AddWithValue("releaseId", releaseId);

        using var reader = command.ExecuteReader();
        var flags = new List<FeatureFlagRead>();
        while (reader.Read())
        {
            flags.Add(new FeatureFlagRead(
                RequiredText(reader, "feature_flag_id"),
                RequiredText(reader, "release_id"),
                RequiredText(reader, "flag_key"),
                RequiredText(reader, "description"),
                RequiredText(reader, "status"),
                JsonObject(NullableText(reader, "scope_rules")),
                JsonObject(NullableText(reader, "default_behavior")),
                RequiredText(reader, "created_by"),
                RequiredDate(reader, "created_at_utc"),
                RequiredDate(reader, "updated_at_utc"),
                NullableDate(reader, "expires_at_utc")));
        }

        return flags;
    }

    private IReadOnlyList<SliceCutoverStateRead> GetSliceCutoverStates(string releaseId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            select cutover_state_id, release_id, tenant_id, slice_id, runtime_mode,
                   previous_runtime_mode, last_shadow_compare_report_id,
                   last_gate_result_id, rollback_instruction_id, started_at_utc,
                   updated_at_utc, ended_at_utc
            from control_plane.slice_cutover_states
            where release_id = @releaseId
            order by tenant_id, slice_id
            """;
        command.Parameters.AddWithValue("releaseId", releaseId);

        using var reader = command.ExecuteReader();
        var states = new List<SliceCutoverStateRead>();
        while (reader.Read())
        {
            states.Add(new SliceCutoverStateRead(
                RequiredText(reader, "cutover_state_id"),
                RequiredText(reader, "release_id"),
                RequiredText(reader, "tenant_id"),
                RequiredText(reader, "slice_id"),
                RequiredText(reader, "runtime_mode"),
                NullableText(reader, "previous_runtime_mode"),
                NullableText(reader, "last_shadow_compare_report_id"),
                NullableText(reader, "last_gate_result_id"),
                NullableText(reader, "rollback_instruction_id"),
                RequiredDate(reader, "started_at_utc"),
                RequiredDate(reader, "updated_at_utc"),
                NullableDate(reader, "ended_at_utc")));
        }

        return states;
    }

    private static string ShadowCompareSelect(string where) => $"""
        select shadow_compare_report_id, release_id, tenant_id, slice_id,
               compare_scope::text, source_legacy_ref, source_active_ref,
               source_shadow_ref, compared_at_utc, grade, total_compared,
               matched_count, mismatch_count, missing_in_shadow_count,
               extra_in_shadow_count, mismatch_examples::text, summary::text,
               generated_by, ci_run_id
        from control_plane.shadow_compare_reports
        where {where}
        """;

    private static GateResultRead ReadGateResult(NpgsqlDataReader reader) =>
        new(
            RequiredText(reader, "gate_result_id"),
            RequiredText(reader, "release_id"),
            RequiredText(reader, "mr_id"),
            NullableText(reader, "tenant_id"),
            NullableText(reader, "slice_id"),
            RequiredText(reader, "gate_name"),
            RequiredText(reader, "gate_type"),
            RequiredText(reader, "status"),
            RequiredText(reader, "severity"),
            NullableText(reader, "ci_run_id"),
            JsonStringArray(NullableText(reader, "automated_test_refs")),
            JsonStringArray(NullableText(reader, "invariant_check_refs")),
            JsonStringArray(NullableText(reader, "shadow_compare_report_refs")),
            JsonStringArray(NullableText(reader, "business_signoff_refs")),
            JsonStringArray(NullableText(reader, "no_go_items")),
            JsonStringArray(NullableText(reader, "go_items")),
            JsonStringArray(NullableText(reader, "known_risks")),
            RequiredText(reader, "generated_by"),
            RequiredDate(reader, "generated_at_utc"),
            RequiredText(reader, "input_hash"),
            RequiredText(reader, "result_hash"));

    private static ShadowCompareReportRead ReadShadowCompareReport(NpgsqlDataReader reader) =>
        new(
            RequiredText(reader, "shadow_compare_report_id"),
            RequiredText(reader, "release_id"),
            RequiredText(reader, "tenant_id"),
            RequiredText(reader, "slice_id"),
            JsonObject(NullableText(reader, "compare_scope")),
            NullableText(reader, "source_legacy_ref"),
            NullableText(reader, "source_active_ref"),
            NullableText(reader, "source_shadow_ref"),
            RequiredDate(reader, "compared_at_utc"),
            RequiredText(reader, "grade"),
            RequiredInt(reader, "total_compared"),
            RequiredInt(reader, "matched_count"),
            RequiredInt(reader, "mismatch_count"),
            RequiredInt(reader, "missing_in_shadow_count"),
            RequiredInt(reader, "extra_in_shadow_count"),
            JsonArray(NullableText(reader, "mismatch_examples")),
            JsonObject(NullableText(reader, "summary")),
            RequiredText(reader, "generated_by"),
            NullableText(reader, "ci_run_id"));

    private static RuntimeInvariantCheckRead ReadInvariantCheck(NpgsqlDataReader reader) =>
        new(
            RequiredText(reader, "invariant_check_id"),
            RequiredText(reader, "release_id"),
            RequiredText(reader, "tenant_id"),
            RequiredText(reader, "slice_id"),
            RequiredText(reader, "invariant_key"),
            RequiredText(reader, "description"),
            RequiredText(reader, "mode"),
            RequiredText(reader, "severity"),
            RequiredText(reader, "source_type"),
            NullableText(reader, "check_sql"),
            NullableText(reader, "check_ref"),
            RequiredText(reader, "status"),
            JsonObject(NullableText(reader, "observed_value")),
            JsonObject(NullableText(reader, "threshold")),
            RequiredInt(reader, "violation_count"),
            JsonArray(NullableText(reader, "sample_violations")),
            RequiredText(reader, "generated_by"),
            NullableText(reader, "ci_run_id"),
            RequiredDate(reader, "checked_at_utc"));

    private static RollbackInstructionRead ReadRollbackInstruction(NpgsqlDataReader reader) =>
        new(
            RequiredText(reader, "rollback_instruction_id"),
            RequiredText(reader, "release_id"),
            RequiredText(reader, "instruction_type"),
            RequiredText(reader, "rollback_kind"),
            RequiredText(reader, "title"),
            JsonObject(NullableText(reader, "scope")),
            JsonStringArray(NullableText(reader, "allowed_before_status")),
            JsonStringArray(NullableText(reader, "allowed_after_status")),
            JsonStringArray(NullableText(reader, "steps")),
            JsonStringArray(NullableText(reader, "validation_steps")),
            RequiredText(reader, "owner"),
            RequiredText(reader, "risk_level"),
            RequiredBool(reader, "requires_business_approval"),
            RequiredBool(reader, "requires_architecture_approval"),
            RequiredBool(reader, "requires_finance_approval"),
            RequiredDate(reader, "created_at_utc"),
            RequiredDate(reader, "updated_at_utc"));

    private static InvariantSeverityCounts CountInvariants(IReadOnlyList<RuntimeInvariantCheckRead> invariants) =>
        new(
            invariants.Count(item => item.Severity == "P0"),
            invariants.Count(item => item.Severity == "P1"),
            invariants.Count(item => item.Severity == "P2"));

    private NpgsqlConnection Open()
    {
        var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        return connection;
    }

    private static string RequiredText(NpgsqlDataReader reader, string column) =>
        NullableText(reader, column) ?? string.Empty;

    private static string? NullableText(NpgsqlDataReader reader, string column)
    {
        var value = reader[column];
        return value is DBNull ? null : Convert.ToString(value);
    }

    private static int RequiredInt(NpgsqlDataReader reader, string column) =>
        Convert.ToInt32(reader[column]);

    private static bool RequiredBool(NpgsqlDataReader reader, string column) =>
        Convert.ToBoolean(reader[column]);

    private static DateTimeOffset RequiredDate(NpgsqlDataReader reader, string column) =>
        reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal(column));

    private static DateTimeOffset? NullableDate(NpgsqlDataReader reader, string column) =>
        reader[column] is DBNull ? null : reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal(column));

    private static IReadOnlyList<string> JsonStringArray(string? json) =>
        string.IsNullOrWhiteSpace(json)
            ? Array.Empty<string>()
            : JsonSerializer.Deserialize<string[]>(json, PostgresProjectionStore.JsonOptions) ?? Array.Empty<string>();

    private static IReadOnlyDictionary<string, object> JsonObject(string? json) =>
        string.IsNullOrWhiteSpace(json)
            ? new Dictionary<string, object>()
            : JsonSerializer.Deserialize<Dictionary<string, object>>(json, PostgresProjectionStore.JsonOptions) ?? new Dictionary<string, object>();

    private static IReadOnlyList<IReadOnlyDictionary<string, object>> JsonArray(string? json) =>
        string.IsNullOrWhiteSpace(json)
            ? Array.Empty<IReadOnlyDictionary<string, object>>()
            : JsonSerializer.Deserialize<List<Dictionary<string, object>>>(json, PostgresProjectionStore.JsonOptions)
                ?.Cast<IReadOnlyDictionary<string, object>>()
                .ToArray()
              ?? Array.Empty<IReadOnlyDictionary<string, object>>();
}

public sealed record ReleaseControlSummary(
    string ReleaseId,
    string MrId,
    string ReleaseStatus,
    string Owner,
    string? GateResultId,
    string GateResultStatus,
    string? ShadowCompareReportId,
    string ShadowGrade,
    InvariantSeverityCounts InvariantCounts,
    string FeatureFlagStatus,
    string SliceRuntimeMode,
    string? RollbackInstructionId,
    AcceptanceProgress AcceptanceProgress);

public sealed record ReleaseControlDetail(
    ReleaseControlSummary Overview,
    ReleaseManifestRead Manifest,
    GateResultRead? GateResult,
    IReadOnlyList<ShadowCompareReportRead> ShadowReports,
    IReadOnlyList<RuntimeInvariantCheckRead> InvariantChecks,
    IReadOnlyList<FeatureFlagRead> FeatureFlags,
    IReadOnlyList<SliceCutoverStateRead> SliceCutoverStates,
    RollbackInstructionRead? RollbackInstruction,
    ReleaseAdmissionStatus Admission);

public sealed record ReleaseManifestRead(
    string ReleaseId,
    string MrId,
    string ReleaseName,
    string Status,
    IReadOnlyList<string> Owners,
    string? CommitSha,
    string? MigrationVersion,
    string DefinitionVersion,
    string? ApiSchemaHash,
    string? CiRunId,
    string? GateResultId,
    string? RollbackInstructionId,
    IReadOnlyList<string> FeatureFlagIds,
    IReadOnlyList<string> SliceCutoverStateIds,
    IReadOnlyList<string> ShadowCompareReportIds,
    IReadOnlyList<string> InvariantCheckIds,
    IReadOnlyList<string> AcceptanceScenarios,
    IReadOnlyList<string> GoCriteria,
    IReadOnlyList<string> NoGoCriteria,
    IReadOnlyList<string> KnownRisks,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? ReleasedAtUtc,
    DateTimeOffset? LockedAtUtc);

public sealed record GateResultRead(
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

public sealed record ShadowCompareReportRead(
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

public sealed record RuntimeInvariantCheckRead(
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

public sealed record FeatureFlagRead(
    string FeatureFlagId,
    string ReleaseId,
    string FlagKey,
    string Description,
    string Status,
    IReadOnlyDictionary<string, object> ScopeRules,
    IReadOnlyDictionary<string, object> DefaultBehavior,
    string CreatedBy,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? ExpiresAtUtc);

public sealed record SliceCutoverStateRead(
    string CutoverStateId,
    string ReleaseId,
    string TenantId,
    string SliceId,
    string RuntimeMode,
    string? PreviousRuntimeMode,
    string? LastShadowCompareReportId,
    string? LastGateResultId,
    string? RollbackInstructionId,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? EndedAtUtc);

public sealed record RollbackInstructionRead(
    string RollbackInstructionId,
    string ReleaseId,
    string InstructionType,
    string RollbackKind,
    string Title,
    IReadOnlyDictionary<string, object> Scope,
    IReadOnlyList<string> AllowedBeforeStatus,
    IReadOnlyList<string> AllowedAfterStatus,
    IReadOnlyList<string> Steps,
    IReadOnlyList<string> ValidationSteps,
    string Owner,
    string RiskLevel,
    bool RequiresBusinessApproval,
    bool RequiresArchitectureApproval,
    bool RequiresFinanceApproval,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record InvariantSeverityCounts(int P0, int P1, int P2);

public sealed record AcceptanceProgress(int Completed, int Total, decimal Percent)
{
    public static AcceptanceProgress From(
        IReadOnlyList<string> acceptanceScenarios,
        IReadOnlyList<string> goCriteria,
        IReadOnlyList<string> noGoCriteria)
    {
        var total = acceptanceScenarios.Count + goCriteria.Count + noGoCriteria.Count;
        var completed = goCriteria.Count;
        var percent = total == 0 ? 0 : Math.Round(completed * 100m / total, 2);
        return new AcceptanceProgress(completed, total, percent);
    }
}
