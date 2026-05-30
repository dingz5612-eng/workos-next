using WorkOS.Api.Runtime;

var builder = WebApplication.CreateBuilder(args);
var corsOptions = builder.Configuration.GetSection("Cors").Get<RuntimeCorsOptions>() ?? new RuntimeCorsOptions();
if (corsOptions.AllowedOrigins.Length == 0)
{
    corsOptions = new RuntimeCorsOptions();
}

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins(corsOptions.AllowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var connectionString = builder.Configuration.GetConnectionString("WorkOSRuntime")
    ?? "Host=localhost;Port=54329;Database=workosnext;Username=workosnext;Password=workosnext_dev";
var configuredAuthOptions = builder.Configuration.GetSection("Auth").Get<RuntimeAuthOptions>();
var authOptions = configuredAuthOptions ?? (builder.Environment.IsDevelopment() ? RuntimeAuthOptions.Development : new RuntimeAuthOptions { PasswordSha256ByUsername = new Dictionary<string, string>() });
if (authOptions.PasswordSha256ByUsername.Count == 0 && builder.Environment.IsDevelopment())
{
    authOptions = RuntimeAuthOptions.Development;
}

if (!builder.Environment.IsDevelopment() &&
    (authOptions.PasswordSha256ByUsername.Count == 0 || RuntimeAuthOptions.UsesDevelopmentPasswords(authOptions)))
{
    throw new InvalidOperationException("Production runtime requires configured auth hashes and must not use development auth defaults.");
}
if (!builder.Environment.IsDevelopment())
{
    authOptions.RequireTrustedDeviceForHighRiskActions = true;
}
var migrationsPath = builder.Configuration["Migrations:Path"];
var runtime = ProjectionRuntime.OpenPostgres(connectionString, authOptions, migrationsPath);
var controlPlaneReadStore = new ControlPlaneReadStore(connectionString);
var operationsFactStore = new PostgresOperationsStore(connectionString);
builder.Services.AddSingleton(runtime);
builder.Services.AddSingleton(controlPlaneReadStore);
builder.Services.AddSingleton(new OperationsRuntimeService(
    runtime,
    new PostgresOperationsCommandSubmissionStore(connectionString)));
builder.Services.AddSingleton<OperationsWriteStore>(operationsFactStore);
builder.Services.AddSingleton<OperationsReadStore>(operationsFactStore);
builder.Services.AddSingleton<CommandEnvelopeBuilder>();
builder.Services.AddSingleton<CommandSubmissionService>();
builder.Services.AddSingleton<IdempotencyService>();
builder.Services.AddSingleton<PayloadHashService>();
builder.Services.AddSingleton(_ => new SliceCommandHandlerRouter()
    .Register(CanonicalOperationsApiService.ConfirmCommandType, CanonicalOperationsApiService.HandleConfirmCommand));
builder.Services.AddSingleton<OperationsUnitOfWork>();
builder.Services.AddSingleton<CanonicalOperationsApiService>();
builder.Services.AddSingleton<LegacyWorkItemResolver>();
builder.Services.AddSingleton<LegacyCompatibilityPolicy>();
builder.Services.AddSingleton<LegacyCardRequestMapper>();
builder.Services.AddSingleton<LegacyCardResponseMapper>();
builder.Services.AddSingleton<LegacyWorkspaceCardAdapter>();
builder.Services.AddHostedService<ProjectionOutboxWorker>();

var app = builder.Build();

app.UseCors();

app.MapGet("/", () => Results.Redirect("/health"));

app.MapGet("/health", () => new
{
    status = "ok",
    service = "WorkOSNext Core API",
    version = "0.13.0-backend-runtime",
    runtimeTarget = ".NET 10 LTS",
    persistence = "postgresql",
    timestampUtc = DateTimeOffset.UtcNow
});

app.MapGet("/api/bootstrap", () => DemoBootstrap.Create());
app.MapPost("/api/auth/login", (LoginRequest request) =>
{
    var result = runtime.Login(request);
    return result is null ? Results.Unauthorized() : Results.Ok(result);
});
app.MapPost("/api/auth/sessions/{token}/revoke", (string token, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.Headers["X-WorkOS-Actor-Id"].FirstOrDefault() ?? "runtime";
    runtime.RevokeSession(token, actorId);
    return Results.Ok(new { revoked = true, token });
});
app.MapPost("/api/device-sessions", (RuntimeDeviceSessionRequest request) => Results.Ok(runtime.RegisterDeviceSession(request)));
app.MapPost("/api/device-sessions/{deviceId}/revoke", (string deviceId, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.Headers["X-WorkOS-Actor-Id"].FirstOrDefault() ?? "runtime";
    var revoked = runtime.RevokeDeviceSession(deviceId, actorId);
    return revoked is null ? Results.NotFound(new { error = "device_session_not_found", deviceId }) : Results.Ok(revoked);
});

app.MapGet("/api/workspaces", () => runtime.GetAll());

app.MapGet("/api/workspaces/{workspaceId}", (string workspaceId) =>
{
    var workspace = runtime.FindWorkspace(workspaceId);
    return workspace is null ? Results.NotFound(new { error = "workspace_not_found", workspaceId }) : Results.Ok(workspace);
});

app.MapGet("/api/work-queue", () => runtime.GetWorkQueue());
app.MapGet("/api/search", (string? q) => runtime.Search(q));
app.MapGet("/api/lenses/home-surface", () => runtime.GetHomeSurface());
app.MapGet("/api/lenses/work-queue", () => runtime.GetWorkQueue());
app.MapGet("/api/lenses/search", (string? q) => runtime.Search(q));
app.MapGet("/api/lenses/learning-catalog", () => runtime.GetLearningCatalog());
app.MapGet("/api/lenses/accommodation/{lensId}", (string lensId) => runtime.GetAccommodationLens(lensId));

app.MapGet("/api/control-plane/releases", () => controlPlaneReadStore.GetReleases());
app.MapGet("/api/control-plane/releases/{releaseId}", (string releaseId) =>
{
    var release = controlPlaneReadStore.GetRelease(releaseId);
    return release is null ? Results.NotFound(new { error = "release_not_found", releaseId }) : Results.Ok(release);
});
app.MapGet("/api/control-plane/gate-results/{gateResultId}", (string gateResultId) =>
{
    var gateResult = controlPlaneReadStore.GetGateResult(gateResultId);
    return gateResult is null ? Results.NotFound(new { error = "gate_result_not_found", gateResultId }) : Results.Ok(gateResult);
});
app.MapGet("/api/control-plane/shadow-compare-reports/{id}", (string id) =>
{
    var report = controlPlaneReadStore.GetShadowCompareReport(id);
    return report is null ? Results.NotFound(new { error = "shadow_compare_report_not_found", id }) : Results.Ok(report);
});
app.MapGet("/api/control-plane/invariant-checks", (string releaseId) => controlPlaneReadStore.GetInvariantChecks(releaseId));
app.MapGet("/api/control-plane/rollback-instructions/{id}", (string id) =>
{
    var instruction = controlPlaneReadStore.GetRollbackInstruction(id);
    return instruction is null ? Results.NotFound(new { error = "rollback_instruction_not_found", id }) : Results.Ok(instruction);
});

app.MapGet("/api/evidence", (string? evidenceId) => runtime.GetEvidenceObjects(evidenceId));
app.MapPost("/api/evidence/drafts", (EvidenceDraftRequest request, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.Headers["X-WorkOS-Actor-Id"].FirstOrDefault() ?? "runtime";
    return Results.Ok(runtime.CreateEvidenceDraft(request, actorId));
});
app.MapPost("/api/evidence/{evidenceId}/attachments", (string evidenceId, EvidenceAttachmentRequest request, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.Headers["X-WorkOS-Actor-Id"].FirstOrDefault() ?? "runtime";
    try
    {
        return Results.Ok(runtime.AttachEvidence(evidenceId, request, actorId));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("evidence_file_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "evidence_file_invalid", reason = ex.Message });
    }
});
app.MapPost("/api/evidence/{evidenceId}/verify", (string evidenceId, EvidenceDecisionRequest request) => Results.Ok(runtime.VerifyEvidence(evidenceId, request)));
app.MapPost("/api/evidence/{evidenceId}/reject", (string evidenceId, EvidenceDecisionRequest request) => Results.Ok(runtime.RejectEvidence(evidenceId, request)));
app.MapGet("/api/evidence/{evidenceId}/signed-url", (string evidenceId, string? actorId, string? deviceId, int? ttlSeconds) =>
{
    try
    {
        return Results.Ok(runtime.CreateEvidenceSignedUrl(evidenceId, new EvidenceSignedUrlRequest(
            actorId ?? "runtime",
            deviceId ?? string.Empty,
            ttlSeconds ?? RuntimeSignedUrlPolicy.MaxTtlSeconds)));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("evidence_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.Json(new { error = "evidence_access_forbidden", reason = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
    }
});

app.MapPost("/api/reconciliation/bank-statement-imports/preview", (BankStatementImportRequest request) =>
    Results.Ok(runtime.PreviewBankStatementImport(request)));
app.MapPost("/api/reconciliation/bank-statement-imports", (BankStatementImportRequest request, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.Headers["X-WorkOS-Actor-Id"].FirstOrDefault() ?? request.ImportedBy ?? "runtime";
    try
    {
        return Results.Ok(runtime.ConfirmBankStatementImport(request, actorId));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("bank_import_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "bank_statement_import_invalid", reason = ex.Message });
    }
});

app.MapPost("/api/reconciliation/match-candidates/generate", (ReconciliationCandidateGenerationRequest request) =>
    Results.Ok(runtime.GenerateReconciliationMatchCandidates(request)));
app.MapPost("/api/reconciliation/mismatches/detect", (ReconciliationMismatchDetectionRequest request) =>
{
    try
    {
        return Results.Ok(runtime.DetectReconciliationMismatches(request));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("reconciliation_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "reconciliation_detection_invalid", reason = ex.Message });
    }
});
app.MapGet("/api/reconciliation/match-candidates", (string tenantId, string? bankTransactionId) =>
    Results.Ok(runtime.GetReconciliationMatchCandidates(tenantId, bankTransactionId)));
app.MapPost("/api/reconciliation/match-candidates/{candidateId}/accept", (string candidateId, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.Headers["X-WorkOS-Actor-Id"].FirstOrDefault() ?? "runtime";
    try
    {
        return Results.Ok(runtime.AcceptReconciliationMatchCandidate(candidateId, actorId));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("reconciliation_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "reconciliation_match_invalid", reason = ex.Message });
    }
});
app.MapPost("/api/reconciliation/match-candidates/{candidateId}/reject", (string candidateId, ReconciliationMatchDecisionRequest request, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.Headers["X-WorkOS-Actor-Id"].FirstOrDefault() ?? "runtime";
    try
    {
        return Results.Ok(runtime.RejectReconciliationMatchCandidate(candidateId, actorId, request.Reason ?? "manual_rejected"));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("reconciliation_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "reconciliation_reject_invalid", reason = ex.Message });
    }
});
app.MapPost("/api/reconciliation/bank-transactions/{bankTransactionId}/mismatch", (string bankTransactionId, ReconciliationMismatchRequest request, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.Headers["X-WorkOS-Actor-Id"].FirstOrDefault() ?? "runtime";
    try
    {
        return Results.Ok(runtime.MarkBankTransactionMismatch(bankTransactionId, request, actorId));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("reconciliation_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "reconciliation_mismatch_invalid", reason = ex.Message });
    }
});
app.MapPost("/api/reconciliation/bank-transactions/{bankTransactionId}/ignore", (string bankTransactionId, ReconciliationTransactionDecisionRequest request, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.Headers["X-WorkOS-Actor-Id"].FirstOrDefault() ?? "runtime";
    try
    {
        return Results.Ok(runtime.IgnoreBankTransaction(bankTransactionId, request.TenantId, actorId, request.Reason ?? "manual_ignored"));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("reconciliation_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "reconciliation_ignore_invalid", reason = ex.Message });
    }
});

app.MapPost("/api/correction-center/ledger-correction-requests", (LedgerCorrectionRequestCommand request) =>
{
    try
    {
        return Results.Ok(runtime.RequestLedgerCorrection(request));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("correction_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "ledger_correction_invalid", reason = ex.Message });
    }
});
app.MapPost("/api/correction-center/ledger-correction-requests/{correctionRequestId}/approve", (string correctionRequestId, LedgerCorrectionApproveRequest request) =>
{
    try
    {
        return Results.Ok(runtime.ApproveLedgerCorrection(new LedgerCorrectionApproveCommand(
            request.TenantId,
            correctionRequestId,
            request.ApproverId,
            request.Note,
            request.ActorRole,
            request.ActorCapabilities,
            request.DeviceId,
            request.DeviceTrustStatus,
            request.Surface ?? "pc")));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("correction_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "ledger_correction_approval_invalid", reason = ex.Message });
    }
});
app.MapPost("/api/correction-center/ledger-correction-requests/{correctionRequestId}/reject", (string correctionRequestId, LedgerCorrectionRejectRequest request) =>
{
    try
    {
        return Results.Ok(runtime.RejectLedgerCorrection(new LedgerCorrectionRejectCommand(
            request.TenantId,
            correctionRequestId,
            request.ApproverId,
            request.Reason)));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("correction_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "ledger_correction_rejection_invalid", reason = ex.Message });
    }
});
app.MapPost("/api/correction-center/ledger-correction-requests/{correctionRequestId}/apply", (string correctionRequestId, LedgerCorrectionApplyRequest request) =>
{
    try
    {
        return Results.Ok(runtime.ApplyLedgerCorrection(new LedgerCorrectionApplyCommand(
            request.TenantId,
            correctionRequestId,
            request.ActorId,
            request.WorkItemId,
            request.AdjustmentAmount,
            request.Reason)));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("correction_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "ledger_correction_apply_invalid", reason = ex.Message });
    }
});

app.MapPost("/api/pc-governance/exports/{exportType}", (string exportType, GovernanceExportRequest request) =>
{
    var result = runtime.RequestGovernanceExport(request with { ExportType = exportType });
    return result.Allowed
        ? Results.Ok(result)
        : Results.Json(result, statusCode: StatusCodes.Status403Forbidden);
});

app.MapOperationsRuntimeEndpoints();

app.MapPost("/api/workspaces/{workspaceId}/cards/{cardId}/prepare", (string workspaceId, string cardId, PrepareCardRequest? request, LegacyWorkspaceCardAdapter operations) =>
{
    var prepared = operations.PrepareWorkspaceCard(workspaceId, cardId, request);
    return prepared.StatusCode switch
    {
        StatusCodes.Status404NotFound => Results.NotFound(prepared.Payload),
        _ => Results.Ok(prepared.Payload)
    };
});

app.MapPost("/api/workspaces/{workspaceId}/cards/{cardId}/confirm", (string workspaceId, string cardId, ConfirmCardRequest request, HttpRequest httpRequest, LegacyWorkspaceCardAdapter operations) =>
{
    var token = httpRequest.Headers["X-WorkOS-Actor-Token"].FirstOrDefault() ?? string.Empty;
    var requestId = httpRequest.Headers["X-Request-Id"].FirstOrDefault() ?? httpRequest.HttpContext.TraceIdentifier;
    var result = operations.ConfirmWorkspaceCard(workspaceId, cardId, request, token, requestId);
    return result.StatusCode switch
    {
        StatusCodes.Status404NotFound => Results.NotFound(result.Payload),
        StatusCodes.Status400BadRequest => Results.BadRequest(result.Payload),
        StatusCodes.Status401Unauthorized => Results.Unauthorized(),
        StatusCodes.Status403Forbidden => Results.Json(result.Payload, statusCode: StatusCodes.Status403Forbidden),
        StatusCodes.Status500InternalServerError => Results.Json(result.Payload, statusCode: StatusCodes.Status500InternalServerError),
        StatusCodes.Status409Conflict => Results.Json(result.Payload, statusCode: StatusCodes.Status409Conflict),
        StatusCodes.Status422UnprocessableEntity => Results.UnprocessableEntity(result.Payload),
        _ => Results.Ok(result.Payload)
    };
});

app.MapGet("/api/workspaces/{workspaceId}/events", (string workspaceId) => runtime.GetAuditEvents(workspaceId));
app.MapGet("/api/audit-events", () => runtime.GetAuditEvents());
app.MapGet("/api/outbox", () => runtime.GetOutboxMessages());
app.MapPost("/api/projections/process-outbox", () => new { processed = runtime.ProcessPendingOutbox() });
app.MapGet("/api/behavior-events", () => runtime.GetBehaviorEvents());
app.MapGet("/api/observability/runtime", () => runtime.Observe());

app.MapPost("/api/behavior-events", (BehaviorEventRequest request) =>
{
    var record = new BehaviorEventRecord(
        $"beh-{Guid.NewGuid():N}",
        request.EventType,
        request.ObjectType,
        request.ObjectId,
        request.Language,
        request.Source,
        DateTimeOffset.UtcNow);
    runtime.AppendBehaviorEvent(record);
    return Results.Ok(new { accepted = true, record.EventId, record.EventType, receivedAtUtc = record.OccurredAtUtc });
});

app.Run();

internal sealed record BehaviorEventRequest(
    string EventType,
    string? ObjectType,
    string? ObjectId,
    string Language,
    string? Source);

internal sealed record LedgerCorrectionApproveRequest(
    string TenantId,
    string ApproverId,
    string? Note,
    string? ActorRole,
    IReadOnlyList<string>? ActorCapabilities,
    string? DeviceId,
    string? DeviceTrustStatus,
    string? Surface);

internal sealed record LedgerCorrectionRejectRequest(
    string TenantId,
    string ApproverId,
    string Reason);

internal sealed record LedgerCorrectionApplyRequest(
    string TenantId,
    string ActorId,
    string WorkItemId,
    decimal? AdjustmentAmount,
    string? Reason);

internal static class DemoBootstrap
{
    public static object Create() => new
    {
        supportedLanguages = new[] { "zh-CN", "ru-RU" },
        product = new
        {
            name = "WorkOSNext",
            phase = "WON-13",
            principles = new[]
            {
                "Mobile-first",
                "Bilingual-first",
                "Intent-first",
            "Projection-centered",
            "PostgreSQL-backed",
            "Human-confirmed",
            "Audit-ready"
            }
        },
        runtimeApis = new[]
        {
            "GET /api/workspaces",
            "GET /api/workspaces/{workspaceId}",
            "POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare",
            "POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm",
            "GET /api/work-queue",
            "GET /api/search?q=...",
            "GET /api/lenses/home-surface",
            "GET /api/lenses/work-queue",
            "GET /api/lenses/search?q=...",
            "GET /api/lenses/learning-catalog",
            "GET /api/control-plane/releases",
            "GET /api/control-plane/releases/{releaseId}",
            "GET /api/control-plane/gate-results/{gateResultId}",
            "GET /api/control-plane/shadow-compare-reports/{id}",
            "GET /api/control-plane/invariant-checks?releaseId=...",
            "GET /api/control-plane/rollback-instructions/{id}",
            "GET /api/evidence",
            "POST /api/evidence/drafts",
            "POST /api/evidence/{evidenceId}/attachments",
            "POST /api/evidence/{evidenceId}/verify",
            "POST /api/evidence/{evidenceId}/reject",
            "POST /api/reconciliation/bank-statement-imports/preview",
            "POST /api/reconciliation/bank-statement-imports",
            "POST /api/reconciliation/match-candidates/generate",
            "POST /api/reconciliation/mismatches/detect",
            "GET /api/reconciliation/match-candidates?tenantId=...",
            "POST /api/reconciliation/match-candidates/{candidateId}/accept",
            "POST /api/reconciliation/match-candidates/{candidateId}/reject",
            "POST /api/reconciliation/bank-transactions/{bankTransactionId}/mismatch",
            "POST /api/reconciliation/bank-transactions/{bankTransactionId}/ignore",
            "POST /api/correction-center/ledger-correction-requests",
            "POST /api/correction-center/ledger-correction-requests/{correctionRequestId}/approve",
            "POST /api/correction-center/ledger-correction-requests/{correctionRequestId}/reject",
            "POST /api/correction-center/ledger-correction-requests/{correctionRequestId}/apply",
            "POST /api/operations/cases",
            "GET /api/operations/cases/{caseId}",
            "POST /api/operations/work-items",
            "GET /api/operations/work-items",
            "GET /api/operations/work-items/{workItemId}",
            "POST /api/operations/work-items/{workItemId}/prepare",
            "POST /api/operations/work-items/{workItemId}/confirm",
            "GET /api/operations/trace/submissions/{submissionId}",
            "GET /api/operations/trace/work-items/{workItemId}",
            "GET /api/operations/trace/cases/{caseId}",
            "GET /api/workspaces/{workspaceId}/events",
            "GET /api/audit-events",
            "GET /api/outbox",
            "POST /api/projections/process-outbox",
            "POST /api/behavior-events"
        }
    };
}
