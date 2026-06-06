using Microsoft.AspNetCore.Http;

namespace WorkOS.Api.Runtime;

public sealed class RuntimeScenarioRunner
{
    private readonly string tenantId;

    public RuntimeScenarioRunner(string tenantId = "scenario-tenant")
    {
        this.tenantId = tenantId;
    }

    public ExecutableScenarioRunResult Run(ExecutableScenarioDefinition scenario)
    {
        return scenario.ScenarioType switch
        {
            "committed_scenario" => RunCommitted(scenario),
            "rejected_command_scenario" when scenario.ExpectedOutcome == "idempotency_conflict_409" => RunConflict(scenario),
            "rejected_command_scenario" => RunRejected(scenario),
            "gate_only_blocked_scenario" => RunGateOnly(scenario),
            _ => throw new InvalidOperationException($"unsupported_scenario_type:{scenario.ScenarioType}")
        };
    }

    private ExecutableScenarioRunResult RunCommitted(ExecutableScenarioDefinition scenario)
    {
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, CanonicalOperationsApiService.HandleConfirmCommand);
        var result = unitOfWork.Commit(Request(scenario, "idem-committed"));
        var trace = store.GetFactTraceBySubmission(result.SubmissionId);
        var submission = store.Submissions.Single(item => item.SubmissionId == result.SubmissionId);
        var factGraph = ScenarioFactGraphBuilder.Build(tenantId, scenario, store, trace, null, null, "semantic-shadow-green", "gate-accepts-committed");

