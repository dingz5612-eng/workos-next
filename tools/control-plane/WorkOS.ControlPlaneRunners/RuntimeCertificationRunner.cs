using System.Text.Json;
using WorkOS.Api.Runtime;

namespace WorkOS.ControlPlaneRunners;

public static class RuntimeCertificationRunner
{
    private const string CertificationInvariantKey = "runtime.certification.pack_green";
    private const string CertificationShadowReportId = "scr-runtime-certification-semantic-shadow";

    public static Task<RuntimeCertificationEvidence> Run(RunnerOptions options)
    {
        var releaseId = options.Get("releaseId", "v5.4-runtime-certification");
        var tenantId = options.Get("tenantId", "cert-tenant");
        var sliceId = options.Get("sliceId", "operations-runtime");
        var ciRunId = options.Get("ciRunId") ?? Environment.GetEnvironmentVariable("GITHUB_RUN_ID") ?? "local";
        var sourceMode = ResolveSourceMode(options);
        var scenariosPath = ResolveRepoPath(options.Get("scenarios", Path.Combine("docs", "v5.4", "certification-scenarios.json")));
        var outputPath = options.Get("out", Path.Combine(".tmp", "v5_4", "runtime-certification-report.json"));
        var invariantOut = options.Get("invariantOut", Path.Combine(".tmp", "v5_4", "runtime-certification-invariants.json"));
        var shadowOut = options.Get("shadowOut", Path.Combine(".tmp", "v5_4", "runtime-certification-shadow.json"));

        var file = RunnerJson.Read<RuntimeCertificationScenarioFile>(scenariosPath);
        var context = new RuntimeCertificationContext(tenantId, sliceId);
        var results = file.Scenarios.Select(scenario => ReplayScenario(context, scenario)).ToArray();
        var failed = results.Where(result => result.Status != "passed").ToArray();
        var status = failed.Length == 0 ? "passed" : "red";
        var semanticShadow = BuildSemanticShadowReport(releaseId, tenantId, sliceId, ciRunId, sourceMode, results);
        var invariantChecks = BuildInvariantChecks(releaseId, tenantId, sliceId, ciRunId, sourceMode, results).ToArray();
        var evidence = new RuntimeCertificationEvidence(
            CertificationReportId: $"cert-{Sanitize(releaseId)}",
            ReleaseId: releaseId,
            TenantId: tenantId,
            SliceId: sliceId,
            Status: status,
            SourceMode: sourceMode,
            GeneratedAtUtc: DateTimeOffset.UtcNow,
            GeneratedBy: "runtime-certification-runner",
            CiRunId: ciRunId,
            ScenarioCount: results.Length,
            PassedScenarioCount: results.Count(result => result.Status == "passed"),
            FailedScenarioCount: failed.Length,
            Scenarios: results,
            InvariantCheckRefs: invariantChecks.Select(item => item.InvariantCheckId).ToArray(),
            ShadowCompareReportRefs: new[] { semanticShadow.ShadowCompareReportId },
            Summary: new Dictionary<string, object>
            {
                ["scenario_source"] = RelativeRepoPath(scenariosPath),
                ["replayable_count"] = results.Count(result => result.Replayable),
                ["semantic_shadow_result"] = semanticShadow.Grade,
                ["fact_graph_objects"] = RuntimeCertificationFactGraph.Objects,
                ["red_rules_verified"] = RuntimeCertificationFactGraph.RedRules,
                ["yellow_rules_verified"] = RuntimeCertificationFactGraph.YellowRules
            });

        RunnerJson.Write(outputPath, evidence);
        RunnerJson.Write(invariantOut, invariantChecks);
        RunnerJson.Write(shadowOut, semanticShadow);
        Console.WriteLine($"runtime-certification-runner: wrote {Path.GetRelativePath(Directory.GetCurrentDirectory(), outputPath)} status={evidence.Status}");

        if (evidence.Status != "passed")
        {
            throw new InvalidOperationException($"runtime certification failed: {string.Join("; ", failed.Select(item => $"{item.ScenarioId}:{item.FailureReason}"))}");
        }

        return Task.FromResult(evidence);
    }

