using System.Text.Json;

namespace WorkOS.Api.Runtime;

public static class ProductionObservabilityMetricsBuilder
{
    public static ProductionObservabilityMetrics Build(
        IReadOnlyList<OutboxMessage> outbox,
        IReadOnlyList<BehaviorEventRecord> behaviorEvents,
        IReadOnlyDictionary<string, int> failedConfirmReasons,
        IReadOnlyList<long> confirmLatencyMs,
        ProductionObservabilityDatabaseSnapshot database,
        long projectionLagSeconds,
        DateTimeOffset now)
    {
        var pendingOutbox = outbox
            .Where(message => message.ProcessedAtUtc is null && message.DeadLetteredAtUtc is null)
            .ToArray();
        var outboxLagSeconds = pendingOutbox.Length == 0
            ? 0
            : pendingOutbox.Max(message => Math.Max(0, Convert.ToInt64((now - message.CreatedAtUtc).TotalSeconds)));
        var mobileBundleLatencies = behaviorEvents
            .Where(IsWorkItemBundleLatency)
            .Select(SourceDurationMs)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .ToArray();

        var runtime = new RuntimeProductionMetrics(
            ConfirmLatencyP95Ms: Percentile95(confirmLatencyMs),
            ConfirmLatencySampleCount: confirmLatencyMs.Count,
            ConfirmFailureCount: failedConfirmReasons.Values.Sum(),
            IdempotencyConflictCount: CountReasons(failedConfirmReasons, reason =>
                reason.Contains("idempotency_conflict", StringComparison.OrdinalIgnoreCase) ||
                reason.Contains("different_payload", StringComparison.OrdinalIgnoreCase)),
            ForbiddenCount403: CountReasons(failedConfirmReasons, ConfirmHttpStatusMapper.IsAuthorizationForbidden),
            ConflictCount409: CountReasons(failedConfirmReasons, reason =>
                reason.Contains("idempotency_conflict", StringComparison.OrdinalIgnoreCase) ||
                reason.Contains("conflict", StringComparison.OrdinalIgnoreCase)),
            ValidationCount422: CountReasons(failedConfirmReasons, IsBusinessValidationReason),
            HandlerFailureCount: CountReasons(failedConfirmReasons, reason =>
                reason.Contains("handler_failure", StringComparison.OrdinalIgnoreCase) ||
                reason.Contains("handler failed", StringComparison.OrdinalIgnoreCase) ||
                reason.Contains("exception", StringComparison.OrdinalIgnoreCase)));

        var mobile = new MobileProductionMetrics(
            WorkItemBundleP95Ms: Percentile95(mobileBundleLatencies),
            WorkItemBundleSampleCount: mobileBundleLatencies.Length,
            UploadFailureCount: CountEvents(behaviorEvents, ContainsAll("upload", "fail")),
            SubmitRetryCount: CountEvents(behaviorEvents, ContainsAll("submit", "retry")),
            DraftRecoveryCount: CountEvents(behaviorEvents, ContainsAny("draftrecovered", "draft_recovered", "draft recovery", "draft restored", "draft_recovery")));

        return new ProductionObservabilityMetrics(
            runtime,
            new OutboxProductionMetrics(
                outboxLagSeconds,
                outbox.Count(message => message.DeadLetteredAtUtc is not null),
                database.ReplayCount),
            new ProjectionProductionMetrics(
                projectionLagSeconds,
                database.RebuildCount,
                database.StaleLensCount),
            mobile,
            new MoneyProductionMetrics(
                database.PaymentConfirmWithoutEvidenceViolations,
                database.AllocationOverAvailableViolations,
                database.StayBalanceMismatchCount),
            new DepositProductionMetrics(
                database.AvailableRefundNegativeCount,
                database.RefundFailedDoubleCount,
                database.HeldAmountNegativeCount),
            new CheckoutProductionMetrics(
                database.OpenBlockers,
                database.DuplicateBlockers,
                database.FakeCloseAttempts),
            new ControlPlaneProductionMetrics(
                database.GateResultStatus,
                database.RedShadowReports,
                database.BlockingInvariantFailures,
                database.ReleaseState),
            now);
    }