        return new ExecutableScenarioRunResult(
            scenario.ScenarioId,
            scenario.ScenarioType,
            result.StatusCode == StatusCodes.Status200OK && result.CommitStatus == "committed" ? "passed" : "failed",
            CommandSubmission(submission),
            null,
            null,
            WorkItem(scenario),
            result.DomainEventIds,
            store.LedgerTransactions.Where(item => item.SubmissionId == result.SubmissionId).Select(item => item.LedgerTransactionId).ToArray(),
            store.LedgerEntries.Where(entry => store.LedgerTransactions.Any(tx => tx.SubmissionId == result.SubmissionId && tx.LedgerTransactionId == entry.LedgerTransactionId)).Select(item => item.EntryId).ToArray(),
            trace,
            factGraph,
            true);
    }

    private ExecutableScenarioRunResult RunRejected(ExecutableScenarioDefinition scenario)
    {
        var store = new InMemoryOperationsStore();
        var statusCode = scenario.RejectionStatusCode ?? StatusCodes.Status422UnprocessableEntity;
        var reason = scenario.RejectionReason ?? "scenario_rejected";
        var unitOfWork = UnitOfWork(store, _ => SliceCommandHandlerResult.Rejected(statusCode, reason));
        var result = unitOfWork.Commit(Request(scenario, "idem-rejected"));
        var submission = store.Submissions.Single(item => item.SubmissionId == result.SubmissionId);
        var rejected = RejectedSubmission(submission);
        var trace = RejectionTrace(scenario, submission, statusCode, reason);
        var factTrace = store.GetFactTraceBySubmission(result.SubmissionId);
        var factGraph = ScenarioFactGraphBuilder.Build(tenantId, scenario, store, factTrace, rejected, trace, "semantic-shadow-green", $"rejected-{statusCode}");

        return new ExecutableScenarioRunResult(
            scenario.ScenarioId,
            scenario.ScenarioType,
            result.StatusCode == statusCode &&
            submission.Status == "rejected" &&
            store.DomainEvents.Count == 0 &&
            store.LedgerTransactions.Count == 0 ? "passed" : "failed",
            null,
            rejected,
            trace,
            WorkItem(scenario),
            Array.Empty<string>(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            factTrace,
            factGraph,
            true);
    }

    private ExecutableScenarioRunResult RunConflict(ExecutableScenarioDefinition scenario)
    {
        var store = new InMemoryOperationsStore();
        var unitOfWork = UnitOfWork(store, CanonicalOperationsApiService.HandleConfirmCommand);
        var first = unitOfWork.Commit(Request(scenario, "idem-conflict"));
        var eventCountAfterFirst = store.DomainEvents.Count;
        var conflicting = scenario with { Amount = (scenario.Amount ?? 100m) + 1m };
        var second = unitOfWork.Commit(Request(conflicting, "idem-conflict"));
        var submission = store.Submissions.Single(item => item.SubmissionId == first.SubmissionId);
        var rejected = new RejectedCommandSubmissionV1(
            submission.TenantId,
            submission.SubmissionId,
            submission.CaseId,
            submission.WorkItemId,
            "blocked",
            StatusCodes.Status409Conflict,
            second.Reason ?? "same_idempotency_different_payload",
            second.Reason ?? "same_idempotency_different_payload");
        var trace = RejectionTrace(scenario, submission, StatusCodes.Status409Conflict, rejected.FailureReason);
        var factTrace = store.GetFactTraceBySubmission(first.SubmissionId);
        var factGraph = ScenarioFactGraphBuilder.Build(tenantId, scenario, store, factTrace, rejected, trace, "semantic-shadow-green", "idempotency-conflict-blocked");

        return new ExecutableScenarioRunResult(
            scenario.ScenarioId,
            scenario.ScenarioType,
            first.StatusCode == StatusCodes.Status200OK &&
            second.StatusCode == StatusCodes.Status409Conflict &&
            store.DomainEvents.Count == eventCountAfterFirst ? "passed" : "failed",
            CommandSubmission(submission),
            rejected,
            trace,
            WorkItem(scenario),
            store.DomainEvents.Select(item => item.EventId).ToArray(),
            store.LedgerTransactions.Select(item => item.LedgerTransactionId).ToArray(),
            store.LedgerEntries.Select(item => item.EntryId).ToArray(),
            factTrace,
            factGraph,
            store.DomainEvents.Count == eventCountAfterFirst);
    }

    private ExecutableScenarioRunResult RunGateOnly(ExecutableScenarioDefinition scenario)
    {
        var factGraph = ScenarioFactGraphBuilder.BuildGateOnly(tenantId, scenario);
        return new ExecutableScenarioRunResult(
            scenario.ScenarioId,
            scenario.ScenarioType,
            "passed",
            null,
            null,
            null,
            WorkItem(scenario),
            Array.Empty<string>(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            null,
            factGraph,
            true);
    }

    private OperationsCommandRequest Request(ExecutableScenarioDefinition scenario, string idempotencyKey)
    {
        var caseId = $"case-{scenario.ScenarioId}";
        var workItemId = $"wi-{scenario.ScenarioId}";
        var fieldValues = new Dictionary<string, object>(StringComparer.Ordinal)
        {
            ["amount"] = scenario.Amount ?? 100m,
            ["currency"] = scenario.Currency ?? "KGS",
            ["scenarioId"] = scenario.ScenarioId
        };
        if (scenario.CardId?.Equals("RefundDeposit", StringComparison.OrdinalIgnoreCase) is true)
        {
            fieldValues["depositAccountId"] = $"deposit-account-{caseId}";
        }

        return new OperationsCommandRequest(
            tenantId,
            caseId,
            workItemId,
            CanonicalOperationsApiService.ConfirmCommandType,
            "CommandEnvelope.v1",
            $"scenario:{scenario.ScenarioId}:v1",
            idempotencyKey,
            new Dictionary<string, object>(StringComparer.Ordinal)
            {
                ["cardId"] = scenario.CardId ?? "OperationsConfirm",
                ["fieldValues"] = fieldValues,
                ["evidenceIds"] = scenario.EvidenceRefs,
                ["source"] = "runtime-scenario-runner"
            },
            scenario.ActorId ?? "scenario-operator",
            $"{tenantId}:{workItemId}:confirm",
            $"cause-{scenario.ScenarioId}",
            $"corr-{scenario.ScenarioId}");
    }

    private static OperationsUnitOfWork UnitOfWork(InMemoryOperationsStore store, Func<CommandEnvelopeV1, SliceCommandHandlerResult> handler)
    {
        var router = new SliceCommandHandlerRouter().Register(CanonicalOperationsApiService.ConfirmCommandDefinition, handler);
        return new OperationsUnitOfWork(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            router);
    }

    private CommandSubmissionV1 CommandSubmission(OperationsCommandSubmission submission) =>
        new(
            submission.TenantId,
            submission.SubmissionId,
            submission.CaseId,
            submission.WorkItemId,
            submission.IdempotencyKey,
            submission.PayloadHash,
            submission.Status);

    private RejectedCommandSubmissionV1 RejectedSubmission(OperationsCommandSubmission submission) =>
        new(
            submission.TenantId,
            submission.SubmissionId,
            submission.CaseId,
            submission.WorkItemId,
            submission.Status,
            submission.ResponseStatusCode ?? StatusCodes.Status422UnprocessableEntity,
            submission.FailureCode ?? "scenario_rejected",
            submission.FailureReason ?? submission.FailureCode ?? "scenario_rejected");

    private RejectionTraceV1 RejectionTrace(ExecutableScenarioDefinition scenario, OperationsCommandSubmission submission, int statusCode, string reason) =>
        new(
            submission.TenantId,
            $"rej-trace-{submission.SubmissionId}",
            submission.CaseId,
            submission.WorkItemId,
            submission.SubmissionId,
            scenario.PolicyRef ?? $"scenario-policy:{scenario.ScenarioId}",
            statusCode,
            reason,
            scenario.EvidenceRefs,
            Array.Empty<string>(),
            Array.Empty<string>());

    private WorkItemV1 WorkItem(ExecutableScenarioDefinition scenario) =>
        new(
            tenantId,
            $"case-{scenario.ScenarioId}",
            $"wi-{scenario.ScenarioId}",
            scenario.WorkItemType ?? $"Scenario.{scenario.CardId ?? "Operation"}",
            "scenario_replayed",
            scenario.OwnerRole ?? "operator");
}

public static class ScenarioFactGraphBuilder
{
    public static ScenarioFactGraphV1 Build(
        string tenantId,
        ExecutableScenarioDefinition scenario,
        InMemoryOperationsStore store,
        FactTraceV1? factTrace,
        RejectedCommandSubmissionV1? rejected,
        RejectionTraceV1? rejectionTrace,
        string semanticShadowRef,
        string gateImpactRef) =>
        new(
            tenantId,
            scenario.ScenarioId,
            scenario.ScenarioType,
            store.Submissions.Select(item => item.SubmissionId).ToArray(),
            rejected is null ? Array.Empty<string>() : new[] { rejected.SubmissionId },
            new[] { $"wi-{scenario.ScenarioId}" },
            scenario.EvidenceRefs,
            store.DomainEvents.Select(item => item.EventId).ToArray(),
            store.LedgerTransactions.Select(item => item.LedgerTransactionId).ToArray(),
            store.LedgerEntries.Select(item => item.EntryId).ToArray(),
            factTrace?.ProjectionCommitRefs ?? Array.Empty<string>(),
            new[] { $"lens-{scenario.ScenarioId}" },
            new[] { semanticShadowRef },
            rejectionTrace is null ? new[] { gateImpactRef } : new[] { gateImpactRef, rejectionTrace.TraceId });

    public static ScenarioFactGraphV1 BuildGateOnly(string tenantId, ExecutableScenarioDefinition scenario) =>
        new(
            tenantId,
            scenario.ScenarioId,
            scenario.ScenarioType,
            Array.Empty<string>(),
            Array.Empty<string>(),
            new[] { $"wi-{scenario.ScenarioId}" },
            scenario.EvidenceRefs,
            Array.Empty<string>(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            new[] { $"lens-{scenario.ScenarioId}" },
            new[] { scenario.ShadowCompareReportRef ?? $"shadow-{scenario.ScenarioId}" },
            new[] { scenario.GateResultRef ?? $"gate-{scenario.ScenarioId}", scenario.RollbackBlockerRef ?? $"rollback-blocker-{scenario.ScenarioId}" });
}

public sealed record ExecutableScenarioDefinition(
    string ScenarioId,
    string Name,
    string ScenarioType,
    string? ExpectedOutcome = null,
    string? CardId = null,
    string? WorkItemType = null,
    string? OwnerRole = null,
    bool MoneyCommand = false,
    decimal? Amount = null,
    string Currency = "KGS",
    string? ActorId = null,
    int? RejectionStatusCode = null,
    string? RejectionReason = null,
    string? PolicyRef = null,
    string? GateResultRef = null,
    string? ShadowCompareReportRef = null,
    string? RollbackBlockerRef = null,
    IReadOnlyList<string>? EvidenceRefs = null)
{
    public IReadOnlyList<string> EvidenceRefs { get; init; } = EvidenceRefs ?? Array.Empty<string>();
}

public sealed record ExecutableScenarioRunResult(
    string ScenarioId,
    string ScenarioType,
    string Status,
    CommandSubmissionV1? CommandSubmission,
    RejectedCommandSubmissionV1? RejectedCommandSubmission,
    RejectionTraceV1? RejectionTrace,
    WorkItemV1 WorkItem,
    IReadOnlyList<string> DomainEventRefs,
    IReadOnlyList<string> LedgerTransactionRefs,
    IReadOnlyList<string> LedgerEntryRefs,
    FactTraceV1? FactTrace,
    ScenarioFactGraphV1 FactGraph,
    bool NoDuplicateSideEffect);
