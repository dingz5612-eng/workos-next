namespace WorkOS.Api.Runtime;

public static class ReconciliationProcessRuleIds
{
    public const string PaymentMismatchDetectedCreatesReconciliationWorkItem =
        "reconciliation.payment_mismatch_detected.create_reconciliation_work_item";
}

public sealed class ReconciliationProcessManager
{
    public CheckoutServiceProcessManagerResult Handle(WorkspaceEvent workspaceEvent, ICheckoutServiceProcessRunSink sink)
    {
        if (workspaceEvent.EventType is not "PaymentMismatchDetected" and not "Reconciliation.PaymentMismatchDetected")
        {
            return CheckoutServiceProcessManagerResult.Empty;
        }

        var run = Run(workspaceEvent, ReconciliationProcessRuleIds.PaymentMismatchDetectedCreatesReconciliationWorkItem);
        var intent = new ProcessWorkItemIntentRecord(
            IntentId(run.ProcessRunId, "work-item"),
            run.ProcessRunId,
            run.TenantId,
            Value(workspaceEvent, "reconciliationWorkItemId", StableWorkItemId(workspaceEvent, "reconciliation-review")),
            "reconciliationReview",
            "W-FINANCE-RECONCILIATION",
            Value(workspaceEvent, "ownerRole", "finance"),
            workspaceEvent.EventId,
            "requested",
            run.CreatedAtUtc,
            new Dictionary<string, string>
            {
                ["caseId"] = Value(workspaceEvent, "caseId", string.Empty),
                ["reconciliationCaseId"] = Value(workspaceEvent, "reconciliationCaseId", string.Empty),
                ["mismatchId"] = Value(workspaceEvent, "mismatchId", string.Empty),
                ["mismatchType"] = Value(workspaceEvent, "mismatchType", string.Empty),
                ["bankTransactionId"] = Value(workspaceEvent, "bankTransactionId", string.Empty),
                ["relatedObjectType"] = Value(workspaceEvent, "relatedObjectType", string.Empty),
                ["relatedObjectId"] = Value(workspaceEvent, "relatedObjectId", string.Empty),
                ["resolveActions"] = Value(workspaceEvent, "resolveActions", string.Empty),
                ["dueAtUtc"] = Value(workspaceEvent, "dueAtUtc", string.Empty),
                ["blockerSeverity"] = Value(workspaceEvent, "blockerSeverity", "P1"),
                ["sourceEventType"] = workspaceEvent.EventType
            });

        if (!sink.TryRecordProcessRun(run, new[] { intent }, Array.Empty<ProcessRequestEventIntentRecord>()))
        {
            return CheckoutServiceProcessManagerResult.Empty;
        }

        return new CheckoutServiceProcessManagerResult(
            new[] { run },
            new[] { intent },
            Array.Empty<ProcessRequestEventIntentRecord>());
    }

    private static ProcessRunRecord Run(WorkspaceEvent workspaceEvent, string processRuleId) =>
        new(
            $"prun-{StableHash(workspaceEvent.WorkspaceId, workspaceEvent.EventId, processRuleId)}",
            workspaceEvent.WorkspaceId,
            workspaceEvent.EventId,
            workspaceEvent.EventType,
            processRuleId,
            "recorded",
            DateTimeOffset.UtcNow,
            new Dictionary<string, string>
            {
                ["cardId"] = workspaceEvent.CardId,
                ["correlationId"] = workspaceEvent.CorrelationId,
                ["requestId"] = workspaceEvent.RequestId,
                ["businessWriteOwner"] = "process_manager_intent_only"
            });

    private static string Value(WorkspaceEvent workspaceEvent, string key, string defaultValue) =>
        RuntimeFieldAliases.Value(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static string StableWorkItemId(WorkspaceEvent workspaceEvent, string suffix) =>
        $"wi-{StableHash(workspaceEvent.WorkspaceId, workspaceEvent.EventId, suffix)}";

    private static string IntentId(string processRunId, string suffix) =>
        $"{processRunId}-{suffix}";

    private static string StableHash(params string[] parts)
    {
        var value = string.Join("|", parts);
        var hash = 2166136261u;
        foreach (var ch in value)
        {
            hash ^= ch;
            hash *= 16777619;
        }

        return hash.ToString("x8", System.Globalization.CultureInfo.InvariantCulture);
    }
}
