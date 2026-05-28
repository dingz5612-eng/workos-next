using WorkOS.Api.Runtime;
using Npgsql;
using System.Text.Json;

var connectionString = Environment.GetEnvironmentVariable("WORKOS_TEST_CONNECTION")
    ?? "Host=localhost;Port=54329;Database=workosnext;Username=workosnext;Password=workosnext_dev";

ResetPostgres(connectionString);

{
    var runtime = ProjectionRuntime.OpenPostgres(connectionString);
    var projection = runtime.GetAll();
    var cards = projection.Workspaces.SelectMany(workspace => workspace.Cards).ToArray();

    ValidateProjectionContractFiles();
    ValidateGeneratedDtos();
    ValidateSliceManifest(projection);
    ValidateProjectionEnvelopeAgainstContract(projection);

    Assert(projection.Workspaces.Count == 8, $"expected 8 workspaces, got {projection.Workspaces.Count}");
    Assert(cards.Length == 32, $"expected 32 cards, got {cards.Length}");

    foreach (var card in cards)
    {
        Assert(card.Fields.Business.Count > 0, $"{card.Id} missing business fields");
        Assert(card.Fields.System.Count > 0, $"{card.Id} missing system fields");
        Assert(card.Fields.Analytics.Count > 0, $"{card.Id} missing analytics fields");
        Assert(card.Evidence.Count > 0, $"{card.Id} missing evidence");
        Assert(card.Checks.Count > 0, $"{card.Id} missing system checks");
        Assert(card.Events.Count > 0, $"{card.Id} missing events");
        Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnPrepare), $"{card.Id} missing prepare transition");
        Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnConfirm), $"{card.Id} missing confirm transition");
        Assert(card.Confirmation.ForbiddenForAi, $"{card.Id} must forbid AI confirmation");
    }

    var resource = projection.Workspaces.Single(workspace => workspace.Id == "W-STAY-RESOURCE");
    AssertSequence(resource, "room", "bed", "activate");

    var checkin = projection.Workspaces.Single(workspace => workspace.Id == "W-STAY-CHECKIN");
    AssertSequence(checkin, "application", "stayOrder", "deposit", "finance", "checkin");

    var prepared = runtime.Prepare("W-STAY-RESOURCE", "room");
    Assert(prepared is not null, "prepare should return room card payload");
    Assert(runtime.Login(new LoginRequest("operator", "wrong-password")) is null, "login must reject invalid password");

    var operatorToken = LoginToken(runtime, "operator");
    var financeToken = LoginToken(runtime, "finance");
    var aiToken = LoginToken(runtime, "ai");

    var missingToken = runtime.Confirm("W-STAY-CHECKIN", "finance", Human("missing-token-finance"), "");
    Assert(missingToken.Status == ConfirmStatus.Forbidden, "confirm must require a trusted backend session token");
    var missingIdempotencyKey = runtime.Confirm("W-STAY-RESOURCE", "room", new ConfirmCardRequest("zh-CN", "", new Dictionary<string, string>(), Array.Empty<string>()), operatorToken);
    Assert(missingIdempotencyKey.Status == ConfirmStatus.Invalid, "confirm must require idempotency key");

    var aiFinance = runtime.Confirm("W-STAY-CHECKIN", "finance", Human("ai-finance"), aiToken);
    Assert(aiFinance.Status == ConfirmStatus.Forbidden, "AI finance confirmation must be rejected");
    Assert(aiFinance.Reason?.StartsWith("ai_confirmation_forbidden:") == true, "AI rejection must use stable policy decision code");

    var operatorFinance = runtime.Confirm("W-STAY-CHECKIN", "finance", Human("operator-finance"), operatorToken);
    Assert(operatorFinance.Status == ConfirmStatus.Forbidden, "operator must not confirm finance card");
    Assert(operatorFinance.Reason?.StartsWith("role_confirmation_forbidden:") == true, "role rejection must use stable policy decision code");

    var humanRoom = runtime.Confirm("W-STAY-RESOURCE", "room", Human("resource-room", new Dictionary<string, string> { ["房间号"] = "A302" }), operatorToken);
    Assert(humanRoom.Status == ConfirmStatus.Confirmed, "human room confirmation should pass");
    runtime.ProcessPendingOutbox();

    var duplicateRoom = runtime.Confirm("W-STAY-RESOURCE", "room", Human("resource-room"), operatorToken);
    Assert(duplicateRoom.Status == ConfirmStatus.Duplicate, "same idempotency key should return duplicate instead of writing another event");

    Assert(runtime.Confirm("W-STAY-RESOURCE", "bed", Human("resource-bed"), operatorToken).Status == ConfirmStatus.Confirmed, "bed confirmation should pass");
    runtime.ProcessPendingOutbox();
    Assert(runtime.Confirm("W-STAY-RESOURCE", "activate", Human("resource-activate"), operatorToken).Status == ConfirmStatus.Confirmed, "resource activation should pass");
    runtime.ProcessPendingOutbox();

    foreach (var cardId in new[] { "application", "stayOrder", "deposit", "finance", "checkin" })
    {
        var token = cardId == "finance" ? financeToken : operatorToken;
        var result = runtime.Confirm("W-STAY-CHECKIN", cardId, Human($"checkin-{cardId}"), token);
        Assert(result.Status == ConfirmStatus.Confirmed, $"{cardId} confirmation should pass");
        runtime.ProcessPendingOutbox();
    }

    var behavior = runtime.AppendBehaviorEvent(new BehaviorEventRecord("beh-test", "WorkspaceOpened", "workspace", "W-STAY-CHECKIN", "zh-CN", "contract-test", DateTimeOffset.UtcNow));
    Assert(behavior.EventId == "beh-test", "behavior event should append");

    var reloaded = ProjectionRuntime.OpenPostgres(connectionString).GetAll();
    var reloadedResource = reloaded.Workspaces.Single(workspace => workspace.Id == "W-STAY-RESOURCE");
    Assert(reloaded.Events.Any(item => item.EventType == "RoomCreated"), "RoomCreated event should be persisted");
    Assert(reloaded.Events.All(item => !string.IsNullOrWhiteSpace(item.CorrelationId)), "audit events must include correlationId");
    Assert(reloaded.Events.All(item => !string.IsNullOrWhiteSpace(item.RequestId)), "audit events must include requestId");
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-RESOURCE").Select(item => item.EventType).ToArray(), "RoomCreated", "BedCreated", "BedActivated");
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-CHECKIN").Select(item => item.EventType).ToArray(), "ApplicationApproved", "StayOrderPrepared", "DepositEvidenceSubmitted", "FinanceDepositConfirmed", "CheckInConfirmed");
    Assert(reloadedResource.Cards.Single(card => card.Id == "room").Status == "done", "room status should persist as done");
    Assert(reloadedResource.Cards.All(card => card.Status == "done"), "resource cards should all be done");

    var reloadedCheckin = reloaded.Workspaces.Single(workspace => workspace.Id == "W-STAY-CHECKIN");
    Assert(reloadedCheckin.Cards.All(card => card.Status == "done"), "check-in cards should all be done");
    var reloadedRuntime = ProjectionRuntime.OpenPostgres(connectionString);
    Assert(CountRows(connectionString, "schema_migrations") >= 4, "schema migrations should be recorded in PostgreSQL");
    Assert(reloadedRuntime.GetAuditEvents("W-STAY-CHECKIN").Count == 5, "check-in audit events should persist in PostgreSQL");
    Assert(reloadedRuntime.GetBehaviorEvents().Any(item => item.EventId == "beh-test"), "behavior event should persist in PostgreSQL");
    var outbox = reloadedRuntime.GetOutboxMessages();
    Assert(outbox.Count == 8, $"expected 8 outbox messages, got {outbox.Count}");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.CorrelationId)), "outbox messages must include correlationId");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.RequestId)), "outbox messages must include requestId");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.CausationId)), "outbox messages must include causationId");
    Assert(outbox.All(item => item.ProcessedAtUtc is not null), "all outbox messages should be processed by projector");
    Assert(reloadedRuntime.ProcessPendingOutbox() == 0, "outbox projector should be idempotent after processing");
    var observation = reloadedRuntime.Observe();
    Assert(observation.WorkspaceCount == 8, $"observability workspaceCount expected 8, got {observation.WorkspaceCount}");
    Assert(observation.CardCount == 32, $"observability cardCount expected 32, got {observation.CardCount}");
    Assert(observation.AuditEventCount == 8, $"observability auditEventCount expected 8, got {observation.AuditEventCount}");
    Assert(observation.OutboxCount == 8, $"observability outboxCount expected 8, got {observation.OutboxCount}");
    Assert(observation.PendingOutboxCount == 0, "observability pending outbox count should be zero after processing");
    Assert(observation.BehaviorEventCount >= 1, "observability behavior event count should include persisted behavior events");

    Console.WriteLine("WorkOS.RuntimeContractTests: PASS");
}

