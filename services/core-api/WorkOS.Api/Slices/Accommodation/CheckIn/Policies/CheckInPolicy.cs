namespace WorkOS.Api.Slices.Accommodation.CheckIn.Policies;

public static class CheckInPolicy
{
    public const string OperatorRole = "operator";
    public const string FinanceRole = "finance";
    public const string AggregateGate = "Application, StayOrder, Deposit, FinanceConfirmation, and CheckInRecord must become persisted aggregate roots before this slice is production-grade.";
}
