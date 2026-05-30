namespace WorkOS.Api.Runtime;

public static class OperationsRuntimeEndpoints
{
    public static IEndpointRouteBuilder MapOperationsRuntimeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/operations/cases", (CreateOperationCaseRequest request, OperationsRuntimeService operations) =>
        {
            var resolved = operations.CreateCase(request);
            return resolved is null
                ? Results.UnprocessableEntity(new { error = "operation_case_not_resolved", reason = "workspace_or_persisted_case_required" })
                : Results.Ok(resolved);
        });

        app.MapGet("/api/operations/cases/{caseId}", (string caseId, OperationsRuntimeService operations) =>
        {
            var resolved = operations.GetCase(caseId);
            return resolved is null
                ? Results.NotFound(new { error = "operation_case_not_found", caseId })
                : Results.Ok(resolved);
        });

        app.MapPost("/api/operations/work-items", (CreateWorkItemRequest request, OperationsRuntimeService operations) =>
        {
            var resolved = operations.CreateWorkItem(request);
            return resolved is null
                ? Results.UnprocessableEntity(new { error = "operation_work_item_not_resolved", reason = "persisted_process_intent_or_workspace_card_required" })
                : Results.Ok(resolved);
        });

        app.MapGet("/api/operations/work-items", (string? tenantId, string? caseId, OperationsRuntimeService operations) =>
            Results.Ok(operations.ListWorkItems(tenantId, caseId)));

        app.MapGet("/api/operations/work-items/{workItemId}", (string workItemId, OperationsRuntimeService operations) =>
        {
            var resolved = operations.GetWorkItem(workItemId);
            return resolved is null
                ? Results.NotFound(new { error = "operation_work_item_not_found", workItemId })
                : Results.Ok(resolved);
        });

        app.MapPost("/api/operations/work-items/{workItemId}/prepare", (string workItemId, PrepareWorkItemRequest request, OperationsRuntimeService operations) =>
        {
            var prepared = operations.PrepareWorkItem(workItemId, request);
            return prepared is null
                ? Results.NotFound(new { error = "operation_work_item_not_found", workItemId })
                : Results.Ok(prepared);
        });

        app.MapPost("/api/operations/work-items/{workItemId}/confirm", (string workItemId, ConfirmWorkItemRequest request, OperationsRuntimeService operations, HttpRequest httpRequest) =>
        {
            var token = httpRequest.Headers["X-WorkOS-Actor-Token"].FirstOrDefault() ?? string.Empty;
            var requestId = httpRequest.Headers["X-Request-Id"].FirstOrDefault() ?? httpRequest.HttpContext.TraceIdentifier;
            var result = operations.ConfirmWorkItem(workItemId, request, token, requestId);
            return Results.Json(result, statusCode: result.StatusCode);
        });

        return app;
    }
}
