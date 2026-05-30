using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class LegacyWorkspaceCardAdapterTests
{
    [TestMethod]
    public void old_confirm_commits_through_operations_unit_of_work()
    {
        var adapter = Adapter(out var runtime, out var store);

        var result = adapter.ConfirmWorkspaceCard("W-S4", "roomSetup", Request("idem-s4"), "actor-token", "req-s4");
        var payload = Payload(result);
        var commandSubmissionId = (string)payload["commandSubmissionId"]!;
        var trace = store.GetFactTraceBySubmission(commandSubmissionId);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual(1, runtime.ValidateCount);
        Assert.AreEqual(0, runtime.ConfirmCount);
        Assert.AreEqual("operations_unit_of_work", payload["source"]);
        Assert.AreEqual("legacy_workspace_card_adapter", payload["compatibilitySource"]);
        Assert.AreEqual("W-S4:roomSetup", payload["workItemId"]);
        Assert.AreEqual($"/api/operations/trace/submissions/{commandSubmissionId}", payload["traceUrl"]);
        Assert.AreEqual(1, store.Submissions.Count);
        Assert.AreEqual(1, store.DomainEvents.Count);
        Assert.AreEqual(commandSubmissionId, trace?.SubmissionRef);
        Assert.IsTrue(store.WriteLog.IndexOf($"CommandSubmission:{commandSubmissionId}:pending") < store.WriteLog.FindIndex(item => item.StartsWith("DomainEvent:", StringComparison.Ordinal)));
    }

    [TestMethod]
    public void old_confirm_same_key_same_payload_returns_stable_duplicate_response()
    {
        var adapter = Adapter(out var runtime, out var store);
        var request = Request("idem-s4-duplicate");

        var first = adapter.ConfirmWorkspaceCard("W-S4", "roomSetup", request, "actor-token", "req-1");
        var second = adapter.ConfirmWorkspaceCard("W-S4", "roomSetup", request, "actor-token", "req-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, second.StatusCode);
        Assert.AreEqual(2, runtime.ValidateCount);
        Assert.AreEqual(0, runtime.ConfirmCount);
        Assert.AreEqual(1, store.DomainEvents.Count);
        Assert.AreEqual(Payload(first)["commandSubmissionId"], Payload(second)["commandSubmissionId"]);
    }

    [TestMethod]
    public void old_confirm_idempotency_conflict_returns_409_without_second_domain_event()
    {
        var adapter = Adapter(out _, out var store);

        var first = adapter.ConfirmWorkspaceCard("W-S4", "roomSetup", Request("idem-s4-conflict", "A101"), "actor-token", "req-1");
        var conflict = adapter.ConfirmWorkspaceCard("W-S4", "roomSetup", Request("idem-s4-conflict", "B202"), "actor-token", "req-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.AreEqual(1, store.DomainEvents.Count);
        Assert.AreEqual(1, store.Submissions.Count);
    }

    [TestMethod]
    public void old_confirm_policy_rejection_does_not_write_domain_event()
    {
        var adapter = Adapter(
            out var runtime,
            out var store,
            new ConfirmResult(ConfirmStatus.Forbidden, "role_confirmation_forbidden:operator", null));

        var result = adapter.ConfirmWorkspaceCard("W-S4", "roomSetup", Request("idem-s4-forbidden"), "actor-token", "req-forbidden");

        Assert.AreEqual(StatusCodes.Status403Forbidden, result.StatusCode);
        Assert.AreEqual(1, runtime.ValidateCount);
        Assert.AreEqual(0, runtime.ConfirmCount);
        Assert.AreEqual(0, store.DomainEvents.Count);
        Assert.AreEqual(0, store.Submissions.Count);
    }

    [TestMethod]
    public void old_prepare_keeps_legacy_payload_shape()
    {
        var adapter = Adapter(out _, out _);

        var result = adapter.PrepareWorkspaceCard("W-S4", "roomSetup", new PrepareCardRequest("sub-s4", "ci-s4", "room:A101"));
        var payload = Payload(result);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual(true, payload["prepared"]);
        Assert.AreEqual("W-S4", payload["workspaceId"]);
        Assert.AreEqual("roomSetup", payload["cardId"]);
        Assert.AreEqual("W-S4:roomSetup", payload["workItemId"]);
        Assert.AreEqual("W-S4", payload["caseId"]);
        Assert.IsTrue(payload.ContainsKey("card"));
        Assert.IsTrue(payload.ContainsKey("allowedActions"));
        Assert.IsTrue(payload.ContainsKey("fieldDefaults"));
    }

    private static LegacyWorkspaceCardAdapter Adapter(
        out FakeLegacyRuntime runtime,
        out InMemoryOperationsStore store,
        ConfirmResult? policyResult = null)
    {
        runtime = new FakeLegacyRuntime(policyResult);
        var catalog = new OperationsRuntimeService(runtime, new InMemoryOperationsCommandSubmissionStore());
        store = new InMemoryOperationsStore();
        var router = new SliceCommandHandlerRouter()
            .Register(CanonicalOperationsApiService.ConfirmCommandType, CanonicalOperationsApiService.HandleConfirmCommand);
        var unitOfWork = new OperationsUnitOfWork(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            router);
        var operations = new CanonicalOperationsApiService(catalog, unitOfWork, store);
        return new LegacyWorkspaceCardAdapter(
            operations,
            new LegacyWorkItemResolver(),
            new LegacyCompatibilityPolicy(catalog),
            new LegacyCardRequestMapper(),
            new LegacyCardResponseMapper());
    }

    private static ConfirmCardRequest Request(string idempotencyKey, string roomNo = "A101") =>
        new(
            "zh-CN",
            idempotencyKey,
            new Dictionary<string, string> { ["roomNo"] = roomNo },
            Array.Empty<string>(),
            $"sub-{idempotencyKey}",
            $"ci-{idempotencyKey}");

    private static IReadOnlyDictionary<string, object?> Payload(CompatibilityApiResult result) =>
        (IReadOnlyDictionary<string, object?>)result.Payload!;

    private sealed class FakeLegacyRuntime : IOperationsRuntimeAdapter
    {
        private readonly ConfirmResult? policyResult;
        private readonly IReadOnlyList<WorkspaceProjection> workspaces = new[] { Workspace("W-S4") };

        public FakeLegacyRuntime(ConfirmResult? policyResult)
        {
            this.policyResult = policyResult;
        }

        public int ValidateCount { get; private set; }

        public int ConfirmCount { get; private set; }

        public WorkspaceProjection? FindWorkspace(string workspaceId) =>
            workspaces.FirstOrDefault(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
            Array.Empty<ProcessWorkItemIntentRecord>();

        public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null) =>
            new { prepared = true };

        public ConfirmResult ValidateConfirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
        {
            ValidateCount++;
            return policyResult ?? new ConfirmResult(ConfirmStatus.Confirmed, null, null);
        }

        public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
        {
            ConfirmCount++;
            throw new InvalidOperationException("legacy adapter must not call old Workspace/Card confirm as fact path");
        }

        private static WorkspaceProjection Workspace(string workspaceId) =>
            new(
                "IntentWorkspaceProjection",
                workspaceId,
                "stay",
                $"task-{workspaceId}",
                Text("Operations"),
                Text("Operations"),
                new[] { Card("roomSetup") },
                Text("Next"),
                Array.Empty<BlockerRule>());

        private static CardProjection Card(string cardId) =>
            new(
                "WorkspaceCardProjection",
                cardId,
                "ready",
                Text(cardId),
                new FieldSet(Array.Empty<FieldProjection>(), new[] { Field("roomNo") }, Array.Empty<FieldProjection>()),
                Array.Empty<EvidenceRequirement>(),
                Array.Empty<SystemCheck>(),
                Array.Empty<BlockerRule>(),
                Array.Empty<EventDefinition>(),
                new TransitionDefinition("prepare", "confirm", "block"),
                new ConfirmationPolicy(true, false, "operator", Text("Confirm")));

        private static FieldProjection Field(string fieldId) =>
            new(
                fieldId,
                Text(fieldId),
                "business",
                "text",
                true,
                "runtime",
                true,
                fieldId,
                new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
                Text(fieldId));

        private static IReadOnlyDictionary<string, string> Text(string value) =>
            new Dictionary<string, string>
            {
                ["zh-CN"] = value,
                ["ru-RU"] = value
            };
    }
}
