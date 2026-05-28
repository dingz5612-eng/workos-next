using WorkOS.Api.Slices.Accommodation.CheckIn.Events;
using WorkOS.Api.Slices.Accommodation.ResourceSetup.Events;

namespace WorkOS.Api.Runtime;

internal static class EventContractCatalog
{
    public static IReadOnlyList<EventDefinition> ForCard(string cardId) =>
        Types(cardId).Select(eventType => new EventDefinition(eventType, true, ProjectionTargets())).ToArray();

    private static string[] Types(string cardId) => cardId switch
    {
        "room" => new[] { ResourceSetupEvents.RoomCreated },
        "bed" => new[] { ResourceSetupEvents.BedCreated },
        "activate" => new[] { ResourceSetupEvents.BedActivated },
        "application" => new[] { CheckInEvents.ApplicationApproved },
        "stayOrder" => new[] { CheckInEvents.StayOrderPrepared, CheckInEvents.BedSelected },
        "deposit" => new[] { CheckInEvents.DepositEvidenceSubmitted, CheckInEvents.DepositBlocked },
        "finance" => new[] { CheckInEvents.FinanceDepositConfirmed },
        "checkin" => new[] { CheckInEvents.CheckInConfirmed },
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