    private static bool IsBusinessValidationReason(string reason) =>
        !ConfirmHttpStatusMapper.IsAuthenticationFailure(reason) &&
        !ConfirmHttpStatusMapper.IsAuthorizationForbidden(reason) &&
        !reason.StartsWith("Confirm requires", StringComparison.OrdinalIgnoreCase) &&
        !reason.Equals("canonical_field_id_required", StringComparison.OrdinalIgnoreCase) &&
        !reason.Equals("not_found", StringComparison.OrdinalIgnoreCase) &&
        !reason.Contains("idempotency_conflict", StringComparison.OrdinalIgnoreCase);

    private static int CountReasons(IReadOnlyDictionary<string, int> reasons, Func<string, bool> match) =>
        reasons.Where(item => match(item.Key)).Sum(item => item.Value);

    private static int CountEvents(IReadOnlyList<BehaviorEventRecord> events, Func<string, bool> match) =>
        events.Count(item => match($"{item.EventType} {item.ObjectType} {item.Source}"));

    private static Func<string, bool> ContainsAll(params string[] terms) =>
        value => terms.All(term => value.Contains(term, StringComparison.OrdinalIgnoreCase));

    private static Func<string, bool> ContainsAny(params string[] terms) =>
        value => terms.Any(term => value.Contains(term, StringComparison.OrdinalIgnoreCase));

    private static bool IsWorkItemBundleLatency(BehaviorEventRecord record)
    {
        var haystack = $"{record.EventType} {record.ObjectType}";
        return haystack.Contains("workitembundle", StringComparison.OrdinalIgnoreCase) ||
            haystack.Contains("work_item_bundle", StringComparison.OrdinalIgnoreCase);
    }

    private static long? SourceDurationMs(BehaviorEventRecord record)
    {
        if (string.IsNullOrWhiteSpace(record.Source))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(record.Source);
            var root = document.RootElement;
            foreach (var key in new[] { "durationMs", "latencyMs", "elapsedMs", "p95Ms" })
            {
                if (root.TryGetProperty(key, out var value) && value.TryGetInt64(out var number))
                {
                    return number;
                }
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    private static long Percentile95(IReadOnlyList<long> values)
    {
        if (values.Count == 0)
        {
            return 0;
        }

        var ordered = values.OrderBy(value => value).ToArray();
        var index = Math.Clamp(Convert.ToInt32(Math.Ceiling(ordered.Length * 0.95m)) - 1, 0, ordered.Length - 1);
        return ordered[index];
    }
}

public sealed record ProductionObservabilityDatabaseSnapshot(
    int ReplayCount,
    int RebuildCount,
    int StaleLensCount,
    int PaymentConfirmWithoutEvidenceViolations,
    int AllocationOverAvailableViolations,
    int StayBalanceMismatchCount,
    int AvailableRefundNegativeCount,
    int RefundFailedDoubleCount,
    int HeldAmountNegativeCount,
    int OpenBlockers,
    int DuplicateBlockers,
    int FakeCloseAttempts,
    string GateResultStatus,
    int RedShadowReports,
    int BlockingInvariantFailures,
    string ReleaseState)
{
    public static ProductionObservabilityDatabaseSnapshot Empty { get; } = new(
        ReplayCount: 0,
        RebuildCount: 0,
        StaleLensCount: 0,
        PaymentConfirmWithoutEvidenceViolations: 0,
        AllocationOverAvailableViolations: 0,
        StayBalanceMismatchCount: 0,
        AvailableRefundNegativeCount: 0,
        RefundFailedDoubleCount: 0,
        HeldAmountNegativeCount: 0,
        OpenBlockers: 0,
        DuplicateBlockers: 0,
        FakeCloseAttempts: 0,
        GateResultStatus: "not_run",
        RedShadowReports: 0,
        BlockingInvariantFailures: 0,
        ReleaseState: "none");
}
