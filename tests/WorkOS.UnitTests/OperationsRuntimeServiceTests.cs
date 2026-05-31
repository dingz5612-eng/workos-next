using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class OperationsRuntimeServiceTests
{
    [TestMethod]
    public void catalog_resolves_persisted_operation_case_and_work_item()
    {
        var service = Service(out _, out var cases, out var workItems);

        var operationCase = service.CreateCase(new CreateOperationCaseRequest("case-runtime-001", "tenant-runtime", "W-OPS"));
        var workItem = service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-runtime-001",
            TenantId: "tenant-runtime",
            WorkItemType: "roomSetup",
            WorkspaceId: "W-OPS",
            CardId: "roomSetup",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string> { ["caseId"] = "case-runtime-001" }));

        Assert.IsNotNull(operationCase);
        Assert.IsNotNull(workItem);
        Assert.AreEqual("case-runtime-001", service.GetCase("case-runtime-001")!.CaseId);
        Assert.AreEqual("wi-runtime-001", service.GetWorkItem("wi-runtime-001")!.WorkItemId);
        Assert.HasCount(1, cases.List());
        Assert.HasCount(1, workItems.List());
    }

    [TestMethod]
    public void prepare_workspace_card_creates_compatibility_work_item_without_committing_fact()
    {
        var service = Service(out var runtime, out _, out var workItems);

        var result = service.PrepareWorkspaceCard("W-OPS", "roomSetup", new PrepareCardRequest("sub-prepare", "ci-prepare", "room:A101"));
        var payload = (IReadOnlyDictionary<string, object?>)result.Payload!;

        Assert.AreEqual(200, result.StatusCode);
        Assert.AreEqual(true, payload["prepared"]);
        Assert.AreEqual("W-OPS", payload["workspaceId"]);
        Assert.AreEqual("roomSetup", payload["cardId"]);
        StringAssert.StartsWith(payload["workItemId"]!.ToString(), "wi-");
        Assert.AreEqual(1, runtime.PrepareCount);
        Assert.AreEqual(0, runtime.ConfirmCount);
        Assert.HasCount(1, workItems.List());
    }

    [TestMethod]
    public void policy_validation_delegates_to_runtime_without_committing_fact()
    {
        var service = Service(
            out var runtime,
            out _,
            out _,
            new ConfirmResult(ConfirmStatus.Forbidden, "role_confirmation_forbidden:operator", null));

        var result = service.ValidateWorkspaceCardConfirmPolicy(
            "W-OPS",
            "roomSetup",
            new ConfirmCardRequest(
                "zh-CN",
                "idem-policy",
                new Dictionary<string, string> { ["roomNo"] = "A101" },
                Array.Empty<string>(),
                "sub-policy",
                "ci-policy"),
            "actor-token");

        Assert.AreEqual(ConfirmStatus.Forbidden, result.Status);
        Assert.AreEqual("role_confirmation_forbidden:operator", result.Reason);
        Assert.AreEqual(1, runtime.ValidateCount);
        Assert.AreEqual(0, runtime.ConfirmCount);
    }

    private static OperationsRuntimeService Service(
        out FakeOperationsRuntime runtime,
        out InMemoryOperationsCaseStore cases,
        out InMemoryOperationsWorkItemStore workItems,
        ConfirmResult? policyResult = null)
    {
        runtime = new FakeOperationsRuntime(policyResult);
        cases = new InMemoryOperationsCaseStore();
        workItems = new InMemoryOperationsWorkItemStore();
        return new OperationsRuntimeService(runtime, new InMemoryOperationsCommandSubmissionStore(), cases, workItems);
    }

    private sealed class FakeOperationsRuntime : IOperationsRuntimeAdapter
    {
        private readonly ConfirmResult? policyResult;
        private readonly IReadOnlyList<WorkspaceProjection> workspaces = new[] { Workspace("W-OPS") };

        public FakeOperationsRuntime(ConfirmResult? policyResult)
        {
            this.policyResult = policyResult;
        }

        public int PrepareCount { get; private set; }

        public int ValidateCount { get; private set; }

        public int ConfirmCount { get; private set; }

        public WorkspaceProjection? FindWorkspace(string workspaceId) =>
            workspaces.FirstOrDefault(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
            Array.Empty<ProcessWorkItemIntentRecord>();

        public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null)
        {
            PrepareCount++;
            return new { prepared = true };
        }

        public ConfirmResult ValidateConfirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
        {
            ValidateCount++;
            return policyResult ?? new ConfirmResult(ConfirmStatus.Confirmed, null, null);
        }

        public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
        {
            ConfirmCount++;
            throw new InvalidOperationException("OperationsRuntimeService must not commit facts directly.");
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
