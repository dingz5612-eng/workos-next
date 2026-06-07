using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class SearchKernelServiceTests
{
    [TestMethod]
    public void search_kernel_routes_lead_customer_anchor_to_next_actionable_work_item()
    {
        var adapter = new FakeLeadRuntime();
        var workItems = new InMemoryOperationsWorkItemStore();
        var operations = new OperationsRuntimeService(adapter, new InMemoryOperationsCaseStore(), workItems);
        var readStore = new InMemoryOperationsStore();
        operations.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-lead-capture-ding",
            TenantId: "tenant-s3",
            WorkItemType: "leadCapture",
            WorkspaceId: "W-STAY-LEAD-RESERVATION-DING",
            CardId: "leadCapture",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-ding",
                ["cardId"] = "leadCapture",
                ["templateWorkspaceId"] = "W-STAY-LEAD-RESERVATION"
            }));
        operations.RecordWorkItemTransition(
            "tenant-s3",
            "case-ding",
            "wi-lead-capture-ding",
            "available",
            "confirmed",
            "sub-ding",
            "operations_confirm_committed",
            "u-operator-test");
        operations.CreateWorkItem(new CreateWorkItemRequest(
            WorkItemId: "wi-lead-follow-ding",
            TenantId: "tenant-s3",
            WorkItemType: "leadFollowUp",
            WorkspaceId: "W-STAY-LEAD-RESERVATION-DING",
            CardId: "leadFollowUp",
            OwnerRole: "operator",
            Payload: new Dictionary<string, string>
            {
                ["caseId"] = "case-ding",
                ["cardId"] = "leadFollowUp",
                ["templateWorkspaceId"] = "W-STAY-LEAD-RESERVATION",
                ["sourceWorkItemId"] = "wi-lead-capture-ding"
            }));
        readStore.DomainEvents.Add(new OperationsDomainEvent(
            "tenant-s3",
            "evt-ding",
            "case-ding",
            "wi-lead-capture-ding",
            "sub-ding",
            "sub-ding",
            "sub-ding",
            "OperationsWorkItemConfirmed",
            new Dictionary<string, object>
            {
                ["input"] = new Dictionary<string, object>
                {
                    ["fieldValues"] = new Dictionary<string, object>
                    {
                        ["leadName"] = "DING",
                        ["phone"] = "13812341234"
                    }
                }
            },
            DateTimeOffset.UtcNow));
        var service = new SearchKernelService(
            new ProjectionWorkspaceSearchAdapter(),
            WorkItemDefinitionRegistryService.LoadDefault(),
            new AdmissionKernelService(),
            operations,
            readStore);

        var results = service.SearchOperationsSources("DING", new[] { "DING" }, OperatorActor(), "zh-CN");
        var result = results.Single();
        var anchor = (IReadOnlyDictionary<string, object>)result["businessAnchor"]!;

        Assert.AreEqual("workItem", result["resultType"]);
        Assert.AreEqual("wi-lead-follow-ding", result["workItemId"]);
        Assert.AreEqual("leadFollowUp", result["cardId"]);
        Assert.AreEqual("DING", anchor["leadName"]);
        Assert.AreEqual("13812341234", anchor["phone"]);
        Assert.AreEqual("OperationsRuntime.SearchOperations", ((IReadOnlyDictionary<string, object?>)result["sourceRefs"]!)["inputAdapter"]);
        var gateResult = (IReadOnlyDictionary<string, object?>)result["gateResult"]!;
        Assert.AreEqual("operationsDomainEvent", gateResult["sourceType"]);
        Assert.IsFalse((bool)gateResult["writeThroughSearchAllowed"]!);
        Assert.IsFalse((bool)gateResult["writeBusinessFactAllowed"]!);
    }

    [TestMethod]
    public void operations_search_does_not_match_json_field_names_as_business_anchor_values()
    {
        var readStore = new InMemoryOperationsStore();
        readStore.DomainEvents.Add(new OperationsDomainEvent(
            "tenant-s3",
            "evt-room",
            "case-room",
            "wi-room",
            "sub-room",
            "sub-room",
            "sub-room",
            "OperationsWorkItemConfirmed",
            new Dictionary<string, object>
            {
                ["input"] = new Dictionary<string, object>
                {
                    ["fieldValues"] = new Dictionary<string, object>
                    {
                        ["buildingName"] = "D01",
                        ["roomNo"] = "22"
                    }
                }
            },
            DateTimeOffset.UtcNow));

        var results = readStore.SearchOperations("tenant-s3", "DING");

        Assert.IsEmpty(results);
    }

    private static RuntimeActorContext OperatorActor() =>
        new(
            "u-operator-test",
            "operator",
            "tenant-s3",
            new[] { "workos.write", "operations.confirm", "search.read" },
            "test",
            "actor-token");

    private sealed class FakeLeadRuntime : IOperationsRuntimeAdapter
    {
        private readonly WorkspaceProjection workspace = Workspace();

        public WorkspaceProjection? FindWorkspace(string workspaceId) =>
            workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase) ? workspace : null;

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
            Array.Empty<ProcessWorkItemIntentRecord>();

        private static WorkspaceProjection Workspace() =>
            new(
                "IntentWorkspaceProjection",
                "W-STAY-LEAD-RESERVATION-DING",
                "stay",
                "task-lead-ding",
                Text("登记咨询和预订"),
                Text("咨询、跟进和预订。"),
                new[] { Card("leadCapture", "confirmed"), Card("leadFollowUp", "ready") },
                Text("继续跟进线索"),
                Array.Empty<BlockerRule>());

        private static CardProjection Card(string cardId, string status) =>
            new(
                "WorkspaceCardProjection",
                cardId,
                status,
                Text(cardId == "leadFollowUp" ? "线索跟进卡" : "线索捕获卡"),
                new FieldSet(Array.Empty<FieldProjection>(), Array.Empty<FieldProjection>(), Array.Empty<FieldProjection>()),
                Array.Empty<EvidenceRequirement>(),
                Array.Empty<SystemCheck>(),
                Array.Empty<BlockerRule>(),
                Array.Empty<EventDefinition>(),
                new TransitionDefinition("prepare", "confirm", "block"),
                new ConfirmationPolicy(true, false, "operator", Text("确认")));

        private static IReadOnlyDictionary<string, string> Text(string value) =>
            new Dictionary<string, string> { ["zh-CN"] = value, ["ru-RU"] = value, ["ky-KG"] = value };
    }
}
