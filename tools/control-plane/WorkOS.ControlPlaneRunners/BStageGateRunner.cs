using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class BStageGateRunner
{
    public static Task<BStageGateResult> Run(RunnerOptions options)
    {
        var sourceMode = options.Get("sourceMode", "real");
        if (sourceMode != "real")
        {
            throw new InvalidOperationException($"b-stage-gate-runner requires sourceMode=real, got {sourceMode}");
        }

        var noGo = new List<string>();
        var go = new List<string>();
        var inputs = new Dictionary<string, string>();

        var b1 = ReadCheck(options.Get("b1"), "B1 checker output", inputs, noGo);
        RequirePassed(b1, "B1 checker failed", go, noGo);

        var b2 = ReadInput<RuntimeCertificationEvidence>(options.Get("b2"), "B2 dormitory certification report", inputs, noGo);
        if (b2 is null || b2.Status != "passed" || b2.SourceMode != "real")
        {
            noGo.Add("B2 certification must be real and passed.");
        }
        else if (b2.Scenarios.Any(item =>
            item.ExpectedOutcome is "permission_denied_403" or "business_blocked_422" or "idempotency_conflict_409" &&
            item.RejectionTrace is null))
        {
            noGo.Add("B2 rejected or blocked command scenarios require RejectionTrace.");
        }
        else
        {
            go.Add("B2 certification report passed with rejected command trace semantics.");
        }

        var invariants = ReadMany<InvariantCheckEvidence>(options.Get("b2Invariant"), "B2 invariant checks", inputs, noGo);
        if (invariants.Any(item => item.Severity == "P0" && item.Status != "passed"))
        {
            noGo.Add("P0 invariant failed.");
        }
        else if (invariants.Count > 0)
        {
            go.Add("B2 invariant checks are green.");
        }

        var shadows = ReadMany<ShadowCompareEvidence>(options.Get("b2Shadow"), "B2 semantic shadow report", inputs, noGo);
        if (shadows.Any(item => item.Grade == "red"))
        {
            noGo.Add("Semantic shadow red.");
        }
        else if (shadows.Count > 0)
        {
            go.Add("B2 semantic shadow report is green.");
        }

        var b3 = ReadCheck(options.Get("b3"), "B3 admission checker output", inputs, noGo);
        RequirePassed(b3, "B3 admission checker failed", go, noGo);
        var surface = ReadCheck(options.Get("surface"), "runtime-surface alignment checker output", inputs, noGo);
        RequirePassed(surface, "runtime-surface alignment checker failed", go, noGo);

        ValidateRollback(options.Get("rollback"), inputs, noGo, go);
        ValidateBusinessSignoff(options.Get("businessSignoff"), inputs, noGo, go);
        ValidateBusinessLineRegistry(noGo, go);
        ValidateCiWiring(noGo, go);
        ValidateEvidencePolicyRuntimeBinding(noGo, go);
        ValidateGoLiveReadiness(options.Get("dormIntScope"), "DORM-INT scope readiness", inputs, noGo, go, requireSourceMode: false);
        ValidateGoLiveReadiness(options.Get("dormIntMasterData"), "DORM-INT master data readiness", inputs, noGo, go);
        ValidateGoLiveReadiness(options.Get("dormIntFinanceDailyClose"), "DORM-INT finance daily close result", inputs, noGo, go);
        ValidateGoLiveReadiness(options.Get("dormIntEvidencePolicy"), "DORM-INT evidence policy result", inputs, noGo, go);

        var status = noGo.Count == 0 ? "passed" : "blocked";
        var result = new BStageGateResult(
            options.Get("id", "b-stage-gate-rtb"),
            status,
            sourceMode,
            DateTimeOffset.UtcNow,
            "b-stage-gate-runner",
            inputs,
            noGo,
            go);

        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "b-stage-gate-result.json"));
        RunnerJson.Write(outputPath, result);
        Console.WriteLine($"b-stage-gate-runner: wrote {Path.GetRelativePath(Directory.GetCurrentDirectory(), outputPath)} status={result.Status}");

        if (result.Status != "passed" && options.GetBool("fail-on-block", defaultValue: true))
        {
            throw new InvalidOperationException($"BStageGateResult blocked: {string.Join("; ", result.NoGoItems)}");
        }

        return Task.FromResult(result);
    }

    private static BStageCheckResult? ReadCheck(string? path, string label, IDictionary<string, string> inputs, ICollection<string> noGo)
    {
        var result = ReadInput<BStageCheckResult>(path, label, inputs, noGo);
        if (result is not null && result.SourceMode != "real")
        {
            noGo.Add($"{label} must use sourceMode=real.");
        }
        return result;
    }

    private static T? ReadInput<T>(string? path, string label, IDictionary<string, string> inputs, ICollection<string> noGo)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            noGo.Add($"{label} is missing.");
            return default;
        }
        if (Path.GetFileName(path).Contains(".not_run.", StringComparison.OrdinalIgnoreCase))
        {
            noGo.Add($"{label} cannot be .not_run artifact.");
            return default;
        }
        inputs[label] = path;
        return RunnerJson.Read<T>(path);
    }

    private static IReadOnlyList<T> ReadMany<T>(string? path, string label, IDictionary<string, string> inputs, ICollection<string> noGo)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            noGo.Add($"{label} is missing.");
            return [];
        }
        if (Path.GetFileName(path).Contains(".not_run.", StringComparison.OrdinalIgnoreCase))
        {
            noGo.Add($"{label} cannot be .not_run artifact.");
            return [];
        }
        inputs[label] = path;
        var text = File.ReadAllText(path).TrimStart();
        return text.StartsWith('[')
            ? System.Text.Json.JsonSerializer.Deserialize<List<T>>(text, RunnerJson.Options) ?? []
            : [RunnerJson.Read<T>(path)];
    }

    private static void RequirePassed(BStageCheckResult? result, string message, ICollection<string> go, ICollection<string> noGo)
    {
        if (result?.Status == "passed")
        {
            go.Add(result.Name);
            return;
        }
        noGo.Add(message);
    }

    private static void ValidateRollback(string? path, IDictionary<string, string> inputs, ICollection<string> noGo, ICollection<string> go)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            noGo.Add("BStageGate requires rollback instruction.");
            return;
        }
        inputs["rollback instruction"] = path;
        using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        if (!doc.RootElement.TryGetProperty("rollback_instruction_id", out var id) || string.IsNullOrWhiteSpace(id.GetString()))
        {
            noGo.Add("Rollback instruction missing rollback_instruction_id.");
        }
        else
        {
            go.Add("Rollback instruction present.");
        }
    }

    private static void ValidateBusinessSignoff(string? path, IDictionary<string, string> inputs, ICollection<string> noGo, ICollection<string> go)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            noGo.Add("BStageGate requires business signoff.");
            return;
        }
        inputs["business signoff"] = path;
        using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        var approved = doc.RootElement.TryGetProperty("approved", out var value) && value.GetBoolean();
        if (!approved)
        {
            noGo.Add("Business signoff is not approved.");
        }
        else
        {
            go.Add("Business signoff approved for B-stage gate only.");
        }
    }

    private static void ValidateBusinessLineRegistry(ICollection<string> noGo, ICollection<string> go)
    {
        var registry = BusinessLineAdmissionRegistry.LoadDefault();
        foreach (var entry in registry.Entries)
        {
            if (entry.BusinessLineId is "repair" or "parts" or "hr" && entry.Level != "L0 Contract Preview")
            {
                noGo.Add($"{entry.BusinessLineId} must remain L0 Contract Preview.");
            }
            if (entry.ProductionAllowed || entry.ProductionConfirmAllowed)
            {
                noGo.Add($"{entry.BusinessLineId} must not allow production confirm in RT-B.");
            }
        }

        var guard = new BusinessLineAdmissionGuard(new BusinessLineAdmissionEvaluator(registry));
        foreach (var line in new[] { "repair", "parts", "hr" })
        {
            if (guard.EnsureCanConfirm(line).Allowed)
            {
                noGo.Add($"{line} production confirm must be blocked by admission guard.");
            }
        }
        if (noGo.Count == 0 || noGo.All(item => !item.Contains("production confirm", StringComparison.OrdinalIgnoreCase)))
        {
            go.Add("Business line admission guard blocks L0 production confirm.");
        }
    }

    private static void ValidateCiWiring(ICollection<string> noGo, ICollection<string> go)
    {
        var ci = File.ReadAllText(Path.Combine(RepoRoot(), ".github", "workflows", "ci.yml"));
        foreach (var command in new[]
        {
            "check-dormitory-domain-kit.mjs",
            "check-business-domain-kit.mjs",
            "check-business-line-admission.mjs",
            "check-domain-kit-usage.mjs",
            "certify-dormitory.mjs",
            "b-gate-runner.mjs"
        })
        {
            if (!ci.Contains(command, StringComparison.Ordinal))
            {
                noGo.Add($"CI must run {command}.");
            }
        }
        if (noGo.All(item => !item.StartsWith("CI must run", StringComparison.Ordinal)))
        {
            go.Add("B1/B2/B3 and BStage gate commands are wired into CI.");
        }
    }

    private static void ValidateEvidencePolicyRuntimeBinding(ICollection<string> noGo, ICollection<string> go)
    {
        var policy = File.ReadAllText(Path.Combine(RepoRoot(), "docs", "business", "dormitory", "evidence-policy.yml"));
        if (!policy.Contains("EvidencePolicyEvaluator", StringComparison.Ordinal) ||
            !policy.Contains("missingEvidenceBlocksConfirm", StringComparison.Ordinal))
        {
            noGo.Add("Evidence Policy file must drive runtime evaluator.");
        }
        else
        {
            go.Add("Evidence Policy file declares runtime evaluator binding.");
        }
    }

    private static void ValidateGoLiveReadiness(
        string? path,
        string label,
        IDictionary<string, string> inputs,
        ICollection<string> noGo,
        ICollection<string> go,
        bool requireSourceMode = true)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            noGo.Add($"{label} is missing.");
            return;
        }
        if (Path.GetFileName(path).Contains(".not_run.", StringComparison.OrdinalIgnoreCase))
        {
            noGo.Add($"{label} cannot be .not_run artifact.");
            return;
        }

        inputs[label] = path;
        using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        if (!doc.RootElement.TryGetProperty("status", out var status) ||
            !string.Equals(status.GetString(), "passed", StringComparison.OrdinalIgnoreCase))
        {
            noGo.Add($"{label} must be passed.");
            return;
        }
        if (requireSourceMode &&
            (!doc.RootElement.TryGetProperty("sourceMode", out var sourceMode) ||
             !string.Equals(sourceMode.GetString(), "real", StringComparison.OrdinalIgnoreCase)))
        {
            noGo.Add($"{label} must use sourceMode=real.");
            return;
        }

        go.Add($"{label} passed.");
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
}

public sealed record BStageCheckResult(
    string Name,
    string Status,
    string SourceMode,
    IReadOnlyList<string> Commands,
    IReadOnlyList<string> EvidenceRefs);

public sealed record BStageGateResult(
    string BStageGateResultId,
    string Status,
    string SourceMode,
    DateTimeOffset GeneratedAtUtc,
    string GeneratedBy,
    IReadOnlyDictionary<string, string> Inputs,
    IReadOnlyList<string> NoGoItems,
    IReadOnlyList<string> GoItems);
