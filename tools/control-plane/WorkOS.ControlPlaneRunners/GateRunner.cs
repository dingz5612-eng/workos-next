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
        var requireSignoff = options.GetBool("require-business-signoff", defaultValue: true);
        var manualStatus = options.Get("status");
        if (!string.IsNullOrWhiteSpace(manualStatus))
        {
            Console.Error.WriteLine("gate-runner: ignoring manual status; status is computed from invariant, shadow, and signoff inputs.");
        }

        var invariants = ReadMany<InvariantCheckEvidence>(options.Get("invariant")).ToArray();
        var shadowReports = ReadMany<ShadowCompareEvidence>(options.Get("shadow")).ToArray();
        var businessSignoffs = SplitRefs(options.Get("business-signoff"));
        var waivers = SplitRefs(options.Get("waiver")).ToHashSet(StringComparer.Ordinal);
        var input = new GateDecisionInput(invariants, shadowReports, businessSignoffs, waivers, requireSignoff);
        var decision = GateDecisionCalculator.Calculate(input);
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
            ResultHash: resultHash);

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
        return Task.FromResult(evidence);
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
    string ResultHash);
