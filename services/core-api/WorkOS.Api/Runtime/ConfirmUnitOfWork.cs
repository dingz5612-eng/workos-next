using WorkOS.Api.Slices.Persistence;

namespace WorkOS.Api.Runtime;

internal sealed class ConfirmUnitOfWork
{
    private readonly PostgresConnectionFactory connections;
    private readonly RuntimeEventStorage events;
    private readonly SliceAggregateStorage sliceAggregates;
    private readonly RuntimeCardInstanceStorage cardInstances;
    private readonly RuntimeEvidenceStorage evidenceObjects;

    public ConfirmUnitOfWork(
        PostgresConnectionFactory connections,
        RuntimeEventStorage events,
        SliceAggregateStorage sliceAggregates,
        RuntimeCardInstanceStorage cardInstances,
        RuntimeEvidenceStorage evidenceObjects)
    {
        this.connections = connections;
        this.events = events;
        this.sliceAggregates = sliceAggregates;
        this.cardInstances = cardInstances;
        this.evidenceObjects = evidenceObjects;
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
            var firstEvent = committedEvents[0];
            cardInstances.MarkSubmitted(db, firstEvent.Event, firstEvent.IdempotencyKey);

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
                evidenceObjects.MarkUsed(db, firstEvent.Event.EvidenceIds, firstEvent.Event);
                cardInstances.MarkConfirmed(db, firstEvent.Event, firstEvent.IdempotencyKey);
                db.Commit();
            }
        }

        return duplicateKey is null ? null : events.FindEventByIdempotencyKey(duplicateKey);
    }
}