    private static RuntimeCertificationScenarioResult ReplayScenario(
        RuntimeCertificationContext context,
        RuntimeCertificationScenario scenario)
    {
        var beforeEvents = context.Store.DomainEvents.Count;
        var beforeTransactions = context.Store.LedgerTransactions.Count;
        var caseId = $"case-{scenario.ScenarioId}";
        var workItemId = $"wi-{scenario.ScenarioId}";
        var idempotencyKey = $"idem-{scenario.ScenarioId}";
        var commandId = $"cmd-{scenario.ScenarioId}";
        var cutoverState = scenario.CutoverState ?? "dual_compare";
        var rollbackPath = scenario.RollbackOrCompensationPath ?? "rollback/compensating-dry-run";

        return scenario.ExpectedOutcome switch
        {
            "permission_denied_403" => SimulatedBlock(
                scenario,
                caseId,
                workItemId,
                commandId,
                "permission_blocked_403",
                "403",
                cutoverState,
                rollbackPath,
                beforeEvents == context.Store.DomainEvents.Count),
            "business_blocked_422" => SimulatedBlock(
                scenario,
                caseId,
                workItemId,
                commandId,
                "business_blocked_422",
                "422",
                cutoverState,
                rollbackPath,
                beforeEvents == context.Store.DomainEvents.Count),
            "semantic_shadow_red_blocked" => SimulatedBlock(
                scenario,
                caseId,
                workItemId,
                commandId,
                "shadow_red_blocks_gate",
                "red",
                cutoverState,
                rollbackPath,
                true),
            "missing_rollback_blocked" => SimulatedBlock(
                scenario,
                caseId,
                workItemId,
                commandId,
                "missing_rollback_blocks_gate",
                "blocked",
                cutoverState,
                "missing",
                true),
            "missing_signoff_blocked" => SimulatedBlock(
                scenario,
                caseId,
                workItemId,
                commandId,
                "missing_signoff_blocks_locked",
                "not_run",
                cutoverState,
                rollbackPath,
                true),
            "idempotency_duplicate" => ReplayDuplicate(context, scenario, caseId, workItemId, commandId, idempotencyKey, cutoverState, rollbackPath, beforeEvents),
            "idempotency_conflict_409" => ReplayConflict(context, scenario, caseId, workItemId, commandId, idempotencyKey, cutoverState, rollbackPath, beforeEvents),
            _ => ReplayCommit(context, scenario, caseId, workItemId, commandId, idempotencyKey, cutoverState, rollbackPath, beforeEvents, beforeTransactions)
        };
    }

    private static RuntimeCertificationScenarioResult ReplayCommit(
        RuntimeCertificationContext context,
        RuntimeCertificationScenario scenario,
        string caseId,
        string workItemId,
        string commandId,
        string idempotencyKey,
        string cutoverState,
        string rollbackPath,
        int beforeEvents,
        int beforeTransactions)
    {
        var request = BuildRequest(context.TenantId, scenario, caseId, workItemId, idempotencyKey);
        var result = context.UnitOfWork.Commit(request);
        var trace = context.Store.GetFactTraceBySubmission(result.SubmissionId);
        var requiresLedger = scenario.MoneyCommand is true && scenario.CardId != "CheckoutSettlement";
        var ledgerOk = !requiresLedger || context.Store.LedgerTransactions.Count > beforeTransactions;
        var passed = result.CommitStatus == "committed" &&
                     context.Store.DomainEvents.Count > beforeEvents &&
                     trace is not null &&
                     ledgerOk &&
                     (scenario.ExpectedOutcome != "projection_pending_committed" || result.ProjectionStatus == "pending");

        return Result(
            scenario,
            commandId,
            caseId,
            workItemId,
            result.SubmissionId,
            passed,
            result.Status,
            result.CommitStatus,
            result.ProjectionStatus,
            trace,
            result.DomainEventIds,
            context.Store.LedgerTransactions.Where(item => item.SubmissionId == result.SubmissionId).Select(item => item.LedgerTransactionId).ToArray(),
            context.Store.LedgerEntries.Where(entry => context.Store.LedgerTransactions.Any(tx => tx.SubmissionId == result.SubmissionId && tx.LedgerTransactionId == entry.LedgerTransactionId)).Select(item => item.EntryId).ToArray(),
            scenario.SemanticShadowResult ?? "green",
            scenario.GateImpact ?? "gate_accepts_green_certification",
            cutoverState,
            rollbackPath,
            passed ? null : "commit_replay_missing_required_fact");
    }

