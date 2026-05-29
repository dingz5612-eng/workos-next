namespace WorkOS.Api.Runtime;

public sealed class LensQueryService
{
    private readonly SearchProjectionService searchProjection;
    private readonly RuntimeSurfacePolicyCatalog surfacePolicies;

    public LensQueryService(SearchProjectionService searchProjection)
    {
        this.searchProjection = searchProjection;
        surfacePolicies = RuntimeSurfacePolicyCatalog.LoadDefault();
    }

    public IReadOnlyList<object> GetWorkQueue(RuntimeState state) =>
        state.Workspaces
            .Select(workspace =>
            {
                var policy = surfacePolicies.ForWorkspace(workspace.Id);
                if (policy?.Workbench.Visible != true)
                {
                    return null;
                }

                var card = searchProjection.CurrentCard(workspace);
                var cardPolicy = card is null ? null : policy.Card(card.Id);
                if (card is null || cardPolicy?.Workbench != true)
                {
                    return null;
                }

                return card is null ? null : new
                {
                    queueItemId = $"q-{workspace.Id}-{card.Id}",
                    workspaceId = workspace.Id,
                    cardId = card.Id,
                    domain = workspace.Domain,
                    domainGroup = policy.DomainGroup,
                    status = card.Status,
                    badges = BadgesFor(card),
                    title = workspace.Title,
                    cardTitle = card.Title,
                    priority = policy.Home.Priority + StatusPriorityFor(card.Status),
                    reason = workspace.Next,
                    nextActionId = $"{card.Id}.prepare",
                    queueRule = policy.Workbench.QueueRule,
                    defaultLens = cardPolicy.DefaultLens,
                    lenses = policy.Lenses
                };
            })
            .Where(item => item is not null)
            .Cast<object>()
            .ToArray();

    public IReadOnlyList<object> GetHomeSurface(RuntimeState state) =>
        state.Workspaces
            .Select(workspace =>
            {
                var policy = surfacePolicies.ForWorkspace(workspace.Id);
                if (policy?.Home.Visible != true)
                {
                    return null;
                }

                var card = searchProjection.CurrentCard(workspace);
                var cardPolicy = card is null ? null : policy.Card(card.Id);
                return card is null || cardPolicy?.Home != true ? null : new
                {
                    workspaceId = workspace.Id,
                    cardId = card.Id,
                    domain = workspace.Domain,
                    domainGroup = policy.DomainGroup,
                    priority = policy.Home.Priority + StatusPriorityFor(card.Status),
                    status = card.Status,
                    title = workspace.Title,
                    summary = workspace.Summary,
                    reason = workspace.Next,
                    section = policy.Home.Section,
                    lenses = policy.Lenses,
                    defaultLens = cardPolicy.DefaultLens,
                    hiddenReason = policy.HiddenReason
                };
            })
            .Where(item => item is not null)
            .Cast<object>()
            .OrderByDescending(item => item.GetType().GetProperty("priority")?.GetValue(item))
            .ToArray();

    public IReadOnlyList<object> Search(RuntimeState state, string? q)
    {
        var query = (q ?? string.Empty).Trim();
        return state.Workspaces
            .Where(workspace =>
            {
                var policy = surfacePolicies.ForWorkspace(workspace.Id);
                return policy?.Search.Visible == true &&
                    (query.Length == 0 || SearchText(workspace, policy).Contains(query, StringComparison.OrdinalIgnoreCase) ||
                        PolicyTerms(policy).Any(term => query.Contains(term, StringComparison.OrdinalIgnoreCase)));
            })
            .Select(workspace => BuildSearchSurfaceResult(workspace, query))
            .OrderByDescending(item => item.Score)
            .ThenBy(item => item.WorkspaceId)
            .Select(item => new
            {
                resultId = $"sr-{item.WorkspaceId}-{item.CardId}",
                workspaceId = item.WorkspaceId,
                cardId = item.CardId,
                domain = item.Domain,
                domainGroup = item.DomainGroup,
                score = item.Score,
                title = item.Title,
                summary = item.Summary,
                matchedTerms = item.MatchedTerms,
                target = new { kind = "workspaceCard", workspaceId = item.WorkspaceId, cardId = item.CardId }
            })
            .Cast<object>()
            .ToArray();
    }

