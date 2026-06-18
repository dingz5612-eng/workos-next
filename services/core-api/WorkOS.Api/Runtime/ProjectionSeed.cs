namespace WorkOS.Api.Runtime;

public static class ProjectionSeed
{
    public static RuntimeState Create() => new(Workspaces(), new List<WorkspaceEvent>(), Users());

    private static List<RuntimeUser> Users() => new()
    {
        DevUser("u-operator", "operator", "住宿经办人", "operator"),
        DevUser("u-dorm-operator", "dormOperator", "住宿试点经办人", "operator", "tenant-dorm-int-001"),
        DevUser("u-dorm-frontdesk", "dormFrontdesk", "住宿试点前台", "frontdesk", "tenant-dorm-int-001"),
        DevUser("u-dorm-finance", "dormFinance", "住宿试点财务", "finance", "tenant-dorm-int-001"),
        DevUser("u-dorm-housekeeping", "dormHousekeeping", "住宿试点客房", "housekeeping", "tenant-dorm-int-001"),
        DevUser("u-dorm-manager", "dormManager", "住宿试点主管", "manager", "tenant-dorm-int-001"),
        DevUser("u-dorm-release-owner", "dormReleaseOwner", "住宿试点发布负责人", "releaseOwner", "tenant-dorm-int-001"),
        DevUser("u-finance", "finance", "财务确认人", "finance"),
        DevUser("u-manager", "manager", "业务主管", "manager"),
        DevUser("u-admin", "admin", "治理管理员", "admin"),
        DevUser("u-release-owner", "releaseOwner", "发布负责人", "releaseOwner"),
        DevUser("ai-agent", "ai", "AI 助手", "ai")
    };

    private static RuntimeUser DevUser(
        string userId,
        string username,
        string displayName,
        string role,
        string tenantId = RuntimeActorAuthorization.DefaultTenantId) =>
        new(
            userId,
            username,
            displayName,
            role,
            true,
            tenantId,
            DepartmentFor(role),
            BusinessLineFor(role),
            new[] { role },
            RuntimeActorAuthorization.CapabilitiesForRole(role),
            "active",
            DevelopmentOnly: true);

    private static string DepartmentFor(string role) =>
        role.ToLowerInvariant() switch
        {
            "finance" => "财务部",
            "manager" => "运营管理部",
            "admin" => "治理办公室",
            "releaseowner" => "发布治理组",
            _ => "住宿运营部"
        };

    private static string BusinessLineFor(string role) =>
        role.Equals("finance", StringComparison.OrdinalIgnoreCase) ? "finance" : "stay";

    private static List<WorkspaceProjection> Workspaces() => new[]
        {
            AcceptedCapabilityRuntimeProjection.Workspace(),
            DormitoryScenario2RuntimeProjection.Workspace()
        }
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
