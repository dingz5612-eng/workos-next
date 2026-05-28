namespace WorkOS.Api.Slices.Accommodation.CheckIn.Events;

public static class CheckInEvents
{
    public const string LeadCaptured = "LeadCaptured";
    public const string BookingConfirmed = "BookingConfirmed";
    public const string ResidentRegistered = "ResidentRegistered";
    public const string BedAssigned = "BedAssigned";
    public const string TariffAssigned = "TariffAssigned";
    public const string DepositRequired = "DepositRequired";
    public const string PaymentRecordedByFrontDesk = "PaymentRecordedByFrontDesk";
    public const string PaymentConfirmedByFinance = "PaymentConfirmedByFinance";
    public const string StayCheckedIn = "StayCheckedIn";
    public const string OperatingMetricsReviewed = "OperatingMetricsReviewed";
}
