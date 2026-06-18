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

    public IReadOnlyList<object> GetWorkQueue(
        RuntimeState state,
        IReadOnlyList<ProcessWorkItemIntentRecord> workItemIntents) =>
        (workItemIntents ?? Array.Empty<ProcessWorkItemIntentRecord>())
            .Where(item => !RuntimeActiveWorkspacePolicy.IsRetiredUserEntryWorkspaceId(item.TargetWorkspaceId))
            .Where(item => !TerminalStatuses.Contains(item.Status))
            .Select(item => ProcessIntentQueueItem(state, item))
            .ToArray();

    public IReadOnlyList<object> GetHomeSurface(RuntimeState state) =>
        RuntimeActiveWorkspacePolicy.CurrentUserReachable(state.Workspaces)
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
        return RuntimeActiveWorkspacePolicy.CurrentUserReachable(state.Workspaces)
            .Where(workspace =>
            {
                var policy = surfacePolicies.ForWorkspace(workspace.Id);
                return policy?.Search.Visible == true &&
                    (query.Length == 0 || SearchText(state, workspace, policy).Contains(query, StringComparison.OrdinalIgnoreCase) ||
                        PolicyTerms(policy).Any(term => query.Contains(term, StringComparison.OrdinalIgnoreCase)));
            })
            .Select(workspace => BuildSearchSurfaceResult(state, workspace, query))
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
        RuntimeActiveWorkspacePolicy.CurrentUserReachable(state.Workspaces)
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

    private SearchSurfaceResult BuildSearchSurfaceResult(RuntimeState state, WorkspaceProjection workspace, string query)
    {
        var policy = surfacePolicies.ForWorkspace(workspace.Id);
        var card = searchProjection.CurrentCard(workspace);
        var cardPolicy = card is null ? null : policy?.Card(card.Id);
        var text = SearchText(state, workspace, policy);
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

    private string SearchText(RuntimeState state, WorkspaceProjection workspace, RuntimeSurfacePolicy? policy) =>
        string.Join(" ", new[]
        {
            new[] { searchProjection.SearchText(workspace) },
            new[] { EventBusinessAnchorText(state, workspace.Id) },
            PolicyTerms(policy)
        }.SelectMany(item => item));

    private static string EventBusinessAnchorText(RuntimeState state, string workspaceId) =>
        string.Join(" ", state.Events
            .Where(item => item.WorkspaceId.Equals(workspaceId, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(item => item.OccurredAtUtc)
            .Take(32)
            .SelectMany(item => BusinessAnchorSearchValues(item.Payload)));

    private static IReadOnlyList<string> BusinessAnchorSearchValues(IReadOnlyDictionary<string, string> payload) =>
        payload
            .Where(item => SearchableBusinessAnchorKeys.Contains(item.Key))
            .Select(item => item.Value)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

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

    private object ProcessIntentQueueItem(RuntimeState state, ProcessWorkItemIntentRecord intent)
    {
        var workspace = state.Workspaces.FirstOrDefault(item =>
            item.Id.Equals(intent.TargetWorkspaceId, StringComparison.OrdinalIgnoreCase));
        var policy = workspace is null ? null : surfacePolicies.ForWorkspace(workspace.Id);
        var cardId = PayloadValue(intent.Payload, "cardId", intent.WorkItemType);
        var card = workspace?.Cards.FirstOrDefault(item =>
            item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
        var cardPolicy = card is null || policy is null ? null : policy.Card(card.Id);
        var status = string.IsNullOrWhiteSpace(intent.Status) ? "ready" : intent.Status;

        return new
        {
            queueItemId = $"q-{intent.WorkItemId}",
            workItemId = intent.WorkItemId,
            caseId = PayloadValue(intent.Payload, "caseId", intent.TargetWorkspaceId),
            workspaceId = intent.TargetWorkspaceId,
            cardId,
            domain = workspace?.Domain ?? DomainFromIntent(intent),
            domainGroup = policy?.DomainGroup ?? "Operations",
            status,
            lifecycleState = status,
            badges = BadgesFor(status),
            title = workspace?.Title ?? EmptyText(),
            cardTitle = card?.Title ?? EmptyText(),
            priority = (policy?.Home.Priority ?? 0) + StatusPriorityFor(status),
            reason = PayloadValue(intent.Payload, "nextAction", intent.SourceEventId),
            nextActionId = $"{cardId}.prepare",
            queueRule = "process-work-item-intent",
            defaultLens = cardPolicy?.DefaultLens ?? string.Empty,
            lenses = policy?.Lenses ?? Array.Empty<string>(),
            ownerRole = intent.OwnerRole,
            source = "process-work-item-intent",
            payload = intent.Payload
        };
    }

    private static IReadOnlyList<string> BadgesFor(string status)
    {
        var badges = new List<string> { status };
        if (status is "ready" or "open" or "available" or "blocked" or "inProgress") badges.Add("mine");
        if (status is "blocked") badges.Add("blocked");
        return badges.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static IReadOnlyDictionary<string, string> EmptyText() => new Dictionary<string, string>
    {
        ["zh-CN"] = "",
        ["ru-RU"] = ""
    };

    private static string PayloadValue(IReadOnlyDictionary<string, string> payload, string key, string defaultValue = "") =>
        payload.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value) ? value : defaultValue;

    private static string DomainFromIntent(ProcessWorkItemIntentRecord intent)
    {
        var text = string.Join(" ", intent.WorkItemType, intent.TargetWorkspaceId, string.Join(" ", intent.Payload.Values));
        if (text.Contains("stay", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("dorm", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("room", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("bed", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("住宿", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("房间", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("床位", StringComparison.OrdinalIgnoreCase))
        {
            return "stay";
        }

        if (text.Contains("finance", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("payment", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("deposit", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("财务", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("押金", StringComparison.OrdinalIgnoreCase) ||
            text.Contains("收款", StringComparison.OrdinalIgnoreCase))
        {
            return "finance";
        }

        return "operations";
    }

    private static readonly ISet<string> TerminalStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "done",
        "confirmed",
        "completed",
        "committed",
        "closed",
        "cancelled",
        "skipped"
    };

    private static readonly ISet<string> SearchableBusinessAnchorKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "buildingName",
        "building",
        "buildingContextLabel",
        "floor",
        "roomNo",
        "roomLabel",
        "bedLabels",
        "bedNo",
        "bedLabel",
        "bedType",
        "bedTypeLabel",
        "residentName",
        "guestName",
        "leadName",
        "customerName",
        "contactName",
        "phone",
        "residentPhone",
        "customerPhone",
        "contactPhone",
        "mobile",
        "periodLabel",
        "depositStatus",
        "paymentStatus",
        "taskStatus",
        "checkoutStatus",
        "operationStatus",
        "readinessState"
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
