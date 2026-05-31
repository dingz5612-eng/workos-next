using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class CutoverStateRunner
{
    public static Task<IReadOnlyList<InvariantCheckEvidence>> Run(RunnerOptions options)
    {
        var releaseId = options.Get("releaseId", "v5.4-cutover-state");
        var tenantId = options.Get("tenantId", "all-tenants");
        var sliceId = options.Get("sliceId", "operations-runtime");
        var ciRunId = options.Get("ciRunId") ?? Environment.GetEnvironmentVariable("GITHUB_RUN_ID") ?? "local";
        var sourceMode = ResolveSourceMode(options);
        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "cutover-state-invariants.json"));
        var request = new CutoverTransitionRequest(
            options.Get("from", "off"),
            options.Get("to", "shadow"),
            SchemaPass: options.GetBool("schema-pass"),
            ContractPass: options.GetBool("contract-pass"),
            CertificationPass: options.GetBool("certification-pass"),
            SemanticShadowGreen: options.GetBool("semantic-shadow-green"),
            BusinessSignoffPresent: options.GetBool("business-signoff"),
            RollbackInstructionPresent: options.GetBool("rollback"),
            ObservationWindowComplete: options.GetBool("observation-window"),
            HasP0InvariantFailure: options.GetBool("p0-failure"),
            RedShadow: options.GetBool("red-shadow"));
        var decision = CutoverStateMachine.EvaluateTransition(request);
        var checks = new[]
        {
            new InvariantCheckEvidence(
                $"inv-cutover-{Sanitize(request.FromState)}-to-{Sanitize(request.ToState)}",
                releaseId,
                tenantId,
                sliceId,
                "cutover.illegal_transition_blocked",
                "SliceCutoverState transition must satisfy certification, semantic shadow, signoff, rollback, and observation rules.",
                "blocking",
                "P0",
                "cutover-state-runner",
                null,
                "scripts/v5_4/cutover-state-runner.mjs",
                decision.Allowed ? "passed" : "failed",
                new Dictionary<string, object>
                {
                    ["from_state"] = decision.FromState,
                    ["to_state"] = decision.ToState,
                    ["allowed"] = decision.Allowed,
                    ["hold"] = decision.Hold,
                    ["rollback_recommended"] = decision.RollbackRecommended,
                    ["reason"] = decision.Reason,
                    ["write_path"] = decision.WritePath
                },
                new Dictionary<string, object>
                {
                    ["illegal_transition_blockers"] = 0,
                    ["red_shadow_requires_hold_or_rollback"] = true
                },
                decision.Allowed ? 0 : 1,
                decision.Allowed
                    ? []
                    : new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["blocker"] = decision.Reason } },
                "cutover-state-runner",
                ciRunId,
                DateTimeOffset.UtcNow)
            {
                SourceMode = sourceMode
            }
        };

        RunnerJson.Write(outputPath, checks);
        Console.WriteLine($"cutover-state-runner: wrote {Path.GetRelativePath(Directory.GetCurrentDirectory(), outputPath)} status={checks[0].Status}");
        if (checks[0].Status == "failed" && options.GetBool("fail-on-blocked", defaultValue: true))
        {
            throw new InvalidOperationException($"cutover transition blocked: {decision.Reason}");
        }

        return Task.FromResult<IReadOnlyList<InvariantCheckEvidence>>(checks);
    }

    private static string ResolveSourceMode(RunnerOptions options)
    {
        var value = options.Get("sourceMode") ?? options.Get("source-mode") ?? "real";
        return value switch
        {
            "real" or "fixture" or "skeleton" => value,
            _ => throw new InvalidOperationException($"cutover-state-runner: sourceMode must be real, fixture, or skeleton; got {value}")
        };
    }

    private static string Sanitize(string value) =>
        new(value.Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray());
}
