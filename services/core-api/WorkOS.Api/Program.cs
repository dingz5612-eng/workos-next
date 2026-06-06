using Microsoft.AspNetCore.Authentication;
using WorkOS.Api.Runtime;

var builder = WebApplication.CreateBuilder(args);
var corsOptions = builder.Configuration.GetSection("Cors").Get<RuntimeCorsOptions>() ?? new RuntimeCorsOptions();
if (corsOptions.AllowedOrigins.Length == 0 && builder.Environment.IsDevelopment())
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
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var configuredConnectionString = builder.Configuration.GetConnectionString("WorkOSRuntime");
var connectionString = !string.IsNullOrWhiteSpace(configuredConnectionString)
    ? configuredConnectionString
    : builder.Environment.IsDevelopment()
        ? "Host=localhost;Port=54329;Database=workosnext;Username=workosnext;Password=workosnext_dev"
        : string.Empty;
var configuredAuthOptions = builder.Configuration.GetSection("Auth").Get<RuntimeAuthOptions>();
var authOptions = configuredAuthOptions ?? (builder.Environment.IsDevelopment() ? RuntimeAuthOptions.Development : new RuntimeAuthOptions { PasswordSha256ByUsername = new Dictionary<string, string>() });
if (authOptions.PasswordSha256ByUsername.Count == 0 && builder.Environment.IsDevelopment())
{
    authOptions = RuntimeAuthOptions.Development;
}

if (!builder.Environment.IsDevelopment())
{
    authOptions.RequireTrustedDeviceForHighRiskActions = true;
}
var migrationOptions = builder.Configuration.GetSection("Migrations").Get<RuntimeMigrationOptions>() ?? new RuntimeMigrationOptions();
var allowedHosts = builder.Configuration["AllowedHosts"];
RuntimeStartupValidator.ThrowIfInvalid(
    builder.Environment.EnvironmentName,
    authOptions,
    connectionString,
    corsOptions,
    allowedHosts,
    migrationOptions);
var runMigrations = RuntimeStartupValidator.ShouldRunMigrations(builder.Environment.EnvironmentName, migrationOptions);
var runtime = ProjectionRuntime.OpenPostgres(connectionString, authOptions, migrationOptions.Path, runMigrations);
var controlPlaneReadStore = new ControlPlaneReadStore(connectionString);
var operationsFactStore = new PostgresOperationsStore(connectionString);
var operationsOutboxProjectionStore = new OperationsOutboxProjectionStore(connectionString);
builder.Services.AddSingleton(runtime);
builder.Services.AddSingleton(controlPlaneReadStore);
builder.Services.AddSingleton(operationsOutboxProjectionStore);
builder.Services.AddSingleton(new OperationsRuntimeService(
    runtime,
    new PostgresOperationsCaseStore(connectionString),
    new PostgresOperationsWorkItemStore(connectionString)));
builder.Services.AddSingleton<OperationsWriteStore>(operationsFactStore);
builder.Services.AddSingleton<OperationsReadStore>(operationsFactStore);
builder.Services.AddSingleton<CommandEnvelopeBuilder>();
builder.Services.AddSingleton<CommandSubmissionService>();
builder.Services.AddSingleton<IdempotencyService>();
builder.Services.AddSingleton<PayloadHashService>();
builder.Services.AddSingleton(WorkItemDefinitionRegistryService.LoadDefault());
builder.Services.AddSingleton<AdmissionKernelService>();
builder.Services.AddSingleton<ProjectionWorkspaceSearchAdapter>();
builder.Services.AddSingleton<SearchKernelService>();
builder.Services.AddSingleton(_ => new SliceCommandHandlerRouter()
    .Register(CanonicalOperationsApiService.ConfirmCommandDefinition, CanonicalOperationsApiService.HandleConfirmCommand));
builder.Services.AddSingleton<OperationsUnitOfWork>();
builder.Services.AddSingleton<CanonicalOperationsApiService>();
builder.Services.AddHostedService<OperationsOutboxProjectionWorker>();
builder.Services.AddHostedService<ProjectionOutboxWorker>();
builder.Services
    .AddAuthentication(RuntimeActorAuthenticationDefaults.Scheme)
    .AddScheme<AuthenticationSchemeOptions, RuntimeActorAuthenticationHandler>(
        RuntimeActorAuthenticationDefaults.Scheme,
        _ => { });
