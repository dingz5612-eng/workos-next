namespace WorkOS.Api.Runtime;

public sealed class InMemoryProjectionStore : IProjectionStore
{
    private readonly object gate = new();
    private readonly Dictionary<string, RuntimeSession> sessions = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, RuntimeDeviceSession> deviceSessions = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, CardInstanceRecord> cardInstances = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, EvidenceObject> evidenceObjects = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, WorkspaceEvent> eventsByIdempotencyKey = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<OutboxMessage> outbox = new();
    private readonly List<BehaviorEventRecord> behaviorEvents = new();
    private RuntimeState? state;

    public RuntimeState LoadOrSeed(Func<RuntimeState> seedFactory)
    {
        lock (gate)
        {
            state ??= seedFactory();
            return state;
        }
    }

    public void SaveState(RuntimeState state)
    {
        lock (gate) this.state = state;
    }

    public RuntimeSession CreateSession(RuntimeUser user)
    {
        lock (gate)
        {
            var now = DateTimeOffset.UtcNow;
            var session = new RuntimeSession($"sess-{Guid.NewGuid():N}", user.UserId, now, now.AddHours(8));
            sessions[session.Token] = session;
            return session;
        }
    }

    public void RevokeSession(string token, string actorId)
    {
        lock (gate)
        {
            if (sessions.TryGetValue(token, out var session))
            {
                sessions[token] = session with { RevokedAtUtc = DateTimeOffset.UtcNow };
            }
        }
    }

    public RuntimeUser? FindUserBySessionToken(string token)
    {
        lock (gate)
        {
            if (!sessions.TryGetValue(token, out var session) ||
                session.RevokedAtUtc is not null ||
                session.ExpiresAtUtc <= DateTimeOffset.UtcNow)
            {
                return null;
            }

            return state?.Users.FirstOrDefault(user => user.Enabled && user.UserId.Equals(session.UserId, StringComparison.OrdinalIgnoreCase));
        }
    }

    public RuntimeDeviceSession RegisterDeviceSession(RuntimeDeviceSessionRequest request)
    {
        lock (gate)
        {
            var now = DateTimeOffset.UtcNow;
            var session = new RuntimeDeviceSession(
                $"devsess-{Guid.NewGuid():N}",
                request.TenantId,
                request.ActorId,
                request.DeviceId,
                request.DeviceTrustStatus,
                request.UserAgentHash,
                now,
                now,
                null);
            deviceSessions[session.DeviceId] = session;
            return session;
        }
    }

    public RuntimeDeviceSession? FindDeviceSession(string deviceId)
    {
        lock (gate) return deviceSessions.TryGetValue(deviceId, out var session) && session.RevokedAtUtc is null ? session : null;
    }

    public RuntimeDeviceSession? FindDeviceSession(string tenantId, string deviceId)
    {
        lock (gate)
        {
            var session = FindDeviceSession(deviceId);
            return session is not null && session.TenantId.Equals(tenantId, StringComparison.OrdinalIgnoreCase) ? session : null;
        }
    }

    public RuntimeDeviceSession? RevokeDeviceSession(string deviceId, string actorId)
    {
        lock (gate)
        {
            if (!deviceSessions.TryGetValue(deviceId, out var session))
            {
                return null;
            }

            var revoked = session with { RevokedAtUtc = DateTimeOffset.UtcNow };
            deviceSessions[deviceId] = revoked;
            return revoked;
        }
    }

    public WorkspaceEvent? FindEventByIdempotencyKey(string idempotencyKey)
    {
        lock (gate) return eventsByIdempotencyKey.TryGetValue(idempotencyKey, out var workspaceEvent) ? workspaceEvent : null;
    }

    public void AppendAuditEventAndOutbox(WorkspaceEvent workspaceEvent, string idempotencyKey)
    {
        lock (gate)
        {
            if (eventsByIdempotencyKey.ContainsKey(idempotencyKey))
            {
                return;
            }

            eventsByIdempotencyKey[idempotencyKey] = workspaceEvent;
            state?.Events.Add(workspaceEvent);
            outbox.Add(new OutboxMessage(
                $"out-{Guid.NewGuid():N}",
                workspaceEvent.EventId,
                workspaceEvent.WorkspaceId,
                workspaceEvent.CardId,
                workspaceEvent.EventType,
                workspaceEvent.CorrelationId,
                workspaceEvent.CausationId,
                workspaceEvent.RequestId,
                workspaceEvent.OccurredAtUtc,
                null,
                workspaceEvent));
        }
    }

