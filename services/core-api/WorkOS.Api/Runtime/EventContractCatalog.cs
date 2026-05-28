namespace WorkOS.Api.Runtime;

internal static class EventContractCatalog
{
    public static IReadOnlyList<EventDefinition> ForCard(string cardId) =>
        Types(cardId).Select(eventType => new EventDefinition(eventType, true, ProjectionTargets())).ToArray();

    private static string[] Types(string cardId) => cardId switch
    {
        "room" => new[] { "RoomCreated" },
        "bed" => new[] { "BedCreated" },
        "activate" => new[] { "BedActivated" },
        "application" => new[] { "ApplicationApproved" },
        "stayOrder" => new[] { "StayOrderPrepared", "BedSelected" },
        "deposit" => new[] { "DepositEvidenceSubmitted", "DepositBlocked" },
        "finance" => new[] { "FinanceDepositConfirmed" },
        "checkin" => new[] { "CheckInConfirmed" },
        _ => new[] { $"{char.ToUpperInvariant(cardId[0])}{cardId[1..]}Confirmed" }
    };

    private static IReadOnlyList<string> ProjectionTargets() => new[]
    {
        "IntentWorkspaceProjection",
        "WorkspaceCardProjection",
        "WorkQueueProjection",
        "SearchProjection",
        "ScenarioCoachProjection",
        "AiContextProjection",
        "AuditEvidenceProjection"
    };
}
