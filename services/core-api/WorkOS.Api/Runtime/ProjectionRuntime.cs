using System.Diagnostics;
using WorkOS.Api.Slices.Policies;

namespace WorkOS.Api.Runtime;

public sealed class ProjectionRuntime
{
    private readonly object gate = new();
    private readonly IProjectionStore store;
    private readonly RuntimeQueryService queryService = new();
    private readonly LensQueryService lensQueryService;
    private readonly ActionRuntimeService actionRuntimeService;
    private readonly AuthSessionService authSessionService;
    private readonly OutboxProjector outboxProjector;
    private readonly Dictionary<string, int> failedConfirmReasons = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<long> confirmLatencyMs = new();
    private RuntimeState state;

    private ProjectionRuntime(IProjectionStore store, RuntimeAuthOptions authOptions)
    {
        this.store = store;
        var searchProjectionService = new SearchProjectionService();
        lensQueryService = new LensQueryService(searchProjectionService);
        authSessionService = new AuthSessionService(store, authOptions);
        outboxProjector = new OutboxProjector(store);
        actionRuntimeService = new ActionRuntimeService(
            store,
            new CardConfirmationPolicy(),
            queryService,
            SliceRuntimeCapabilityGate.LoadDefault(),
            outboxProjector,
            authOptions.RequireTrustedDeviceForHighRiskActions);
        state = store.LoadOrSeed(ProjectionSeed.Create);
    }

    public static ProjectionRuntime OpenPostgres(
        string connectionString,
        RuntimeAuthOptions? authOptions = null,
        string? migrationsPath = null) =>
        new(new PostgresProjectionStore(connectionString, migrationsPath), authOptions ?? new RuntimeAuthOptions());

    public ProjectionEnvelope GetAll()
    {
        lock (gate) return queryService.Envelope(state);
    }

    public WorkspaceProjection? FindWorkspace(string workspaceId)
    {
        lock (gate) return queryService.FindWorkspace(state, workspaceId);
    }

    public IReadOnlyList<object> GetWorkQueue()
    {
        lock (gate) return lensQueryService.GetWorkQueue(state);
    }

    public IReadOnlyList<object> GetHomeSurface()
    {
        lock (gate) return lensQueryService.GetHomeSurface(state);
    }

    public IReadOnlyList<object> Search(string? q)
    {
        lock (gate) return lensQueryService.Search(state, q);
    }

    public IReadOnlyList<object> GetLearningCatalog()
    {
        lock (gate) return lensQueryService.GetLearningCatalog(state);
    }

    public IReadOnlyList<object> GetAccommodationLens(string lensId)
    {
        lock (gate) return store.GetAccommodationLens(lensId);
    }

