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
    private readonly RuntimeDeviceSessionStorage deviceSessions;
    private readonly RuntimeEventStorage events;
    private readonly RuntimeOutboxStorage outbox;
    private readonly RuntimeBehaviorEventStorage behaviorEvents;
    private readonly RuntimeAggregateLensStorage aggregateLenses;
    private readonly RuntimeAccommodationLedgerStorage accommodationLedgers;
    private readonly RuntimeCardInstanceStorage cardInstances;
    private readonly RuntimeEvidenceStorage evidenceObjects;
    private readonly RuntimeProductionObservabilityStorage productionObservability;
    private readonly BankStatementImportService bankStatementImports;
    private readonly ReconciliationMatchingService reconciliationMatching;
    private readonly ReconciliationMismatchCaseService reconciliationMismatchCases;
    private readonly CorrectionCenterService correctionCenter;
    private readonly RuntimeProcessManagerStorage processManagerStorage;
    private readonly SliceAggregateStorage sliceAggregates;
    private readonly ConfirmUnitOfWork confirmUnitOfWork;
    private readonly CheckoutServiceProcessManager checkoutServiceProcessManager;
    private readonly PostgresConnectionFactory connections;

    public PostgresProjectionStore(string connectionString, string? migrationsPath = null)
    {
        connections = new PostgresConnectionFactory(connectionString);
        new PostgresMigrationRunner(connections, migrationsPath).Run();

        documents = new RuntimeDocumentStorage(connections);
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

    public RuntimeSession CreateSession(RuntimeUser user) =>
        sessions.CreateSession(user);

    public void RevokeSession(string token, string actorId) =>
        sessions.RevokeSession(token, actorId);

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

    public RuntimeDeviceSession RegisterDeviceSession(RuntimeDeviceSessionRequest request) =>
        deviceSessions.Register(request);

    public RuntimeDeviceSession? FindDeviceSession(string deviceId) =>
        deviceSessions.Find(deviceId);

    public RuntimeDeviceSession? RevokeDeviceSession(string deviceId, string actorId) =>
        deviceSessions.Revoke(deviceId, actorId);

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

    public EvidenceObject CreateEvidenceDraft(EvidenceDraftRequest request, string actorId) =>
        evidenceObjects.CreateDraft(request, actorId);

    public EvidenceObject AttachEvidence(string evidenceId, EvidenceAttachmentRequest request, string actorId) =>
        evidenceObjects.Attach(evidenceId, request, actorId);

    public EvidenceObject VerifyEvidence(string evidenceId, EvidenceDecisionRequest request) =>
        evidenceObjects.Decide(evidenceId, request, "verified");

    public EvidenceObject RejectEvidence(string evidenceId, EvidenceDecisionRequest request) =>
        evidenceObjects.Decide(evidenceId, request, "rejected");

    public IReadOnlyList<EvidenceObject> GetEvidenceObjects(string? evidenceId = null) =>
        evidenceObjects.Get(evidenceId);

    public EvidenceSignedUrlResponse CreateEvidenceSignedUrl(string evidenceId, EvidenceSignedUrlRequest request) =>
        evidenceObjects.CreateSignedUrl(evidenceId, request);

    public GovernanceExportResult RequestGovernanceExport(GovernanceExportRequest request)
    {
        var result = RuntimeGovernanceExportPolicy.Validate(request);
        WriteGovernanceExportAudit(request, result);
        behaviorEvents.Append(new BehaviorEventRecord(
            result.AuditEventId,
            "PCGovernanceExportRequested",
            "governance_export",
            request.ExportType,
            "zh-CN",
            result.Status,
            DateTimeOffset.UtcNow));
        return result;
    }

    private void WriteGovernanceExportAudit(GovernanceExportRequest request, GovernanceExportResult result)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            insert into governance_export_audits(
                audit_event_id, export_type, actor_id, device_id, status, reason,
                expires_at_utc, occurred_at_utc)
            values (
                @auditEventId, @exportType, @actorId, @deviceId, @status, @reason,
                @expiresAtUtc, @occurredAtUtc)
            on conflict(audit_event_id) do nothing
            """;
        command.Parameters.AddWithValue("auditEventId", result.AuditEventId);
        command.Parameters.AddWithValue("exportType", result.ExportType);
        command.Parameters.AddWithValue("actorId", request.ActorId);
        command.Parameters.AddWithValue("deviceId", request.DeviceId);
        command.Parameters.AddWithValue("status", result.Status);
        command.Parameters.AddWithValue("reason", result.Reason);
        command.Parameters.AddWithValue("expiresAtUtc", result.ExpiresAtUtc);
        command.Parameters.AddWithValue("occurredAtUtc", DateTimeOffset.UtcNow);
        command.ExecuteNonQuery();
    }

    public ConfirmResult? ValidateEvidenceForConfirm(
        string workspaceId,
        string cardId,
        ConfirmCardRequest request,
        IReadOnlyList<EvidenceRequirement> requirements) =>
        evidenceObjects.ValidateForConfirm(workspaceId, cardId, request, requirements);

    public BankStatementImportPreview PreviewBankStatementImport(BankStatementImportRequest request) =>
        bankStatementImports.Preview(request);

    public BankStatementImportResult ConfirmBankStatementImport(BankStatementImportRequest request, string actorId) =>
        bankStatementImports.Confirm(request, actorId);

    public ReconciliationCandidateGenerationResult GenerateReconciliationMatchCandidates(ReconciliationCandidateGenerationRequest request) =>
        reconciliationMatching.GenerateCandidates(request);

    public IReadOnlyList<ReconciliationMatchCandidate> GetReconciliationMatchCandidates(string tenantId, string? bankTransactionId = null) =>
        reconciliationMatching.GetCandidates(tenantId, bankTransactionId);

    public ReconciliationManualMatchResult AcceptReconciliationMatchCandidate(string candidateId, string actorId) =>
        reconciliationMatching.AcceptCandidate(candidateId, actorId);

    public ReconciliationCandidateDecisionResult RejectReconciliationMatchCandidate(string candidateId, string actorId, string reason) =>
        reconciliationMatching.RejectCandidate(candidateId, actorId, reason);

    public ReconciliationMismatchResult MarkBankTransactionMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId)
    {
        var mismatch = reconciliationMatching.MarkMismatch(bankTransactionId, request, actorId);
        reconciliationMismatchCases.CreateCaseForMismatch(mismatch.TenantId, mismatch.MismatchId, actorId);
        return mismatch;
    }

    public ReconciliationTransactionDecisionResult IgnoreBankTransaction(string bankTransactionId, string tenantId, string actorId, string reason) =>
        reconciliationMatching.IgnoreTransaction(bankTransactionId, tenantId, actorId, reason);

    public ReconciliationMismatchDetectionResult DetectReconciliationMismatches(ReconciliationMismatchDetectionRequest request)
    {
        reconciliationMatching.GenerateCandidates(new ReconciliationCandidateGenerationRequest(
            request.TenantId,
            request.BankTransactionId,
            request.ImportId,
            request.WindowDays));
        return reconciliationMismatchCases.DetectMismatches(request);
    }

    public ReconciliationCaseRecord CreateReconciliationCaseForMismatch(string tenantId, string mismatchId, string actorId) =>
        reconciliationMismatchCases.CreateCaseForMismatch(tenantId, mismatchId, actorId);

    public LedgerCorrectionRequestResult RequestLedgerCorrection(LedgerCorrectionRequestCommand command) =>
        new LedgerCorrectionRequestCommandHandler(correctionCenter).Handle(command);

    public LedgerCorrectionDecisionResult ApproveLedgerCorrection(LedgerCorrectionApproveCommand command) =>
        new LedgerCorrectionApproveCommandHandler(correctionCenter).Handle(command);

    public LedgerCorrectionDecisionResult RejectLedgerCorrection(LedgerCorrectionRejectCommand command) =>
        new LedgerCorrectionRejectCommandHandler(correctionCenter).Handle(command);

    public LedgerCorrectionApplyResult ApplyLedgerCorrection(LedgerCorrectionApplyCommand command) =>
        new LedgerCorrectionApplyCommandHandler(correctionCenter).Handle(command);

    public DepositLedgerState GetDepositLedgerState(string depositId)
        => accommodationLedgers.GetDepositLedgerState(depositId);

    public PaymentLedgerState GetPaymentLedgerState(string paymentId)
        => accommodationLedgers.GetPaymentLedgerState(paymentId);

    public IReadOnlyList<OutboxMessage> ClaimPendingOutboxMessages(string workerId, int take = 50, TimeSpan? lease = null) =>
        outbox.ClaimPending(workerId, take, lease ?? TimeSpan.FromMinutes(2));

    public IReadOnlyList<OutboxMessage> GetOutboxMessages() =>
        outbox.GetAll();

    public void MarkOutboxProcessed(string messageId, string workerId) =>
        outbox.MarkProcessed(messageId, workerId);

    public void MarkOutboxFailed(string messageId, string workerId, string error, int maxRetries = 5) =>
        outbox.MarkFailed(messageId, workerId, error, maxRetries);

    public CheckoutServiceProcessManagerResult ApplyCheckoutServiceProcessRules(WorkspaceEvent workspaceEvent) =>
        checkoutServiceProcessManager.Handle(workspaceEvent, processManagerStorage);

    public IReadOnlyList<ProcessRunRecord> GetProcessRuns(string? tenantId = null) =>
        processManagerStorage.GetProcessRuns(tenantId);

    public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
        processManagerStorage.GetWorkItemIntents(tenantId);

    public IReadOnlyList<ProcessRequestEventIntentRecord> GetProcessRequestEventIntents(string? tenantId = null) =>
        processManagerStorage.GetRequestEventIntents(tenantId);

    public void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent) =>
        behaviorEvents.Append(behaviorEvent);

    public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null) =>
        events.GetAuditEvents(workspaceId);

    public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents() =>
        behaviorEvents.GetAll();

    public ProductionObservabilityDatabaseSnapshot GetProductionObservabilityDatabaseSnapshot() =>
        productionObservability.GetSnapshot();

    public IReadOnlyList<object> GetAccommodationLens(string lensId) =>
        aggregateLenses.GetAccommodationLens(lensId);
}
