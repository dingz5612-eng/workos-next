namespace WorkOS.Api.Slices.Accommodation.CheckIn.Commands;

public sealed record ApproveApplicationCommand(string WorkspaceId, string CardId, string ResidentId);
public sealed record PrepareStayOrderCommand(string WorkspaceId, string CardId, string ApplicationId, string BedId);
public sealed record SubmitDepositEvidenceCommand(string WorkspaceId, string CardId, decimal Amount, string Currency, string EvidenceId);
public sealed record ConfirmFinanceDepositCommand(string WorkspaceId, string CardId, string FinanceReviewId);
public sealed record ConfirmCheckInCommand(string WorkspaceId, string CardId, DateTimeOffset CheckedInAtUtc);
