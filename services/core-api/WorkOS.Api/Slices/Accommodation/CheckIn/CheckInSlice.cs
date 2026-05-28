namespace WorkOS.Api.Slices.Accommodation.CheckIn;

public static class CheckInSlice
{
    public const string Id = "Accommodation.CheckIn";
    public const string WorkspaceId = "W-STAY-CHECKIN";

    public static readonly IReadOnlyList<string> Cards = new[] { "application", "stayOrder", "deposit", "finance", "checkin" };
    public static readonly IReadOnlyList<string> Commands = new[] { "ApproveApplication", "PrepareStayOrder", "SubmitDepositEvidence", "ConfirmFinanceDeposit", "ConfirmCheckIn" };
    public static readonly IReadOnlyList<string> Events = new[] { "ApplicationApproved", "StayOrderPrepared", "DepositEvidenceSubmitted", "FinanceDepositConfirmed", "CheckInConfirmed" };
    public static readonly IReadOnlyList<string> ProjectorRules = new[] { "AdvanceCardStatus", "RefreshWorkQueue", "RefreshSearchProjection" };
    public static readonly IReadOnlyList<string> Tests = new[] { "application_to_checkin_event_chain", "finance_role_required_for_finance_card" };
}
