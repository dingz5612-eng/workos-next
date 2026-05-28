namespace WorkOS.Api.Runtime;

public sealed class LensQueryService
{
    private readonly SearchProjectionService searchProjection;

    public LensQueryService(SearchProjectionService searchProjection)
    {
        this.searchProjection = searchProjection;
    }

    public IReadOnlyList<object> GetWorkQueue(RuntimeState state) =>
        state.Workspaces
            .Select(workspace =>
            {
                var card = searchProjection.CurrentCard(workspace);
                return card is null ? null : new
                {
                    queueItemId = $"Q-{workspace.Id}-{card.Id}",
                    workspaceId = workspace.Id,
                    cardId = card.Id,
                    domain = workspace.Domain,
                    title = workspace.Title,
                    cardTitle = card.Title,
                    priority = PriorityFor(card.Status),
                    reason = workspace.Next,
                    nextActionId = $"{card.Id}.prepare"
                };
            })
            .Where(item => item is not null)
            .Cast<object>()
            .ToArray();

    public IReadOnlyList<object> Search(RuntimeState state, string? q)
    {
        var query = (q ?? string.Empty).Trim();
        return state.Workspaces
            .Where(workspace => query.Length == 0 || searchProjection.SearchText(workspace).Contains(query, StringComparison.OrdinalIgnoreCase))
            .Select(searchProjection.SearchResult)
            .Cast<object>()
            .ToArray();
    }

    private static int PriorityFor(string status) => status switch
    {
        "blocked" => 100,
        "ready" => 90,
        "inProgress" => 80,
        _ => 40
    };
}
