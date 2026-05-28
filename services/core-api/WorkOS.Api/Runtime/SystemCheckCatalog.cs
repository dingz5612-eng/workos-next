namespace WorkOS.Api.Runtime;

internal static class SystemCheckCatalog
{
    public static IReadOnlyList<SystemCheck> ForCard(string cardId) =>
        Labels(cardId).Select(label => new SystemCheck(ContractText.FieldId(label), ContractText.Text(label, label), "blocking", "pending")).ToArray();

    private static string[] Labels(string cardId) => cardId switch
    {
        "application" => new[] { "申请已审批", "入住人未重复入住" },
        "stayOrder" => new[] { "床位可用", "入住周期无冲突", "押金/费用规则可用" },
        "deposit" => new[] { "金额匹配", "币种匹配", "付款人匹配", "凭证清晰" },
        "finance" => new[] { "到账状态有效", "确认金额一致", "财务角色可确认" },
        "checkin" => new[] { "押金已通过", "床位仍锁定", "人工确认完整" },
        "room" => new[] { "房间号未重复", "容量有效" },
        "bed" => new[] { "房间存在", "未超过容量", "床位号未重复" },
        "activate" => new[] { "检查已通过", "床位未锁定" },
        _ => new[] { "字段完整", "证据完整", "权限满足" }
    };
}
