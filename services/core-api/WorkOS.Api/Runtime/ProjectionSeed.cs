namespace WorkOS.Api.Runtime;

public static class ProjectionSeed
{
    public static RuntimeState Create() => new(Workspaces(), new List<WorkspaceEvent>(), Users());

    private static List<RuntimeUser> Users() => new()
    {
        new RuntimeUser("u-operator", "operator", "住宿经办人", "operator", true),
        new RuntimeUser("u-dorm-operator", "dormOperator", "住宿试点经办人", "operator", true, "tenant-dorm-int-001"),
        new RuntimeUser("u-dorm-frontdesk", "dormFrontdesk", "住宿试点前台", "frontdesk", true, "tenant-dorm-int-001"),
        new RuntimeUser("u-dorm-finance", "dormFinance", "住宿试点财务", "finance", true, "tenant-dorm-int-001"),
        new RuntimeUser("u-dorm-housekeeping", "dormHousekeeping", "住宿试点客房", "housekeeping", true, "tenant-dorm-int-001"),
        new RuntimeUser("u-dorm-manager", "dormManager", "住宿试点主管", "manager", true, "tenant-dorm-int-001"),
        new RuntimeUser("u-dorm-release-owner", "dormReleaseOwner", "住宿试点发布负责人", "releaseOwner", true, "tenant-dorm-int-001"),
        new RuntimeUser("u-finance", "finance", "财务确认人", "finance", true),
        new RuntimeUser("u-manager", "manager", "业务主管", "manager", true),
        new RuntimeUser("u-admin", "admin", "治理管理员", "admin", true),
        new RuntimeUser("u-release-owner", "releaseOwner", "发布负责人", "releaseOwner", true),
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