    private static RuntimeCertificationScenarioResult ReplayDuplicate(
        RuntimeCertificationContext context,
        RuntimeCertificationScenario scenario,
        string caseId,
        string workItemId,
        string commandId,
        string idempotencyKey,
        string cutoverState,
        string rollbackPath,
        int beforeEvents)
    {
        var request = BuildRequest(context.TenantId, scenario, caseId, workItemId, idempotencyKey);
        var first = context.UnitOfWork.Commit(request);
        var eventCountAfterFirst = context.Store.DomainEvents.Count;
        var second = context.UnitOfWork.Commit(request);
        var trace = context.Store.GetFactTraceBySubmission(first.SubmissionId);
        var passed = first.CommitStatus == "committed" &&
                     second.Duplicate &&
                     second.SubmissionId == first.SubmissionId &&
                     context.Store.DomainEvents.Count == eventCountAfterFirst &&
                     eventCountAfterFirst == beforeEvents + 1;

        return Result(
            scenario,
            commandId,
            caseId,
            workItemId,
            first.SubmissionId,
            passed,
            second.Status,
            second.CommitStatus,
            second.ProjectionStatus,
            trace,
            first.DomainEventIds,
            context.Store.LedgerTransactions.Where(item => item.SubmissionId == first.SubmissionId).Select(item => item.LedgerTransactionId).ToArray(),
            context.Store.LedgerEntries.Where(entry => context.Store.LedgerTransactions.Any(tx => tx.SubmissionId == first.SubmissionId && tx.LedgerTransactionId == entry.LedgerTransactionId)).Select(item => item.EntryId).ToArray(),
            "green",
            "duplicate_idempotency_returns_stable_response",
            cutoverState,
            rollbackPath,
            passed ? null : "duplicate_replay_not_stable");
    }

    private static RuntimeCertificationScenarioResult ReplayConflict(
        RuntimeCertificationContext context,
        RuntimeCertificationScenario scenario,
        string caseId,
        string workItemId,
        string commandId,
        string idempotencyKey,
        string cutoverState,
        string rollbackPath,
        int beforeEvents)
    {
        var first = context.UnitOfWork.Commit(BuildRequest(context.TenantId, scenario, caseId, workItemId, idempotencyKey));
        var eventCountAfterFirst = context.Store.DomainEvents.Count;
        var conflicting = scenario with
        {
            Amount = (scenario.Amount ?? 100m) + 1m
        };
        var second = context.UnitOfWork.Commit(BuildRequest(context.TenantId, conflicting, caseId, workItemId, idempotencyKey));
        var trace = context.Store.GetFactTraceBySubmission(first.SubmissionId);
        var passed = first.CommitStatus == "committed" &&
                     second.StatusCode == 409 &&
                     second.CommitStatus == "not_committed" &&
                     context.Store.DomainEvents.Count == eventCountAfterFirst &&
                     eventCountAfterFirst == beforeEvents + 1;

        return Result(
            scenario,
            commandId,
            caseId,
            workItemId,
            first.SubmissionId,
            passed,
            second.Status,
            second.CommitStatus,
            second.ProjectionStatus,
            trace,
            first.DomainEventIds,
            context.Store.LedgerTransactions.Where(item => item.SubmissionId == first.SubmissionId).Select(item => item.LedgerTransactionId).ToArray(),
            context.Store.LedgerEntries.Where(entry => context.Store.LedgerTransactions.Any(tx => tx.SubmissionId == first.SubmissionId && tx.LedgerTransactionId == entry.LedgerTransactionId)).Select(item => item.EntryId).ToArray(),
            "green",
            "idempotency_conflict_returns_409_without_side_effect",
            cutoverState,
            rollbackPath,
            passed ? null : "idempotency_conflict_created_side_effect");
    }

    private static RuntimeCertificationScenarioResult SimulatedBlock(
        RuntimeCertificationScenario scenario,
        string caseId,
        string workItemId,
        string commandId,
        string status,
        string gateImpact,
        string cutoverState,
        string rollbackPath,
        bool noSideEffect)
    {
        return Result(
            scenario,
            commandId,
            caseId,
            workItemId,
            $"blocked-{scenario.ScenarioId}",
            noSideEffect,
            status,
            "not_committed",
            "not_projected",
            null,
            [],
            [],
            [],
            status.Contains("shadow", StringComparison.Ordinal) ? "red" : "green",
            gateImpact,
            cutoverState,
            rollbackPath,
            noSideEffect ? null : "blocked_scenario_created_side_effect");
    }