static void AssertSequence(WorkspaceProjection workspace, params string[] expected)
{
    var actual = workspace.Cards.Select(card => card.Id).ToArray();
    Assert(actual.SequenceEqual(expected), $"{workspace.Id} sequence expected {string.Join(" -> ", expected)}, got {string.Join(" -> ", actual)}");
}

static void AssertEventSequence(string[] actual, params string[] expected)
{
    Assert(actual.SequenceEqual(expected), $"event sequence expected {string.Join(" -> ", expected)}, got {string.Join(" -> ", actual)}");
}

static ConfirmCardRequest Human(string idempotencyKey, IReadOnlyDictionary<string, string>? fieldValues = null) =>
    new("zh-CN", idempotencyKey, fieldValues ?? new Dictionary<string, string>(), Array.Empty<string>());

static void ValidateProjectionContractFiles()
{
    using var projectionSchema = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "projection-contract.schema.json")));
    var required = projectionSchema.RootElement.GetProperty("required").EnumerateArray().Select(item => item.GetString()).ToHashSet();
    foreach (var field in new[] { "projection", "version", "languages", "sourceOfTruth", "workspaces", "events" })
    {
        Assert(required.Contains(field), $"projection schema must require {field}");
    }

    var eventRequired = projectionSchema.RootElement
        .GetProperty("$defs")
        .GetProperty("workspaceEvent")
        .GetProperty("required")
        .EnumerateArray()
        .Select(item => item.GetString())
        .ToHashSet();
    foreach (var field in new[] { "correlationId", "causationId", "requestId" })
    {
        Assert(eventRequired.Contains(field), $"projection schema workspaceEvent must require {field}");
    }

    using var openApi = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "workos-runtime.openapi.json")));
    var confirm = openApi.RootElement
        .GetProperty("paths")
        .GetProperty("/api/workspaces/{workspaceId}/cards/{cardId}/confirm")
        .GetProperty("post");

    var hasActorHeader = confirm.GetProperty("parameters").EnumerateArray().Any(item =>
        item.GetProperty("name").GetString() == "X-WorkOS-Actor-Token" &&
        item.GetProperty("in").GetString() == "header" &&
        item.GetProperty("required").GetBoolean());
    Assert(hasActorHeader, "OpenAPI confirm must require X-WorkOS-Actor-Token");

    var confirmRequired = openApi.RootElement
        .GetProperty("components")
        .GetProperty("schemas")
        .GetProperty("ConfirmCardRequest")
        .GetProperty("required")
        .EnumerateArray()
        .Select(item => item.GetString())
        .ToHashSet();
    foreach (var field in new[] { "language", "idempotencyKey", "fieldValues", "evidenceIds" })
    {
        Assert(confirmRequired.Contains(field), $"OpenAPI ConfirmCardRequest must require {field}");
    }

    Assert(openApi.RootElement.GetProperty("paths").TryGetProperty("/api/observability/runtime", out _), "OpenAPI must include runtime observability endpoint");

    using var policyContract = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "policy-contract.json")));
    var decisionCodes = policyContract.RootElement.GetProperty("decisionCodes").EnumerateArray().Select(item => item.GetString()).ToHashSet();
    foreach (var code in new[] { "allowed", "ai_confirmation_forbidden", "role_confirmation_forbidden" })
    {
        Assert(decisionCodes.Contains(code), $"policy contract must include decision code {code}");
    }
}

