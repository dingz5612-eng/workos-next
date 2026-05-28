namespace WorkOS.Api.Runtime;

public static class ProjectionSeed
{
    public static RuntimeState Create() => new(Workspaces(), new List<WorkspaceEvent>(), Users());

    private static List<RuntimeUser> Users() => new()
    {
        new RuntimeUser("u-operator", "operator", "住宿经办人", "operator", true),
        new RuntimeUser("u-finance", "finance", "财务确认人", "finance", true),
        new RuntimeUser("u-manager", "manager", "业务主管", "manager", true),
        new RuntimeUser("ai-agent", "ai", "AI 助手", "ai", true)
    };

    private static List<WorkspaceProjection> Workspaces() => WorkspaceSeedCatalog.All()
        .Select(Workspace)
        .ToList();

    private static WorkspaceProjection Workspace(WorkspaceSeed seed)
    {
        var cards = seed.Cards.Select(CardContractFactory.Create).ToArray();
        return new WorkspaceProjection(
            "IntentWorkspaceProjection",
            seed.Id,
            seed.Domain,
            seed.TaskId,
            ContractText.Text(seed.ZhTitle, seed.RuTitle),
            ContractText.Text(seed.ZhSummary, seed.RuSummary),
            cards,
            ContractText.Text(seed.ZhNext, seed.RuNext),
            cards.SelectMany(card => card.BlockerRules).ToArray());
    }
}