    public void ApplySliceAggregate(WorkspaceEvent workspaceEvent)
    {
    }

    public WorkspaceEvent? CommitConfirmEvents(IReadOnlyList<IdempotentWorkspaceEvent> events)
    {
        lock (gate)
        {
            WorkspaceEvent? first = null;
            foreach (var item in events)
            {
                AppendAuditEventAndOutbox(item.Event, item.IdempotencyKey);
                first ??= item.Event;
            }

            return first;
        }
    }

    public CardInstanceRecord PrepareCardInstance(string workspaceId, string cardId, PrepareCardRequest request)
    {
        lock (gate)
        {
            var now = DateTimeOffset.UtcNow;
            var id = string.IsNullOrWhiteSpace(request.CardInstanceId)
                ? $"ci-{Guid.NewGuid():N}"
                : request.CardInstanceId;
            var record = new CardInstanceRecord(
                id,
                workspaceId,
                cardId,
                request.AggregateRef,
                request.SubmissionId,
                null,
                "prepared",
                now,
                now);
            cardInstances[id] = record;
            return record;
        }
    }

    public CardInstanceRecord? FindCardInstance(string cardInstanceId)
    {
        lock (gate) return cardInstances.TryGetValue(cardInstanceId, out var record) ? record : null;
    }

    public EvidenceObject CreateEvidenceDraft(EvidenceDraftRequest request, string actorId)
    {
        lock (gate)
        {
            var evidence = new EvidenceObject(
                string.IsNullOrWhiteSpace(request.EvidenceId) ? $"ev-{Guid.NewGuid():N}" : request.EvidenceId,
                request.TenantId ?? RuntimeActorAuthorization.DefaultTenantId,
                request.WorkspaceId,
                request.CardId,
                request.CardInstanceId,
                request.SubmissionId,
                request.RequirementId,
                "draft",
                Array.Empty<EvidenceAttachment>(),
                DateTimeOffset.UtcNow,
                null,
                null,
                null,
                null,
                null);
            evidenceObjects[evidence.EvidenceId] = evidence;
            return evidence;
        }
    }

    public EvidenceObject AttachEvidence(string evidenceId, EvidenceAttachmentRequest request, string actorId)
    {
        lock (gate)
        {
            var evidence = RequiredEvidence(evidenceId);
            var attachment = new EvidenceAttachment(
                $"att-{Guid.NewGuid():N}",
                evidenceId,
                request.FileName,
                request.ContentType,
                request.ContentSha256,
                request.SizeBytes,
                DateTimeOffset.UtcNow);
            var updated = evidence with
            {
                Status = "attached",
                Attachments = evidence.Attachments.Concat(new[] { attachment }).ToArray(),
                AttachedAtUtc = attachment.AttachedAtUtc
            };
            evidenceObjects[evidenceId] = updated;
            return updated;
        }
    }

    public EvidenceObject VerifyEvidence(string evidenceId, EvidenceDecisionRequest request)
    {
        lock (gate)
        {
            var updated = RequiredEvidence(evidenceId) with { Status = "verified", VerifiedAtUtc = DateTimeOffset.UtcNow };
            evidenceObjects[evidenceId] = updated;
            return updated;
        }
    }

    public EvidenceObject RejectEvidence(string evidenceId, EvidenceDecisionRequest request)
    {
        lock (gate)
        {
            var updated = RequiredEvidence(evidenceId) with { Status = "rejected", RejectedAtUtc = DateTimeOffset.UtcNow };
            evidenceObjects[evidenceId] = updated;
            return updated;
        }
    }

    public IReadOnlyList<EvidenceObject> GetEvidenceObjects(string? evidenceId = null)
    {
        lock (gate)
        {
            return string.IsNullOrWhiteSpace(evidenceId)
                ? evidenceObjects.Values.ToArray()
                : evidenceObjects.Values.Where(item => item.EvidenceId.Equals(evidenceId, StringComparison.OrdinalIgnoreCase)).ToArray();
        }
    }

