using System.Text.Json;
using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class ShadowCompareRunner
{
    private const string SemanticMode = "semantic";

    public static Task<ShadowCompareEvidence> Run(RunnerOptions options)
    {
        var releaseId = options.Get("releaseId", "v5.4-first-batch");
        var tenantId = options.Get("tenantId", "all-tenants");
        var sliceId = options.Get("sliceId", "all-slices");
        var ciRunId = options.Get("ciRunId") ?? Environment.GetEnvironmentVariable("GITHUB_RUN_ID") ?? "local";
        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "shadow-compare-report.json"));
        var configPath = options.Get("config", Path.Combine("docs", "v5.4", "shadow-compare.config.json"));
        var semanticRulesPath = options.Get("semantic-rules", Path.Combine("docs", "v5.4", "shadow-compare-semantic-rules.json"));
        var mode = options.Get("mode");
        var dryRun = options.GetBool("dry-run");
        var config = RunnerJson.Read<ShadowCompareConfig>(ResolveRepoPath(configPath));
        if (mode == "skeleton")
        {
            var skeleton = Build(
                releaseId,
                tenantId,
                sliceId,
                DateTimeOffset.UtcNow,
                "green",
                0,
                0,
                0,
                0,
                0,
                [],
                new Dictionary<string, object> { ["status"] = "skeleton_green", ["config"] = config.Name },
                config,
                ciRunId);
            RunnerJson.Write(outputPath, skeleton);
            Console.WriteLine($"shadow-compare-runner: wrote {Path.GetRelativePath(Directory.GetCurrentDirectory(), outputPath)} grade={skeleton.Grade}");
            return Task.FromResult(skeleton);
        }

        var database = new ControlPlaneDatabase(ControlPlaneDatabase.ResolveConnectionString(options));

        if (!dryRun)
        {
            database.ApplyMigrations(Path.Combine("infra", "db", "migrations"));
            database.EnsureReleaseManifest(releaseId, options.Get("mrId", "local"), ciRunId);
        }

        var report = string.Equals(mode, SemanticMode, StringComparison.OrdinalIgnoreCase)
            ? CompareSemantic(database, config, releaseId, tenantId, sliceId, ciRunId, semanticRulesPath)
            : Compare(database, config, releaseId, tenantId, sliceId, ciRunId);
        if (!dryRun)
        {
            new ControlPlaneWriteStore(database.ConnectionString).WriteShadowCompareReport(new ShadowCompareReportWrite(
                report.ShadowCompareReportId,
                report.ReleaseId,
                report.TenantId,
                report.SliceId,
                report.CompareScope,
                report.SourceLegacyRef,
                report.SourceActiveRef,
                report.SourceShadowRef,
                report.ComparedAtUtc,
                report.Grade,
                report.TotalCompared,
                report.MatchedCount,
                report.MismatchCount,
                report.MissingInShadowCount,
                report.ExtraInShadowCount,
                report.MismatchExamples,
                report.Summary,
                report.GeneratedBy,
                report.CiRunId));
        }

        RunnerJson.Write(outputPath, report);
        Console.WriteLine($"shadow-compare-runner: wrote {Path.GetRelativePath(Directory.GetCurrentDirectory(), outputPath)} grade={report.Grade}");
        return Task.FromResult(report);
    }

    private static ShadowCompareEvidence Compare(
        ControlPlaneDatabase database,
        ShadowCompareConfig config,
        string releaseId,
        string tenantId,
        string sliceId,
        string ciRunId)
    {
        var comparedAt = DateTimeOffset.UtcNow;
        var shadow = TableRef.Parse(config.ShadowTable);
        var active = TableRef.Parse(config.ActiveTable);
        var requiredTables = new[] { shadow, active };
        var missing = requiredTables.Where(table => !database.TableExists(table.Schema, table.Table)).ToArray();
        if (missing.Length > 0)
        {
            return Build(
                releaseId,
                tenantId,
                sliceId,
                comparedAt,
                "red",
                0,
                0,
                0,
                0,
                0,
                missing.Select(table => (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["missing_table"] = table.ToString() }).ToArray(),
                new Dictionary<string, object> { ["status"] = "schema_missing" },
                config,
                ciRunId);
        }

        var shadowCount = database.CountRows(shadow.Schema, shadow.Table);
        var activeCount = database.CountRows(active.Schema, active.Table);
        if (shadowCount == 0 && activeCount == 0)
        {
            return Build(releaseId, tenantId, sliceId, comparedAt, "green", 0, 0, 0, 0, 0, [], new Dictionary<string, object> { ["status"] = "empty_green" }, config, ciRunId);
        }

        var mismatch = Math.Abs(shadowCount - activeCount);
        var grade = mismatch == 0 ? "green" : config.CountMismatchGrade;
        return Build(
            releaseId,
            tenantId,
            sliceId,
            comparedAt,
            grade,
            Convert.ToInt32(Math.Max(shadowCount, activeCount)),
            Convert.ToInt32(Math.Min(shadowCount, activeCount)),
            Convert.ToInt32(mismatch),
            Convert.ToInt32(Math.Max(activeCount - shadowCount, 0)),
            Convert.ToInt32(Math.Max(shadowCount - activeCount, 0)),
            mismatch == 0 ? [] : new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["active_count"] = activeCount, ["shadow_count"] = shadowCount } },
            new Dictionary<string, object> { ["status"] = mismatch == 0 ? "matched" : "count_mismatch" },
            config,
            ciRunId);
    }

    private static ShadowCompareEvidence CompareSemantic(
        ControlPlaneDatabase database,
        ShadowCompareConfig config,
        string releaseId,
        string tenantId,
        string sliceId,
        string ciRunId,
        string semanticRulesPath)
    {
        var comparedAt = DateTimeOffset.UtcNow;
        var resolvedRulesPath = ResolveRepoPath(semanticRulesPath);
        var rules = RunnerJson.Read<ShadowSemanticRules>(resolvedRulesPath);
        var countCompare = Compare(database, config, releaseId, tenantId, sliceId, ciRunId);
        var checks = new List<ShadowSemanticCheckResult>
        {
            CountCompareResult(countCompare, config),
            OfficialContaminationCompare(database, rules),
            CommandSubmissionCompare(database),
            OperationsContractCompare(rules),
            BusinessFactSafetyCompare(database, rules)
        };

        var grade = checks.Any(check => check.Grade == "red")
            ? "red"
            : checks.Any(check => check.Grade == "yellow")
                ? "yellow"
                : "green";
        var failedChecks = checks.Where(check => check.Grade != "green").ToArray();
        var examples = failedChecks
            .SelectMany(check => check.Samples.Select(sample => WithCheckId(check.CheckId, sample)))
            .ToArray();
        var summary = new Dictionary<string, object>
        {
            ["status"] = $"semantic_{grade}",
            ["mode"] = SemanticMode,
            ["rules"] = new Dictionary<string, object>
            {
                ["version"] = rules.Version,
                ["name"] = rules.Name,
                ["path"] = RelativeRepoPath(resolvedRulesPath)
            },
            ["count_compare"] = new Dictionary<string, object>
            {
                ["grade"] = countCompare.Grade,
                ["total_compared"] = countCompare.TotalCompared,
                ["matched_count"] = countCompare.MatchedCount,
                ["mismatch_count"] = countCompare.MismatchCount,
                ["summary"] = countCompare.Summary
            },
            ["semantic_checks"] = checks.Select(check => check.ToSummary()).ToArray(),
            ["red_count"] = checks.Count(check => check.Grade == "red"),
            ["yellow_count"] = checks.Count(check => check.Grade == "yellow"),
            ["green_count"] = checks.Count(check => check.Grade == "green")
        };

        return Build(
            releaseId,
            tenantId,
            sliceId,
            comparedAt,
            grade,
            checks.Count,
            checks.Count(check => check.Grade == "green"),
            failedChecks.Length,
            countCompare.MissingInShadowCount + checks.Where(check => check.CheckId == "operations.contract_response_schema").Sum(check => check.ViolationCount),
            countCompare.ExtraInShadowCount + checks.Where(check => check.CheckId.Contains("contamination", StringComparison.Ordinal) || check.CheckId.Contains("business_fact", StringComparison.Ordinal)).Sum(check => check.ViolationCount),
            examples,
            summary,
            config,
            ciRunId,
            CompareScope(config, SemanticMode, resolvedRulesPath, rules));
    }

    private static ShadowSemanticCheckResult CountCompareResult(ShadowCompareEvidence countCompare, ShadowCompareConfig config)
    {
        var violationCount = countCompare.Grade == "green" ? 0 : Math.Max(countCompare.MismatchCount, 1);
        return new ShadowSemanticCheckResult(
            "count.row_count_compare",
            countCompare.Grade,
            countCompare.Grade == "green" ? "passed" : countCompare.Summary.TryGetValue("status", out var status) ? Convert.ToString(status) ?? "count_mismatch" : "count_mismatch",
            countCompare.Grade == "red" ? "P0" : countCompare.Grade == "yellow" ? "P1" : "P2",
            new Dictionary<string, object>
            {
                ["source_active_ref"] = countCompare.SourceActiveRef ?? string.Empty,
                ["source_shadow_ref"] = countCompare.SourceShadowRef ?? string.Empty,
                ["total_compared"] = countCompare.TotalCompared,
                ["matched_count"] = countCompare.MatchedCount,
                ["mismatch_count"] = countCompare.MismatchCount
            },
            new Dictionary<string, object>
            {
                ["count_mismatch_grade"] = config.CountMismatchGrade
            },
            violationCount,
            countCompare.MismatchExamples);
    }

    private static ShadowSemanticCheckResult OfficialContaminationCompare(ControlPlaneDatabase database, ShadowSemanticRules rules)
    {
        var sourceSamples = OfficialProjectorShadowReadSamples(rules);
        var sourceViolationCount = sourceSamples.Count;
        var dbUnavailable = false;
        SqlInvariantResult dbResult;
        if (!database.TableExists("public", "projection_checkpoints"))
        {
            dbUnavailable = true;
            dbResult = new SqlInvariantResult(
                0,
                new Dictionary<string, object> { ["projection_checkpoints_exists"] = false },
                new Dictionary<string, object> { ["source_namespace_column_exists"] = true },
                []);
        }
        else if (!database.ColumnExists("public", "projection_checkpoints", "source_namespace"))
        {
            dbUnavailable = true;
            dbResult = new SqlInvariantResult(
                0,
                new Dictionary<string, object>
                {
                    ["projection_checkpoints_exists"] = true,
                    ["source_namespace_column_exists"] = false
                },
                new Dictionary<string, object> { ["source_namespace_column_exists"] = true },
                []);
        }
        else
        {
            dbResult = database.ProjectionCheckpointShadowNamespaceCheck();
        }

        var violationCount = sourceViolationCount + dbResult.ViolationCount;
        var grade = violationCount > 0 ? "red" : dbUnavailable ? "yellow" : "green";
        var samples = sourceSamples.Concat(dbResult.SampleViolations.Select(sample => WithReason("projection_checkpoint_consumes_shadow_runtime", sample))).ToArray();
        return new ShadowSemanticCheckResult(
            "shadow.official_contamination",
            grade,
            grade == "green" ? "passed" : dbUnavailable ? "db_level_check_unavailable" : "contaminated",
            grade == "red" ? "P0" : grade == "yellow" ? "P1" : "P2",
            new Dictionary<string, object>
            {
                ["source_file_violation_count"] = sourceViolationCount,
                ["projection_checkpoint_violation_count"] = dbResult.ViolationCount,
                ["db_level_check_unavailable"] = dbUnavailable,
                ["db_observed"] = dbResult.ObservedValue
            },
            new Dictionary<string, object>
            {
                ["max_official_projector_shadow_runtime_reads"] = 0,
                ["projection_checkpoints_source_namespace"] = "not shadow_runtime"
            },
            violationCount,
            samples);
    }

    private static ShadowSemanticCheckResult CommandSubmissionCompare(ControlPlaneDatabase database)
    {
        if (!database.TableExists("shadow_runtime", "command_submissions"))
        {
            return new ShadowSemanticCheckResult(
                "shadow.command_submission_compare",
                "red",
                "schema_missing",
                "P0",
                new Dictionary<string, object> { ["shadow_command_submissions_exists"] = false },
                new Dictionary<string, object> { ["shadow_command_submissions_exists"] = true },
                1,
                new[]
                {
                    (IReadOnlyDictionary<string, object>)new Dictionary<string, object>
                    {
                        ["missing_table"] = "shadow_runtime.command_submissions"
                    }
                });
        }

        var shadowDuplicatePayloads = database.ExecuteInvariantSql("""
            with conflicting_keys as (
                select
                    tenant_id,
                    slice_id,
                    idempotency_key,
                    count(distinct nullif(coalesce(command_payload->>'payloadHash', command_payload->>'payload_hash'), '')) as payload_hash_count,
                    jsonb_agg(command_submission_id order by submitted_at_utc) as command_submission_ids
                from shadow_runtime.command_submissions
                group by tenant_id, slice_id, idempotency_key
                having count(distinct nullif(coalesce(command_payload->>'payloadHash', command_payload->>'payload_hash'), '')) > 1
            )
            select
                count(*)::int as violation_count,
                jsonb_build_object('conflicting_idempotency_keys', count(*)) as observed_value,
                jsonb_build_object('max_payload_hashes_per_idempotency_key', 1) as threshold,
                coalesce(
                    jsonb_agg(
                        jsonb_build_object(
                            'tenant_id', tenant_id,
                            'slice_id', slice_id,
                            'idempotency_key', idempotency_key,
                            'payload_hash_count', payload_hash_count,
                            'command_submission_ids', command_submission_ids
                        )
                    ),
                    '[]'::jsonb
                ) as sample_violations
            from conflicting_keys
            """);

        SqlInvariantResult activeHashConflicts;
        SqlInvariantResult activeMissingPayloadHashes;
        if (database.TableExists("public", "audit_events"))
        {
            activeHashConflicts = database.ExecuteInvariantSql("""
                with joined as (
                    select
                        shadow.command_submission_id,
                        shadow.tenant_id,
                        shadow.idempotency_key,
                        coalesce(shadow.command_payload->>'payloadHash', shadow.command_payload->>'payload_hash') as shadow_payload_hash,
                        coalesce(
                            active.body->>'payloadHash',
                            active.body->>'payload_hash',
                            active.body #>> '{command,payloadHash}',
                            active.body #>> '{result,payloadHash}',
                            active.body #>> '{request,payloadHash}'
                        ) as active_payload_hash
                    from shadow_runtime.command_submissions shadow
                    join public.audit_events active
                      on active.idempotency_key = shadow.idempotency_key
                    where coalesce(shadow.idempotency_key, '') <> ''
                ),
                conflicts as (
                    select *
                    from joined
                    where coalesce(shadow_payload_hash, '') <> ''
                      and coalesce(active_payload_hash, '') <> ''
                      and shadow_payload_hash <> active_payload_hash
                )
                select
                    count(*)::int as violation_count,
                    jsonb_build_object('active_payload_hash_conflicts', count(*)) as observed_value,
                    jsonb_build_object('same_idempotency_key_payload_hash_must_match', true) as threshold,
                    coalesce(
                        jsonb_agg(
                            jsonb_build_object(
                                'command_submission_id', command_submission_id,
                                'tenant_id', tenant_id,
                                'idempotency_key', idempotency_key,
                                'shadow_payload_hash', shadow_payload_hash,
                                'active_payload_hash', active_payload_hash
                            )
                        ),
                        '[]'::jsonb
                    ) as sample_violations
                from conflicts
                """);
            activeMissingPayloadHashes = database.ExecuteInvariantSql("""
                with joined as (
                    select
                        shadow.command_submission_id,
                        shadow.tenant_id,
                        shadow.idempotency_key,
                        coalesce(shadow.command_payload->>'payloadHash', shadow.command_payload->>'payload_hash') as shadow_payload_hash,
                        coalesce(
                            active.body->>'payloadHash',
                            active.body->>'payload_hash',
                            active.body #>> '{command,payloadHash}',
                            active.body #>> '{result,payloadHash}',
                            active.body #>> '{request,payloadHash}'
                        ) as active_payload_hash
                    from shadow_runtime.command_submissions shadow
                    join public.audit_events active
                      on active.idempotency_key = shadow.idempotency_key
                    where coalesce(shadow.idempotency_key, '') <> ''
                ),
                missing_hashes as (
                    select *
                    from joined
                    where coalesce(shadow_payload_hash, '') <> ''
                      and coalesce(active_payload_hash, '') = ''
                )
                select
                    count(*)::int as violation_count,
                    jsonb_build_object('active_rows_missing_payload_hash', count(*)) as observed_value,
                    jsonb_build_object('active_payload_hash_should_be_present_for_compared_commands', true) as threshold,
                    coalesce(
                        jsonb_agg(
                            jsonb_build_object(
                                'command_submission_id', command_submission_id,
                                'tenant_id', tenant_id,
                                'idempotency_key', idempotency_key,
                                'shadow_payload_hash', shadow_payload_hash
                            )
                        ),
                        '[]'::jsonb
                    ) as sample_violations
                from missing_hashes
                """);
        }
        else
        {
            activeHashConflicts = new SqlInvariantResult(0, new Dictionary<string, object> { ["active_fact_table_exists"] = false }, new Dictionary<string, object>(), []);
            activeMissingPayloadHashes = new SqlInvariantResult(0, new Dictionary<string, object> { ["active_fact_table_exists"] = false }, new Dictionary<string, object>(), []);
        }

        var redCount = shadowDuplicatePayloads.ViolationCount + activeHashConflicts.ViolationCount;
        var yellowCount = activeMissingPayloadHashes.ViolationCount;
        var grade = redCount > 0 ? "red" : yellowCount > 0 ? "yellow" : "green";
        var samples = shadowDuplicatePayloads.SampleViolations.Select(sample => WithReason("shadow_idempotency_payload_hash_conflict", sample))
            .Concat(activeHashConflicts.SampleViolations.Select(sample => WithReason("active_fact_payload_hash_conflict", sample)))
            .Concat(activeMissingPayloadHashes.SampleViolations.Select(sample => WithReason("active_fact_payload_hash_missing", sample)))
            .ToArray();

        return new ShadowSemanticCheckResult(
            "shadow.command_submission_compare",
            grade,
            grade == "green" ? "passed" : grade == "red" ? "payload_hash_conflict" : "active_payload_hash_missing",
            grade == "red" ? "P0" : grade == "yellow" ? "P1" : "P2",
            new Dictionary<string, object>
            {
                ["shadow_duplicate_payload_hash_conflicts"] = shadowDuplicatePayloads.ViolationCount,
                ["active_payload_hash_conflicts"] = activeHashConflicts.ViolationCount,
                ["active_payload_hash_missing"] = activeMissingPayloadHashes.ViolationCount
            },
            new Dictionary<string, object>
            {
                ["max_payload_hash_conflicts"] = 0,
                ["same_command_payload_hash_must_match"] = true
            },
            redCount + yellowCount,
            samples);
    }

    private static ShadowSemanticCheckResult OperationsContractCompare(ShadowSemanticRules rules)
    {
        var servicePath = ResolveRepoPath(Path.Combine("services", "core-api", "WorkOS.Api", "Runtime", "OperationsRuntimeService.cs"));
        var source = File.Exists(servicePath) ? File.ReadAllText(servicePath) : string.Empty;
        return ShadowSemanticChecks.CompareOperationsContract(rules, source, RelativeRepoPath(servicePath));
    }

    private static ShadowSemanticCheckResult BusinessFactSafetyCompare(ControlPlaneDatabase database, ShadowSemanticRules rules)
    {
        var ledgerResult = database.ShadowLedgerOfficialContaminationCheck(rules.OfficialLedgerTables ?? []);
        var domainEventResult = database.ShadowDomainEventOfficialContaminationCheck();
        var violationCount = ledgerResult.ViolationCount + domainEventResult.ViolationCount;
        var samples = ledgerResult.SampleViolations.Select(sample => WithReason("shadow_ledger_entry_in_official_ledger_table", sample))
            .Concat(domainEventResult.SampleViolations.Select(sample => WithReason("shadow_domain_event_in_public_domain_events", sample)))
            .ToArray();
        return new ShadowSemanticCheckResult(
            "shadow.business_fact_safety",
            violationCount == 0 ? "green" : "red",
            violationCount == 0 ? "passed" : "shadow_fact_contamination",
            violationCount == 0 ? "P2" : "P0",
            new Dictionary<string, object>
            {
                ["ledger_contamination"] = ledgerResult.ObservedValue,
                ["domain_event_contamination"] = domainEventResult.ObservedValue
            },
            new Dictionary<string, object>
            {
                ["max_shadow_ledger_entries_in_public_ledger_tables"] = 0,
                ["max_shadow_domain_events_in_public_domain_events"] = 0
            },
            violationCount,
            samples);
    }

    private static IReadOnlyList<IReadOnlyDictionary<string, object>> OfficialProjectorShadowReadSamples(ShadowSemanticRules rules)
    {
        var samples = new List<IReadOnlyDictionary<string, object>>();
        foreach (var relativePath in rules.OfficialProjectorFiles ?? [])
        {
            var path = ResolveRepoPath(relativePath);
            if (!File.Exists(path))
            {
                continue;
            }

            var text = File.ReadAllText(path);
            if (!text.Contains("shadow_runtime", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            samples.Add(new Dictionary<string, object>
            {
                ["reason"] = "official_projector_source_references_shadow_runtime",
                ["file"] = RelativeRepoPath(path)
            });
        }

        return samples;
    }

    private static ShadowCompareEvidence Build(
        string releaseId,
        string tenantId,
        string sliceId,
        DateTimeOffset comparedAt,
        string grade,
        int totalCompared,
        int matchedCount,
        int mismatchCount,
        int missingInShadowCount,
        int extraInShadowCount,
        IReadOnlyList<IReadOnlyDictionary<string, object>> examples,
        IReadOnlyDictionary<string, object> summary,
        ShadowCompareConfig config,
        string ciRunId,
        IReadOnlyDictionary<string, object>? compareScope = null)
    {
        return new ShadowCompareEvidence(
            ShadowCompareReportId: $"scr-v54-{Sanitize(config.Name)}",
            ReleaseId: releaseId,
            TenantId: tenantId,
            SliceId: sliceId,
            CompareScope: compareScope ?? CompareScope(config),
            SourceLegacyRef: config.LegacyRef,
            SourceActiveRef: config.ActiveTable,
            SourceShadowRef: config.ShadowTable,
            ComparedAtUtc: comparedAt,
            Grade: grade,
            TotalCompared: totalCompared,
            MatchedCount: matchedCount,
            MismatchCount: mismatchCount,
            MissingInShadowCount: missingInShadowCount,
            ExtraInShadowCount: extraInShadowCount,
            MismatchExamples: examples,
            Summary: summary,
            GeneratedBy: "shadow-compare-runner",
            CiRunId: ciRunId);
    }

    private static string Sanitize(string value) =>
        new(value.Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray());

    private static string ResolveRepoPath(string path)
    {
        if (Path.IsPathRooted(path) || File.Exists(path) || Directory.Exists(path))
        {
            return path;
        }

        return Path.Combine(RepoRoot(), path);
    }

    private static string RepoRoot()
    {
        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        return current?.FullName ?? Directory.GetCurrentDirectory();
    }

    private static string RelativeRepoPath(string path)
    {
        var fullPath = Path.GetFullPath(path);
        return Path.GetRelativePath(RepoRoot(), fullPath).Replace('\\', '/');
    }

    private static IReadOnlyDictionary<string, object> CompareScope(
        ShadowCompareConfig config,
        string type = "count",
        string? semanticRulesPath = null,
        ShadowSemanticRules? semanticRules = null)
    {
        var scope = new Dictionary<string, object>
        {
            ["name"] = config.Name,
            ["type"] = type
        };

        if (config.CompareScopes is { Count: > 0 })
        {
            scope["compare_scopes"] = config.CompareScopes;
        }

        if (config.GreenRules is { Count: > 0 } || config.YellowRules is { Count: > 0 } || config.RedRules is { Count: > 0 })
        {
            scope["grade_rules"] = new Dictionary<string, object>
            {
                ["green"] = config.GreenRules ?? Array.Empty<string>(),
                ["yellow"] = config.YellowRules ?? Array.Empty<string>(),
                ["red"] = config.RedRules ?? Array.Empty<string>()
            };
        }

        if (type == SemanticMode && semanticRules is not null && semanticRulesPath is not null)
        {
            scope["semantic_rules"] = new Dictionary<string, object>
            {
                ["version"] = semanticRules.Version,
                ["name"] = semanticRules.Name,
                ["path"] = RelativeRepoPath(semanticRulesPath),
                ["checks"] = semanticRules.Checks.Select(check => check.CheckId).ToArray()
            };
        }

        return scope;
    }

    private static IReadOnlyDictionary<string, object> WithReason(string reason, IReadOnlyDictionary<string, object> sample)
    {
        var copy = new Dictionary<string, object>(sample, StringComparer.Ordinal);
        copy["reason"] = reason;
        return copy;
    }

    private static IReadOnlyDictionary<string, object> WithCheckId(string checkId, IReadOnlyDictionary<string, object> sample)
    {
        var copy = new Dictionary<string, object>(sample, StringComparer.Ordinal);
        copy["check_id"] = checkId;
        return copy;
    }

}

public sealed record ShadowCompareConfig(
    string Name,
    string ShadowTable,
    string ActiveTable,
    string CountMismatchGrade,
    string? LegacyRef,
    IReadOnlyList<string>? CompareScopes = null,
    IReadOnlyList<string>? GreenRules = null,
    IReadOnlyList<string>? YellowRules = null,
    IReadOnlyList<string>? RedRules = null);

public sealed record ShadowSemanticRules(
    int Version,
    string Name,
    ShadowSemanticGradeRules GradeRules,
    IReadOnlyList<ShadowSemanticRule> Checks,
    IReadOnlyList<string>? OperationsContractRequiredFields = null,
    IReadOnlyList<string>? OfficialProjectorFiles = null,
    IReadOnlyList<string>? OfficialLedgerTables = null);

public sealed record ShadowSemanticGradeRules(
    IReadOnlyList<string> Green,
    IReadOnlyList<string> Yellow,
    IReadOnlyList<string> Red);

public sealed record ShadowSemanticRule(
    string CheckId,
    string Description,
    string RedWhen,
    string? YellowWhen = null);

public sealed record ShadowCompareEvidence(
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

public static class ShadowSemanticChecks
{
    public static ShadowSemanticCheckResult CompareOperationsContract(
        ShadowSemanticRules rules,
        string serviceSource,
        string servicePath)
    {
        var requiredFields = (rules.OperationsContractRequiredFields is { Count: > 0 }
            ? rules.OperationsContractRequiredFields
            : new[] { "workItemId", "submissionId", "commitStatus", "projectionStatus" }).ToArray();
        var operationMissing = requiredFields
            .Where(field => !serviceSource.Contains(ToPascal(field), StringComparison.Ordinal))
            .ToArray();
        var compatibilityMissing = requiredFields
            .Where(field => !serviceSource.Contains($"[\"{field}\"]", StringComparison.Ordinal))
            .ToArray();
        var missing = operationMissing.Select(field => (schema: "operations_confirm_result", field))
            .Concat(compatibilityMissing.Select(field => (schema: "old_compatibility_response", field)))
            .ToArray();
        var samples = missing
            .Select(item => (IReadOnlyDictionary<string, object>)new Dictionary<string, object>
            {
                ["schema"] = item.schema,
                ["missing_field"] = item.field
            })
            .ToArray();

        return new ShadowSemanticCheckResult(
            "operations.contract_response_schema",
            missing.Length == 0 ? "green" : "red",
            missing.Length == 0 ? "passed" : "missing_required_field",
            missing.Length == 0 ? "P2" : "P0",
            new Dictionary<string, object>
            {
                ["service_path"] = servicePath,
                ["required_fields"] = requiredFields,
                ["operations_confirm_result_missing"] = operationMissing,
                ["old_compatibility_response_missing"] = compatibilityMissing
            },
            new Dictionary<string, object>
            {
                ["missing_required_fields"] = 0
            },
            missing.Length,
            samples);
    }

    private static string ToPascal(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? value
            : char.ToUpperInvariant(value[0]) + value[1..];
}

public sealed record ShadowSemanticCheckResult(
    string CheckId,
    string Grade,
    string Status,
    string Severity,
    IReadOnlyDictionary<string, object> ObservedValue,
    IReadOnlyDictionary<string, object> Threshold,
    int ViolationCount,
    IReadOnlyList<IReadOnlyDictionary<string, object>> Samples)
{
    public IReadOnlyDictionary<string, object> ToSummary() => new Dictionary<string, object>
    {
        ["check_id"] = CheckId,
        ["grade"] = Grade,
        ["status"] = Status,
        ["severity"] = Severity,
        ["violation_count"] = ViolationCount,
        ["observed_value"] = ObservedValue,
        ["threshold"] = Threshold,
        ["samples"] = Samples
    };
}

internal sealed record TableRef(string Schema, string Table)
{
    public static TableRef Parse(string value)
    {
        var parts = value.Split('.', 2);
        if (parts.Length != 2)
        {
            throw new InvalidOperationException($"Expected schema.table, got {value}");
        }

        return new TableRef(parts[0], parts[1]);
    }

    public override string ToString() => $"{Schema}.{Table}";
}
