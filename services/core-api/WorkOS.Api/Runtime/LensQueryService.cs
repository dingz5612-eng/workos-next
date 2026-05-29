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
                    queueItemId = $"q-{workspace.Id}-{card.Id}",
                    workspaceId = workspace.Id,
                    cardId = card.Id,
                    domain = workspace.Domain,
                    domainGroup = DomainGroupFor(workspace),
                    status = card.Status,
                    badges = BadgesFor(card),
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

    public IReadOnlyList<object> GetHomeSurface(RuntimeState state) =>
        state.Workspaces
            .Select(workspace =>
            {
                var card = searchProjection.CurrentCard(workspace);
                return card is null ? null : new
                {
                    workspaceId = workspace.Id,
                    cardId = card.Id,
                    domain = workspace.Domain,
                    domainGroup = DomainGroupFor(workspace),
                    priority = PriorityFor(card.Status) + DomainPriorityFor(workspace),
                    status = card.Status,
                    title = workspace.Title,
                    summary = workspace.Summary,
                    reason = workspace.Next,
                    section = $"{DomainGroupFor(workspace).ToLowerInvariant()}-operations",
                    lenses = LensesFor(workspace.Id)
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
            .Where(workspace => query.Length == 0 || searchProjection.SearchText(workspace).Contains(query, StringComparison.OrdinalIgnoreCase))
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
            .SelectMany(workspace => workspace.Cards.Select(card => new
            {
                workspaceId = workspace.Id,
                cardId = card.Id,
                domain = workspace.Domain,
                domainGroup = DomainGroupFor(workspace),
                learningType = "card",
                title = card.Title,
                workspaceTitle = workspace.Title,
                fields = card.Fields.Business,
                evidence = card.Evidence,
                checks = card.Checks,
                blockers = card.BlockerRules.Count > 0 ? card.BlockerRules : workspace.Blockers
            }))
            .Cast<object>()
            .ToArray();

    private static int PriorityFor(string status) => status switch
    {
        "blocked" => 100,
        "ready" => 90,
        "inProgress" => 80,
        _ => 40
    };

    private SearchSurfaceResult BuildSearchSurfaceResult(WorkspaceProjection workspace, string query)
    {
        var card = searchProjection.CurrentCard(workspace);
        var text = searchProjection.SearchText(workspace);
        var terms = MatchedTerms(query, text, workspace);
        var score = PriorityFor(card?.Status ?? string.Empty) + DomainPriorityFor(workspace) + terms.Count * 10 + IntentBoost(query, workspace);
        return new SearchSurfaceResult(
            workspace.Id,
            card?.Id ?? string.Empty,
            workspace.Domain,
            DomainGroupFor(workspace),
            score,
            workspace.Title,
            workspace.Summary,
            terms);
    }

    private static IReadOnlyList<string> MatchedTerms(string query, string searchText, WorkspaceProjection workspace)
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

        if (ContainsDepositIntent(query) && workspace.Id.Contains("DEPOSIT", StringComparison.OrdinalIgnoreCase))
        {
            terms.Add("deposit");
        }

        return terms.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static int IntentBoost(string query, WorkspaceProjection workspace)
    {
        if (ContainsDepositIntent(query) && workspace.Id.Equals("W-STAY-DEPOSIT-LEDGER", StringComparison.OrdinalIgnoreCase)) return 200;
        if (ContainsAny(query, "收款", "payment", "оплат") && workspace.Id.Equals("W-STAY-PAYMENT-LEDGER", StringComparison.OrdinalIgnoreCase)) return 180;
        if (ContainsAny(query, "入住", "checkin", "засел") && workspace.Id.Equals("W-STAY-LIFECYCLE", StringComparison.OrdinalIgnoreCase)) return 160;
        if (ContainsAny(query, "预订", "reservation", "брон") && workspace.Id.Equals("W-STAY-LEAD-RESERVATION", StringComparison.OrdinalIgnoreCase)) return 160;
        if (ContainsAny(query, "退住", "退房", "checkout", "высел") && workspace.Id.Equals("W-STAY-CHECKOUT-SETTLEMENT", StringComparison.OrdinalIgnoreCase)) return 160;
        if (ContainsAny(query, "清洁", "维修", "service", "clean", "ремонт") && workspace.Id.Equals("W-STAY-SERVICE-TASK", StringComparison.OrdinalIgnoreCase)) return 150;
        if (ContainsAny(query, "周期", "复盘", "period", "analytics") && workspace.Id.Equals("W-STAY-PERIOD-ANALYTICS", StringComparison.OrdinalIgnoreCase)) return 150;
        return 0;
    }

    private static bool ContainsDepositIntent(string query) =>
        ContainsAny(query, "押金", "deposit", "депозит");

    private static bool ContainsAny(string value, params string[] terms) =>
        terms.Any(term => value.Contains(term, StringComparison.OrdinalIgnoreCase));

    private static IReadOnlyList<string> BadgesFor(CardProjection card)
    {
        var badges = new List<string> { card.Status };
        if (card.Status is "ready" or "blocked" or "inProgress") badges.Add("mine");
        if (card.Status is "blocked") badges.Add("blocked");
        if (card.Confirmation.Required) badges.Add("confirm");
        return badges.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static string DomainGroupFor(WorkspaceProjection workspace) => workspace.Domain switch
    {
        "stay" => "Accommodation",
        "repair" => "Repair",
        "finance" => "Finance",
        _ => "Operations"
    };

    private static int DomainPriorityFor(WorkspaceProjection workspace) =>
        DomainGroupFor(workspace) == "Accommodation" ? 20 : 0;

    private static IReadOnlyList<string> LensesFor(string workspaceId) => workspaceId switch
    {
        "W-STAY-RESOURCE" => new[] { "room-readiness", "bed-inventory", "rate-plan", "room-revenue-potential" },
        "W-STAY-CHECKIN" => new[] { "today-operations", "active-stay", "deposit-liability", "payment-risk", "stay-balance" },
        "W-STAY-LEAD-RESERVATION" => new[] { "lead-funnel" },
        "W-STAY-LIFECYCLE" => new[] { "active-stay", "stay-balance" },
        "W-STAY-DEPOSIT-LEDGER" => new[] { "deposit-liability" },
        "W-STAY-PAYMENT-LEDGER" => new[] { "payment-risk", "stay-balance" },
        "W-STAY-CHECKOUT-SETTLEMENT" => new[] { "checkout-queue" },
        "W-STAY-SERVICE-TASK" => new[] { "service-task-queue" },
        "W-STAY-EXPENSE-LEDGER" => new[] { "expense-analytics" },
        "W-STAY-PERIOD-ANALYTICS" => new[] { "period-performance", "risk-command" },
        _ => Array.Empty<string>()
    };

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