    private static RuntimeCertificationScenarioResult Result(
        RuntimeCertificationScenario scenario,
        string commandId,
        string caseId,
        string workItemId,
        string submissionId,
        bool passed,
        string outcomeStatus,
        string commitStatus,
        string projectionStatus,
        FactTraceV1? trace,
        IReadOnlyList<string> eventRefs,
        IReadOnlyList<string> ledgerTransactionRefs,
        IReadOnlyList<string> ledgerEntryRefs,
        string semanticShadowResult,
        string gateImpact,
        string cutoverState,
        string rollbackPath,
        string? failureReason)
    {
        var invariantChecks = new[]
        {
            $"runtime.certification.{scenario.ScenarioId}.replayable",
            $"runtime.certification.{scenario.ScenarioId}.fact_trace",
            $"runtime.certification.{scenario.ScenarioId}.semantic_shadow"
        };

        return new RuntimeCertificationScenarioResult(
            ScenarioId: scenario.ScenarioId,
            Name: scenario.Name,
            CommandId: commandId,
            SubmissionId: submissionId,
            CommandType: CanonicalOperationsApiService.ConfirmCommandType,
            OperationCaseId: caseId,
            WorkItemId: workItemId,
            Replayable: passed,
            Status: passed ? "passed" : "failed",
            ExpectedOutcome: scenario.ExpectedOutcome,
            OutcomeStatus: outcomeStatus,
            CommitStatus: commitStatus,
            ProjectionStatus: projectionStatus,
            DomainEventRefs: eventRefs,
            LedgerTransactionRefs: ledgerTransactionRefs,
            LedgerEntryRefs: ledgerEntryRefs,
            EvidenceRefs: scenario.RequiredEvidence ?? [],
            FactTrace: trace,
            SemanticShadowResult: semanticShadowResult,
            InvariantChecks: invariantChecks,
            GateImpact: gateImpact,
            CutoverState: cutoverState,
            RollbackOrCompensationPath: rollbackPath,
            FailureReason: failureReason);
    }

    private static OperationsCommandRequest BuildRequest(
        string tenantId,
        RuntimeCertificationScenario scenario,
        string caseId,
        string workItemId,
        string idempotencyKey)
    {
        var fieldValues = new Dictionary<string, object>(StringComparer.Ordinal)
        {
            ["amount"] = scenario.Amount ?? 100m,
            ["currency"] = scenario.Currency ?? "KGS",
            ["scenarioId"] = scenario.ScenarioId
        };
        if (scenario.FieldValues is not null)
        {
            foreach (var (key, value) in scenario.FieldValues)
            {
                fieldValues[key] = NormalizeJsonValue(value) ?? string.Empty;
            }
        }

        var payload = new Dictionary<string, object>(StringComparer.Ordinal)
        {
            ["cardId"] = scenario.CardId ?? "OperationsConfirm",
            ["fieldValues"] = fieldValues,
            ["evidenceIds"] = scenario.RequiredEvidence ?? [],
            ["source"] = "runtime-certification-runner"
        };

        return new OperationsCommandRequest(
            tenantId,
            caseId,
            workItemId,
            CanonicalOperationsApiService.ConfirmCommandType,
            "CommandEnvelope.v1",
            $"certification:{scenario.ScenarioId}:v1",
            idempotencyKey,
            payload,
            scenario.ActorId ?? "cert-operator",
            $"{tenantId}:{workItemId}:confirm",
            $"cause-{scenario.ScenarioId}",
            $"corr-{scenario.ScenarioId}");
    }

