namespace WorkOS.Api.Runtime;

public static class CheckoutServiceProcessRuleIds
{
    public const string CheckoutStartedCreatesRoomInspectionWorkItem = "checkout.checkout_started.create_room_inspection_work_item";
    public const string RoomInspectedDamageCreatesDepositSettlementWorkItem = "checkout.room_inspected_damage.create_deposit_settlement_work_item";
    public const string RoomInspectedCleaningCreatesServiceTaskWorkItem = "checkout.room_inspected_cleaning.create_service_task_work_item";
    public const string RoomInspectedBalanceCreatesBalanceCloseWorkItem = "checkout.room_inspected_balance.create_balance_close_work_item";
    public const string ServiceTaskVerifiedCreatesResourceReleaseWorkItem = "checkout.service_task_verified.create_resource_release_work_item";
    public const string ResourceReleaseRequestedRoutesToResourceInventory = "checkout.resource_release_requested.route_to_resource_inventory";
    public const string BedReleasedEvaluatesCaseClosurePolicy = "checkout.bed_released.evaluate_case_closure_policy";
    public const string CaseClosurePolicyFailedCreatesBlockers = "checkout.case_closure_policy_failed.create_blockers_and_resolution_work_items";
    public const string PeriodOperationsDiagnosedSuggestsActionPlanWorkItem = "period.operations_diagnosed.suggest_action_plan_work_item";
    public const string PeriodActionPlanCommittedCreatesWorkItem = "period.action_plan_committed.create_action_plan_work_item";
    public const string PeriodActionPlanCommittedEmitsWorkItemCreated = "period.action_plan_committed.emit_action_plan_work_item_created";
}

public sealed record ProcessRunRecord(
    string ProcessRunId,
    string TenantId,
    string TriggerEventId,
    string TriggerEventType,
    string ProcessRuleId,
    string Status,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyDictionary<string, string> Metadata);

public sealed record ProcessWorkItemIntentRecord(
    string IntentId,
    string ProcessRunId,
    string TenantId,
    string WorkItemId,
    string WorkItemType,
    string TargetWorkspaceId,
    string OwnerRole,
    string SourceEventId,
    string Status,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyDictionary<string, string> Payload);

public sealed record ProcessRequestEventIntentRecord(
    string IntentId,
    string ProcessRunId,
    string TenantId,
    string RequestEventType,
    string TargetSliceId,
    string SourceEventId,
    string Status,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyDictionary<string, string> Payload);

public sealed record CheckoutServiceProcessManagerResult(
    IReadOnlyList<ProcessRunRecord> ProcessRuns,
    IReadOnlyList<ProcessWorkItemIntentRecord> WorkItemIntents,
    IReadOnlyList<ProcessRequestEventIntentRecord> RequestEventIntents)
{
    public static CheckoutServiceProcessManagerResult Empty { get; } = new(
        Array.Empty<ProcessRunRecord>(),
        Array.Empty<ProcessWorkItemIntentRecord>(),
        Array.Empty<ProcessRequestEventIntentRecord>());
}

public interface ICheckoutServiceProcessRunSink
{
    bool TryRecordProcessRun(
        ProcessRunRecord processRun,
        IReadOnlyList<ProcessWorkItemIntentRecord> workItemIntents,
        IReadOnlyList<ProcessRequestEventIntentRecord> requestEventIntents);
}

public sealed class CheckoutServiceProcessManager
{
    public CheckoutServiceProcessManagerResult Handle(WorkspaceEvent workspaceEvent, ICheckoutServiceProcessRunSink sink)
    {
        var recordedRuns = new List<ProcessRunRecord>();
        var recordedWorkItems = new List<ProcessWorkItemIntentRecord>();
        var recordedRequests = new List<ProcessRequestEventIntentRecord>();

        foreach (var decision in DecisionsFor(workspaceEvent))
        {
            if (!sink.TryRecordProcessRun(decision.ProcessRun, decision.WorkItemIntents, decision.RequestEventIntents))
            {
                continue;
            }

            recordedRuns.Add(decision.ProcessRun);
            recordedWorkItems.AddRange(decision.WorkItemIntents);
            recordedRequests.AddRange(decision.RequestEventIntents);
        }

        return new CheckoutServiceProcessManagerResult(recordedRuns, recordedWorkItems, recordedRequests);
    }

