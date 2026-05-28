var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowAnyOrigin();
    });
});

var app = builder.Build();

app.UseCors();

app.MapGet("/", () => Results.Redirect("/health"));

app.MapGet("/health", () => new
{
    status = "ok",
    service = "WorkOSNext Core API",
    version = "0.1.0-phase-0-1",
    runtimeTarget = ".NET 10 LTS",
    timestampUtc = DateTimeOffset.UtcNow
});

app.MapGet("/api/bootstrap", () => DemoBootstrap.Create());

app.MapPost("/api/behavior-events", (BehaviorEventRequest request) => Results.Ok(new
{
    accepted = true,
    eventId = $"beh-{Guid.NewGuid():N}",
    eventType = request.EventType,
    objectType = request.ObjectType,
    objectId = request.ObjectId,
    language = request.Language,
    receivedAtUtc = DateTimeOffset.UtcNow
}));

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
            phase = "Phase 0-1",
            principles = new[]
            {
                "Mobile-first",
                "Bilingual-first",
                "Intent-first",
                "Task-first",
                "Human-confirmed",
                "Audit-ready"
            }
        },
        domains = new[]
        {
            new { id = "accommodation", labelKey = "domain.accommodation" },
            new { id = "maintenance", labelKey = "domain.maintenance" }
        },
        routes = new[]
        {
            "/home",
            "/intent",
            "/workbench",
            "/objects/{type}/{id}",
            "/tasks/{taskId}",
            "/confirm/{actionId}",
            "/result/{actionId}",
            "/help"
        }
    };
}