builder.Services.AddAuthorization(RuntimeActorAuthorization.Configure);

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseWorkOSRuntimeAccessPolicies();
app.UseAuthorization();

app.MapGet("/", () => Results.Redirect("/health"));

app.MapGet("/live", () => new
{
    status = "alive",
    service = "WorkOSNext Core API",
    timestampUtc = DateTimeOffset.UtcNow
});

app.MapGet("/ready", () =>
{
    var readiness = RuntimeReadiness.Check(connectionString);
    return readiness.Status == "ready"
        ? Results.Ok(readiness)
        : Results.Json(readiness, statusCode: StatusCodes.Status503ServiceUnavailable);
});

app.MapGet("/health", () => new
{
    status = RuntimeReadiness.Check(connectionString).Status == "ready" ? "ok" : "degraded",
    service = "WorkOSNext Core API",
    version = "0.13.0-backend-runtime",
    runtimeTarget = ".NET 10 LTS",
    persistence = "postgresql",
    readiness = RuntimeReadiness.Check(connectionString),
    timestampUtc = DateTimeOffset.UtcNow
});

app.MapGet("/api/bootstrap", () => DemoBootstrap.Create());
app.MapPost("/api/auth/login", (LoginRequest request, HttpContext httpContext) =>
{
    var result = runtime.Login(request);
    if (result is null)
    {
        return Results.Unauthorized();
    }

    var csrf = $"csrf-{Guid.NewGuid():N}";
    var cookieOptions = new CookieOptions
    {
        HttpOnly = true,
        Secure = !app.Environment.IsDevelopment(),
        SameSite = SameSiteMode.Lax,
        Expires = result.ExpiresAtUtc
    };
    httpContext.Response.Cookies.Append(RuntimeActorAuthenticationDefaults.SessionCookieName, result.Token, cookieOptions);
    httpContext.Response.Cookies.Append(RuntimeActorAuthenticationDefaults.CsrfCookieName, csrf, new CookieOptions
    {
        HttpOnly = false,
        Secure = !app.Environment.IsDevelopment(),
        SameSite = SameSiteMode.Lax,
        Expires = result.ExpiresAtUtc
    });

    return app.Environment.IsDevelopment()
        ? Results.Ok(result)
        : Results.Ok(new
        {
            result.Authenticated,
            result.ActorId,
            result.ActorType,
            result.DisplayName,
            result.Role,
            result.UserId,
            result.TenantId,
            result.Department,
            result.BusinessLine,
            result.Roles,
            result.Capabilities,
            Session = result.Session is null ? null : result.Session with { Token = string.Empty },
            result.Status,
            result.ExpiresAtUtc
        });
});
app.MapPost("/api/auth/logout", (HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    runtime.RevokeSession(actor.SessionToken, actor.ActorId);
    return Results.Ok(new { revoked = true, actor.ActorId });
});
app.MapPost("/api/auth/sessions/{token}/revoke", (string token, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.HttpContext.RequireActor().ActorId;
    runtime.RevokeSession(token, actorId);
    return Results.Ok(new { revoked = true, token });
});
app.MapPost("/api/device-sessions", (RuntimeDeviceSessionRequest request, HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    if (!string.Equals(request.ActorId, actor.ActorId, StringComparison.OrdinalIgnoreCase))
    {
        return Results.Json(new { error = "device_actor_mismatch" }, statusCode: StatusCodes.Status403Forbidden);
    }

    return Results.Ok(runtime.RegisterDeviceSession(request));
});
app.MapGet("/api/device-sessions", (HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    return Results.Ok(runtime.ListDeviceSessions(actor.TenantId));
});
app.MapPost("/api/device-sessions/{deviceId}/revoke", (string deviceId, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.HttpContext.RequireActor().ActorId;
    var revoked = runtime.RevokeDeviceSession(deviceId, actorId);
    return revoked is null ? Results.NotFound(new { error = "device_session_not_found", deviceId }) : Results.Ok(revoked);
});
app.MapGet("/api/pc-governance/account-users", (HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    return Results.Ok(runtime.ListAccountUsers(actor.TenantId));
});
app.MapPost("/api/pc-governance/account-users", (AccountUserCreateRequest request, HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    try
    {
        var created = runtime.CreateAccountUser(request, actor);
        return created is null
            ? Results.UnprocessableEntity(new { error = "account_user_create_failed" })
            : Results.Ok(created);
    }
    catch (InvalidOperationException ex)
    {
        return Results.UnprocessableEntity(new { error = ex.Message });
    }
});
app.MapPost("/api/pc-governance/account-users/{userId}/disable", (string userId, HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    var disabled = runtime.DisableAccountUser(userId, actor);
    return disabled is null ? Results.NotFound(new { error = "account_user_not_found", userId }) : Results.Ok(disabled);
});
app.MapPost("/api/pc-governance/account-users/{userId}/reset-password", (string userId, AccountUserPasswordResetRequest request, HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    var updated = runtime.ResetAccountUserPassword(userId, request, actor);
    return updated is null ? Results.NotFound(new { error = "account_user_not_found", userId }) : Results.Ok(updated);
});
app.MapGet("/api/pc-governance/account-audit", (HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    return Results.Ok(runtime.ListAccountAudit(actor.TenantId));
});