static void ValidateGeneratedDtos()
{
    var generated = File.ReadAllText(Path.Combine("apps", "mobile", "src", "generated", "workosContracts.d.ts"));
    foreach (var typeName in new[] { "ProjectionEnvelope", "WorkspaceProjection", "CardProjection", "ConfirmCardRequest", "RuntimeObservation" })
    {
        Assert(generated.Contains($"export type {typeName}"), $"generated DTOs must include {typeName}");
    }
    Assert(generated.Contains("correlationId: string"), "generated DTOs must include WorkspaceEvent correlationId");
    Assert(File.Exists(Path.Combine("apps", "mobile", "src", "generated", "runtimeApiPaths.js")), "generated runtime API paths module must exist");
}

static void ValidateSliceManifest(ProjectionEnvelope projection)
{
    using var manifest = JsonDocument.Parse(File.ReadAllText(Path.Combine("docs", "contracts", "slice-manifest.json")));
    var slices = manifest.RootElement.GetProperty("slices").EnumerateArray().ToArray();
    foreach (var required in new[] { "Accommodation.ResourceSetup", "Accommodation.CheckIn", "Accommodation.CheckOut", "Finance.DepositException", "Repair.Dispatch", "Repair.Close" })
    {
        var slice = slices.FirstOrDefault(item => item.GetProperty("id").GetString() == required);
        Assert(slice.ValueKind != JsonValueKind.Undefined, $"slice manifest missing {required}");
        var workspaceId = slice.GetProperty("workspaceId").GetString();
        Assert(projection.Workspaces.Any(workspace => workspace.Id == workspaceId), $"slice {required} references missing workspace {workspaceId}");
        Assert(slice.GetProperty("cards").GetArrayLength() > 0, $"slice {required} must own cards");
        Assert(slice.GetProperty("events").GetArrayLength() > 0, $"slice {required} must own events");
        Assert(slice.GetProperty("ownsAggregates").GetArrayLength() > 0, $"slice {required} must declare aggregate ownership");
    }
}