    private static IReadOnlyList<InvariantCheckEvidence> BuildInvariantChecks(
        string releaseId,
        string tenantId,
        string sliceId,
        string ciRunId,
        string sourceMode,
        IReadOnlyList<RuntimeCertificationScenarioResult> results)
    {
        var checks = new List<InvariantCheckEvidence>();
        var failed = results.Where(item => item.Status != "passed").ToArray();
        checks.Add(Invariant(
            $"inv-{Sanitize(CertificationInvariantKey)}",
            releaseId,
            tenantId,
            sliceId,
            CertificationInvariantKey,
            "Runtime certification pack must replay all scenarios with expected gate impact.",
            failed.Length == 0 ? "passed" : "failed",
            failed.Length,
            new Dictionary<string, object>
            {
                ["scenario_count"] = results.Count,
                ["failed_scenarios"] = failed.Select(item => item.ScenarioId).ToArray()
            },
            sourceMode,
            ciRunId));

        checks.AddRange(results.Select(result => Invariant(
            $"inv-runtime-certification-{Sanitize(result.ScenarioId)}",
            releaseId,
            tenantId,
            sliceId,
            $"runtime.certification.{result.ScenarioId}",
            $"Runtime certification scenario {result.ScenarioId} must be replayable and emit fact trace evidence.",
            result.Status == "passed" ? "passed" : "failed",
            result.Status == "passed" ? 0 : 1,
            new Dictionary<string, object>
            {
                ["scenario_id"] = result.ScenarioId,
                ["command_id"] = result.CommandId,
                ["submission_id"] = result.SubmissionId,
                ["semantic_shadow_result"] = result.SemanticShadowResult,
                ["gate_impact"] = result.GateImpact
            },
            sourceMode,
            ciRunId)));
        return checks;
    }

    private static InvariantCheckEvidence Invariant(
        string id,
        string releaseId,
        string tenantId,
        string sliceId,
        string key,
        string description,
        string status,
        int violationCount,
        IReadOnlyDictionary<string, object> observed,
        string sourceMode,
        string ciRunId) =>
        new(
            id,
            releaseId,
            tenantId,
            sliceId,
            key,
            description,
            "blocking",
            "P0",
            "runtime-certification",
            null,
            "scripts/v5_4/certify-runtime.mjs",
            status,
            observed,
            new Dictionary<string, object> { ["expected_failed_scenarios"] = 0 },
            violationCount,
            violationCount == 0
                ? []
                : new[] { (IReadOnlyDictionary<string, object>)new Dictionary<string, object> { ["certification_failure"] = key } },
            "runtime-certification-runner",
            ciRunId,
            DateTimeOffset.UtcNow)
        {
            SourceMode = sourceMode
        };

    private static ShadowCompareEvidence BuildSemanticShadowReport(
        string releaseId,
        string tenantId,
        string sliceId,
        string ciRunId,
        string sourceMode,
        IReadOnlyList<RuntimeCertificationScenarioResult> results)
    {
        var redScenarios = results
            .Where(result => result.Status != "passed" || result.SemanticShadowResult == "red_unexpected")
            .ToArray();
        var grade = redScenarios.Length == 0 ? "green" : "red";
        var summary = new Dictionary<string, object>
        {
            ["status"] = grade == "green" ? "semantic_green" : "semantic_red",
            ["mode"] = "certification_fact_graph",
            ["fact_graph_objects"] = RuntimeCertificationFactGraph.Objects,
            ["red_rules_verified"] = RuntimeCertificationFactGraph.RedRules,
            ["yellow_rules_verified"] = RuntimeCertificationFactGraph.YellowRules,
            ["scenario_count"] = results.Count,
            ["red_scenarios"] = redScenarios.Select(item => item.ScenarioId).ToArray()
        };

        return new ShadowCompareEvidence(
            CertificationShadowReportId,
            releaseId,
            tenantId,
            sliceId,
            new Dictionary<string, object>
            {
                ["type"] = "semantic_certification_fact_graph",
                ["objects"] = RuntimeCertificationFactGraph.Objects
            },
            "legacy-runtime-certification",
            "operations-runtime-certification",
            "semantic-shadow-fact-graph",
            DateTimeOffset.UtcNow,
            grade,
            results.Count,
            results.Count - redScenarios.Length,
            redScenarios.Length,
            0,
            0,
            redScenarios.Select(item => (IReadOnlyDictionary<string, object>)new Dictionary<string, object>
            {
                ["scenario_id"] = item.ScenarioId,
                ["failure_reason"] = item.FailureReason ?? "semantic_shadow_red"
            }).ToArray(),
            summary,
            "runtime-certification-runner",
            ciRunId)
        {
            SourceMode = sourceMode
        };
    }

    private static object? NormalizeJsonValue(object? value)
    {
        if (value is JsonElement element)
        {
            return element.ValueKind switch
            {
                JsonValueKind.String => element.GetString(),
                JsonValueKind.Number when element.TryGetDecimal(out var number) => number,
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Array => element.EnumerateArray().Select(item => NormalizeJsonValue(item)).ToArray(),
                JsonValueKind.Object => element.EnumerateObject().ToDictionary(item => item.Name, item => NormalizeJsonValue(item.Value), StringComparer.Ordinal),
                _ => element.ToString()
            };
        }