app.MapGet("/api/workspaces", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetAll();
});

app.MapGet("/api/workspaces/{workspaceId}", (string workspaceId, HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    var workspace = runtime.FindWorkspace(workspaceId);
    return workspace is null ? Results.NotFound(new { error = "workspace_not_found", workspaceId }) : Results.Ok(workspace);
});

app.MapGet("/api/work-queue", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetWorkQueue();
});
app.MapGet("/api/search", (string? q, string? language, HttpRequest httpRequest, SearchKernelService searchKernel) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    return searchKernel.Search(runtime, q, actor, language);
});
app.MapGet("/api/lenses/home-surface", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetHomeSurface();
});
app.MapGet("/api/lenses/work-queue", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetWorkQueue();
});
app.MapGet("/api/lenses/search", (string? q, string? language, HttpRequest httpRequest, SearchKernelService searchKernel) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    return searchKernel.Search(runtime, q, actor, language);
});
app.MapGet("/api/lenses/learning-catalog", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetLearningCatalog();
});
app.MapGet("/api/lenses/accommodation/{lensId}", (string lensId, HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetAccommodationLens(lensId);
});

app.MapGet("/api/control-plane/releases", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return controlPlaneReadStore.GetReleases();
});
app.MapGet("/api/control-plane/releases/{releaseId}", (string releaseId, HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    var release = controlPlaneReadStore.GetRelease(releaseId);
    return release is null ? Results.NotFound(new { error = "release_not_found", releaseId }) : Results.Ok(release);
});
app.MapGet("/api/control-plane/gate-results/{gateResultId}", (string gateResultId, HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    var gateResult = controlPlaneReadStore.GetGateResult(gateResultId);
    return gateResult is null ? Results.NotFound(new { error = "gate_result_not_found", gateResultId }) : Results.Ok(gateResult);
});
app.MapGet("/api/control-plane/shadow-compare-reports/{id}", (string id, HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    var report = controlPlaneReadStore.GetShadowCompareReport(id);
    return report is null ? Results.NotFound(new { error = "shadow_compare_report_not_found", id }) : Results.Ok(report);
});
app.MapGet("/api/control-plane/invariant-checks", (string releaseId, HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return controlPlaneReadStore.GetInvariantChecks(releaseId);
});
app.MapGet("/api/control-plane/rollback-instructions/{id}", (string id, HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    var instruction = controlPlaneReadStore.GetRollbackInstruction(id);
    return instruction is null ? Results.NotFound(new { error = "rollback_instruction_not_found", id }) : Results.Ok(instruction);
});