static void ValidateProjectionEnvelopeAgainstContract(ProjectionEnvelope projection)
{
    Assert(projection.Projection == "IntentWorkspaceProjection", "projection envelope type must match contract");
    Assert(!string.IsNullOrWhiteSpace(projection.Version), "projection envelope missing version");
    Assert(projection.Languages.Contains("zh-CN") && projection.Languages.Contains("ru-RU"), "projection languages must include zh-CN and ru-RU");
    Assert(!string.IsNullOrWhiteSpace(projection.SourceOfTruth), "projection sourceOfTruth missing");
    Assert(projection.Workspaces.Count > 0, "projection workspaces missing");

    foreach (var workspace in projection.Workspaces)
    {
        Assert(workspace.ProjectionType == "IntentWorkspaceProjection", $"{workspace.Id} projectionType mismatch");
        AssertLocalized(workspace.Title, $"{workspace.Id} title");
        AssertLocalized(workspace.Summary, $"{workspace.Id} summary");
        Assert(workspace.Cards.Count > 0, $"{workspace.Id} cards missing");
        foreach (var card in workspace.Cards)
        {
            Assert(card.ProjectionType == "WorkspaceCardProjection", $"{card.Id} projectionType mismatch");
            AssertLocalized(card.Title, $"{card.Id} title");
            Assert(new[] { "notStarted", "ready", "blocked", "inProgress", "done" }.Contains(card.Status), $"{card.Id} status invalid");
            Assert(card.Fields.System.Count > 0 && card.Fields.Business.Count > 0 && card.Fields.Analytics.Count > 0, $"{card.Id} fields incomplete");
            foreach (var field in card.Fields.Business)
            {
                AssertLocalized(field.Label, $"{card.Id}.{field.Id} field label");
                AssertLocalized(field.Help, $"{card.Id}.{field.Id} field help");
                Assert(!string.IsNullOrWhiteSpace(field.Ui.Control), $"{card.Id}.{field.Id} missing ui control");
                if (field.Ui.Control is "select" or "searchSelect")
                {
                    Assert(field.Ui.Options.Count > 0, $"{card.Id}.{field.Id} selectable field missing contract options");
                    Assert(field.Ui.Options.All(option => !string.IsNullOrWhiteSpace(option.Value)), $"{card.Id}.{field.Id} option missing value");
                    foreach (var option in field.Ui.Options)
                    {
                        AssertLocalized(option.Label, $"{card.Id}.{field.Id} option {option.Value}");
                    }
                }
            }
            Assert(card.Evidence.Count > 0, $"{card.Id} evidence missing");
            Assert(card.Checks.Count > 0, $"{card.Id} checks missing");
            Assert(card.Events.Count > 0, $"{card.Id} events missing");
            Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnPrepare), $"{card.Id} onPrepare missing");
            Assert(!string.IsNullOrWhiteSpace(card.Transitions.OnConfirm), $"{card.Id} onConfirm missing");
            Assert(!string.IsNullOrWhiteSpace(card.Confirmation.RequiredRole), $"{card.Id} confirmation requiredRole missing");
            AssertLocalized(card.Confirmation.Label, $"{card.Id} confirmation label");
        }
    }
}

static void AssertLocalized(IReadOnlyDictionary<string, string> value, string label)
{
    Assert(value.TryGetValue("zh-CN", out var zh) && !string.IsNullOrWhiteSpace(zh), $"{label} missing zh-CN");
    Assert(value.TryGetValue("ru-RU", out var ru) && !string.IsNullOrWhiteSpace(ru), $"{label} missing ru-RU");
}

static string LoginToken(ProjectionRuntime runtime, string username)
{
    var login = runtime.Login(new LoginRequest(username, "dev"));
    if (login is null)
    {
        throw new InvalidOperationException($"login should succeed for {username}");
    }

    var token = login.GetType().GetProperty("token")?.GetValue(login)?.ToString();
    Assert(!string.IsNullOrWhiteSpace(token), $"login token should be issued for {username}");
    return token!;
}

static int CountRows(string connectionString, string tableName)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = $"select count(*) from {tableName}";
    return Convert.ToInt32(command.ExecuteScalar());
}

static void ResetPostgres(string connectionString)
{
    using var connection = new NpgsqlConnection(connectionString);
    connection.Open();
    using var command = connection.CreateCommand();
    command.CommandText = """
        drop table if exists behavior_events;
        drop table if exists runtime_sessions;
        drop table if exists outbox_messages;
        drop table if exists audit_events;
        drop table if exists runtime_documents;
        drop table if exists schema_migrations;
        """;
    command.ExecuteNonQuery();
}

static void Assert(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}
