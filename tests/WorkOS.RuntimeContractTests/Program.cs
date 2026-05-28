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
    Assert(cards.Length == 37, $"expected 37 cards, got {cards.Length}");

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
    ValidateFieldContracts(resource);

    var checkin = projection.Workspaces.Single(workspace => workspace.Id == "W-STAY-CHECKIN");
    AssertSequence(checkin, "lead", "booking", "resident", "bedAssign", "tariff", "depositRequirement", "payment", "finance", "checkin", "operatingDashboard");
    ValidateFieldContracts(checkin);

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

    foreach (var cardId in new[] { "lead", "booking", "resident", "bedAssign", "tariff", "depositRequirement", "payment", "finance", "checkin", "operatingDashboard" })
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
    AssertEventSequence(reloaded.Events.Where(item => item.WorkspaceId == "W-STAY-CHECKIN").Select(item => item.EventType).ToArray(), "LeadCaptured", "BookingConfirmed", "ResidentRegistered", "BedAssigned", "TariffAssigned", "DepositRequired", "PaymentRecordedByFrontDesk", "PaymentConfirmedByFinance", "StayCheckedIn", "OperatingMetricsReviewed");
    Assert(reloadedResource.Cards.Single(card => card.Id == "room").Status == "done", "room status should persist as done");
    Assert(reloadedResource.Cards.All(card => card.Status == "done"), "resource cards should all be done");

    var reloadedCheckin = reloaded.Workspaces.Single(workspace => workspace.Id == "W-STAY-CHECKIN");
    Assert(reloadedCheckin.Cards.All(card => card.Status == "done"), "check-in cards should all be done");
    var reloadedRuntime = ProjectionRuntime.OpenPostgres(connectionString);
    Assert(CountRows(connectionString, "schema_migrations") >= 6, "schema migrations should be recorded in PostgreSQL");
    Assert(CountRows(connectionString, "accommodation_rooms") >= 1, "Room aggregate should persist in accommodation_rooms");
    Assert(CountRows(connectionString, "accommodation_beds") >= 1, "Bed aggregate should persist in accommodation_beds");
    Assert(CountRows(connectionString, "accommodation_deposits") >= 1, "Deposit aggregate should persist in accommodation_deposits");
    Assert(CountRows(connectionString, "finance_confirmations") >= 1, "FinanceConfirmation aggregate should persist in finance_confirmations");
    Assert(CountRows(connectionString, "hostel_leads") >= 1, "Hostel lead should persist in hostel_leads");
    Assert(CountRows(connectionString, "hostel_bookings") >= 1, "Hostel booking should persist in hostel_bookings");
    Assert(CountRows(connectionString, "hostel_stays") >= 1, "Hostel stay should persist in hostel_stays");
    Assert(CountRows(connectionString, "guest_folios") >= 1, "Guest folio should persist in guest_folios");
    Assert(CountRows(connectionString, "deposit_liabilities") >= 1, "Deposit liability should persist in deposit_liabilities");
    Assert(CountRows(connectionString, "hostel_payments") >= 1, "Payment should persist in hostel_payments");
    Assert(CountRows(connectionString, "finance_reconciliations") >= 1, "Finance reconciliation should persist in finance_reconciliations");
    Assert(CountRows(connectionString, "hostel_operating_metrics") >= 1, "Operating metrics should persist in hostel_operating_metrics");
    Assert(CountRows(connectionString, "repair_stations") >= 2, "RepairStation aggregate roots should persist in repair_stations");
    Assert(CountRows(connectionString, "repair_technicians") >= 2, "Technician aggregate roots should persist in repair_technicians");
    Assert(CountRows(connectionString, "repair_vehicles") >= 2, "Vehicle aggregate roots should persist in repair_vehicles");
    Assert(reloadedRuntime.GetAuditEvents("W-STAY-CHECKIN").Count == 10, "check-in audit events should persist in PostgreSQL");
    Assert(reloadedRuntime.GetBehaviorEvents().Any(item => item.EventId == "beh-test"), "behavior event should persist in PostgreSQL");
    var outbox = reloadedRuntime.GetOutboxMessages();
    Assert(outbox.Count == 13, $"expected 13 outbox messages, got {outbox.Count}");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.CorrelationId)), "outbox messages must include correlationId");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.RequestId)), "outbox messages must include requestId");
    Assert(outbox.All(item => !string.IsNullOrWhiteSpace(item.CausationId)), "outbox messages must include causationId");
    Assert(outbox.All(item => item.ProcessedAtUtc is not null), "all outbox messages should be processed by projector");
    Assert(reloadedRuntime.ProcessPendingOutbox() == 0, "outbox projector should be idempotent after processing");
    var observation = reloadedRuntime.Observe();
    Assert(observation.WorkspaceCount == 8, $"observability workspaceCount expected 8, got {observation.WorkspaceCount}");
    Assert(observation.CardCount == 37, $"observability cardCount expected 37, got {observation.CardCount}");
    Assert(observation.AuditEventCount == 13, $"observability auditEventCount expected 13, got {observation.AuditEventCount}");
    Assert(observation.OutboxCount == 13, $"observability outboxCount expected 13, got {observation.OutboxCount}");
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

