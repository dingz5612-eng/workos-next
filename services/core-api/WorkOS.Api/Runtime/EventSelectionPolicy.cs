namespace WorkOS.Api.Runtime;

internal static class EventSelectionPolicy
{
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
            "expenseRecord" => WithOptionalEvidence(card, "Accommodation.ExpenseRecorded", "Accommodation.ExpenseEvidenceSubmitted", request),
            "serviceTaskCreate" => ServiceTaskCreateEvents(card, request),
            "depositDeduction" => DepositSettlementEvents(card, request),
            _ => card.Events
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

    private static string ConfirmationResult(ConfirmCardRequest request) =>
        ResultValue(request, "confirmationResult") == "confirmed" ? "confirmed" : "rejected";

    private static string ResultValue(ConfirmCardRequest request, string key) =>
        RuntimeFieldAliases.Value(request.FieldValues ?? new Dictionary<string, string>(), key, string.Empty);

    private static IEnumerable<EventDefinition> EventsOf(CardProjection card, string eventType) =>
        card.Events.Where(item => item.EventType.Equals(eventType, StringComparison.OrdinalIgnoreCase));
}

internal sealed record EventDispatchPlan(string DispatchMode, IReadOnlyList<EventDefinition> Events);
