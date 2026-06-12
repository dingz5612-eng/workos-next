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

    private static RuntimeActorContext OperatorActor() =>
        new(
            "u-operator-test",
            "operator",
            "tenant-s3",
            new[] { "workos.write", "operations.confirm", "search.read" },
            "test",
            "actor-token");

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