    public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null)
    {
        lock (gate) return actionRuntimeService.Prepare(state, workspaceId, cardId, request);
    }

    public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
    {
        lock (gate)
        {
            var stopwatch = Stopwatch.StartNew();
            var result = actionRuntimeService.Confirm(state, workspaceId, cardId, request, actorToken);
            stopwatch.Stop();
            confirmLatencyMs.Add(stopwatch.ElapsedMilliseconds);
            if (confirmLatencyMs.Count > 1024)
            {
                confirmLatencyMs.RemoveRange(0, confirmLatencyMs.Count - 1024);
            }

            if (result.Status is not ConfirmStatus.Confirmed and not ConfirmStatus.Duplicate)
            {
                var key = string.IsNullOrWhiteSpace(result.Reason) ? result.Status.ToString() : result.Reason;
                failedConfirmReasons[key] = failedConfirmReasons.GetValueOrDefault(key) + 1;
            }

            return result;
        }
    }

    public EvidenceObject CreateEvidenceDraft(EvidenceDraftRequest request, string actorId)
    {
        lock (gate) return store.CreateEvidenceDraft(request, actorId);
    }

    public EvidenceObject AttachEvidence(string evidenceId, EvidenceAttachmentRequest request, string actorId)
    {
        lock (gate) return store.AttachEvidence(evidenceId, request, actorId);
    }

    public EvidenceSignedUrlResponse CreateEvidenceSignedUrl(string evidenceId, EvidenceSignedUrlRequest request)
    {
        lock (gate) return store.CreateEvidenceSignedUrl(evidenceId, request);
    }

    public EvidenceObject VerifyEvidence(string evidenceId, EvidenceDecisionRequest request)
    {
        lock (gate) return store.VerifyEvidence(evidenceId, request);
    }

    public EvidenceObject RejectEvidence(string evidenceId, EvidenceDecisionRequest request)
    {
        lock (gate) return store.RejectEvidence(evidenceId, request);
    }

    public IReadOnlyList<EvidenceObject> GetEvidenceObjects(string? evidenceId = null) => store.GetEvidenceObjects(evidenceId);

    public BankStatementImportPreview PreviewBankStatementImport(BankStatementImportRequest request)
    {
        lock (gate) return store.PreviewBankStatementImport(request);
    }

    public BankStatementImportResult ConfirmBankStatementImport(BankStatementImportRequest request, string actorId)
    {
        lock (gate) return store.ConfirmBankStatementImport(request, actorId);
    }

    public ReconciliationCandidateGenerationResult GenerateReconciliationMatchCandidates(ReconciliationCandidateGenerationRequest request)
    {
        lock (gate) return store.GenerateReconciliationMatchCandidates(request);
    }

    public IReadOnlyList<ReconciliationMatchCandidate> GetReconciliationMatchCandidates(string tenantId, string? bankTransactionId = null)
    {
        lock (gate) return store.GetReconciliationMatchCandidates(tenantId, bankTransactionId);
    }

    public ReconciliationManualMatchResult AcceptReconciliationMatchCandidate(string candidateId, string actorId)
    {
        lock (gate) return store.AcceptReconciliationMatchCandidate(candidateId, actorId);
    }

    public ReconciliationCandidateDecisionResult RejectReconciliationMatchCandidate(string candidateId, string actorId, string reason)
    {
        lock (gate) return store.RejectReconciliationMatchCandidate(candidateId, actorId, reason);
    }

    public ReconciliationMismatchResult MarkBankTransactionMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId)
    {
        lock (gate) return store.MarkBankTransactionMismatch(bankTransactionId, request, actorId);
    }

    public ReconciliationTransactionDecisionResult IgnoreBankTransaction(string bankTransactionId, string tenantId, string actorId, string reason)
    {
        lock (gate) return store.IgnoreBankTransaction(bankTransactionId, tenantId, actorId, reason);
    }

    public ReconciliationMismatchDetectionResult DetectReconciliationMismatches(ReconciliationMismatchDetectionRequest request)
    {
        lock (gate) return store.DetectReconciliationMismatches(request);
    }

    public ReconciliationCaseRecord CreateReconciliationCaseForMismatch(string tenantId, string mismatchId, string actorId)
    {
        lock (gate) return store.CreateReconciliationCaseForMismatch(tenantId, mismatchId, actorId);
    }

    public LedgerCorrectionRequestResult RequestLedgerCorrection(LedgerCorrectionRequestCommand command)
    {
        lock (gate) return store.RequestLedgerCorrection(command);
    }

    public LedgerCorrectionDecisionResult ApproveLedgerCorrection(LedgerCorrectionApproveCommand command)
    {
        lock (gate) return store.ApproveLedgerCorrection(command);
    }

    public LedgerCorrectionDecisionResult RejectLedgerCorrection(LedgerCorrectionRejectCommand command)
    {
        lock (gate) return store.RejectLedgerCorrection(command);
    }

    public LedgerCorrectionApplyResult ApplyLedgerCorrection(LedgerCorrectionApplyCommand command)
    {
        lock (gate) return store.ApplyLedgerCorrection(command);
    }

    public object? Login(LoginRequest request)
    {
        lock (gate) return authSessionService.Login(state, request);
    }

    public void RevokeSession(string token, string actorId)
    {
        lock (gate) store.RevokeSession(token, actorId);
    }

    public RuntimeDeviceSession RegisterDeviceSession(RuntimeDeviceSessionRequest request)
    {
        lock (gate) return store.RegisterDeviceSession(request);
    }

    public RuntimeDeviceSession? RevokeDeviceSession(string deviceId, string actorId)
    {
        lock (gate) return store.RevokeDeviceSession(deviceId, actorId);
    }

    public GovernanceExportResult RequestGovernanceExport(GovernanceExportRequest request)
    {
        lock (gate) return store.RequestGovernanceExport(request);
    }

    public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null) => store.GetAuditEvents(workspaceId);

    public IReadOnlyList<OutboxMessage> GetOutboxMessages() => store.GetOutboxMessages();

    public IReadOnlyList<ProcessRunRecord> GetProcessRuns(string? tenantId = null) => store.GetProcessRuns(tenantId);

    public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) => store.GetProcessWorkItemIntents(tenantId);

    public IReadOnlyList<ProcessRequestEventIntentRecord> GetProcessRequestEventIntents(string? tenantId = null) => store.GetProcessRequestEventIntents(tenantId);

    public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents() => store.GetBehaviorEvents();

    public RuntimeObservation Observe()
    {
        lock (gate)
        {
            var events = store.GetAuditEvents();
            var outbox = store.GetOutboxMessages();
            var behaviorEvents = store.GetBehaviorEvents();
            var lastAuditAt = events.OrderByDescending(item => item.OccurredAtUtc).FirstOrDefault()?.OccurredAtUtc;
            var activeExceptions = ArchitectureExceptionCatalog.LoadDefault().ActiveRuleIds();
            var surfacePolicies = RuntimeSurfacePolicyCatalog.LoadDefault();
            var projectionLagSeconds = lastAuditAt is null ? 0 : Math.Max(0, Convert.ToInt64((DateTimeOffset.UtcNow - lastAuditAt.Value).TotalSeconds));
            var databaseMetrics = store is PostgresProjectionStore postgresStore
                ? postgresStore.GetProductionObservabilityDatabaseSnapshot()
                : ProductionObservabilityDatabaseSnapshot.Empty;
            var productionMetrics = ProductionObservabilityMetricsBuilder.Build(
                outbox,
                behaviorEvents,
                failedConfirmReasons,
                confirmLatencyMs,
                databaseMetrics,
                projectionLagSeconds,
                DateTimeOffset.UtcNow);
            return new RuntimeObservation(
                "WorkOSNext Core API",
                "0.13.0-backend-runtime",
                "postgresql",
                state.Workspaces.Count,
                state.Workspaces.Sum(workspace => workspace.Cards.Count),
                events.Count,
                outbox.Count,
                outbox.Count(message => message.ProcessedAtUtc is null && message.DeadLetteredAtUtc is null),
                outbox.Count(message => message.DeadLetteredAtUtc is not null),
                behaviorEvents.Count,
                lastAuditAt,
                projectionLagSeconds,
                new Dictionary<string, int>(failedConfirmReasons, StringComparer.OrdinalIgnoreCase),
                surfacePolicies.MissingSurfaceCoverageCount(state),
                0,
                state.SchemaVersion,
                activeExceptions.Count,
                activeExceptions,
                productionMetrics);
        }
    }

    public BehaviorEventRecord AppendBehaviorEvent(BehaviorEventRecord behaviorEvent)
    {
        store.AppendBehaviorEvent(behaviorEvent);
        return behaviorEvent;
    }

    public int ProcessPendingOutbox()
    {
        lock (gate)
        {
            return outboxProjector.ProcessPending(state);
        }
    }
}
