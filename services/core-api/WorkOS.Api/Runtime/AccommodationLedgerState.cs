namespace WorkOS.Api.Runtime;

public sealed record DepositLedgerState(
    string DepositId,
    decimal HeldAmount,
    decimal DeductedAmount,
    decimal AppliedToBalanceAmount,
    decimal RefundApprovedAmount,
    decimal RefundPaidAmount)
{
    public decimal AvailableForSettlement =>
        Math.Max(HeldAmount - DeductedAmount - AppliedToBalanceAmount - RefundApprovedAmount - RefundPaidAmount, 0m);
}

public sealed record PaymentLedgerState(
    string PaymentId,
    decimal ConfirmedAmount,
    decimal AllocatedAmount)
{
    public decimal AvailableForAllocation =>
        Math.Max(ConfirmedAmount - AllocatedAmount, 0m);
}

