namespace WorkOS.Api.Runtime;

public sealed class ProjectionRuntime
{
    private readonly object gate = new();
    private readonly IProjectionStore store;
    private readonly RuntimeAuthOptions authOptions;
    private readonly CardConfirmationPolicy confirmationPolicy = new();
    private RuntimeState state;

    private ProjectionRuntime(IProjectionStore store, RuntimeAuthOptions authOptions)
    {
        this.store = store;
        this.authOptions = authOptions;
        state = store.LoadOrSeed(ProjectionSeed.Create);
    }

    public static ProjectionRuntime OpenPostgres(
        string connectionString,
        RuntimeAuthOptions? authOptions = null,
        string? migrationsPath = null) =>
        new(new PostgresProjectionStore(connectionString, migrationsPath), authOptions ?? RuntimeAuthOptions.Development);

    public ProjectionEnvelope GetAll()
    {
        lock (gate)
        {
            return Envelope();
        }
    }

    public WorkspaceProjection? FindWorkspace(string workspaceId)
    {
        lock (gate)
        {
            return FindWorkspaceUnlocked(workspaceId);
        }
    }

    public IReadOnlyList<object> GetWorkQueue()
    {
        lock (gate)
        {
            return state.Workspaces
                .Select(workspace =>
                {
                    var card = CurrentCard(workspace);
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
        }
    }

    public IReadOnlyList<object> Search(string? q)
    {
        lock (gate)
        {
            var query = (q ?? string.Empty).Trim();
            return state.Workspaces
                .Where(workspace => query.Length == 0 || SearchText(workspace).Contains(query, StringComparison.OrdinalIgnoreCase))
                .Select(SearchResult)
                .Cast<object>()
                .ToArray();
        }
    }

    public object? Prepare(string workspaceId, string cardId)
    {
        lock (gate)
        {
            var workspace = FindWorkspaceUnlocked(workspaceId);
            var card = workspace?.Cards.FirstOrDefault(item => item.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
            if (workspace is null || card is null)
            {
                return null;
            }

            return new
            {
                prepared = true,
                preparedAtUtc = DateTimeOffset.UtcNow,
                workspaceId = workspace.Id,
                cardId = card.Id,
                card,
                allowedActions = new[]
                {
                    new
                    {
                        actionId = $"{card.Id}.confirm",
                        kind = "confirm",
                        label = card.Confirmation.Label,
                        confirmationPolicy = card.Confirmation
                    }
                },
                checks = card.Checks,
                blockers = card.BlockerRules,
                fieldDefaults = card.Fields.Business.ToDictionary(field => field.Id, _ => string.Empty)
            };
        }
    }

    public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
    {
        lock (gate)
        {
            var workspaceIndex = state.Workspaces.FindIndex(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));
            if (workspaceIndex < 0)
            {
                return new ConfirmResult(ConfirmStatus.NotFound, null, null);
            }

            var workspace = state.Workspaces[workspaceIndex];
            var cards = workspace.Cards.ToList();
            var cardIndex = cards.FindIndex(card => card.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));
            if (cardIndex < 0)
            {
                return new ConfirmResult(ConfirmStatus.NotFound, null, null);
            }

            var card = cards[cardIndex];
            if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
            {
                return new ConfirmResult(ConfirmStatus.Invalid, "Confirm requires an idempotency key.", null);
            }

            var actor = store.FindUserBySessionToken(actorToken);
            if (actor is null)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "A valid actor session token is required for confirmation.", null);
            }

            var policyFailure = confirmationPolicy.Authorize(card, actor);
            if (policyFailure is not null)
            {
                return policyFailure;
            }

            var idempotencyKey = request.IdempotencyKey;
            var existingEvent = store.FindEventByIdempotencyKey(idempotencyKey);
            if (existingEvent is not null)
            {
                return new ConfirmResult(ConfirmStatus.Duplicate, null, new
                {
                    confirmed = true,
                    duplicate = true,
                    workspaceId = workspace.Id,
                    cardId = card.Id,
                    @event = existingEvent,
                    workspace,
                    projection = Envelope()
                });
            }

            var eventDefinition = card.Events.First();
            var workspaceEvent = new WorkspaceEvent(
                $"evt-{Guid.NewGuid():N}",
                workspace.Id,
                card.Id,
                eventDefinition.EventType,
                actor.Role,
                actor.UserId,
                DateTimeOffset.UtcNow,
                request.FieldValues ?? new Dictionary<string, string>(),
                eventDefinition.ProjectionTargets);

            store.AppendAuditEventAndOutbox(workspaceEvent, idempotencyKey);

            return new ConfirmResult(ConfirmStatus.Confirmed, null, new
            {
                confirmed = true,
                duplicate = false,
                workspaceId = workspace.Id,
                cardId = card.Id,
                @event = workspaceEvent,
                workspace,
                projection = Envelope()
            });
        }
    }

    public object? Login(LoginRequest request)
    {
        lock (gate)
        {
            var user = state.Users.FirstOrDefault(item =>
                item.Enabled &&
                item.Username.Equals(request.Username, StringComparison.OrdinalIgnoreCase));

            if (user is null ||
                !authOptions.PasswordSha256ByUsername.TryGetValue(user.Username, out var passwordHash) ||
                !RuntimePasswordHasher.Verify(request.Password, passwordHash))
            {
                return null;
            }

            var session = user is null ? null : store.CreateSession(user);
            return user is null || session is null ? null : new
            {
                authenticated = true,
                actorId = user.UserId,
                actorType = user.Role,
                displayName = user.DisplayName,
                role = user.Role,
                token = session.Token,
                expiresAtUtc = session.ExpiresAtUtc
            };
        }
    }

    public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null) => store.GetAuditEvents(workspaceId);

    public IReadOnlyList<OutboxMessage> GetOutboxMessages() => store.GetOutboxMessages();

    public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents() => store.GetBehaviorEvents();

    public BehaviorEventRecord AppendBehaviorEvent(BehaviorEventRecord behaviorEvent)
    {
        store.AppendBehaviorEvent(behaviorEvent);
        return behaviorEvent;
    }

    public int ProcessPendingOutbox()
    {
        lock (gate)
        {
            return ProcessPendingOutboxUnlocked();
        }
    }

    private ProjectionEnvelope Envelope() => new(
        "IntentWorkspaceProjection",
        "0.13.0-backend-runtime",
        new[] { "zh-CN", "ru-RU" },
        "IntentWorkspaceProjection + WorkspaceCardProjection",
        state.Workspaces,
        state.Events);

    private WorkspaceProjection? FindWorkspaceUnlocked(string workspaceId) =>
        state.Workspaces.FirstOrDefault(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));

    private int ProcessPendingOutboxUnlocked()
    {
        var processed = 0;
        foreach (var message in store.GetPendingOutboxMessages())
        {
            ApplyEventToReadModel(message.Event);
            store.SaveState(state);
            store.MarkOutboxProcessed(message.MessageId);
            processed++;
        }

        return processed;
    }

    private void ApplyEventToReadModel(WorkspaceEvent workspaceEvent)
    {
        if (state.Events.Any(item => item.EventId == workspaceEvent.EventId))
        {
            return;
        }

        var workspaceIndex = state.Workspaces.FindIndex(workspace => workspace.Id.Equals(workspaceEvent.WorkspaceId, StringComparison.OrdinalIgnoreCase));
        if (workspaceIndex < 0)
        {
            return;
        }

        var workspace = state.Workspaces[workspaceIndex];
        var cards = workspace.Cards.ToList();
        var cardIndex = cards.FindIndex(card => card.Id.Equals(workspaceEvent.CardId, StringComparison.OrdinalIgnoreCase));
        if (cardIndex < 0)
        {
            return;
        }

        cards[cardIndex] = cards[cardIndex] with { Status = "done", BlockerRules = Array.Empty<BlockerRule>() };
        if (cardIndex + 1 < cards.Count && cards[cardIndex + 1].Status == "notStarted")
        {
            cards[cardIndex + 1] = cards[cardIndex + 1] with { Status = "ready" };
        }

        state.Workspaces[workspaceIndex] = workspace with
        {
            Cards = cards,
            Blockers = cards.SelectMany(item => item.BlockerRules).ToArray()
        };
        state.Events.Add(workspaceEvent);
    }

    private static CardProjection? CurrentCard(WorkspaceProjection workspace) =>
        workspace.Cards.FirstOrDefault(card => card.Status is "ready" or "blocked" or "inProgress") ?? workspace.Cards.FirstOrDefault();

    private static int PriorityFor(string status) => status switch
    {
        "blocked" => 100,
        "ready" => 90,
        "inProgress" => 80,
        _ => 40
    };

    private static object SearchResult(WorkspaceProjection workspace)
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

    private static string SearchText(WorkspaceProjection workspace) =>
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
}
