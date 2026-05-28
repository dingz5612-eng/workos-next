namespace WorkOS.Api.Runtime;

internal static class EvidenceContractCatalog
{
    public static IReadOnlyList<EvidenceRequirement> ForCard(string cardId) =>
        Labels(cardId).Select(label => new EvidenceRequirement(
            ContractText.FieldId(label),
            ContractText.Text(label, ContractText.TermRu(label)),
            true,
            label.Contains("照片") || label.Contains("截图") || label.Contains("凭证") ? "upload" : "record",
            ContractText.FieldId(label),
            ContractText.Text("提交前需要核对这项证据，确认后会进入审计事件。", "Проверьте это доказательство перед отправкой; после подтверждения оно попадет в аудит."))).ToArray();

    private static string[] Labels(string cardId) => cardId switch
    {
        "application" => new[] { "已审批申请", "审批意见" },
        "stayOrder" => new[] { "已审批申请", "房间床位" },
        "deposit" => new[] { "付款截图", "收据编号", "付款人", "付款时间" },
        "finance" => new[] { "到账记录", "金额核对", "财务确认记录" },
        "checkin" => new[] { "钥匙/物品交接", "入住人现场确认" },
        "room" => new[] { "房间重复校验", "建档人记录" },
        "bed" => new[] { "容量校验", "床位编号校验" },
        "activate" => new[] { "检查状态", "资源启用确认" },
        _ => new[] { "操作证据", "人工处理记录" }
    };
}
