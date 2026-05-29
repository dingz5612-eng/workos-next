using WorkOS.Api.Slices.Persistence;

namespace WorkOS.Api.Runtime;

internal sealed class ConfirmUnitOfWork
{
    private readonly PostgresConnectionFactory connections;
    private readonly RuntimeEventStorage events;
    private readonly SliceAggregateStorage sliceAggregates;

    public ConfirmUnitOfWork(
        PostgresConnectionFactory connections,
        RuntimeEventStorage events,
        SliceAggregateStorage sliceAggregates)
    {
        this.connections = connections;
        this.events = events;
        this.sliceAggregates = sliceAggregates;
    }

    public WorkspaceEvent? Commit(IReadOnlyList<IdempotentWorkspaceEvent> committedEvents)
    {
        if (committedEvents.Count == 0)
        {
            return null;
        }

        string? duplicateKey = null;
        using (var connection = connections.Open())
        using (var db = new RuntimeDbSession(connection))
        {
            foreach (var committedEvent in committedEvents)
            {
                if (!events.InsertAuditEventAndOutbox(db, committedEvent.Event, committedEvent.IdempotencyKey))
                {
                    duplicateKey = committedEvent.IdempotencyKey;
                    break;
                }

                sliceAggregates.Apply(committedEvent.Event, db);
            }

            if (duplicateKey is null)
            {
                db.Commit();
            }
        }

        return duplicateKey is null ? null : events.FindEventByIdempotencyKey(duplicateKey);
    }
}

