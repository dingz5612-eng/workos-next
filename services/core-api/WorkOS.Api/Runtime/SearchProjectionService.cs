namespace WorkOS.Api.Runtime;

public sealed class SearchProjectionService
{
    public object SearchResult(WorkspaceProjection workspace)
    {
        var card = CurrentCard(workspace);
        return new
        {
            resultId = $"SR-{workspace.Id}",
            workspaceId = workspace.Id,
            cardId = card?.Id,
            title = workspace.Title,
            matchedText = SearchText(workspace),
            target = new { kind = "workspaceCard", workspaceId = workspace.Id, cardId = card?.Id }
        };
    }

    public string SearchText(WorkspaceProjection workspace) =>
        string.Join(" ", new[]
        {
            workspace.Id,
            workspace.Domain,
            workspace.Title.GetValueOrDefault("zh-CN", ""),
            workspace.Title.GetValueOrDefault("ru-RU", ""),
            workspace.Summary.GetValueOrDefault("zh-CN", ""),
            workspace.Summary.GetValueOrDefault("ru-RU", ""),
            workspace.Next.GetValueOrDefault("zh-CN", ""),
            workspace.Next.GetValueOrDefault("ru-RU", ""),
            string.Join(" ", workspace.Cards.Select(card => $"{card.Id} {card.Title.GetValueOrDefault("zh-CN", "")} {card.Title.GetValueOrDefault("ru-RU", "")}"))
        });

    public CardProjection? CurrentCard(WorkspaceProjection workspace) =>
        workspace.Cards.FirstOrDefault(card => card.Status is "ready" or "blocked" or "inProgress") ?? workspace.Cards.FirstOrDefault();
}
