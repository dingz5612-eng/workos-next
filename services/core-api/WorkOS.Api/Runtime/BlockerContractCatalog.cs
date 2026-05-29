namespace WorkOS.Api.Runtime;

internal static class BlockerContractCatalog
{
    public static IReadOnlyList<BlockerRule> ForCard(string cardId, string status)
    {
        var labels = cardId switch
        {
            "deposit" or "depositReceipt" => new[] { "cannot_confirm_non_cash_deposit_without_evidence" },
            "depositConfirmation" => new[] { "cannot_confirm_payment_without_actor_token", "cannot_confirm_non_cash_deposit_without_evidence" },
            "depositRefundApproval" or "depositRefundPayment" or "depositDeduction" or "depositSettlement" => new[] { "cannot_refund_more_than_held_deposit" },
            "payment" or "paymentReceipt" => new[] { "cannot_confirm_non_cash_payment_without_evidence" },
            "finance" or "paymentConfirmation" => new[] { "cannot_confirm_payment_without_actor_token", "cannot_confirm_non_cash_payment_without_evidence" },
            "paymentAllocation" => new[] { "cannot_allocate_payment_more_than_confirmed_amount" },
            "checkin" or "checkInBedAssign" => new[] { "cannot_confirm_checkin_if_bed_not_available", "cannot_confirm_checkin_if_room_not_ready" },
            "bedRelease" => new[] { "cannot_release_bed_before_checkout_started" },
            "finalBalanceClose" => new[] { "cannot_close_checkout_with_unsettled_deposit" },
            "periodFinanceReview" => new[] { "cannot_count_deposit_received_as_revenue", "cannot_count_deposit_refund_as_expense" },
            "periodClose" => new[] { "cannot_close_period_without_metrics_review", "cannot_close_period_without_finance_review", "cannot_close_period_with_blocking_finance_exceptions", "cannot_close_period_without_action_plan_when_high_risk" },
            "serviceTaskCreate" or "roomReleaseAfterService" => new[] { "ServiceAvailabilityCheck" },
            _ => new[] { "当前卡存在阻断" }
        };

        return labels.Select(label => new BlockerRule(
            label.StartsWith("cannot_", StringComparison.OrdinalIgnoreCase) || label.EndsWith("Check", StringComparison.OrdinalIgnoreCase)
                ? label
                : ContractText.FieldId(label),
            ContractText.Text(label, label),
            ConfirmationPolicyCatalog.OwnerRoleForCard(cardId),
            ContractText.Text("补齐材料或人工确认后继续", "Дополните данные или подтвердите вручную"))).ToArray();
    }
}
