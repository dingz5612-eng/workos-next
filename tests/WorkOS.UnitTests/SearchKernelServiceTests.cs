using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class SearchKernelServiceTests
{
    [TestMethod]
    public void search_kernel_does_not_query_operations_store_directly()
    {
        var source = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "SearchKernelService.cs"));
        var contract = File.ReadAllText(RepoPath("docs", "contracts", "search", "search-contract.json"));

        Assert.IsFalse(source.Contains("SearchOperationsSources", StringComparison.Ordinal));
        Assert.IsFalse(source.Contains("OperationsReadStore.SearchOperations", StringComparison.Ordinal));
        Assert.IsTrue(contract.Contains("\"allowedOnlyAs\": \"upstreamProjectionBuilderSource\"", StringComparison.Ordinal));
        Assert.IsTrue(contract.Contains("\"searchKernelDirectQueryAllowed\": false", StringComparison.Ordinal));
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

    [TestMethod]
    public void search_kernel_emits_server_admission_for_start_adapter_commands()
    {
        var search = new SearchKernelService(
            new ProjectionWorkspaceSearchAdapter(),
            WorkItemDefinitionRegistryService.LoadDefault(),
            new AdmissionKernelService());
        var results = search.Search(ProjectionRuntime.OpenInMemory(), "处理押金", OperatorActor(), "zh-CN")
            .Cast<Dictionary<string, object?>>()
            .ToArray();

        var command = results.Single(item =>
            Value(item, "templateWorkspaceId") == "W-STAY-DEPOSIT-LEDGER" &&
            Value(item, "firstCardId") == "depositAssessment");
        var admission = (IReadOnlyDictionary<string, object>)command["admission"]!;
        var sourceRefs = (IReadOnlyDictionary<string, object?>)command["sourceRefs"]!;
        var target = (IReadOnlyDictionary<string, object?>)command["target"]!;

        Assert.AreEqual("SearchKernelService", Convert.ToString(sourceRefs["source"]));
        Assert.AreEqual("StartAdapterMap", Convert.ToString(sourceRefs["inputAdapter"]));
        Assert.AreEqual("definition.dormitory.depositConfirm.v1", Convert.ToString(sourceRefs["definitionId"]));
        Assert.IsTrue((bool)admission["prepareAllowed"]);
        Assert.IsFalse((bool)admission["confirmAllowed"]);
        Assert.IsFalse((bool)admission["productionAllowed"]);
        Assert.IsFalse((bool)target["writeThroughSearchAllowed"]!);
    }

    [TestMethod]
    public void search_kernel_does_not_emit_start_adapter_admission_without_query()
    {
        var search = new SearchKernelService(
            new ProjectionWorkspaceSearchAdapter(),
            WorkItemDefinitionRegistryService.LoadDefault(),
            new AdmissionKernelService());
        var results = search.Search(ProjectionRuntime.OpenInMemory(), "", OperatorActor(), "zh-CN")
            .Cast<Dictionary<string, object?>>()
            .ToArray();

        Assert.IsFalse(results.Any(item => Value(item, "resultType") == "command"));
    }

    private static RuntimeActorContext OperatorActor() =>
        new(
            "u-operator-test",
            "operator",
            "tenant-s3",
            new[] { "workos.write", "operations.confirm", "search.read" },
            "test",
            "actor-token");

    private static string Value(Dictionary<string, object?> item, string key) =>
        item.TryGetValue(key, out var value) ? Convert.ToString(value) ?? string.Empty : string.Empty;

    private static string RepoPath(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate repository root.");
        return Path.Combine(new[] { current!.FullName }.Concat(segments).ToArray());
    }

}