    private static IReadOnlyList<ProcessDecision> DecisionsFor(WorkspaceEvent workspaceEvent) =>
        workspaceEvent.EventType switch
        {
            "CheckoutStarted" or "Accommodation.ResidentCheckedOut" => new[]
            {
                WorkItemDecision(
                    workspaceEvent,
                    CheckoutServiceProcessRuleIds.CheckoutStartedCreatesRoomInspectionWorkItem,
                    "roomInspection",
                    "W-STAY-CHECKOUT-SETTLEMENT",
                    Value(workspaceEvent, "roomInspectionWorkItemId", StableWorkItemId(workspaceEvent, "room-inspection")),
                    "operator",
                    new Dictionary<string, string>
                    {
                        ["caseId"] = CaseId(workspaceEvent),
                        ["checkoutId"] = CheckoutId(workspaceEvent),
                        ["stayId"] = Value(workspaceEvent, "stayId", string.Empty),
                        ["sourceEventType"] = workspaceEvent.EventType
                    })
            },
            "RoomInspected" or "Accommodation.RoomInspected" => RoomInspectionDecisions(workspaceEvent),
            "ServiceTaskVerified" or "Accommodation.ServiceTaskVerified" => new[]
            {
                WorkItemDecision(
                    workspaceEvent,
                    CheckoutServiceProcessRuleIds.ServiceTaskVerifiedCreatesResourceReleaseWorkItem,
                    "resourceReleaseRequest",
                    "W-STAY-RESOURCE",
                    Value(workspaceEvent, "resourceReleaseWorkItemId", StableWorkItemId(workspaceEvent, "resource-release")),
                    "operator",
                    new Dictionary<string, string>
                    {
                        ["caseId"] = CaseId(workspaceEvent),
                        ["taskId"] = Value(workspaceEvent, "taskId", string.Empty),
                        ["roomId"] = Value(workspaceEvent, "roomId", string.Empty),
                        ["bedId"] = Value(workspaceEvent, "bedId", string.Empty),
                        ["writesBedStatus"] = "false",
                        ["sourceEventType"] = workspaceEvent.EventType
                    })
            },
            "ResourceReleaseRequested" or "Accommodation.ResourceReleaseRequested" or "Accommodation.RoomReleaseAfterServiceRequested" or "Accommodation.BedReleaseAfterServiceRequested" => new[]
            {
                RequestDecision(
                    workspaceEvent,
                    CheckoutServiceProcessRuleIds.ResourceReleaseRequestedRoutesToResourceInventory,
                    "Accommodation.ResourceReleaseRoutedToResourceInventory",
                    "Accommodation.ResourceSetup",
                    new Dictionary<string, string>
                    {
                        ["caseId"] = CaseId(workspaceEvent),
                        ["roomId"] = Value(workspaceEvent, "roomId", string.Empty),
                        ["bedId"] = Value(workspaceEvent, "bedId", string.Empty),
                        ["writesBedStatus"] = "false",
                        ["sourceEventType"] = workspaceEvent.EventType
                    })
            },
            "BedReleased" or "Accommodation.BedReleased" => new[]
            {
                RequestDecision(
                    workspaceEvent,
                    CheckoutServiceProcessRuleIds.BedReleasedEvaluatesCaseClosurePolicy,
                    "Accommodation.CaseClosurePolicyEvaluationRequested",
                    "Accommodation.CheckOutSettlement",
                    new Dictionary<string, string>
                    {
                        ["caseId"] = CaseId(workspaceEvent),
                        ["checkoutId"] = CheckoutId(workspaceEvent),
                        ["bedId"] = Value(workspaceEvent, "bedId", string.Empty),
                        ["closesCaseWithoutClosurePolicy"] = "false",
                        ["sourceEventType"] = workspaceEvent.EventType
                    })
            },
            "CaseClosurePolicyFailed" or "Accommodation.CaseClosurePolicyFailed" => ClosureFailureDecisions(workspaceEvent),
            "Accommodation.PeriodOperationsDiagnosed" => new[]
            {
                WorkItemDecision(
                    workspaceEvent,
                    CheckoutServiceProcessRuleIds.PeriodOperationsDiagnosedSuggestsActionPlanWorkItem,
                    "periodActionPlan",
                    "W-STAY-PERIOD-ANALYTICS",
                    Value(workspaceEvent, "actionPlanWorkItemId", StableWorkItemId(workspaceEvent, "period-action-plan-suggestion")),
                    "manager",
                    new Dictionary<string, string>
                    {
                        ["periodId"] = PeriodId(workspaceEvent),
                        ["issueCategory"] = Value(workspaceEvent, "issueCategory", "operations"),
                        ["issueSummary"] = Value(workspaceEvent, "issueSummary", string.Empty),
                        ["suggestedActionPlan"] = "true",
                        ["ownerRole"] = "manager",
                        ["priority"] = Value(workspaceEvent, "priority", "normal"),
                        ["dueAtUtc"] = DueAtUtc(workspaceEvent),
                        ["sourceEventType"] = workspaceEvent.EventType
                    })
            },
            "Accommodation.PeriodActionPlanCommitted" => PeriodActionPlanCommittedDecisions(workspaceEvent),
            _ => Array.Empty<ProcessDecision>()
        };

