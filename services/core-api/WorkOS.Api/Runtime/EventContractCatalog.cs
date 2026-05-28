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
        "lead" => new[] { CheckInEvents.LeadCaptured },
        "booking" => new[] { CheckInEvents.BookingConfirmed },
        "resident" => new[] { CheckInEvents.ResidentRegistered },
        "bedAssign" => new[] { CheckInEvents.BedAssigned },
        "tariff" => new[] { CheckInEvents.TariffAssigned },
        "depositRequirement" => new[] { CheckInEvents.DepositRequired },
        "payment" => new[] { CheckInEvents.PaymentRecordedByFrontDesk },
        "finance" => new[] { CheckInEvents.PaymentConfirmedByFinance },
        "checkin" => new[] { CheckInEvents.StayCheckedIn },
        "operatingDashboard" => new[] { CheckInEvents.OperatingMetricsReviewed },
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
        "AuditEvidenceProjection",
        "GuestFolioProjection",
        "DepositLiabilityProjection",
        "PaymentReconciliationProjection",
        "HostelOperatingDashboardProjection",
        "DecisionQueueProjection"
    };
}
