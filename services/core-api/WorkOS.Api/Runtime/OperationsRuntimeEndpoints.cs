namespace WorkOS.Api.Runtime;

public static class OperationsRuntimeEndpoints
{
    public static IEndpointRouteBuilder MapOperationsRuntimeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/operations/cases", (CreateOperationCaseRequest request, CanonicalOperationsApiService operations, HttpRequest httpRequest) =>
        {
            var actor = httpRequest.HttpContext.RequireActor();
            if (!TenantMatches(request.TenantId, actor.TenantId))
            {
                return TenantScopeForbidden("operation_case_tenant_mismatch");
            }

            var resolved = operations.CreateCase(string.IsNullOrWhiteSpace(request.TenantId) ? request with { TenantId = actor.TenantId } : request);
            return resolved is null
                ? Results.UnprocessableEntity(new { error = "operation_case_not_resolved", reason = "workspace_or_persisted_case_required" })
                : Results.Ok(resolved);
        });

        app.MapGet("/api/operations/cases/{caseId}", (string caseId, CanonicalOperationsApiService operations, HttpRequest httpRequest) =>
        {
            var actor = httpRequest.HttpContext.RequireActor();
            var resolved = operations.GetCase(caseId);
            return resolved is null || !TenantMatches(resolved.TenantId, actor.TenantId)
                ? Results.NotFound(new { error = "operation_case_not_found", caseId })
                : Results.Ok(resolved);
        });

        app.MapPost("/api/operations/work-items", (CreateWorkItemRequest request, CanonicalOperationsApiService operations, HttpRequest httpRequest) =>
        {
            var actor = httpRequest.HttpContext.RequireActor();
            if (!TenantMatches(request.TenantId, actor.TenantId))
            {
                return TenantScopeForbidden("operation_work_item_tenant_mismatch");
            }

            var resolved = operations.CreateWorkItem(string.IsNullOrWhiteSpace(request.TenantId) ? request with { TenantId = actor.TenantId } : request);
            return resolved is null
                ? Results.UnprocessableEntity(new { error = "operation_work_item_not_resolved", reason = "persisted_process_intent_or_workspace_card_required" })
                : Results.Ok(resolved);
        });

        app.MapGet("/api/operations/work-items", (string? tenantId, string? caseId, CanonicalOperationsApiService operations, HttpRequest httpRequest) =>
        {
            var actor = httpRequest.HttpContext.RequireActor();
            return !TenantMatches(tenantId, actor.TenantId)
                ? TenantScopeForbidden("operation_work_items_tenant_mismatch")
                : Results.Ok(operations.ListWorkItemSurfaces(actor.TenantId, caseId));
        });

        app.MapGet("/api/operations/work-items/{workItemId}", (string workItemId, CanonicalOperationsApiService operations, HttpRequest httpRequest) =>
        {
            var actor = httpRequest.HttpContext.RequireActor();
            var resolved = operations.GetWorkItem(workItemId);
            return resolved is null || !TenantMatches(resolved.TenantId, actor.TenantId)
                ? Results.NotFound(new { error = "operation_work_item_not_found", workItemId })
                : Results.Ok(operations.GetWorkItemSurface(workItemId));
        });

        app.MapPost("/api/operations/work-items/{workItemId}/prepare", (string workItemId, PrepareWorkItemRequest request, CanonicalOperationsApiService operations, HttpRequest httpRequest) =>
        {
            var actor = httpRequest.HttpContext.RequireActor();
            var workItem = operations.GetWorkItem(workItemId);
            if (workItem is not null && !TenantMatches(workItem.TenantId, actor.TenantId))
            {
                return Results.NotFound(new { error = "operation_work_item_not_found", workItemId });
            }

            var prepared = operations.PrepareWorkItem(workItemId, request);
            return prepared is null
                ? Results.NotFound(new { error = "operation_work_item_not_found", workItemId })
                : Results.Ok(prepared);
        });

        app.MapPost("/api/operations/work-items/{workItemId}/confirm", (string workItemId, ConfirmWorkItemRequest request, CanonicalOperationsApiService operations, ProjectionRuntime runtime, HttpRequest httpRequest) =>
        {
            var actor = httpRequest.HttpContext.RequireActor();
            var workItem = operations.GetWorkItem(workItemId);
            if (workItem is not null && !TenantMatches(workItem.TenantId, actor.TenantId))
            {
                return Results.NotFound(new { error = "operation_work_item_not_found", workItemId });
            }

            var token = httpRequest.SessionTokenForOperations();
            var requestId = httpRequest.Headers["X-Request-Id"].FirstOrDefault() ?? httpRequest.HttpContext.TraceIdentifier;
            var device = RuntimeActorAuthorization.TrustedDeviceFromRequest(runtime, actor, request.DeviceId);
            var enrichedRequest = request with
            {
                DeviceTrustStatus = device?.DeviceTrustStatus ?? (string.IsNullOrWhiteSpace(request.DeviceId) ? "not_provided" : "unknown"),
                Surface = string.IsNullOrWhiteSpace(request.Surface) ? "operations-api" : request.Surface
            };
            var result = operations.ConfirmWorkItem(workItemId, enrichedRequest, actor with { SessionToken = token }, requestId);
            return Results.Json(result, statusCode: result.StatusCode);
        });

        app.MapGet("/api/operations/trace/submissions/{submissionId}", (string submissionId, CanonicalOperationsApiService operations, HttpRequest httpRequest) =>
        {
            var actor = httpRequest.HttpContext.RequireActor();
            var trace = operations.GetSubmissionTrace(submissionId);
            return trace is null || !TenantMatches(trace.TenantId, actor.TenantId)
                ? Results.NotFound(new { error = "operation_trace_not_found", submissionId })
                : Results.Ok(trace);
        });

        app.MapGet("/api/operations/trace/work-items/{workItemId}", (string workItemId, CanonicalOperationsApiService operations, HttpRequest httpRequest) =>
        {
            var actor = httpRequest.HttpContext.RequireActor();
            return Results.Ok(operations.GetWorkItemTraces(workItemId)
                .Where(trace => TenantMatches(trace.TenantId, actor.TenantId))
                .ToArray());
        });

        app.MapGet("/api/operations/trace/cases/{caseId}", (string caseId, CanonicalOperationsApiService operations, HttpRequest httpRequest) =>
        {
            var actor = httpRequest.HttpContext.RequireActor();
            return Results.Ok(operations.GetCaseTraces(caseId)
                .Where(trace => TenantMatches(trace.TenantId, actor.TenantId))
                .ToArray());
        });

        return app;
    }

    private static bool TenantMatches(string? requestedTenantId, string actorTenantId) =>
        string.IsNullOrWhiteSpace(requestedTenantId) ||
        requestedTenantId.Equals(actorTenantId, StringComparison.OrdinalIgnoreCase);

    private static IResult TenantScopeForbidden(string reason) =>
        Results.Json(new { error = "business_read_tenant_scope_mismatch", reason }, statusCode: StatusCodes.Status403Forbidden);
}
