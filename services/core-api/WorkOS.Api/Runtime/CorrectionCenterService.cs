namespace WorkOS.Api.Runtime;

internal interface ICorrectionCenterStore
{
    LedgerCorrectionRequestResult RequestCorrection(LedgerCorrectionRequestCommand command);

    LedgerCorrectionDecisionResult ApproveCorrection(LedgerCorrectionApproveCommand command);

    LedgerCorrectionDecisionResult RejectCorrection(LedgerCorrectionRejectCommand command);

    LedgerCorrectionApplyResult ApplyCorrection(LedgerCorrectionApplyCommand command);
}

public static class CorrectionCenterProcessRuleIds
{
    public const string CorrectionRequestedCreatesWorkItem = "correction.requested.create_review_work_item";
}

internal sealed class CorrectionCenterService
{
    private static readonly HashSet<string> TargetLedgerTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "payment",
        "deposit",
        "charge",
        "cash",
        "refund"
    };

    private static readonly HashSet<string> CorrectionTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "reversal",
        "amount_adjustment",
        "classification_adjustment",
        "evidence_correction",
        "allocation_reversal",
        "refund_correction",
        "charge_adjustment"
    };

    private static readonly HashSet<string> RiskLevels = new(StringComparer.OrdinalIgnoreCase)
    {
        "low",
        "medium",
        "high",
        "critical"
    };

    private readonly ICorrectionCenterStore store;

    public CorrectionCenterService(ICorrectionCenterStore store)
    {
        this.store = store;
    }

    public LedgerCorrectionRequestResult RequestCorrection(LedgerCorrectionRequestCommand command)
    {
        Require(command.TenantId, "correction_tenant_required");
        Require(command.WorkItemId, "correction_request_requires_work_item");
        Require(command.TargetEntryId, "correction_target_entry_required");
        Require(command.TargetObjectType, "correction_target_object_type_required");
        Require(command.TargetObjectId, "correction_target_object_required");
        Require(command.Reason, "correction_request_requires_reason");
        Require(command.RequestedBy, "correction_requested_by_required");
        RequireAllowed(command.TargetLedgerType, TargetLedgerTypes, "correction_target_ledger_type_invalid");
        RequireAllowed(command.CorrectionType, CorrectionTypes, "correction_type_invalid");
        RequireAllowed(command.RiskLevel, RiskLevels, "correction_risk_level_invalid");

        return store.RequestCorrection(command with
        {
            TargetLedgerType = command.TargetLedgerType.ToLowerInvariant(),
            CorrectionType = command.CorrectionType.ToLowerInvariant(),
            RiskLevel = command.RiskLevel.ToLowerInvariant()
        });
    }

    public LedgerCorrectionDecisionResult ApproveCorrection(LedgerCorrectionApproveCommand command)
    {
        Require(command.TenantId, "correction_tenant_required");
        Require(command.CorrectionRequestId, "correction_request_id_required");
        Require(command.ApproverId, "correction_approver_required");
        RuntimeSecurityPolicy.ValidateHighRiskOperation(
            "correction.approve",
            command.ApproverId,
            command.ActorRole,
            command.ActorCapabilities,
            command.DeviceTrustStatus,
            command.Surface,
            command.Note);
        return store.ApproveCorrection(command);
    }

    public LedgerCorrectionDecisionResult RejectCorrection(LedgerCorrectionRejectCommand command)
    {
        Require(command.TenantId, "correction_tenant_required");
        Require(command.CorrectionRequestId, "correction_request_id_required");
        Require(command.ApproverId, "correction_approver_required");
        Require(command.Reason, "correction_reject_requires_reason");
        return store.RejectCorrection(command);
    }

    public LedgerCorrectionApplyResult ApplyCorrection(LedgerCorrectionApplyCommand command)
    {
        Require(command.TenantId, "correction_tenant_required");
        Require(command.CorrectionRequestId, "correction_request_id_required");
        Require(command.ActorId, "correction_actor_required");
        Require(command.WorkItemId, "correction_apply_requires_work_item");
        return store.ApplyCorrection(command);
    }

    private static void Require(string? value, string error)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(error);
        }
    }

    private static void RequireAllowed(string value, HashSet<string> allowed, string error)
    {
        if (!allowed.Contains(value))
        {
            throw new InvalidOperationException(error);
        }
    }
}

public sealed class LedgerCorrectionRequestCommandHandler
{
    private readonly CorrectionCenterService service;

    internal LedgerCorrectionRequestCommandHandler(CorrectionCenterService service)
    {
        this.service = service;
    }

    public LedgerCorrectionRequestResult Handle(LedgerCorrectionRequestCommand command) =>
        service.RequestCorrection(command);
}

public sealed class LedgerCorrectionApproveCommandHandler
{
    private readonly CorrectionCenterService service;

    internal LedgerCorrectionApproveCommandHandler(CorrectionCenterService service)
    {
        this.service = service;
    }

    public LedgerCorrectionDecisionResult Handle(LedgerCorrectionApproveCommand command) =>
        service.ApproveCorrection(command);
}

public sealed class LedgerCorrectionRejectCommandHandler
{
    private readonly CorrectionCenterService service;

    internal LedgerCorrectionRejectCommandHandler(CorrectionCenterService service)
    {
        this.service = service;
    }

    public LedgerCorrectionDecisionResult Handle(LedgerCorrectionRejectCommand command) =>
        service.RejectCorrection(command);
}

public sealed class LedgerCorrectionApplyCommandHandler
{
    private readonly CorrectionCenterService service;

    internal LedgerCorrectionApplyCommandHandler(CorrectionCenterService service)
    {
        this.service = service;
    }

    public LedgerCorrectionApplyResult Handle(LedgerCorrectionApplyCommand command) =>
        service.ApplyCorrection(command);
}
