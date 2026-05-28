namespace WorkOS.Api.Runtime;

internal static class BlockerContractCatalog
{
    public static IReadOnlyList<BlockerRule> ForCard(string cardId, string status)
    {
        if (status != "blocked")
        {
            return Array.Empty<BlockerRule>();
        }

        var labels = cardId switch
        {
            "deposit" => new[] { "押金金额不匹配", "付款人不一致", "凭证不清晰" },
            "finance" => new[] { "未到账", "确认金额不一致", "财务权限不足" },
            "checkin" => new[] { "押金未通过", "床位已释放", "入住确认缺失" },
            _ => new[] { "当前卡存在阻断" }
        };

        return labels.Select(label => new BlockerRule(
            ContractText.FieldId(label),
            ContractText.Text(label, label),
            ConfirmationPolicyCatalog.OwnerRoleForCard(cardId),
            ContractText.Text("补齐材料或人工确认后继续", "Дополните данные или подтвердите вручную"))).ToArray();
    }
}