static void ValidateFieldContracts(WorkspaceProjection workspace)
{
    foreach (var card in workspace.Cards)
    {
        foreach (var field in card.Fields.Business)
        {
            var label = field.Label["zh-CN"];
            if (new[] { "房间号", "床位号", "凭证编号", "付款人", "姓名", "电话" }.Contains(label))
            {
                Assert(field.Type != "searchSelect", $"{workspace.Id}.{card.Id}.{label} creates or records data and must not be searchSelect");
                Assert(field.Ui.Control != "searchSelect", $"{workspace.Id}.{card.Id}.{label} must not render as searchSelect");
                Assert(field.Source == "userInput", $"{workspace.Id}.{card.Id}.{label} must come from userInput");
            }

            if (field.Type == "readonly" || field.Ui.Readonly)
            {
                Assert(field.Source is "system" or "projection", $"{workspace.Id}.{card.Id}.{label} readonly field must declare system or projection source");
                Assert(field.Ui.Control == "readonly", $"{workspace.Id}.{card.Id}.{label} readonly field must render with readonly control");
            }

            if (IsDateLabel(label))
            {
                Assert(field.Type == "dateTime", $"{workspace.Id}.{card.Id}.{label} must use dateTime type");
                Assert(field.Ui.Control is "dateTime" or "dateTimeRange", $"{workspace.Id}.{card.Id}.{label} must render with date/time control");
            }

            if (field.Ui.Control == "select")
            {
                Assert(!string.IsNullOrWhiteSpace(field.Ui.OptionSet), $"{workspace.Id}.{card.Id}.{label} select must declare optionSet");
                Assert(field.Ui.Options.Count > 0, $"{workspace.Id}.{card.Id}.{label} select must include options");
            }
        }
    }

    var room = workspace.Cards.FirstOrDefault(card => card.Id == "room");
    if (room is not null)
    {
        Assert(Field(room, "房间号").Ui.Control == "text", "房间号 must be text on room creation");
        Assert(Field(room, "容量").Ui.Control == "readonly", "容量 must be readonly derived field");
        Assert(Field(room, "容量").Ui.DerivedFrom == "房型", "容量 must derive from 房型");
    }

    var bed = workspace.Cards.FirstOrDefault(card => card.Id == "bed");
    if (bed is not null)
    {
        Assert(Field(bed, "所属房间").Ui.Control == "searchSelect", "所属房间 must select an existing room");
        Assert(Field(bed, "床位号").Ui.Control == "text", "床位号 must be text on bed creation");
    }
}

static bool IsDateLabel(string label) =>
    new[] { "联系日期", "入住日期", "计划退住日期", "预计入住/退房", "入住周期", "可分配时间", "押金截止时间", "付款时间", "到账时间", "实际入住时间" }.Contains(label);

static FieldProjection Field(CardProjection card, string zhLabel) =>
    card.Fields.Business.Single(field => field.Label["zh-CN"] == zhLabel);

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
        drop table if exists finance_confirmations;
        drop table if exists accommodation_deposits;
        drop table if exists hostel_operating_metrics;
        drop table if exists finance_reconciliations;
        drop table if exists hostel_payments;
        drop table if exists deposit_liabilities;
        drop table if exists guest_folios;
        drop table if exists hostel_stays;
        drop table if exists hostel_bookings;
        drop table if exists hostel_leads;
        drop table if exists accommodation_beds;
        drop table if exists accommodation_rooms;
        drop table if exists repair_vehicles;
        drop table if exists repair_technicians;
        drop table if exists repair_stations;
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