    private static IReadOnlyList<ProcessDecision> PeriodActionPlanCommittedDecisions(WorkspaceEvent workspaceEvent)
    {
        var actionPlanId = ActionPlanId(workspaceEvent);
        var workItemId = Value(workspaceEvent, "actionPlanWorkItemId",
            Value(workspaceEvent, "workItemId", StableWorkItemId(workspaceEvent, "period-action-plan")));
        var ownerRole = OwnerRole(workspaceEvent);
        var dueAtUtc = DueAtUtc(workspaceEvent);
        var priority = Value(workspaceEvent, "priority", "normal");
        return new[]
        {
            WorkItemDecision(
                workspaceEvent,
                CheckoutServiceProcessRuleIds.PeriodActionPlanCommittedCreatesWorkItem,
                "periodActionPlanExecution",
                "W-STAY-PERIOD-ANALYTICS",
                workItemId,
                ownerRole,
                new Dictionary<string, string>
                {
                    ["periodId"] = PeriodId(workspaceEvent),
                    ["actionPlanId"] = actionPlanId,
                    ["actionTitle"] = Value(workspaceEvent, "actionTitle", string.Empty),
                    ["ownerRole"] = ownerRole,
                    ["ownerActorId"] = Value(workspaceEvent, "ownerActorId", string.Empty),
                    ["dueAtUtc"] = dueAtUtc,
                    ["priority"] = priority,
                    ["actionPlanCompleted"] = "false",
                    ["sourceEventType"] = workspaceEvent.EventType
                }),
            RequestDecision(
                workspaceEvent,
                CheckoutServiceProcessRuleIds.PeriodActionPlanCommittedEmitsWorkItemCreated,
                "Accommodation.PeriodActionPlanWorkItemCreated",
                "Accommodation.PeriodAnalytics",
                new Dictionary<string, string>
                {
                    ["periodId"] = PeriodId(workspaceEvent),
                    ["actionPlanId"] = actionPlanId,
                    ["workItemId"] = workItemId,
                    ["ownerRole"] = ownerRole,
                    ["dueAtUtc"] = dueAtUtc,
                    ["priority"] = priority,
                    ["sourceEventType"] = workspaceEvent.EventType
                })
        };
    }

