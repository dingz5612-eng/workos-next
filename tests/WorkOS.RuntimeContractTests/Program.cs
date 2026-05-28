using WorkOS.Api.Runtime;
using Npgsql;

var connectionString = Environment.GetEnvironmentVariable("WORKOS_TEST_CONNECTION")
    ?? "Host=localhost;Port=54329;Database=workosnext;Username=workosnext;Password=workosnext_dev";

ResetPostgres(connectionString);

{
    var runtime = ProjectionRuntime.OpenPostgres(connectionString);
    var projection = runtime.GetAll();
    var cards = projection.Workspaces.SelectMany(workspace => workspace.Cards).ToArray();

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

    var operatorToken = LoginToken(runtime, "operator");
    var financeToken = LoginToken(runtime, "finance");
    var aiToken = LoginToken(runtime, "ai");

    var missingToken = runtime.Confirm("W-STAY-CHECKIN", "finance", Human("missing-token-finance"), "");
    Assert(missingToken.Status == ConfirmStatus.Forbidden, "confirm must require a trusted backend session token");

    var aiFinance = runtime.Confirm("W-STAY-CHECKIN", "finance", Human("ai-finance"), aiToken);
    Assert(aiFinance.Status == ConfirmStatus.Forbidden, "AI finance confirmation must be rejected");

    var operatorFinance = runtime.Confirm("W-STAY-CHECKIN", "finance", Human("operator-finance"), operatorToken);
    Assert(operatorFinance.Status == ConfirmStatus.Forbidden, "operator must not confirm finance card");

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
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-RESOURCE").Select(item => item.EventType).ToArray(), "RoomCreated", "BedCreated", "BedActivated");
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-CHECKIN").Select(item => item.EventType).ToArray(), "ApplicationApproved", "StayOrderPrepared", "DepositEvidenceSubmitted", "FinanceDepositConfirmed", "CheckInConfirmed");
    Assert(reloadedResource.Cards.Single(card => card.Id == "room").Status == "done", "room status should persist as done");
    Assert(reloadedResource.Cards.All(card => card.Status == "done"), "resource cards should all be done");

    var reloadedCheckin = reloaded.Workspaces.Single(workspace => workspace.Id == "W-STAY-CHECKIN");
    Assert(reloadedCheckin.Cards.All(card => card.Status == "done"), "check-in cards should all be done");
    var reloadedRuntime = ProjectionRuntime.OpenPostgres(connectionString);
    Assert(CountRows(connectionString, "schema_migrations") >= 3, "schema migrations should be recorded in PostgreSQL");
    Assert(reloadedRuntime.GetAuditEvents("W-STAY-CHECKIN").Count == 5, "check-in audit events should persist in PostgreSQL");
    Assert(reloadedRuntime.GetBehaviorEvents().Any(item => item.EventId == "beh-test"), "behavior event should persist in PostgreSQL");
    var outbox = reloadedRuntime.GetOutboxMessages();
    Assert(outbox.Count == 8, $"expected 8 outbox messages, got {outbox.Count}");
    Assert(outbox.All(item => item.ProcessedAtUtc is not null), "all outbox messages should be processed by projector");
    Assert(reloadedRuntime.ProcessPendingOutbox() == 0, "outbox projector should be idempotent after processing");

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
