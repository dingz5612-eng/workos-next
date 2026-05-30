using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class CanonicalOperationsApiServiceTests
{
    [TestMethod]
    public void operations_confirm_uses_unit_of_work_and_exposes_fact_trace()
    {
        var service = Service(out var runtime, out var store);

        var result = service.ConfirmWorkItem("W-S3:roomSetup", Request("idem-s3"), "actor-token", "req-s3");
        var trace = service.GetSubmissionTrace(result.CommandSubmissionId!);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual("operations_unit_of_work", result.Source);
        Assert.AreEqual("committed", result.CommitStatus);
        Assert.AreEqual("pending", result.ProjectionStatus);
        Assert.AreEqual(0, runtime.ConfirmCount);
        Assert.AreEqual(1, store.DomainEvents.Count);
        Assert.AreEqual(result.CommandSubmissionId, trace?.SubmissionRef);
        Assert.AreEqual(result.ResultEventIds[0], trace?.DomainEventRefs[0]);
    }

    [TestMethod]
    public void operations_confirm_idempotency_conflict_does_not_write_second_domain_event()
    {
        var service = Service(out _, out var store);

        var first = service.ConfirmWorkItem("W-S3:roomSetup", Request("idem-conflict", "A101"), "actor-token", "req-1");
        var conflict = service.ConfirmWorkItem("W-S3:roomSetup", Request("idem-conflict", "B202"), "actor-token", "req-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.AreEqual("idempotency_conflict", conflict.Error);
        Assert.AreEqual(1, store.DomainEvents.Count);
    }

    [TestMethod]
    public void trace_routes_can_resolve_work_item_and_case_fact_graphs()
    {
        var service = Service(out _, out _);
        var result = service.ConfirmWorkItem("W-S3:roomSetup", Request("idem-trace"), "actor-token", "req-trace");

        var byWorkItem = service.GetWorkItemTraces("W-S3:roomSetup");
        var byCase = service.GetCaseTraces("W-S3");

        Assert.AreEqual(result.CommandSubmissionId, byWorkItem.Single().SubmissionRef);
        Assert.AreEqual(result.CommandSubmissionId, byCase.Single().SubmissionRef);
    }

    private static CanonicalOperationsApiService Service(out FakeCatalogRuntime runtime, out InMemoryOperationsStore store)
    {
        runtime = new FakeCatalogRuntime();
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
        return new CanonicalOperationsApiService(catalog, unitOfWork, store);
    }

    private static ConfirmWorkItemRequest Request(string idempotencyKey, string roomNo = "A101") =>
        new(
            Language: "zh-CN",
            IdempotencyKey: idempotencyKey,
            FieldValues: new Dictionary<string, string> { ["roomNo"] = roomNo },
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private sealed class FakeCatalogRuntime : IOperationsRuntimeAdapter
    {
        private readonly IReadOnlyList<WorkspaceProjection> workspaces = new[] { Workspace("W-S3") };
        private readonly IReadOnlyList<ProcessWorkItemIntentRecord> intents = new[]
        {
            new ProcessWorkItemIntentRecord(
                "intent-s3-room-setup",
                "process-run-s3",
                "tenant-s3",
                "W-S3:roomSetup",
                "roomSetup",
                "W-S3",
                "operator",
                "evt-intent-s3",
                "open",
                DateTimeOffset.UtcNow,
                new Dictionary<string, string>
                {
                    ["caseId"] = "W-S3",
                    ["cardId"] = "roomSetup"
                })
        };

        public int ConfirmCount { get; private set; }

        public WorkspaceProjection? FindWorkspace(string workspaceId) =>
            workspaces.FirstOrDefault(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
            string.IsNullOrWhiteSpace(tenantId)
                ? intents
                : intents.Where(intent => intent.TenantId.Equals(tenantId, StringComparison.OrdinalIgnoreCase)).ToArray();

        public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null) =>
            new { prepared = true };

        public ConfirmResult ValidateConfirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken) =>
            new(ConfirmStatus.Confirmed, null, null);

        public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
        {
            ConfirmCount++;
            throw new InvalidOperationException("canonical S3 confirm must not call legacy card confirm");
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