    private static IReadOnlyList<ProcessDecision> RoomInspectionDecisions(WorkspaceEvent workspaceEvent)
    {
        var decisions = new List<ProcessDecision>();
        if (DecimalValue(workspaceEvent, "damageAmount", DecimalValue(workspaceEvent, "damageChargeAmount", 0m)) > 0)
        {
            decisions.Add(WorkItemDecision(
                workspaceEvent,
                CheckoutServiceProcessRuleIds.RoomInspectedDamageCreatesDepositSettlementWorkItem,
                "depositSettlement",
                "W-STAY-CHECKOUT-SETTLEMENT",
                Value(workspaceEvent, "depositSettlementWorkItemId", StableWorkItemId(workspaceEvent, "deposit-settlement")),
                "finance",
                new Dictionary<string, string>
                {
                    ["caseId"] = CaseId(workspaceEvent),
                    ["checkoutId"] = CheckoutId(workspaceEvent),
                    ["damageAmount"] = DecimalValue(workspaceEvent, "damageAmount", DecimalValue(workspaceEvent, "damageChargeAmount", 0m)).ToString(System.Globalization.CultureInfo.InvariantCulture),
                    ["writesDepositEntry"] = "false",
                    ["sourceEventType"] = workspaceEvent.EventType
                }));
        }

        if (BoolValue(workspaceEvent, "cleaningRequired", false))
        {
            decisions.Add(WorkItemDecision(
                workspaceEvent,
                CheckoutServiceProcessRuleIds.RoomInspectedCleaningCreatesServiceTaskWorkItem,
                "serviceTaskCreate",
                "W-STAY-SERVICE-TASK",
                Value(workspaceEvent, "cleaningWorkItemId", StableWorkItemId(workspaceEvent, "cleaning")),
                "operator",
                new Dictionary<string, string>
                {
                    ["caseId"] = CaseId(workspaceEvent),
                    ["checkoutId"] = CheckoutId(workspaceEvent),
                    ["taskType"] = "cleaning",
                    ["roomId"] = Value(workspaceEvent, "roomId", string.Empty),
                    ["bedId"] = Value(workspaceEvent, "bedId", string.Empty),
                    ["sourceEventType"] = workspaceEvent.EventType
                }));
        }

        var outstandingBalance = DecimalValue(workspaceEvent, "outstandingBalance",
            DecimalValue(workspaceEvent, "currentBalance", DecimalValue(workspaceEvent, "endingDebtAmount", 0m)));
        if (outstandingBalance > 0)
        {
            decisions.Add(WorkItemDecision(
                workspaceEvent,
                CheckoutServiceProcessRuleIds.RoomInspectedBalanceCreatesBalanceCloseWorkItem,
                "finalBalanceClose",
                "W-STAY-CHECKOUT-SETTLEMENT",
                Value(workspaceEvent, "balanceCloseWorkItemId", StableWorkItemId(workspaceEvent, "balance-close")),
                "finance",
                new Dictionary<string, string>
                {
                    ["caseId"] = CaseId(workspaceEvent),
                    ["checkoutId"] = CheckoutId(workspaceEvent),
                    ["outstandingBalance"] = outstandingBalance.ToString(System.Globalization.CultureInfo.InvariantCulture),
                    ["sourceEventType"] = workspaceEvent.EventType
                }));
        }

        return decisions;
    }

    private static IReadOnlyList<ProcessDecision> ClosureFailureDecisions(WorkspaceEvent workspaceEvent)
    {
        var blockerCode = Value(workspaceEvent, "blockerCode", "CASE_CLOSURE_BLOCKED");
        var resolveAction = Value(workspaceEvent, "resolveAction", "createResolutionWorkItem");
        var run = Run(workspaceEvent, CheckoutServiceProcessRuleIds.CaseClosurePolicyFailedCreatesBlockers);
        return new[]
        {
            new ProcessDecision(
                run,
                new[]
                {
                    new ProcessWorkItemIntentRecord(
                        IntentId(run.ProcessRunId, "work-item"),
                        run.ProcessRunId,
                        run.TenantId,
                        Value(workspaceEvent, "resolutionWorkItemId", StableWorkItemId(workspaceEvent, "blocker-resolution")),
                        Value(workspaceEvent, "resolutionWorkItemType", "blockerResolution"),
                        Value(workspaceEvent, "resolutionWorkspaceId", "W-STAY-CHECKOUT-SETTLEMENT"),
                        Value(workspaceEvent, "ownerRole", "operator"),
                        workspaceEvent.EventId,
                        "requested",
                        run.CreatedAtUtc,
                        new Dictionary<string, string>
                        {
                            ["caseId"] = CaseId(workspaceEvent),
                            ["blockerCode"] = blockerCode,
                            ["resolveAction"] = resolveAction,
                            ["sourceEventType"] = workspaceEvent.EventType
                        })
                },
                new[]
                {
                    new ProcessRequestEventIntentRecord(
                        IntentId(run.ProcessRunId, "request"),
                        run.ProcessRunId,
                        run.TenantId,
                        "Accommodation.CaseBlockerCreated",
                        "Accommodation.BlockerEngine",
                        workspaceEvent.EventId,
                        "requested",
                        run.CreatedAtUtc,
                        new Dictionary<string, string>
                        {
                            ["caseId"] = CaseId(workspaceEvent),
                            ["blockerCode"] = blockerCode,
                            ["resolveAction"] = resolveAction,
                            ["sourceEventType"] = workspaceEvent.EventType
                        })
                })
        };
    }