    public IReadOnlyList<object> GetLearningCatalog(RuntimeState state) =>
        state.Workspaces
            .SelectMany(workspace =>
            {
                var policy = surfacePolicies.ForWorkspace(workspace.Id);
                if (policy?.Learning.Visible != true)
                {
                    return Array.Empty<object>();
                }

                return workspace.Cards
                    .Select(card => new { Card = card, Policy = policy.Card(card.Id) })
                    .Where(item => item.Policy is not null)
                    .Select(item => new
                    {
                        workspaceId = workspace.Id,
                        cardId = item.Card.Id,
                        domain = workspace.Domain,
                        domainGroup = policy.DomainGroup,
                        learningType = "card",
                        section = item.Policy!.LearningSection,
                        defaultLens = item.Policy.DefaultLens,
                        intentTags = item.Policy.IntentTags,
                        title = item.Card.Title,
                        workspaceTitle = workspace.Title,
                        fields = item.Card.Fields.Business,
                        evidence = item.Card.Evidence,
                        checks = item.Card.Checks,
                        blockers = item.Card.BlockerRules.Count > 0 ? item.Card.BlockerRules : workspace.Blockers
                    })
                    .Cast<object>()
                    .ToArray();
            })
            .Cast<object>()
            .ToArray();

    private static int StatusPriorityFor(string status) => status switch
    {
        "blocked" => 100,
        "ready" => 90,
        "inProgress" => 80,
        _ => 40
    };

    private SearchSurfaceResult BuildSearchSurfaceResult(WorkspaceProjection workspace, string query)
    {
        var policy = surfacePolicies.ForWorkspace(workspace.Id);
        var card = searchProjection.CurrentCard(workspace);
        var cardPolicy = card is null ? null : policy?.Card(card.Id);
        var text = SearchText(workspace, policy);
        var terms = MatchedTerms(query, text, policy, cardPolicy);
        var score = (policy?.Home.Priority ?? 0) + StatusPriorityFor(card?.Status ?? string.Empty) + terms.Count * 25;
        return new SearchSurfaceResult(
            workspace.Id,
            card?.Id ?? string.Empty,
            workspace.Domain,
            policy?.DomainGroup ?? "Operations",
            score,
            workspace.Title,
            workspace.Summary,
            terms);
    }

    private static IReadOnlyList<string> MatchedTerms(string query, string searchText, RuntimeSurfacePolicy? policy, SurfaceCardPolicy? cardPolicy)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return Array.Empty<string>();
        }

        var terms = new List<string>();
        foreach (var term in query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (searchText.Contains(term, StringComparison.OrdinalIgnoreCase))
            {
                terms.Add(term);
            }
        }

        foreach (var term in PolicyTerms(policy, cardPolicy))
        {
            if (query.Contains(term, StringComparison.OrdinalIgnoreCase) || term.Contains(query, StringComparison.OrdinalIgnoreCase))
            {
                terms.Add(term);
            }
        }

        return terms.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private string SearchText(WorkspaceProjection workspace, RuntimeSurfacePolicy? policy) =>
        string.Join(" ", new[]
        {
            new[] { searchProjection.SearchText(workspace) },
            PolicyTerms(policy)
        }.SelectMany(item => item));

    private static IReadOnlyList<string> PolicyTerms(RuntimeSurfacePolicy? policy, SurfaceCardPolicy? cardPolicy = null) =>
        policy is null
            ? Array.Empty<string>()
            : policy.Search.Keywords
                .Concat(policy.Search.IntentTags)
                .Concat(policy.Cards.SelectMany(card => card.SearchKeywords))
                .Concat(policy.Cards.SelectMany(card => card.IntentTags))
                .Concat(cardPolicy?.SearchKeywords ?? Array.Empty<string>())
                .Concat(cardPolicy?.IntentTags ?? Array.Empty<string>())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

    private static IReadOnlyList<string> BadgesFor(CardProjection card)
    {
        var badges = new List<string> { card.Status };
        if (card.Status is "ready" or "blocked" or "inProgress") badges.Add("mine");
        if (card.Status is "blocked") badges.Add("blocked");
        if (card.Confirmation.Required) badges.Add("confirm");
        return badges.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private sealed record SearchSurfaceResult(
        string WorkspaceId,
        string CardId,
        string Domain,
        string DomainGroup,
        int Score,
        IReadOnlyDictionary<string, string> Title,
        IReadOnlyDictionary<string, string> Summary,
        IReadOnlyList<string> MatchedTerms);
}
