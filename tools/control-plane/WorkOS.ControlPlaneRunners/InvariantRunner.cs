using System.Diagnostics;
using System.Text.Json;
using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class InvariantRunner
{
    private static readonly HashSet<string> ValidModes = new(StringComparer.Ordinal) { "blocking", "observing" };
    private static readonly HashSet<string> ValidSeverities = new(StringComparer.Ordinal) { "P0", "P1", "P2" };

    public static Task<IReadOnlyList<InvariantCheckEvidence>> Run(RunnerOptions options)
    {
        var releaseId = options.Get("releaseId", "v5.4-first-batch");
        var tenantId = options.Get("tenantId", "all-tenants");
        var sliceId = options.Get("sliceId", "all-slices");
        var ciRunId = ResolveCiRunId(options);
        var definitionsPath = options.Get("definitions", Path.Combine("docs", "v5.4", "invariant-definitions.json"));
        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "invariant-checks.json"));
        var dryRun = options.GetBool("dry-run");
        var database = new ControlPlaneDatabase(ControlPlaneDatabase.ResolveConnectionString(options));
        var definitions = RunnerJson.Read<InvariantDefinitionFile>(definitionsPath).Invariants;

        if (!dryRun)
        {
            database.ApplyMigrations(Path.Combine("infra", "db", "migrations"));
            database.EnsureReleaseManifest(releaseId, options.Get("mrId", "local"), ciRunId);
        }

        var results = definitions.Select(definition =>
        {
            ValidateDefinition(definition);
            return ExecuteDefinition(definition, database, releaseId, tenantId, sliceId, ciRunId);
        }).ToArray();

        if (!dryRun)
        {
            var store = new ControlPlaneWriteStore(database.ConnectionString);
            foreach (var result in results)
            {
                store.WriteRuntimeInvariantCheck(new RuntimeInvariantCheckWrite(
                    result.InvariantCheckId,
                    result.ReleaseId,
                    result.TenantId,
                    result.SliceId,
                    result.InvariantKey,
                    result.Description,
                    result.Mode,
                    result.Severity,
                    result.SourceType,
                    result.CheckSql,
                    result.CheckRef,
                    result.Status,
                    result.ObservedValue,
                    result.Threshold,
                    result.ViolationCount,
                    result.SampleViolations,
                    result.GeneratedBy,
                    result.CiRunId,
                    result.CheckedAtUtc));
            }
        }

        RunnerJson.Write(outputPath, results);
        Console.WriteLine($"invariant-runner: wrote {Path.GetRelativePath(Directory.GetCurrentDirectory(), outputPath)} count={results.Length}");
        return Task.FromResult<IReadOnlyList<InvariantCheckEvidence>>(results);
    }

    private static InvariantCheckEvidence ExecuteDefinition(
        InvariantDefinition definition,
        ControlPlaneDatabase database,
        string releaseId,
        string tenantId,
        string sliceId,
        string ciRunId)
    {
        var evaluated = definition.SourceType switch
        {
            "sql" => database.ExecuteInvariantSql(definition.CheckSql ?? throw new InvalidOperationException($"{definition.InvariantKey} missing check_sql")),
            "api-boundary-check-v2" => ApiBoundaryCheckV2(),
            "service-db-file" => ExecuteServiceDbFileCheck(definition.InvariantKey, database),
            "file+dist-scan" => ProductionDemoFallbackCheck(),
            "skeleton" => ExecuteSkeleton(definition.InvariantKey),
            _ => throw new InvalidOperationException($"Unsupported invariant source_type {definition.SourceType}")
        };

        var status = evaluated.ViolationCount == 0
            ? "passed"
            : definition.Mode == "observing" ? "warning" : "failed";

        return new InvariantCheckEvidence(
            InvariantCheckId: $"inv-v54-{Sanitize(definition.InvariantKey)}",
            ReleaseId: releaseId,
            TenantId: tenantId,
            SliceId: sliceId,
            InvariantKey: definition.InvariantKey,
            Description: definition.Description,
            Mode: definition.Mode,
            Severity: definition.Severity,
            SourceType: definition.SourceType,
            CheckSql: definition.CheckSql,
            CheckRef: definition.CheckRef,
            Status: status,
            ObservedValue: evaluated.ObservedValue,
            Threshold: evaluated.Threshold,
            ViolationCount: evaluated.ViolationCount,
            SampleViolations: evaluated.SampleViolations,
            GeneratedBy: "invariant-runner",
            CiRunId: ciRunId,
            CheckedAtUtc: DateTimeOffset.UtcNow);
    }

    private static SqlInvariantResult ExecuteSkeleton(string key)
    {
        return key switch
        {
            "shadow.no_shadow_event_consumed_by_official_projector" => OfficialProjectorShadowReadCheck(),
            "api.no_page_specific_business_write" => ApiBoundaryCheck(),
            "runtime.no_production_demo_fallback" => ProductionDemoFallbackCheck(),
            "case.closed_has_no_open_blocker" => ConfiguredSkeletonCheck(key, "docs/v5.4/checkout-service-cutover.config.json"),
            "case.close_requires_closure_policy" => FileContainsCheck(
                key,
                "services/core-api/WorkOS.Api/Runtime/CheckoutServiceProcessManager.cs",
                new[] { "CaseClosurePolicy", "BedReleasedEvaluatesCaseClosurePolicy" }),
            "blocker.no_duplicate_open_resolution" => FileContainsCheck(
                key,
                "infra/db/migrations/016_checkout_service_process_manager.sql",
                new[] { "uq_process_runs_trigger_rule", "unique(tenant_id, trigger_event_id, process_rule_id)" }),
            "service.cannot_directly_change_bed_status" => SourcePatternGuard(
                key,
                "services/core-api/WorkOS.Api/Slices/Accommodation/ServiceTask",
                new[] { "UpdateBedStatus", "insert into accommodation_beds", "Accommodation.BedReleased", "Accommodation.RoomReleased" }),
            "checkout.cannot_directly_write_deposit_entry" => SourcePatternGuard(
                key,
                "services/core-api/WorkOS.Api/Slices/Accommodation/CheckOutSettlement",
                new[] { "deposit_entries", "deposit_transactions", "insert into deposit", "DepositLedgerStorage" }),
            "checkout.cleaning_required_before_release" => FileContainsCheck(
                key,
                "services/core-api/WorkOS.Api/Runtime/SystemCheckCatalog.cs",
                new[] { "roomReleaseAfterService", "服务任务已验收" }),
            "bank.import_does_not_create_payment_fact" => ConfiguredSkeletonCheck(key, "docs/v5.4/reconciliation-correction-cutover.config.json"),
            "reconciliation.bank_transaction_single_match_default" => ConfiguredSkeletonCheck(key, "docs/v5.4/reconciliation-correction-cutover.config.json"),
            "ledger.no_edit_old_entry" => ConfiguredSkeletonCheck(key, "docs/v5.4/reconciliation-correction-cutover.config.json"),
            "correction.requires_reason" => ConfiguredSkeletonCheck(key, "docs/v5.4/reconciliation-correction-cutover.config.json"),
            "correction.high_risk_requires_approval" => ConfiguredSkeletonCheck(key, "docs/v5.4/reconciliation-correction-cutover.config.json"),
            "balance.rebuild_after_correction" => ConfiguredSkeletonCheck(key, "docs/v5.4/reconciliation-correction-cutover.config.json"),
            _ => new SqlInvariantResult(0, new Dictionary<string, object> { ["skeleton"] = key }, new Dictionary<string, object>(), [])
        };
    }

    private static SqlInvariantResult ExecuteServiceDbFileCheck(string key, ControlPlaneDatabase database)
    {
        return key switch
        {
            "shadow.no_shadow_event_consumed_by_official_projector" => OfficialProjectorShadowIsolationCheck(database),
            _ => throw new InvalidOperationException($"Unsupported service-db-file invariant {key}")
        };
    }

    private static SqlInvariantResult OfficialProjectorShadowIsolationCheck(ControlPlaneDatabase database)
    {
        var fileResult = OfficialProjectorShadowReadCheck();
        var samples = fileResult.SampleViolations.ToList();
        var observed = new Dictionary<string, object>(fileResult.ObservedValue)
        {
            ["source_scan_violation_count"] = fileResult.ViolationCount
        };

        var threshold = new Dictionary<string, object>(fileResult.Threshold)
        {
            ["max_projection_checkpoints_shadow_runtime_rows"] = 0
        };

        if (!database.TableExists("public", "projection_checkpoints"))
        {
            observed["projection_checkpoints_exists"] = false;
            observed["db_check_status"] = "observing_risk_projection_checkpoints_missing";
            return new SqlInvariantResult(fileResult.ViolationCount, observed, threshold, samples);
        }

        observed["projection_checkpoints_exists"] = true;
        if (!database.ColumnExists("public", "projection_checkpoints", "source_namespace"))
        {
            observed["source_namespace_column_exists"] = false;
            samples.Add(new Dictionary<string, object>
            {
                ["table"] = "public.projection_checkpoints",
                ["missing_column"] = "source_namespace"
            });
            return new SqlInvariantResult(fileResult.ViolationCount + 1, observed, threshold, samples);
        }

        var dbResult = database.ProjectionCheckpointShadowNamespaceCheck();
        observed["source_namespace_column_exists"] = true;
        foreach (var item in dbResult.ObservedValue)
        {
            observed[item.Key] = item.Value;
        }

        foreach (var item in dbResult.Threshold)
        {
            threshold[item.Key] = item.Value;
        }

        samples.AddRange(dbResult.SampleViolations);
        return new SqlInvariantResult(fileResult.ViolationCount + dbResult.ViolationCount, observed, threshold, samples);
    }

    private static SqlInvariantResult OfficialProjectorShadowReadCheck()
    {
        var officialProjectorFiles = new[]
        {
            "services/core-api/WorkOS.Api/Runtime/OutboxProjector.cs",
            "services/core-api/WorkOS.Api/Runtime/PostgresProjectionStore.cs",
            "services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs",
            "services/core-api/WorkOS.Api/Runtime/RuntimeQueryService.cs",
            "services/core-api/WorkOS.Api/Runtime/RuntimeAggregateLensStorage.cs"
        };

        var offenders = officialProjectorFiles
            .Select(ResolveRepoPath)
            .Where(path => File.Exists(path) && File.ReadAllText(path).Contains("shadow_runtime", StringComparison.OrdinalIgnoreCase))
            .Select(path => (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["file"] = path })
            .ToArray();

        return new SqlInvariantResult(
            offenders.Length,
            new Dictionary<string, object> { ["checked_files"] = officialProjectorFiles.Length },
            new Dictionary<string, object> { ["max_shadow_reads"] = 0 },
            offenders);
    }

    private static SqlInvariantResult ApiBoundaryCheck()
    {
        return NodeGuardCheck("scripts/check-api-boundaries.mjs");
    }

    private static SqlInvariantResult ApiBoundaryCheckV2()
    {
        var reportPath = Path.Combine(RepoRoot(), ".tmp", "v5_4", "api-boundary-check-v2.json");
        Directory.CreateDirectory(Path.GetDirectoryName(reportPath)!);
        var nodeResult = RunNode("scripts/check-api-boundaries.mjs", $"--out={reportPath}");
        if (!File.Exists(reportPath))
        {
            return new SqlInvariantResult(
                1,
                new Dictionary<string, object>
                {
                    ["exit_code"] = nodeResult.ExitCode,
                    ["script"] = "scripts/check-api-boundaries.mjs",
                    ["report_path"] = reportPath
                },
                new Dictionary<string, object> { ["expected_exit_code"] = 0, ["report_required"] = true },
                new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["output"] = nodeResult.Output } });
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var violationCount = root.GetProperty("violation_count").GetInt32();
        if (nodeResult.ExitCode != 0 && violationCount == 0)
        {
            violationCount = 1;
        }

        var observed = new Dictionary<string, object>
        {
            ["version"] = root.GetProperty("version").GetInt32(),
            ["status"] = root.GetProperty("status").GetString() ?? "unknown",
            ["route_count"] = root.GetProperty("route_count").GetInt32(),
            ["api_route_count"] = root.GetProperty("api_route_count").GetInt32(),
            ["write_route_count"] = root.GetProperty("write_route_count").GetInt32(),
            ["classified_write_route_count"] = root.GetProperty("classified_write_route_count").GetInt32(),
            ["unclassified_write_route_count"] = root.GetProperty("unclassified_write_route_count").GetInt32(),
            ["multi_classified_write_route_count"] = root.GetProperty("multi_classified_write_route_count").GetInt32(),
            ["business_write_route_count"] = root.GetProperty("business_write_route_count").GetInt32(),
            ["exit_code"] = nodeResult.ExitCode,
            ["report_path"] = reportPath
        };

        var samples = root.GetProperty("violations")
            .EnumerateArray()
            .Select(item => (IReadOnlyDictionary<string, object>)new Dictionary<string, object>
            {
                ["message"] = item.GetProperty("message").GetString() ?? string.Empty
            })
            .ToArray();

        return new SqlInvariantResult(
            violationCount,
            observed,
            new Dictionary<string, object>
            {
                ["version"] = 2,
                ["violation_count"] = 0,
                ["unclassified_write_route_count"] = 0,
                ["multi_classified_write_route_count"] = 0
            },
            samples);
    }

    private static SqlInvariantResult ProductionDemoFallbackCheck()
    {
        return NodeGuardCheck("scripts/check-no-production-fake-fallback.mjs");
    }

    private static SqlInvariantResult NodeGuardCheck(string scriptPath, params string[] scriptArgs)
    {
        var nodeResult = RunNode(scriptPath, scriptArgs);
        var violationCount = nodeResult.ExitCode == 0 ? 0 : 1;
        var samples = violationCount == 0
            ? Array.Empty<IReadOnlyDictionary<string, object>>()
            : new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["output"] = nodeResult.Output } };

        return new SqlInvariantResult(
            violationCount,
            new Dictionary<string, object> { ["exit_code"] = nodeResult.ExitCode, ["script"] = scriptPath },
            new Dictionary<string, object> { ["expected_exit_code"] = 0 },
            samples);
    }

    private static NodeResult RunNode(string scriptPath, params string[] scriptArgs)
    {
        var startInfo = new ProcessStartInfo("node")
        {
            WorkingDirectory = RepoRoot(),
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        startInfo.ArgumentList.Add(ResolveRepoPath(scriptPath));
        foreach (var arg in scriptArgs)
        {
            startInfo.ArgumentList.Add(arg);
        }

        using var process = Process.Start(startInfo);
        if (process is null)
        {
            throw new InvalidOperationException($"Could not start node guard: {scriptPath}");
        }

        if (!process.WaitForExit(30000))
        {
            process.Kill(entireProcessTree: true);
            return new NodeResult(124, $"node guard timed out: {scriptPath}");
        }

        var output = process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();
        return new NodeResult(process.ExitCode, output + error);
    }

    private static SqlInvariantResult ConfiguredSkeletonCheck(string key, string configPath)
    {
        var resolved = ResolveRepoPath(configPath);
        var exists = File.Exists(resolved);
        return new SqlInvariantResult(
            exists ? 0 : 1,
            new Dictionary<string, object> { ["skeleton"] = key, ["config"] = configPath, ["exists"] = exists },
            new Dictionary<string, object> { ["required_config_exists"] = true },
            exists ? Array.Empty<IReadOnlyDictionary<string, object>>() : new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["missing_config"] = configPath } });
    }

    private static SqlInvariantResult FileContainsCheck(string key, string path, IReadOnlyList<string> requiredTokens)
    {
        var resolved = ResolveRepoPath(path);
        var text = File.Exists(resolved) ? File.ReadAllText(resolved) : string.Empty;
        var missing = requiredTokens
            .Where(token => !text.Contains(token, StringComparison.Ordinal))
            .Select(token => (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["missing_token"] = token, ["file"] = path })
            .ToArray();

        return new SqlInvariantResult(
            missing.Length,
            new Dictionary<string, object> { ["skeleton"] = key, ["file"] = path, ["required_tokens"] = requiredTokens.Count },
            new Dictionary<string, object> { ["missing_tokens"] = 0 },
            missing);
    }

    private static SqlInvariantResult SourcePatternGuard(string key, string directory, IReadOnlyList<string> forbiddenPatterns)
    {
        var resolved = ResolveRepoPath(directory);
        var files = Directory.Exists(resolved)
            ? Directory.EnumerateFiles(resolved, "*.cs", SearchOption.AllDirectories).ToArray()
            : Array.Empty<string>();
        var offenders = new List<IReadOnlyDictionary<string, object>>();

        foreach (var file in files)
        {
            var text = File.ReadAllText(file);
            foreach (var pattern in forbiddenPatterns)
            {
                if (text.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                {
                    offenders.Add(new Dictionary<string, object>
                    {
                        ["file"] = file,
                        ["pattern"] = pattern
                    });
                }
            }
        }

        return new SqlInvariantResult(
            offenders.Count,
            new Dictionary<string, object> { ["skeleton"] = key, ["checked_files"] = files.Length },
            new Dictionary<string, object> { ["max_forbidden_patterns"] = 0 },
            offenders);
    }

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

    private static void ValidateDefinition(InvariantDefinition definition)
    {
        if (!ValidModes.Contains(definition.Mode))
        {
            throw new InvalidOperationException($"{definition.InvariantKey} has invalid mode {definition.Mode}");
        }

        if (!ValidSeverities.Contains(definition.Severity))
        {
            throw new InvalidOperationException($"{definition.InvariantKey} has invalid severity {definition.Severity}");
        }
    }

    private static string ResolveCiRunId(RunnerOptions options) =>
        options.Get("ciRunId")
        ?? Environment.GetEnvironmentVariable("GITHUB_RUN_ID")
        ?? "local";

    private static string Sanitize(string value) =>
        new(value.Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray());
}

public sealed record InvariantDefinitionFile(IReadOnlyList<InvariantDefinition> Invariants);

public sealed record InvariantDefinition(
    string InvariantKey,
    string Description,
    string Mode,
    string Severity,
    string SourceType,
    string? CheckSql,
    string? CheckRef);

public sealed record InvariantCheckEvidence(
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

internal sealed record NodeResult(int ExitCode, string Output);
