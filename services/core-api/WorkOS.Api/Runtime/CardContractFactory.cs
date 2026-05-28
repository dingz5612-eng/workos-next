namespace WorkOS.Api.Runtime;

internal static class CardContractFactory
{
    public static CardProjection Create(CardSeed seed) => new(
        "WorkspaceCardProjection",
        seed.Id,
        seed.Status,
        ContractText.Text(seed.ZhTitle, seed.RuTitle),
        new FieldSet(
            seed.System.Select(label => FieldContractCatalog.Field(label, "system")).ToArray(),
            seed.Business.Select(label => FieldContractCatalog.Field(label, "business")).ToArray(),
            seed.Analytics.Select(label => FieldContractCatalog.Field(label, "analytics")).ToArray()),
        EvidenceContractCatalog.ForCard(seed.Id),
        SystemCheckCatalog.ForCard(seed.Id),
        BlockerContractCatalog.ForCard(seed.Id, seed.Status),
        EventContractCatalog.ForCard(seed.Id),
        new TransitionDefinition($"{seed.Id}.prepared", $"{seed.Id}.confirmed", $"{seed.Id}.blocked"),
        ConfirmationPolicyCatalog.ForCard(seed.Id, seed.Status));
}
