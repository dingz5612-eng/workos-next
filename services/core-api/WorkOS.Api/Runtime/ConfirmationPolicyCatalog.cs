namespace WorkOS.Api.Runtime;

internal static class ConfirmationPolicyCatalog
{
    public static ConfirmationPolicy ForCard(string cardId, string status)
    {
        var critical = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "finance", "checkin", "checkoutFinance", "checkoutClose", "review", "returnBusiness",
            "dispatch", "diagnosis", "inspection", "feeMaterial", "customerConfirm", "close",
            "depositRequirement", "payment", "operatingDashboard", "depositConfirmation",
            "depositRefundApproval", "depositRefundPayment", "depositClose", "paymentConfirmation", "paymentAllocation",
            "paymentAdjustment", "expenseApproval", "periodFinanceReview", "periodClose",
            "finalBalanceClose", "bedRelease"
        };
        return new ConfirmationPolicy(
            status != "done" && critical.Contains(cardId),
            true,
            RequiredRole(cardId),
            status == "done"
                ? ContractText.Text("已确认", "Подтверждено")
                : ContractText.Text("关键动作由人工确认", "Ключевое действие подтверждает человек"));
    }

    public static string OwnerRoleForCard(string cardId)
    {
        if (ContractText.ContainsAny(cardId,
            "finance",
            "checkoutFinance",
            "feeMaterial",
            "depositConfirmation",
            "depositDeduction",
            "depositRefundPayment",
            "depositClose",
            "paymentConfirmation",
            "paymentAllocation",
            "paymentAdjustment",
            "debtFollowUp",
            "expenseApproval",
            "periodFinanceReview")) return "finance";
        if (ContractText.ContainsAny(cardId,
            "depositRefundApproval",
            "serviceTaskVerify",
            "periodScope",
            "periodMetricsReview",
            "periodOperationsDiagnosis",
            "periodActionPlan",
            "periodActionPlanComplete",
            "periodClose",
            "operatingDashboard")) return "manager";
        if (ContractText.ContainsAny(cardId, "repairBlocker", "repairDispatch", "repairExecution")) return "repair";
        return "operator";
    }

    private static string RequiredRole(string cardId)
    {
        return OwnerRoleForCard(cardId);
    }
}
