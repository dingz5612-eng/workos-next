namespace WorkOS.Api.Slices.Accommodation.CheckIn.Aggregates;

public sealed record DepositAggregate(
    string DepositId,
    string WorkspaceId,
    string StayOrderId,
    decimal Amount,
    string Currency,
    string PaymentMethod,
    string EvidenceId,
    string Status,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);

public sealed record FinanceConfirmationAggregate(
    string FinanceConfirmationId,
    string WorkspaceId,
    string DepositId,
    decimal ConfirmedAmount,
    string Currency,
    string Status,
    string ConfirmedBy,
    string CreatedEventId,
    DateTimeOffset UpdatedAtUtc);
