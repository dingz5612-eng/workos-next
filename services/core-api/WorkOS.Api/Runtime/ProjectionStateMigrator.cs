namespace WorkOS.Api.Runtime;

internal static class ProjectionStateMigrator
{
    public const string Name = "ProjectionStateMigrator.v1.merge-seed-contracts";

    public static RuntimeState Migrate(RuntimeState persisted, RuntimeState currentContractState)
    {
        var workspaces = MergeWorkspaces(persisted.Workspaces, currentContractState.Workspaces);
        var users = MergeUsers(persisted.Users, currentContractState.Users);
        return RuntimeStateMigrator.Migrate(new RuntimeState(workspaces, persisted.Events.ToList(), users, persisted.SchemaVersion));
    }

    private static List<WorkspaceProjection> MergeWorkspaces(
        IReadOnlyList<WorkspaceProjection> persisted,
        IReadOnlyList<WorkspaceProjection> current)
    {
        var persistedById = persisted.ToDictionary(item => item.Id, StringComparer.OrdinalIgnoreCase);
        var merged = current.Select(seed =>
            persistedById.TryGetValue(seed.Id, out var existing)
                ? MergeWorkspace(existing, seed)
                : seed).ToList();

        var currentIds = new HashSet<string>(current.Select(item => item.Id), StringComparer.OrdinalIgnoreCase);
        merged.AddRange(persisted.Where(item => !currentIds.Contains(item.Id)));
        return merged;
    }

    private static WorkspaceProjection MergeWorkspace(WorkspaceProjection existing, WorkspaceProjection seed)
    {
        var statusByCardId = existing.Cards.ToDictionary(item => item.Id, item => item.Status, StringComparer.OrdinalIgnoreCase);
        var cards = seed.Cards
            .Select(card => statusByCardId.TryGetValue(card.Id, out var status) ? card with { Status = status } : card)
            .ToList();

        return seed with { Cards = cards };
    }

    private static List<RuntimeUser> MergeUsers(
        IReadOnlyList<RuntimeUser> persisted,
        IReadOnlyList<RuntimeUser> current)
    {
        var users = current.ToList();
        var userIds = new HashSet<string>(users.Select(item => item.UserId), StringComparer.OrdinalIgnoreCase);
        users.AddRange(persisted.Where(item => !userIds.Contains(item.UserId)));
        return users;
    }
}
