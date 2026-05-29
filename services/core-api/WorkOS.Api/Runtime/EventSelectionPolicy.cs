namespace WorkOS.Api.Runtime;

internal static class EventSelectionPolicy
{
    private static readonly HashSet<string> ExplicitMultiEventPolicies = new(StringComparer.OrdinalIgnoreCase)
    {
        "roomBlock",
        "roomRelease",
        "reservationCancel",
        "checkInBedAssign",
        "stayExtension",
        "depositReceipt",
        "depositConfirmation",
        "depositDeduction",
        "paymentReceipt",
        "paymentConfirmation",
        "paymentAllocation",
        "paymentAdjustment",
        "roomInspection",
        "serviceTaskCreate",
        "roomReleaseAfterService",
        "expenseRecord",
        "expenseApproval",
        "expenseLink",
        "periodActionPlan"
    };

    public static bool HasExplicitPolicyFor(string cardId) =>
        ExplicitMultiEventPolicies.Contains(cardId);

    public static EventDispatchPlan PlanForConfirm(CardProjection card, ConfirmCardRequest request)
    {
        if (card.Events.Count == 0)
        {
            throw new InvalidOperationException($"Card '{card.Id}' declares no confirm events.");
        }

        var events = SelectEvents(card, request).ToArray();
        if (events.Length == 0)
        {
            throw new InvalidOperationException($"Card '{card.Id}' confirm dispatch selected no events.");
        }

        var mode = events.Length == card.Events.Count
            ? (events.Length == 1 ? "single" : "all")
            : "conditional";
        return new EventDispatchPlan(mode, events);
    }

    private static IEnumerable<EventDefinition> SelectEvents(CardProjection card, ConfirmCardRequest request)
    {
        return card.Id switch
        {
            "roomBlock" => AllEvents(card),
            "roomRelease" => AllEvents(card),
            "reservationCancel" => AllEvents(card),
            "checkInBedAssign" => AllEvents(card),
            "stayExtension" => AllEvents(card),
            "depositConfirmation" => ConfirmationResult(request) == "confirmed"
                ? EventsOf(card, "Accommodation.DepositConfirmed")
                : EventsOf(card, "Accommodation.DepositRejected"),
            "paymentConfirmation" => ConfirmationResult(request) == "confirmed"
                ? EventsOf(card, "Accommodation.PaymentConfirmed")
                : EventsOf(card, "Accommodation.PaymentRejected"),
            "expenseApproval" => ResultValue(request, "approvalResult") == "approved"
                ? EventsOf(card, "Accommodation.ExpenseApproved")
                : EventsOf(card, "Accommodation.ExpenseRejected"),
            "depositReceipt" => WithOptionalEvidence(card, "Accommodation.DepositReceived", "Accommodation.DepositEvidenceSubmitted", request),
            "paymentReceipt" => WithOptionalEvidence(card, "Accommodation.PaymentReceived", "Accommodation.PaymentEvidenceSubmitted", request),
            "paymentAllocation" => AllEvents(card),
            "paymentAdjustment" => AllEvents(card),
            "roomInspection" => AllEvents(card),
            "expenseRecord" => WithOptionalEvidence(card, "Accommodation.ExpenseRecorded", "Accommodation.ExpenseEvidenceSubmitted", request),
            "expenseLink" => AllEvents(card),
            "serviceTaskCreate" => ServiceTaskCreateEvents(card, request),
            "roomReleaseAfterService" => AllEvents(card),
            "depositDeduction" => DepositSettlementEvents(card, request),
            "periodActionPlan" => PeriodActionPlanEvents(card, request),
            _ when card.Events.Count == 1 => card.Events,
            _ => throw new InvalidOperationException($"Multi-event card '{card.Id}' requires an explicit EventSelectionPolicy.")
        };
    }

    private static IReadOnlyList<EventDefinition> WithOptionalEvidence(CardProjection card, string primary, string evidence, ConfirmCardRequest request)
    {
        var selected = EventsOf(card, primary).ToList();
        if (request.EvidenceIds?.Count > 0)
        {
            selected.AddRange(EventsOf(card, evidence));
        }

        return selected;
    }

    private static IReadOnlyList<EventDefinition> ServiceTaskCreateEvents(CardProjection card, ConfirmCardRequest request)
    {
        var selected = EventsOf(card, "Accommodation.ServiceTaskCreated").ToList();
        if (!RuntimeFieldAliases.BoolValue(request.FieldValues ?? new Dictionary<string, string>(), "blocksAvailability", false))
        {
            return selected;
        }

        selected.AddRange(EventsOf(card, "Accommodation.RoomBlockedForService"));
        if (!string.IsNullOrWhiteSpace(RuntimeFieldAliases.Value(request.FieldValues ?? new Dictionary<string, string>(), "bedId", string.Empty)))
        {
            selected.AddRange(EventsOf(card, "Accommodation.BedBlockedForService"));
        }

        return selected;
    }

    private static IReadOnlyList<EventDefinition> DepositSettlementEvents(CardProjection card, ConfirmCardRequest request)
    {
        var values = request.FieldValues ?? new Dictionary<string, string>();
        var selected = new List<EventDefinition>();
        if (RuntimeFieldAliases.DecimalValue(values, "deductionAmount", 0m) > 0m)
        {
            selected.AddRange(EventsOf(card, "Accommodation.DepositDeducted"));
        }
        if (RuntimeFieldAliases.DecimalValue(values, "applyToBalanceAmount", 0m) > 0m)
        {
            selected.AddRange(EventsOf(card, "Accommodation.DepositAppliedToBalance"));
        }

        return selected.Count > 0 ? selected : card.Events;
    }

    private static IReadOnlyList<EventDefinition> PeriodActionPlanEvents(CardProjection card, ConfirmCardRequest request)
    {
        var selected = EventsOf(card, "Accommodation.PeriodActionPlanCommitted").ToList();
        var status = ResultValue(request, "actionStatus");
        if (status.Equals("completed", StringComparison.OrdinalIgnoreCase) ||
            status.Equals("done", StringComparison.OrdinalIgnoreCase))
        {
            selected.AddRange(EventsOf(card, "Accommodation.PeriodActionPlanCompleted"));
        }

        return selected;
    }

    private static string ConfirmationResult(ConfirmCardRequest request) =>
        ResultValue(request, "confirmationResult") == "confirmed" ? "confirmed" : "rejected";

    private static string ResultValue(ConfirmCardRequest request, string key) =>
        RuntimeFieldAliases.Value(request.FieldValues ?? new Dictionary<string, string>(), key, string.Empty);

    private static IEnumerable<EventDefinition> EventsOf(CardProjection card, string eventType) =>
        card.Events.Where(item => item.EventType.Equals(eventType, StringComparison.OrdinalIgnoreCase));

    private static IReadOnlyList<EventDefinition> AllEvents(CardProjection card) =>
        card.Events;
}

internal sealed record EventDispatchPlan(string DispatchMode, IReadOnlyList<EventDefinition> Events);
