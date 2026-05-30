namespace WorkOS.Api.Runtime;

internal interface IReconciliationMismatchCaseStore
{
    ReconciliationMismatchDetectionResult DetectMismatches(ReconciliationMismatchDetectionRequest request);

    ReconciliationCaseRecord CreateCaseForMismatch(string tenantId, string mismatchId, string actorId);
}

internal sealed class ReconciliationMismatchCaseService
{
    private readonly IReconciliationMismatchCaseStore store;

    public ReconciliationMismatchCaseService(IReconciliationMismatchCaseStore store)
    {
        this.store = store;
    }

    public ReconciliationMismatchDetectionResult DetectMismatches(ReconciliationMismatchDetectionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TenantId))
        {
            throw new InvalidOperationException("reconciliation_tenant_required");
        }

        var windowDays = Math.Clamp(request.WindowDays, 1, 30);
        var paymentThresholdDays = Math.Clamp(request.ConfirmedPaymentThresholdDays, 1, 60);
        var refundThresholdDays = Math.Clamp(request.RefundThresholdDays, 1, 60);
        return store.DetectMismatches(request with
        {
            WindowDays = windowDays,
            ConfirmedPaymentThresholdDays = paymentThresholdDays,
            RefundThresholdDays = refundThresholdDays
        });
    }

    public ReconciliationCaseRecord CreateCaseForMismatch(string tenantId, string mismatchId, string actorId)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            throw new InvalidOperationException("reconciliation_tenant_required");
        }

        if (string.IsNullOrWhiteSpace(mismatchId))
        {
            throw new InvalidOperationException("reconciliation_mismatch_required");
        }

        return store.CreateCaseForMismatch(tenantId, mismatchId, string.IsNullOrWhiteSpace(actorId) ? "runtime" : actorId);
    }
}
