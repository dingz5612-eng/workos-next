namespace WorkOS.Api.Runtime;

public static class CorrectionCenterEvents
{
    public const string LedgerCorrectionRequested = "LedgerCorrectionRequested";
    public const string LedgerCorrectionApproved = "LedgerCorrectionApproved";
    public const string LedgerCorrectionRejected = "LedgerCorrectionRejected";
    public const string LedgerEntryReversed = "LedgerEntryReversed";
    public const string LedgerCorrectionApplied = "LedgerCorrectionApplied";
    public const string PaymentAllocationReversed = "PaymentAllocationReversed";
    public const string PaymentAdjustmentLite = "PaymentAdjustmentLite";
    public const string DepositEntryReversed = "DepositEntryReversed";
    public const string ChargeAdjusted = "ChargeAdjusted";
}

public sealed record LedgerCorrectionRequestCommand(
    string TenantId,
    string WorkItemId,
    string? CaseId,
    string TargetLedgerType,
    string TargetEntryId,
    string TargetObjectType,
    string TargetObjectId,
    string CorrectionType,
    string Reason,
    string RequestedBy,
    string RiskLevel);

public sealed record LedgerCorrectionApproveCommand(
    string TenantId,
    string CorrectionRequestId,
    string ApproverId,
    string? Note = null,
    string? ActorRole = null,
    IReadOnlyList<string>? ActorCapabilities = null,
    string? DeviceId = null,
    string? DeviceTrustStatus = null,
    string Surface = "pc");

public sealed record LedgerCorrectionRejectCommand(
    string TenantId,
    string CorrectionRequestId,
    string ApproverId,
    string Reason);

public sealed record LedgerCorrectionApplyCommand(
    string TenantId,
    string CorrectionRequestId,
    string ActorId,
    string WorkItemId,
    decimal? AdjustmentAmount = null,
    string? Reason = null);

public sealed record LedgerCorrectionRequestResult(
    string CorrectionRequestId,
    string TenantId,
    string Status,
    string RiskLevel,
    string EventId,
    ProcessWorkItemIntentRecord WorkItemIntent);

public sealed record LedgerCorrectionDecisionResult(
    string CorrectionRequestId,
    string TenantId,
    string Status,
    string EventId);

public sealed record LedgerCorrectionApplyResult(
    string CorrectionRequestId,
    string TenantId,
    string Status,
    string TargetLedgerType,
    string TargetEntryId,
    string ReversalId,
    string CorrectionEntryId,
    IReadOnlyList<string> EventIds,
    IReadOnlyList<string> BalanceRebuilds,
    bool LateAdjustmentRecorded);

internal sealed record LedgerCorrectionRequestRow(
    string CorrectionRequestId,
    string TenantId,
    string? CaseId,
    string TargetLedgerType,
    string TargetEntryId,
    string TargetObjectType,
    string TargetObjectId,
    string CorrectionType,
    string Reason,
    string RequestedBy,
    string Status,
    string RiskLevel,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);