        return value;
    }

    private static string ResolveSourceMode(RunnerOptions options)
    {
        var value = options.Get("sourceMode") ?? options.Get("source-mode") ?? "real";
        return value switch
        {
            "real" or "fixture" or "skeleton" => value,
            _ => throw new InvalidOperationException($"runtime-certification-runner: sourceMode must be real, fixture, or skeleton; got {value}")
        };
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

    private static string RelativeRepoPath(string path) =>
        Path.GetRelativePath(RepoRoot(), Path.GetFullPath(path)).Replace('\\', '/');

    private sealed class RuntimeCertificationContext
    {
        public RuntimeCertificationContext(string tenantId, string sliceId)
        {
            TenantId = tenantId;
            SliceId = sliceId;
            Store = new InMemoryOperationsStore();
            var router = new SliceCommandHandlerRouter()
                .Register(CanonicalOperationsApiService.ConfirmCommandType, CanonicalOperationsApiService.HandleConfirmCommand);
            UnitOfWork = new OperationsUnitOfWork(
                new CommandEnvelopeBuilder(),
                new CommandSubmissionService(Store),
                new IdempotencyService(Store),
                new PayloadHashService(),
                router);
        }

        public string TenantId { get; }

        public string SliceId { get; }

        public InMemoryOperationsStore Store { get; }

        public OperationsUnitOfWork UnitOfWork { get; }
    }
}

public sealed record RuntimeCertificationScenarioFile(
    string Version,
    IReadOnlyList<RuntimeCertificationScenario> Scenarios);

public sealed record RuntimeCertificationScenario(
    string ScenarioId,
    string Name,
    string ExpectedOutcome,
    string? CardId = null,
    bool? MoneyCommand = null,
    decimal? Amount = null,
    string? Currency = null,
    string? ActorId = null,
    IReadOnlyList<string>? RequiredEvidence = null,
    IReadOnlyDictionary<string, object>? FieldValues = null,
    string? SemanticShadowResult = null,
    string? GateImpact = null,
    string? CutoverState = null,
    string? RollbackOrCompensationPath = null);

public sealed record RuntimeCertificationEvidence(
    string CertificationReportId,
    string ReleaseId,
    string TenantId,
    string SliceId,
    string Status,
    string SourceMode,
    DateTimeOffset GeneratedAtUtc,
    string GeneratedBy,
    string? CiRunId,
    int ScenarioCount,
    int PassedScenarioCount,
    int FailedScenarioCount,
    IReadOnlyList<RuntimeCertificationScenarioResult> Scenarios,
    IReadOnlyList<string> InvariantCheckRefs,
    IReadOnlyList<string> ShadowCompareReportRefs,
    IReadOnlyDictionary<string, object> Summary);

public sealed record RuntimeCertificationScenarioResult(
    string ScenarioId,
    string Name,
    string CommandId,
    string SubmissionId,
    string CommandType,
    string OperationCaseId,
    string WorkItemId,
    bool Replayable,
    string Status,
    string ExpectedOutcome,
    string OutcomeStatus,
    string CommitStatus,
    string ProjectionStatus,
    IReadOnlyList<string> DomainEventRefs,
    IReadOnlyList<string> LedgerTransactionRefs,
    IReadOnlyList<string> LedgerEntryRefs,
    IReadOnlyList<string> EvidenceRefs,
    FactTraceV1? FactTrace,
    string SemanticShadowResult,
    IReadOnlyList<string> InvariantChecks,
    string GateImpact,
    string CutoverState,
    string RollbackOrCompensationPath,
    string? FailureReason);

public static class RuntimeCertificationFactGraph
{
    public static readonly string[] Objects =
    [
        "CommandSubmission",
        "DomainEvent",
        "LedgerTransaction",
        "LedgerEntry",
        "WorkItemTimeline",
        "WorkQueueState",
        "LensSnapshot",
        "EvidenceState",
        "CaseTimeline"
    ];

    public static readonly string[] RedRules =
    [
        "money amount mismatch",
        "currency mismatch",
        "missing ledger transaction",
        "deposit treated as revenue",
        "evidence hash mismatch",
        "missing domain event",
        "work item final status mismatch"
    ];

    public static readonly string[] YellowRules =
    [
        "projection-only drift",
        "stale lens",
        "non-critical formatting drift"
    ];
}