    private static ProcessDecision WorkItemDecision(
        WorkspaceEvent workspaceEvent,
        string processRuleId,
        string workItemType,
        string targetWorkspaceId,
        string workItemId,
        string ownerRole,
        IReadOnlyDictionary<string, string> payload)
    {
        var run = Run(workspaceEvent, processRuleId);
        return new ProcessDecision(
            run,
            new[]
            {
                new ProcessWorkItemIntentRecord(
                    IntentId(run.ProcessRunId, "work-item"),
                    run.ProcessRunId,
                    run.TenantId,
                    workItemId,
                    workItemType,
                    targetWorkspaceId,
                    ownerRole,
                    workspaceEvent.EventId,
                    "requested",
                    run.CreatedAtUtc,
                    payload)
            },
            Array.Empty<ProcessRequestEventIntentRecord>());
    }

    private static ProcessDecision RequestDecision(
        WorkspaceEvent workspaceEvent,
        string processRuleId,
        string requestEventType,
        string targetSliceId,
        IReadOnlyDictionary<string, string> payload)
    {
        var run = Run(workspaceEvent, processRuleId);
        return new ProcessDecision(
            run,
            Array.Empty<ProcessWorkItemIntentRecord>(),
            new[]
            {
                new ProcessRequestEventIntentRecord(
                    IntentId(run.ProcessRunId, "request"),
                    run.ProcessRunId,
                    run.TenantId,
                    requestEventType,
                    targetSliceId,
                    workspaceEvent.EventId,
                    "requested",
                    run.CreatedAtUtc,
                    payload)
            });
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

    private static decimal DecimalValue(WorkspaceEvent workspaceEvent, string key, decimal defaultValue) =>
        RuntimeFieldAliases.DecimalValue(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static bool BoolValue(WorkspaceEvent workspaceEvent, string key, bool defaultValue) =>
        RuntimeFieldAliases.BoolValue(workspaceEvent.Payload, RuntimeFieldAliases.CanonicalKey(key), defaultValue);

    private static string CheckoutId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "checkoutId", $"checkout-{workspaceEvent.WorkspaceId}".ToLowerInvariant());

    private static string CaseId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "caseId", CheckoutId(workspaceEvent));

    private static string PeriodId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "periodId", $"period-{workspaceEvent.WorkspaceId}".ToLowerInvariant());

    private static string ActionPlanId(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "actionPlanId", StableWorkItemId(workspaceEvent, "action-plan"));

    private static string OwnerRole(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "ownerRole", Value(workspaceEvent, "ownerName", "manager"));

    private static string DueAtUtc(WorkspaceEvent workspaceEvent) =>
        Value(workspaceEvent, "dueAtUtc",
            Value(workspaceEvent, "dueAt", workspaceEvent.OccurredAtUtc.AddDays(7).ToString("O", System.Globalization.CultureInfo.InvariantCulture)));

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

    private sealed record ProcessDecision(
        ProcessRunRecord ProcessRun,
        IReadOnlyList<ProcessWorkItemIntentRecord> WorkItemIntents,
        IReadOnlyList<ProcessRequestEventIntentRecord> RequestEventIntents);
}
