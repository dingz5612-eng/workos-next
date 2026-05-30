using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class ShadowCompareRunner
{
    public static Task<ShadowCompareEvidence> Run(RunnerOptions options)
    {
        var releaseId = options.Get("releaseId", "v5.4-first-batch");
        var tenantId = options.Get("tenantId", "all-tenants");
        var sliceId = options.Get("sliceId", "all-slices");
        var ciRunId = options.Get("ciRunId") ?? Environment.GetEnvironmentVariable("GITHUB_RUN_ID") ?? "local";
        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "shadow-compare-report.json"));
        var configPath = options.Get("config", Path.Combine("docs", "v5.4", "shadow-compare.config.json"));
        var dryRun = options.GetBool("dry-run");
        var config = RunnerJson.Read<ShadowCompareConfig>(ResolveRepoPath(configPath));
        if (options.Get("mode") == "skeleton")
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

        var report = Compare(database, config, releaseId, tenantId, sliceId, ciRunId);
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
        string ciRunId)
    {
        return new ShadowCompareEvidence(
            ShadowCompareReportId: $"scr-v54-{Sanitize(config.Name)}",
            ReleaseId: releaseId,
            TenantId: tenantId,
            SliceId: sliceId,
            CompareScope: CompareScope(config),
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

    private static IReadOnlyDictionary<string, object> CompareScope(ShadowCompareConfig config)
    {
        var scope = new Dictionary<string, object>
        {
            ["name"] = config.Name,
            ["type"] = "count"
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

        return scope;
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