    public EvidenceSignedUrlResponse CreateEvidenceSignedUrl(string evidenceId, EvidenceSignedUrlRequest request)
    {
        lock (gate)
        {
            var evidence = RequiredEvidence(evidenceId);
            var attachment = evidence.Attachments.FirstOrDefault()
                ?? throw new InvalidOperationException("evidence_attachment_missing");
            return new EvidenceSignedUrlResponse(
                evidenceId,
                attachment.AttachmentId,
                $"memory://evidence/{evidenceId}/{attachment.AttachmentId}",
                (request.NowUtc ?? DateTimeOffset.UtcNow).AddSeconds(request.TtlSeconds),
                $"audit-{Guid.NewGuid():N}");
        }
    }

    public GovernanceExportResult RequestGovernanceExport(GovernanceExportRequest request) =>
        new(true, "ready", request.ExportType, "real_browser_in_memory_export", Array.Empty<string>(), $"memory://exports/{request.ExportType}", (request.NowUtc ?? DateTimeOffset.UtcNow).AddMinutes(15), $"audit-{Guid.NewGuid():N}");

    public ConfirmResult? ValidateEvidenceForConfirm(string workspaceId, string cardId, ConfirmCardRequest request, IReadOnlyList<EvidenceRequirement> requirements) =>
        null;

    public BankStatementImportPreview PreviewBankStatementImport(BankStatementImportRequest request) =>
        throw new NotSupportedException("real_browser_in_memory_bank_statement_preview_not_supported");

    public BankStatementImportResult ConfirmBankStatementImport(BankStatementImportRequest request, string actorId) =>
        throw new NotSupportedException("real_browser_in_memory_bank_statement_confirm_not_supported");

    public ReconciliationCandidateGenerationResult GenerateReconciliationMatchCandidates(ReconciliationCandidateGenerationRequest request) =>
        throw new NotSupportedException("real_browser_in_memory_reconciliation_generation_not_supported");

    public IReadOnlyList<ReconciliationMatchCandidate> GetReconciliationMatchCandidates(string tenantId, string? bankTransactionId = null) =>
        Array.Empty<ReconciliationMatchCandidate>();

    public ReconciliationManualMatchResult AcceptReconciliationMatchCandidate(string candidateId, string tenantId, string actorId) =>
        throw new NotSupportedException("real_browser_in_memory_reconciliation_accept_not_supported");

    public ReconciliationCandidateDecisionResult RejectReconciliationMatchCandidate(string candidateId, string tenantId, string actorId, string reason) =>
        throw new NotSupportedException("real_browser_in_memory_reconciliation_reject_not_supported");

    public ReconciliationMismatchResult MarkBankTransactionMismatch(string bankTransactionId, ReconciliationMismatchRequest request, string actorId) =>
        throw new NotSupportedException("real_browser_in_memory_reconciliation_mismatch_not_supported");

    public ReconciliationTransactionDecisionResult IgnoreBankTransaction(string bankTransactionId, string tenantId, string actorId, string reason) =>
        throw new NotSupportedException("real_browser_in_memory_reconciliation_ignore_not_supported");

    public ReconciliationMismatchDetectionResult DetectReconciliationMismatches(ReconciliationMismatchDetectionRequest request) =>
        throw new NotSupportedException("real_browser_in_memory_reconciliation_detection_not_supported");

    public ReconciliationCaseRecord CreateReconciliationCaseForMismatch(string tenantId, string mismatchId, string actorId) =>
        throw new NotSupportedException("real_browser_in_memory_reconciliation_case_not_supported");

    public LedgerCorrectionRequestResult RequestLedgerCorrection(LedgerCorrectionRequestCommand command) =>
        throw new NotSupportedException("real_browser_in_memory_correction_request_not_supported");

    public LedgerCorrectionDecisionResult ApproveLedgerCorrection(LedgerCorrectionApproveCommand command) =>
        throw new NotSupportedException("real_browser_in_memory_correction_approve_not_supported");

    public LedgerCorrectionDecisionResult RejectLedgerCorrection(LedgerCorrectionRejectCommand command) =>
        throw new NotSupportedException("real_browser_in_memory_correction_reject_not_supported");

