using System.Text.Json;
using WorkOS.Api.Slices.Persistence;

namespace WorkOS.Api.Runtime;

public sealed partial class PostgresProjectionStore : IProjectionStore
{
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly RuntimeDocumentStorage documents;
    private readonly AccountActorKernelStorage accounts;
    private readonly RuntimeSessionStorage sessions;
    private readonly RuntimeDeviceSessionStorage deviceSessions;
    private readonly RuntimeEventStorage events;
    private readonly RuntimeOutboxStorage outbox;
    private readonly RuntimeBehaviorEventStorage behaviorEvents;
    private readonly RuntimeAggregateLensStorage aggregateLenses;
    private readonly RuntimeAccommodationLedgerStorage accommodationLedgers;
    private readonly RuntimeCardInstanceStorage cardInstances;
    private readonly RuntimeEvidenceStorage evidenceObjects;
    private readonly RuntimeProductionObservabilityStorage productionObservability;
    private readonly RuntimeGovernanceExportStorage governanceExports;
    private readonly BankStatementImportService bankStatementImports;
    private readonly ReconciliationMatchingService reconciliationMatching;
    private readonly ReconciliationMismatchCaseService reconciliationMismatchCases;
    private readonly CorrectionCenterService correctionCenter;
    private readonly RuntimeProcessManagerStorage processManagerStorage;
    private readonly SliceAggregateStorage sliceAggregates;
    private readonly ConfirmUnitOfWork confirmUnitOfWork;
    private readonly CheckoutServiceProcessManager checkoutServiceProcessManager;
    private readonly PostgresConnectionFactory connections;

    public PostgresProjectionStore(string connectionString, string? migrationsPath = null, bool runMigrations = true)
    {
        connections = new PostgresConnectionFactory(connectionString);
        if (runMigrations)
        {
            new PostgresMigrationRunner(connections, migrationsPath).Run();
        }

        documents = new RuntimeDocumentStorage(connections);
        accounts = new AccountActorKernelStorage(connections);
        sessions = new RuntimeSessionStorage(connections);
        deviceSessions = new RuntimeDeviceSessionStorage(connections);
        events = new RuntimeEventStorage(connections);
        outbox = new RuntimeOutboxStorage(connections);
        behaviorEvents = new RuntimeBehaviorEventStorage(connections);
        aggregateLenses = new RuntimeAggregateLensStorage(connections);
        accommodationLedgers = new RuntimeAccommodationLedgerStorage(connections);
        cardInstances = new RuntimeCardInstanceStorage(connections);
        evidenceObjects = new RuntimeEvidenceStorage(connections, deviceSessions);
        productionObservability = new RuntimeProductionObservabilityStorage(connections);
        governanceExports = new RuntimeGovernanceExportStorage(connections, behaviorEvents);
        bankStatementImports = new BankStatementImportService(new RuntimeBankStatementImportStorage(connections));
        processManagerStorage = new RuntimeProcessManagerStorage(connections);
        reconciliationMatching = new ReconciliationMatchingService(new RuntimeReconciliationMatchingStorage(connections));
        reconciliationMismatchCases = new ReconciliationMismatchCaseService(new RuntimeReconciliationMismatchCaseStorage(connections, processManagerStorage));
        correctionCenter = new CorrectionCenterService(new RuntimeCorrectionCenterStorage(connections, events, processManagerStorage));
        sliceAggregates = new SliceAggregateStorage(connections);
        confirmUnitOfWork = new ConfirmUnitOfWork(connections, events, sliceAggregates, cardInstances, evidenceObjects);
        checkoutServiceProcessManager = new CheckoutServiceProcessManager();
    }

    public RuntimeState LoadOrSeed(Func<RuntimeState> seedFactory) =>
        documents.LoadOrSeed(seedFactory);

    public void SaveState(RuntimeState state) =>
        documents.SaveState(state);

    public WorkspaceEvent? FindEventByIdempotencyKey(string idempotencyKey) =>
        events.FindEventByIdempotencyKey(idempotencyKey);

    public void AppendAuditEventAndOutbox(WorkspaceEvent workspaceEvent, string idempotencyKey) =>
        events.AppendAuditEventAndOutbox(workspaceEvent, idempotencyKey);

    public void ApplySliceAggregate(WorkspaceEvent workspaceEvent) =>
        sliceAggregates.Apply(workspaceEvent);

    public WorkspaceEvent? CommitConfirmEvents(IReadOnlyList<IdempotentWorkspaceEvent> committedEvents) =>
        confirmUnitOfWork.Commit(committedEvents);

    public CardInstanceRecord PrepareCardInstance(string workspaceId, string cardId, PrepareCardRequest request) =>
        cardInstances.Prepare(workspaceId, cardId, request);

    public CardInstanceRecord? FindCardInstance(string cardInstanceId) =>
        cardInstances.Find(cardInstanceId);
}
