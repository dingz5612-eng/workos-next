using WorkOS.Api.Slices.Accommodation.CheckIn.Events;
using WorkOS.Api.Slices.Accommodation.ResourceSetup.Events;

namespace WorkOS.Api.Runtime;

internal static class EventContractCatalog
{
    public static IReadOnlyList<EventDefinition> ForCard(string cardId) =>
        Types(cardId).Select(eventType => new EventDefinition(eventType, true, ProjectionTargets())).ToArray();

    private static string[] Types(string cardId) => cardId switch
    {
        "roomSetup" => new[] { ResourceSetupEvents.RoomConfigured },
        "bedSetup" => new[] { ResourceSetupEvents.BedConfigured },
        "rateSetup" => new[] { ResourceSetupEvents.RateConfigured },
        "roomReadiness" => new[] { ResourceSetupEvents.RoomReadinessChanged },
        "roomBlock" => new[] { ResourceSetupEvents.RoomBlocked, ResourceSetupEvents.BedBlocked },
        "roomRelease" => new[] { ResourceSetupEvents.RoomReleased, ResourceSetupEvents.BedReleased },
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
        "leadCapture" => new[] { "Accommodation.LeadCaptured" },
        "leadFollowUp" => new[] { "Accommodation.LeadStatusChanged" },
        "reservationCreate" => new[] { "Accommodation.ReservationCreated" },
        "reservationCancel" => new[] { "Accommodation.ReservationCancelled", "Accommodation.ReservationExpired" },
        "reservationConvert" => new[] { "Accommodation.ReservationConvertedToStay" },
        "residentProfile" => new[] { "Accommodation.ResidentProfileCaptured" },
        "checkInBedAssign" => new[] { "Accommodation.ResidentCheckedIn", "Accommodation.BedAssigned" },
        "chargeAssessment" => new[] { "Accommodation.StayChargeAssessed" },
        "stayExtension" => new[] { "Accommodation.StayExtended", "Accommodation.StayRateChanged" },
        "depositAssessment" => new[] { "Accommodation.DepositAssessed" },
        "depositReceipt" => new[] { "Accommodation.DepositReceived", "Accommodation.DepositEvidenceSubmitted" },
        "depositConfirmation" => new[] { "Accommodation.DepositConfirmed", "Accommodation.DepositRejected" },
        "depositDeduction" => new[] { "Accommodation.DepositDeducted", "Accommodation.DepositAppliedToBalance" },
        "depositRefundApproval" => new[] { "Accommodation.DepositRefundApproved" },
        "depositRefundPayment" => new[] { "Accommodation.DepositRefundPaid" },
        "depositClose" => new[] { "Accommodation.DepositClosed" },
        "paymentReceipt" => new[] { "Accommodation.PaymentReceived", "Accommodation.PaymentEvidenceSubmitted" },
        "paymentConfirmation" => new[] { "Accommodation.PaymentConfirmed", "Accommodation.PaymentRejected" },
        "paymentAllocation" => new[] { "Accommodation.PaymentAllocated", "Accommodation.BalanceRecalculated" },
        "paymentAdjustment" => new[] { "Accommodation.PaymentAdjusted", "Accommodation.BalanceRecalculated" },
        "debtFollowUp" => new[] { "Accommodation.DebtFollowUpRecorded" },
        "checkoutStart" => new[] { "Accommodation.ResidentCheckedOut" },
        "roomInspection" => new[] { "Accommodation.RoomInspected", "Accommodation.CheckoutIssueRaised" },
        "depositSettlement" => new[] { "Accommodation.DepositSettlementRequested" },
        "finalBalanceClose" => new[] { "Accommodation.FinalBalanceClosed" },
        "bedRelease" => new[] { "Accommodation.BedReleased" },
        "postCheckoutCleaning" => new[] { "Accommodation.PostCheckoutCleaningRequested" },
        "serviceTaskCreate" => new[] { "Accommodation.ServiceTaskCreated", "Accommodation.RoomBlockedForService", "Accommodation.BedBlockedForService" },
        "serviceTaskAssign" => new[] { "Accommodation.ServiceTaskAssigned" },
        "serviceTaskComplete" => new[] { "Accommodation.ServiceTaskCompleted" },
        "serviceTaskVerify" => new[] { "Accommodation.ServiceTaskVerified" },
        "roomReleaseAfterService" => new[] { "Accommodation.RoomReleaseAfterServiceRequested", "Accommodation.BedReleaseAfterServiceRequested" },
        "expenseRecord" => new[] { "Accommodation.ExpenseRecorded", "Accommodation.ExpenseEvidenceSubmitted" },
        "expenseApproval" => new[] { "Accommodation.ExpenseApproved", "Accommodation.ExpenseRejected" },
        "expenseLink" => new[] { "Accommodation.ExpenseLinkedToRoom", "Accommodation.ExpenseLinkedToServiceTask" },
        "periodScope" => new[] { "Accommodation.PeriodScopeConfirmed" },
        "periodMetricsReview" => new[] { "Accommodation.PeriodMetricsReviewed" },
        "periodFinanceReview" => new[] { "Accommodation.PeriodFinanceReviewed" },
        "periodOperationsDiagnosis" => new[] { "Accommodation.PeriodOperationsDiagnosed" },
        "periodActionPlan" => new[] { "Accommodation.PeriodActionPlanCommitted", "Accommodation.PeriodActionPlanCompleted" },
        "periodClose" => new[] { "Accommodation.PeriodReviewClosed" },
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
