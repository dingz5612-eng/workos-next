using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class SearchKernelServiceTests
{
    [TestMethod]
    public void search_kernel_reads_operations_events_without_runtime_catalog()
    {
        var readStore = new InMemoryOperationsStore();
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
                ["definitionVersionId"] = "definition.dormitory.roomSetupConfirm.v1",
                ["input"] = new Dictionary<string, object>
                {
                    ["workspaceId"] = "W-STAY-LEAD-RESERVATION-DING",
                    ["cardId"] = "leadCapture",
                    ["definitionId"] = "definition.dormitory.roomSetupConfirm.v1",
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
            readStore);

        var results = service.SearchOperationsSources("DING", new[] { "DING" }, OperatorActor(), "zh-CN");
        var result = results.Single();
        var anchor = (IReadOnlyDictionary<string, object>)result["businessAnchor"]!;

        Assert.AreEqual("operationCase", result["resultType"]);
        Assert.AreEqual("wi-lead-capture-ding", result["workItemId"]);
        Assert.AreEqual("leadCapture", result["cardId"]);
        Assert.AreEqual("DING", anchor["leadName"]);
        Assert.AreEqual("13812341234", anchor["phone"]);
        Assert.AreEqual("OperationsReadStore.SearchOperations", ((IReadOnlyDictionary<string, object?>)result["sourceRefs"]!)["inputAdapter"]);
        Assert.AreEqual("operationsDomainEvent", ((IReadOnlyDictionary<string, object?>)result["target"]!)["kind"]);
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

}
