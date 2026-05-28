namespace WorkOS.Api.Slices.Accommodation.CheckIn;

public static class CheckInSlice
{
    public const string Id = "Accommodation.CheckIn";
    public const string WorkspaceId = "W-STAY-CHECKIN";

    public static readonly IReadOnlyList<string> Cards = new[] { "lead", "booking", "resident", "bedAssign", "tariff", "depositRequirement", "payment", "finance", "checkin", "operatingDashboard" };
    public static readonly IReadOnlyList<string> Commands = new[] { "CaptureLead", "ConfirmBooking", "RegisterResident", "AssignBed", "AssignTariff", "RequireDeposit", "RecordPayment", "ConfirmPaymentByFinance", "ConfirmStayCheckIn", "ReviewOperatingMetrics" };
    public static readonly IReadOnlyList<string> Events = new[] { "LeadCaptured", "BookingConfirmed", "ResidentRegistered", "BedAssigned", "TariffAssigned", "DepositRequired", "PaymentRecordedByFrontDesk", "PaymentConfirmedByFinance", "StayCheckedIn", "OperatingMetricsReviewed" };
    public static readonly IReadOnlyList<string> ProjectorRules = new[] { "AdvanceCardStatus", "RefreshWorkQueue", "RefreshSearchProjection", "RefreshGuestFolio", "RefreshDepositLiability", "RefreshOperatingMetrics" };
    public static readonly IReadOnlyList<string> Tests = new[] { "lead_to_operating_dashboard_event_chain", "finance_role_required_for_finance_card", "folio_deposit_payment_metrics_are_persisted" };
}