app.MapGet("/api/evidence", (string? evidenceId, HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetEvidenceObjects(evidenceId);
});
app.MapPost("/api/evidence/drafts", (EvidenceDraftRequest request, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.HttpContext.RequireActor().ActorId;
    return Results.Ok(runtime.CreateEvidenceDraft(request, actorId));
});
app.MapPost("/api/evidence/{evidenceId}/attachments", (string evidenceId, EvidenceAttachmentRequest request, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.HttpContext.RequireActor().ActorId;
    try
    {
        return Results.Ok(runtime.AttachEvidence(evidenceId, request, actorId));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("evidence_file_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "evidence_file_invalid", reason = ex.Message });
    }
});
app.MapPost("/api/evidence/{evidenceId}/verify", (string evidenceId, EvidenceDecisionRequest request, HttpRequest httpRequest) =>
    Results.Ok(runtime.VerifyEvidence(evidenceId, request with { ActorId = httpRequest.HttpContext.RequireActor().ActorId })));
app.MapPost("/api/evidence/{evidenceId}/reject", (string evidenceId, EvidenceDecisionRequest request, HttpRequest httpRequest) =>
    Results.Ok(runtime.RejectEvidence(evidenceId, request with { ActorId = httpRequest.HttpContext.RequireActor().ActorId })));
app.MapGet("/api/evidence/{evidenceId}/signed-url", (string evidenceId, string? tenantId, string? deviceId, int? ttlSeconds, HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    if (!string.IsNullOrWhiteSpace(tenantId) &&
        !string.Equals(tenantId, actor.TenantId, StringComparison.OrdinalIgnoreCase))
    {
        return Results.Json(new { error = "evidence_access_forbidden", reason = "evidence_tenant_scope_mismatch" }, statusCode: StatusCodes.Status403Forbidden);
    }

    tenantId ??= actor.TenantId;
    try
    {
        return Results.Ok(runtime.CreateEvidenceSignedUrl(evidenceId, new EvidenceSignedUrlRequest(
            actor.ActorId,
            deviceId ?? string.Empty,
            ttlSeconds ?? RuntimeSignedUrlPolicy.MaxTtlSeconds,
            TenantId: tenantId)));
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
    var actorId = httpRequest.HttpContext.RequireActor().ActorId;
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
app.MapGet("/api/reconciliation/match-candidates", (string? tenantId, string? bankTransactionId, HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    if (!string.IsNullOrWhiteSpace(tenantId) &&
        !string.Equals(tenantId, actor.TenantId, StringComparison.OrdinalIgnoreCase))
    {
        return Results.Json(new { error = "business_read_tenant_scope_mismatch", reason = "reconciliation_match_candidates_tenant_mismatch" }, statusCode: StatusCodes.Status403Forbidden);
    }

    return Results.Ok(runtime.GetReconciliationMatchCandidates(actor.TenantId, bankTransactionId));
});
app.MapPost("/api/reconciliation/match-candidates/{candidateId}/accept", (string candidateId, HttpRequest httpRequest) =>
{
    var actorId = httpRequest.HttpContext.RequireActor().ActorId;
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
    var actorId = httpRequest.HttpContext.RequireActor().ActorId;
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
    var actorId = httpRequest.HttpContext.RequireActor().ActorId;
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
    var actorId = httpRequest.HttpContext.RequireActor().ActorId;
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
app.MapPost("/api/correction-center/ledger-correction-requests/{correctionRequestId}/approve", (string correctionRequestId, LedgerCorrectionApproveRequest request, HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    var device = RuntimeActorAuthorization.TrustedDeviceFromRequest(runtime, actor, request.DeviceId);
    try
    {
        return Results.Ok(runtime.ApproveLedgerCorrection(new LedgerCorrectionApproveCommand(
            request.TenantId,
            correctionRequestId,
            actor.ActorId,
            request.Note,
            actor.Role,
            actor.Capabilities,
            request.DeviceId,
            device?.DeviceTrustStatus ?? "unknown",
            "pc")));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("correction_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "ledger_correction_approval_invalid", reason = ex.Message });
    }
});
app.MapPost("/api/correction-center/ledger-correction-requests/{correctionRequestId}/reject", (string correctionRequestId, LedgerCorrectionRejectRequest request, HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    try
    {
        return Results.Ok(runtime.RejectLedgerCorrection(new LedgerCorrectionRejectCommand(
            request.TenantId,
            correctionRequestId,
            actor.ActorId,
            request.Reason)));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("correction_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "ledger_correction_rejection_invalid", reason = ex.Message });
    }
});
app.MapPost("/api/correction-center/ledger-correction-requests/{correctionRequestId}/apply", (string correctionRequestId, LedgerCorrectionApplyRequest request, HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    var device = RuntimeActorAuthorization.TrustedDeviceFromRequest(runtime, actor, request.DeviceId);
    try
    {
        return Results.Ok(runtime.ApplyLedgerCorrection(new LedgerCorrectionApplyCommand(
            request.TenantId,
            correctionRequestId,
            actor.ActorId,
            request.WorkItemId,
            request.AdjustmentAmount,
            request.Reason,
            actor.Role,
            actor.Capabilities,
            request.DeviceId,
            device?.DeviceTrustStatus ?? "unknown",
            request.Surface ?? "pc",
            request.EvidenceRefs,
            request.AdmissionDecisionRef)));
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("correction_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "ledger_correction_apply_invalid", reason = ex.Message });
    }
});

app.MapPost("/api/pc-governance/exports/{exportType}", (string exportType, GovernanceExportRequest request, HttpRequest httpRequest) =>
{
    var actor = httpRequest.HttpContext.RequireActor();
    var device = RuntimeActorAuthorization.TrustedDeviceFromRequest(runtime, actor, request.DeviceId);
    var result = runtime.RequestGovernanceExport(request with
    {
        ExportType = exportType,
        ActorId = actor.ActorId,
        ActorRole = actor.Role,
        ActorCapabilities = actor.Capabilities,
        DeviceTrustStatus = device?.DeviceTrustStatus ?? "unknown",
        Surface = "pc",
        TenantId = actor.TenantId
    });
    return result.Allowed
        ? Results.Ok(result)
        : Results.Json(result, statusCode: StatusCodes.Status403Forbidden);
});

app.MapOperationsRuntimeEndpoints();

app.MapPost("/api/operations/workspaces/start", (StartWorkspaceRequest request, HttpRequest httpRequest, ProjectionRuntime runtime, CanonicalOperationsApiService operations) =>
{
    if (!DormitoryTemplateWorkspaceIds().Contains(request.TemplateWorkspaceId, StringComparer.Ordinal))
    {
        return Results.Json(new { error = "workspace_template_not_allowed", request.TemplateWorkspaceId }, statusCode: StatusCodes.Status404NotFound);
    }

    return StartOperationsWorkspace(
        request,
        request.TemplateWorkspaceId,
        httpRequest,
        runtime,
        operations,
        AllowedWorkspaceStartRoles(request.TemplateWorkspaceId),
        "admission_role_forbidden:operation_workspace_start");
});

app.MapGet("/api/workspaces/{workspaceId}/events", (string workspaceId, HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetAuditEvents(workspaceId);
});
app.MapGet("/api/audit-events", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetAuditEvents();
});
app.MapGet("/api/outbox", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetOutboxMessages();
});
app.MapPost("/api/projections/process-outbox", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return new { processed = runtime.ProcessPendingOutbox() };
});
app.MapGet("/api/behavior-events", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.GetBehaviorEvents();
});
app.MapGet("/api/observability/runtime", (HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
    return runtime.Observe();
});

app.MapPost("/api/mobile/drafts", (MobileDraftRequest request, HttpRequest httpRequest) =>
    AppendExperienceEvent(
        runtime,
        httpRequest,
        "mobile.draft.saved",
        "draft",
        FirstNonEmpty(request.DraftId, request.WorkspaceId, request.CardId),
        request.Language,
        "mobile_experience_write"));

app.MapPost("/api/mobile/client-events", (MobileClientEventRequest request, HttpRequest httpRequest) =>
    AppendExperienceEvent(
        runtime,
        httpRequest,
        request.EventType,
        request.ObjectType,
        request.ObjectId,
        request.Language,
        FirstNonEmpty(request.Source, "mobile_experience_write")));

app.MapPost("/api/mobile/recent-objects", (MobileRecentObjectRequest request, HttpRequest httpRequest) =>
    AppendExperienceEvent(
        runtime,
        httpRequest,
        "mobile.recent_object.recorded",
        request.ObjectType,
        FirstNonEmpty(request.ObjectId, request.WorkspaceId, request.CardId),
        request.Language,
        "mobile_experience_write"));

app.MapPost("/api/behavior-events", (BehaviorEventRequest request, HttpRequest httpRequest) =>
{
    httpRequest.HttpContext.RequireActor();
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

static string[] DormitoryTemplateWorkspaceIds() =>
    new[]
    {
        "W-STAY-RESOURCE",
        "W-STAY-LEAD-RESERVATION",
        "W-STAY-CHECKIN",
        "W-STAY-LIFECYCLE",
        "W-STAY-DEPOSIT-LEDGER",
        "W-STAY-PAYMENT-LEDGER",
        "W-STAY-SERVICE-TASK",
        "W-STAY-CHECKOUT-SETTLEMENT",
        "W-STAY-EXPENSE-LEDGER",
        "W-STAY-PERIOD-ANALYTICS"
    };

static string[] AllowedWorkspaceStartRoles(string templateWorkspaceId) =>
    templateWorkspaceId switch
    {
        "W-STAY-DEPOSIT-LEDGER" or "W-STAY-PAYMENT-LEDGER" or "W-STAY-EXPENSE-LEDGER" => new[] { "operator", "manager", "admin", "finance" },
        _ => new[] { "operator", "manager", "admin" }
    };

static IResult StartOperationsWorkspace(
    StartWorkspaceRequest request,
    string templateWorkspaceId,
    HttpRequest httpRequest,
    ProjectionRuntime runtime,
    CanonicalOperationsApiService operations,
    IReadOnlyList<string> allowedRoles,
    string forbiddenReason)
{
    var actor = httpRequest.HttpContext.RequireActor();
    if (!allowedRoles.Contains(actor.Role, StringComparer.OrdinalIgnoreCase))
    {
        return Results.Json(new { error = "operation_workspace_start_forbidden", reason = forbiddenReason }, statusCode: StatusCodes.Status403Forbidden);
    }

    try
    {
        var workspace = runtime.StartWorkspace(templateWorkspaceId);
        var started = operations.StartWorkspaceCase(workspace, templateWorkspaceId, actor, request.AnchorPayload, request.AnchorQuery);
        return Results.Ok(new
        {
            started.Workspace,
            started.OperationCase,
            started.WorkItem,
            started.OperationWorkItems,
            projection = runtime.GetAll()
        });
    }
    catch (InvalidOperationException ex) when (ex.Message.StartsWith("operation_workspace_start_", StringComparison.OrdinalIgnoreCase))
    {
        return Results.UnprocessableEntity(new { error = "operation_workspace_start_failed", reason = ex.Message, templateWorkspaceId });
    }
}

static IResult AppendExperienceEvent(
    ProjectionRuntime runtime,
    HttpRequest httpRequest,
    string eventType,
    string? objectType,
    string? objectId,
    string? language,
    string? source)
{
    var actor = httpRequest.HttpContext.RequireActor();
    var record = new BehaviorEventRecord(
        $"beh-{Guid.NewGuid():N}",
        eventType,
        objectType,
        objectId,
        string.IsNullOrWhiteSpace(language) ? "zh-CN" : language,
        source,
        DateTimeOffset.UtcNow);
    runtime.AppendBehaviorEvent(record);
    return Results.Ok(new
    {
        accepted = true,
        actor.TenantId,
        actor.ActorId,
        record.EventId,
        record.EventType,
        receivedAtUtc = record.OccurredAtUtc
    });
}

static string? FirstNonEmpty(params string?[] values) =>
    values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

internal sealed record BehaviorEventRequest(
    string EventType,
    string? ObjectType,
    string? ObjectId,
    string Language,
    string? Source);

internal sealed record MobileDraftRequest(
    string? DraftId,
    string? WorkspaceId,
    string? CardId,
    string? Language,
    string? PayloadHash);

internal sealed record MobileClientEventRequest(
    string EventType,
    string? ObjectType,
    string? ObjectId,
    string? Language,
    string? Source);

internal sealed record MobileRecentObjectRequest(
    string? ObjectType,
    string? ObjectId,
    string? WorkspaceId,
    string? CardId,
    string? Language);

internal sealed record StartWorkspaceRequest(
    string TemplateWorkspaceId,
    string? AnchorQuery = null,
    IReadOnlyDictionary<string, string>? AnchorPayload = null);

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
    string? Reason,
    string? DeviceId,
    string? Surface,
    IReadOnlyList<string>? EvidenceRefs,
    string? AdmissionDecisionRef);

internal static class DemoBootstrap
{
    public static object Create() => new
    {
        supportedLanguages = new[] { "zh-CN", "ru-RU", "ky-KG" },
        product = new
        {
            name = "WorkOSNext",
            phase = "WON-13",
            principles = new[]
            {
                "Mobile-first",
                "Trilingual-first",
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
            "POST /api/operations/workspaces/start",
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
