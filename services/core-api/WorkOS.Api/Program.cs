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
var authOptions = builder.Configuration.GetSection("Auth").Get<RuntimeAuthOptions>() ?? RuntimeAuthOptions.Development;
if (authOptions.PasswordSha256ByUsername.Count == 0)
{
    authOptions = RuntimeAuthOptions.Development;
}
var migrationsPath = builder.Configuration["Migrations:Path"];
var runtime = ProjectionRuntime.OpenPostgres(connectionString, authOptions, migrationsPath);
builder.Services.AddSingleton(runtime);
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

app.MapGet("/api/workspaces", () => runtime.GetAll());

app.MapGet("/api/workspaces/{workspaceId}", (string workspaceId) =>
{
    var workspace = runtime.FindWorkspace(workspaceId);
    return workspace is null ? Results.NotFound(new { error = "workspace_not_found", workspaceId }) : Results.Ok(workspace);
});

app.MapGet("/api/work-queue", () => runtime.GetWorkQueue());
app.MapGet("/api/search", (string? q) => runtime.Search(q));
app.MapGet("/api/lenses/work-queue", () => runtime.GetWorkQueue());
app.MapGet("/api/lenses/search", (string? q) => runtime.Search(q));
app.MapGet("/api/lenses/accommodation/{lensId}", (string lensId) => runtime.GetAccommodationLens(lensId));

app.MapPost("/api/workspaces/{workspaceId}/cards/{cardId}/prepare", (string workspaceId, string cardId) =>
{
    var prepared = runtime.Prepare(workspaceId, cardId);
    return prepared is null ? Results.NotFound(new { error = "card_not_found", workspaceId, cardId }) : Results.Ok(prepared);
});

app.MapPost("/api/workspaces/{workspaceId}/cards/{cardId}/confirm", (string workspaceId, string cardId, ConfirmCardRequest request, HttpRequest httpRequest) =>
{
    var token = httpRequest.Headers["X-WorkOS-Actor-Token"].FirstOrDefault() ?? string.Empty;
    var requestId = httpRequest.Headers["X-Request-Id"].FirstOrDefault() ?? httpRequest.HttpContext.TraceIdentifier;
    var result = runtime.Confirm(workspaceId, cardId, request with { RequestId = requestId }, token);
    return result.Status switch
    {
        ConfirmStatus.NotFound => Results.NotFound(new { error = "card_not_found", workspaceId, cardId }),
        ConfirmStatus.Invalid => Results.BadRequest(new { error = "confirmation_invalid", result.Reason }),
        ConfirmStatus.Forbidden => Results.BadRequest(new { error = "confirmation_forbidden", result.Reason }),
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
            "GET /api/lenses/work-queue",
            "GET /api/lenses/search?q=...",
            "GET /api/workspaces/{workspaceId}/events",
            "GET /api/audit-events",
            "GET /api/outbox",
            "POST /api/projections/process-outbox",
            "POST /api/behavior-events"
        }
    };
}
