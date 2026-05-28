using System.Text.Json;
using WorkOS.Api.Slices.Persistence;

namespace WorkOS.Api.Runtime;

public sealed class PostgresProjectionStore : IProjectionStore
{
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly RuntimeDocumentStorage documents;
    private readonly RuntimeSessionStorage sessions;
    private readonly RuntimeEventStorage events;
    private readonly RuntimeOutboxStorage outbox;
    private readonly RuntimeBehaviorEventStorage behaviorEvents;
    private readonly SliceAggregateStorage sliceAggregates;

    public PostgresProjectionStore(string connectionString, string? migrationsPath = null)
    {
        var connections = new PostgresConnectionFactory(connectionString);
        new PostgresMigrationRunner(connections, migrationsPath).Run();

        documents = new RuntimeDocumentStorage(connections);
        sessions = new RuntimeSessionStorage(connections);
        events = new RuntimeEventStorage(connections);
        outbox = new RuntimeOutboxStorage(connections);
        behaviorEvents = new RuntimeBehaviorEventStorage(connections);
        sliceAggregates = new SliceAggregateStorage(connections);
    }

    public RuntimeState LoadOrSeed(Func<RuntimeState> seedFactory) =>
        documents.LoadOrSeed(seedFactory);

    public void SaveState(RuntimeState state) =>
        documents.SaveState(state);

    public RuntimeSession CreateSession(RuntimeUser user) =>
        sessions.CreateSession(user);

    public RuntimeUser? FindUserBySessionToken(string token)
    {
        var userId = sessions.FindUserIdBySessionToken(token);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return null;
        }

        var state = documents.LoadOrSeed(ProjectionSeed.Create);
        return state.Users.FirstOrDefault(user => user.Enabled && user.UserId == userId);
    }

    public WorkspaceEvent? FindEventByIdempotencyKey(string idempotencyKey) =>
        events.FindEventByIdempotencyKey(idempotencyKey);

    public void AppendAuditEventAndOutbox(WorkspaceEvent workspaceEvent, string idempotencyKey) =>
        events.AppendAuditEventAndOutbox(workspaceEvent, idempotencyKey);

    public void ApplySliceAggregate(WorkspaceEvent workspaceEvent) =>
        sliceAggregates.Apply(workspaceEvent);

    public IReadOnlyList<OutboxMessage> GetPendingOutboxMessages(int take = 50) =>
        outbox.GetPending(take);

    public IReadOnlyList<OutboxMessage> GetOutboxMessages() =>
        outbox.GetAll();

    public void MarkOutboxProcessed(string messageId) =>
        outbox.MarkProcessed(messageId);

    public void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent) =>
        behaviorEvents.Append(behaviorEvent);

    public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null) =>
        events.GetAuditEvents(workspaceId);

    public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents() =>
        behaviorEvents.GetAll();
}
