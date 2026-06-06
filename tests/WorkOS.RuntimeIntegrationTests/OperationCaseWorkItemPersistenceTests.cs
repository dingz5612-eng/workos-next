using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class OperationCaseWorkItemPersistenceTests
{
    [TestMethod]
    public void operation_case_work_item_and_state_history_are_persisted()
    {
        var connectionString = ConnectionString();
        ProjectionRuntime.OpenPostgres(connectionString, RuntimeAuthOptions.Development);
        var caseStore = new PostgresOperationsCaseStore(connectionString);
        var workItemStore = new PostgresOperationsWorkItemStore(connectionString);
        var service = new OperationsRuntimeService(new FakeRuntime(), caseStore, workItemStore);
        var suffix = Guid.NewGuid().ToString("N");
        var caseId = $"case-oam-current-{suffix}";
        var workItemId = $"wi-oam-current-{suffix}";

        var operationCase = service.CreateCase(new CreateOperationCaseRequest(caseId, "tenant-oam-current", "W-OAM-CURRENT"));
        var workItem = service.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: workItemId,
            TenantId: "tenant-oam-current",
            WorkItemType: "runtimeAudit",
            WorkspaceId: "W-OAM-CURRENT",
            CardId: "runtimeAudit",
            OwnerRole: "operations",
            Payload: new Dictionary<string, string> { ["caseId"] = caseId }));
        service.RecordWorkItemTransition(
            "tenant-oam-current",
            caseId,
            workItemId,
            "available",
            "confirmed",
            $"sub-oam-current-{suffix}",
            "integration_confirm",
            "actor-oam-current");

        var reloadedCase = caseStore.Get(caseId);
        var reloadedWorkItem = workItemStore.Get(workItemId);
        var transitions = workItemStore.GetTransitions(workItemId);

        Assert.IsNotNull(operationCase);
        Assert.IsNotNull(workItem);
        Assert.IsNotNull(reloadedCase);
        Assert.IsNotNull(reloadedWorkItem);
        Assert.AreEqual("tenant-oam-current", reloadedCase.TenantId);
        Assert.AreEqual(caseId, reloadedWorkItem.CaseId);
        Assert.AreEqual("confirmed", reloadedWorkItem.Status);
        Assert.AreEqual("work-item:runtimeAudit:v1", reloadedWorkItem.DefinitionVersionId);
        Assert.HasCount(1, transitions);
        Assert.AreEqual("available", transitions[0].FromState);
        Assert.AreEqual("confirmed", transitions[0].ToState);
    }

    private static string ConnectionString() =>
        Environment.GetEnvironmentVariable("WORKOS_TEST_CONNECTION")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__WorkOSRuntime")
        ?? "Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev";

    private sealed class FakeRuntime : IOperationsRuntimeAdapter
    {
        public WorkspaceProjection? FindWorkspace(string workspaceId) =>
            workspaceId.Equals("W-OAM-CURRENT", StringComparison.OrdinalIgnoreCase) ? Workspace(workspaceId) : null;

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
            Array.Empty<ProcessWorkItemIntentRecord>();

        public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null) =>
            new { prepared = true };

        public ConfirmResult ValidateConfirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken) =>
            new(ConfirmStatus.Confirmed, null, null);

        public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken) =>
            new(ConfirmStatus.Confirmed, null, null);

        private static WorkspaceProjection Workspace(string workspaceId) =>
            new(
                "IntentWorkspaceProjection",
                workspaceId,
                "stay",
                $"task-{workspaceId}",
                Text("OAM current"),
                Text("OAM current"),
                new[] { Card("runtimeAudit") },
                Text("Next"),
                Array.Empty<BlockerRule>());

        private static CardProjection Card(string cardId) =>
            new(
                "WorkspaceCardProjection",
                cardId,
                "ready",
                Text(cardId),
                new FieldSet(Array.Empty<FieldProjection>(), Array.Empty<FieldProjection>(), Array.Empty<FieldProjection>()),
                Array.Empty<EvidenceRequirement>(),
                Array.Empty<SystemCheck>(),
                Array.Empty<BlockerRule>(),
                Array.Empty<EventDefinition>(),
                new TransitionDefinition("prepare", "confirm", "block"),
                new ConfirmationPolicy(true, false, "operator", Text("Confirm")));

        private static IReadOnlyDictionary<string, string> Text(string value) =>
            new Dictionary<string, string>
            {
                ["zh-CN"] = value,
                ["ru-RU"] = value
            };
    }
}