    public LedgerCorrectionApplyResult ApplyLedgerCorrection(LedgerCorrectionApplyCommand command) =>
        throw new NotSupportedException("real_browser_in_memory_correction_apply_not_supported");

    public DepositLedgerState GetDepositLedgerState(string depositId) =>
        new(depositId, 0m, 0m, 0m, 0m, 0m);

    public PaymentLedgerState GetPaymentLedgerState(string paymentId) =>
        new(paymentId, 0m, 0m);

    public IReadOnlyList<OutboxMessage> ClaimPendingOutboxMessages(string workerId, int take = 50, TimeSpan? lease = null)
    {
        lock (gate)
        {
            var now = DateTimeOffset.UtcNow;
            var claimUntil = now.Add(lease ?? TimeSpan.FromMinutes(2));
            var claimed = outbox
                .Where(item => item.ProcessedAtUtc is null && item.DeadLetteredAtUtc is null && (item.ClaimExpiresAtUtc is null || item.ClaimExpiresAtUtc <= now))
                .Take(take)
                .ToArray();
            foreach (var message in claimed)
            {
                var index = outbox.FindIndex(item => item.MessageId.Equals(message.MessageId, StringComparison.OrdinalIgnoreCase));
                if (index >= 0)
                {
                    outbox[index] = message with { ClaimedBy = workerId, ClaimedAtUtc = now, ClaimExpiresAtUtc = claimUntil, AttemptCount = message.AttemptCount + 1 };
                }
            }

            return claimed;
        }
    }

    public IReadOnlyList<OutboxMessage> GetOutboxMessages()
    {
        lock (gate) return outbox.ToArray();
    }

    public void MarkOutboxProcessed(string messageId, string workerId)
    {
        lock (gate)
        {
            var index = outbox.FindIndex(item => item.MessageId.Equals(messageId, StringComparison.OrdinalIgnoreCase));
            if (index >= 0)
            {
                outbox[index] = outbox[index] with { ProcessedAtUtc = DateTimeOffset.UtcNow, ClaimedBy = workerId };
            }
        }
    }

    public void MarkOutboxFailed(string messageId, string workerId, string error, int maxRetries = 5)
    {
        lock (gate)
        {
            var index = outbox.FindIndex(item => item.MessageId.Equals(messageId, StringComparison.OrdinalIgnoreCase));
            if (index >= 0)
            {
                var message = outbox[index];
                outbox[index] = message with
                {
                    ClaimedBy = workerId,
                    LastError = error,
                    DeadLetteredAtUtc = message.AttemptCount >= maxRetries ? DateTimeOffset.UtcNow : null
                };
            }
        }
    }

    public CheckoutServiceProcessManagerResult ApplyCheckoutServiceProcessRules(WorkspaceEvent workspaceEvent) =>
        CheckoutServiceProcessManagerResult.Empty;

    public IReadOnlyList<ProcessRunRecord> GetProcessRuns(string? tenantId = null) => Array.Empty<ProcessRunRecord>();

    public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) => Array.Empty<ProcessWorkItemIntentRecord>();

    public IReadOnlyList<ProcessRequestEventIntentRecord> GetProcessRequestEventIntents(string? tenantId = null) => Array.Empty<ProcessRequestEventIntentRecord>();

    public void AppendBehaviorEvent(BehaviorEventRecord behaviorEvent)
    {
        lock (gate) behaviorEvents.Add(behaviorEvent);
    }

    public IReadOnlyList<WorkspaceEvent> GetAuditEvents(string? workspaceId = null)
    {
        lock (gate)
        {
            var events = state?.Events ?? new List<WorkspaceEvent>();
            return string.IsNullOrWhiteSpace(workspaceId)
                ? events.ToArray()
                : events.Where(item => item.WorkspaceId.Equals(workspaceId, StringComparison.OrdinalIgnoreCase)).ToArray();
        }
    }

    public IReadOnlyList<BehaviorEventRecord> GetBehaviorEvents()
    {
        lock (gate) return behaviorEvents.ToArray();
    }

    public IReadOnlyList<object> GetAccommodationLens(string lensId) => Array.Empty<object>();

    private EvidenceObject RequiredEvidence(string evidenceId) =>
        evidenceObjects.TryGetValue(evidenceId, out var evidence)
            ? evidence
            : throw new InvalidOperationException("evidence_not_found");
}
