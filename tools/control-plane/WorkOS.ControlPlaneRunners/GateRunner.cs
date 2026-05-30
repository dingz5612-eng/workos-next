using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class GateRunner
{
    public static Task<GateResultEvidence> Run(RunnerOptions options)
    {
        var releaseId = options.Get("releaseId", "v5.4-first-batch");
        var mrId = options.Get("mrId") ?? Environment.GetEnvironmentVariable("GITHUB_REF_NAME") ?? "local";
        var ciRunId = options.Get("ciRunId") ?? Environment.GetEnvironmentVariable("GITHUB_RUN_ID") ?? "local";
        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "gate-result.json"));
        var dryRun = options.GetBool("dry-run");
        var formalReleaseGate = options.GetBool("formal-release-gate");
        var sourceMode = ResolveSourceMode(options);
        var requireSignoff = options.GetBool("require-business-signoff", defaultValue: true);
        var manualStatus = options.Get("status");
        if (!string.IsNullOrWhiteSpace(manualStatus))
        {
            Console.Error.WriteLine("gate-runner: ignoring manual status; status is computed from invariant, shadow, and signoff inputs.");
        }

        ValidateFormalInputPaths(formalReleaseGate, options.Get("invariant"), options.Get("shadow"), outputPath);
        var invariants = ReadMany<InvariantCheckEvidence>(options.Get("invariant")).ToArray();
        var shadowReports = ReadMany<ShadowCompareEvidence>(options.Get("shadow")).ToArray();
        var businessSignoffs = SplitRefs(options.Get("business-signoff"));
        var waivers = SplitRefs(options.Get("waiver")).ToHashSet(StringComparer.Ordinal);
        var input = new GateDecisionInput(invariants, shadowReports, businessSignoffs, waivers, requireSignoff);
        var decision = GateDecisionCalculator.Calculate(input);
        decision = ApplyFormalReleaseGatePolicy(
            decision,
            formalReleaseGate,
            sourceMode,
            ciRunId,
            options.Get("rollback") ?? options.Get("rollbackInstruction"),
            invariants,
            shadowReports);
        var inputHash = RunnerJson.Hash(input);
        var resultHash = RunnerJson.Hash(new
        {
            decision.Status,
            decision.Severity,
            decision.NoGoItems,
            decision.GoItems
        });

        var evidence = new GateResultEvidence(
            GateResultId: options.Get("id", "gate-v5-4-runner"),
            ReleaseId: releaseId,
            MrId: mrId,
            TenantId: options.Get("tenantId"),
            SliceId: options.Get("sliceId"),
            GateName: options.Get("gateName", "v5.4-control-plane"),
            GateType: options.Get("gateType", "automated"),
            Status: decision.Status,
            Severity: decision.Severity,
            CiRunId: ciRunId,
            AutomatedTestRefs: SplitRefs(options.Get("automated-test")).DefaultIfEmpty("scripts/v5_4/run-control-plane-checks.ps1").ToArray(),
            InvariantCheckRefs: invariants.Select(item => item.InvariantCheckId).ToArray(),
            ShadowCompareReportRefs: shadowReports.Select(item => item.ShadowCompareReportId).ToArray(),
            BusinessSignoffRefs: businessSignoffs,
            NoGoItems: decision.NoGoItems,
            GoItems: decision.GoItems,
            KnownRisks: SplitRefs(options.Get("known-risk")).DefaultIfEmpty("minimal runner").ToArray(),
            GeneratedBy: "gate-runner",
            GeneratedAtUtc: DateTimeOffset.UtcNow,
            InputHash: inputHash,
            ResultHash: resultHash)
        {
            SourceMode = sourceMode
        };

        if (!dryRun)
        {
            var database = new ControlPlaneDatabase(ControlPlaneDatabase.ResolveConnectionString(options));
            database.ApplyMigrations(Path.Combine("infra", "db", "migrations"));
            database.EnsureReleaseManifest(releaseId, mrId, ciRunId);
            new ControlPlaneWriteStore(database.ConnectionString).WriteGateResult(new GateResultWrite(
                evidence.GateResultId,
                evidence.ReleaseId,
                evidence.MrId,
                evidence.TenantId,
                evidence.SliceId,
                evidence.GateName,
                evidence.GateType,
                evidence.Status,
                evidence.Severity,
                evidence.CiRunId,
                evidence.AutomatedTestRefs,
                evidence.InvariantCheckRefs,
                evidence.ShadowCompareReportRefs,
                evidence.BusinessSignoffRefs,
                evidence.NoGoItems,
                evidence.GoItems,
                evidence.KnownRisks,
                evidence.GeneratedBy,
                evidence.GeneratedAtUtc,
                evidence.InputHash,
                evidence.ResultHash));
        }

        RunnerJson.Write(outputPath, evidence);
        Console.WriteLine($"gate-runner: wrote {Path.GetRelativePath(Directory.GetCurrentDirectory(), outputPath)} status={evidence.Status}");
        if (formalReleaseGate && IsHardFormalGateFailure(evidence))
        {
            throw new InvalidOperationException($"formal release gate failed: {evidence.Status}; {string.Join("; ", evidence.NoGoItems)}");
        }

        return Task.FromResult(evidence);
    }

    private static GateDecision ApplyFormalReleaseGatePolicy(
        GateDecision decision,
        bool formalReleaseGate,
        string sourceMode,
        string? ciRunId,
        string? rollbackPath,
        IReadOnlyList<InvariantCheckEvidence> invariants,
        IReadOnlyList<ShadowCompareEvidence> shadowReports)
    {
        if (!formalReleaseGate)
        {
            return decision;
        }

        var noGo = decision.NoGoItems.ToList();
        if (sourceMode != "real")
        {
            noGo.Add($"Formal release gate requires sourceMode=real, got {sourceMode}.");
        }

        foreach (var invariant in invariants.Where(item => item.SourceMode == "skeleton"))
        {
            noGo.Add($"Skeleton invariant evidence is not allowed in formal release gate: {invariant.InvariantCheckId}");
        }

        foreach (var report in shadowReports.Where(IsSkeletonShadowEvidence))
        {
            noGo.Add($"Skeleton shadow evidence is not allowed in formal release gate: {report.ShadowCompareReportId}");
        }

        if (decision.Status.Equals("passed", StringComparison.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(ciRunId))
        {
            noGo.Add("Passed formal GateResult requires non-empty ci_run_id.");
        }

        if (string.IsNullOrWhiteSpace(rollbackPath) || !File.Exists(rollbackPath))
        {
            noGo.Add("Formal release gate requires an existing rollback instruction.");
        }
        else
        {
            ValidateRollbackInstruction(rollbackPath);
        }

        return noGo.Count == decision.NoGoItems.Count
            ? decision
            : new GateDecision("blocked", "P0", noGo, decision.GoItems);
    }

    private static bool IsSkeletonShadowEvidence(ShadowCompareEvidence report)
    {
        if (report.SourceMode == "skeleton")
        {
            return true;
        }

        return report.Summary.TryGetValue("status", out var status) &&
               Convert.ToString(status)?.Contains("skeleton", StringComparison.OrdinalIgnoreCase) == true;
    }

    private static bool IsHardFormalGateFailure(GateResultEvidence evidence)
    {
        if (evidence.Status.Equals("passed", StringComparison.OrdinalIgnoreCase) ||
            evidence.Status.Equals("warning", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return true;
    }

    private static void ValidateFormalInputPaths(bool formalReleaseGate, params string?[] paths)
    {
        if (!formalReleaseGate)
        {
            return;
        }

        foreach (var path in paths.Where(path => !string.IsNullOrWhiteSpace(path)))
        {
            var fileName = Path.GetFileName(path!);
            if (fileName.Contains(".not_run.", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"formal release gate rejects not_run artifact: {path}");
            }
        }
    }

    private static void ValidateRollbackInstruction(string path)
    {
        using var document = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        var root = document.RootElement;
        if (!root.TryGetProperty("rollback_instruction_id", out var id) || string.IsNullOrWhiteSpace(id.GetString()))
        {
            throw new InvalidOperationException($"rollback instruction missing rollback_instruction_id: {path}");
        }

        if (!root.TryGetProperty("instruction_type", out var type) || type.GetString() != "rollback")
        {
            throw new InvalidOperationException($"rollback instruction_type must be rollback: {path}");
        }
    }

    private static string ResolveSourceMode(RunnerOptions options)
    {
        var value = options.Get("sourceMode") ?? options.Get("source-mode") ?? options.Get("mode") ?? "real";
        return value switch
        {
            "real" or "fixture" or "skeleton" => value,
            _ => throw new InvalidOperationException($"gate-runner: sourceMode must be real, fixture, or skeleton; got {value}")
        };
    }

    private static IReadOnlyList<T> ReadMany<T>(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return [];
        }

        var text = File.ReadAllText(path);
        var trimmed = text.TrimStart();
        if (trimmed.StartsWith('['))
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<T>>(text, RunnerJson.Options)
                ?? [];
        }

        var item = System.Text.Json.JsonSerializer.Deserialize<T>(text, RunnerJson.Options);
        return item is null ? [] : [item];
    }

    private static IReadOnlyList<string> SplitRefs(string? refs)
    {
        return string.IsNullOrWhiteSpace(refs)
            ? []
            : refs.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }
}

public sealed record GateResultEvidence(
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
    string ResultHash)
{
    public string SourceMode { get; init; } = "real";
}
