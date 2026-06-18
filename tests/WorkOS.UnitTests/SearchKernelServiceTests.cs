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
        var results = search.Search(ProjectionRuntime.OpenInMemory(), "新增房间", OperatorActor(), "zh-CN")
            .Cast<Dictionary<string, object?>>()
            .ToArray();

        Assert.IsFalse(results.Any(item => Value(item, "templateWorkspaceId") == "W-STAY-DEPOSIT-LEDGER"));
        var command = results.Single(item =>
            Value(item, "templateWorkspaceId") == "W-DORM-MAINLINE" &&
            Value(item, "firstCardId") == "cert.roomSetupConfirm");
        var admission = (IReadOnlyDictionary<string, object>)command["admission"]!;
        var sourceRefs = (IReadOnlyDictionary<string, object?>)command["sourceRefs"]!;
        var target = (IReadOnlyDictionary<string, object?>)command["target"]!;
        var title = (IReadOnlyDictionary<string, string>)command["businessTitle"]!;
        var summary = (IReadOnlyDictionary<string, string>)command["businessSummary"]!;
        var nextAction = (IReadOnlyDictionary<string, string>)command["nextAction"]!;
        var readonlyReason = (IReadOnlyDictionary<string, string>)command["readonlyReason"]!;
        var legalActions = (IReadOnlyList<Dictionary<string, object?>>)command["legalActions"]!;

        Assert.AreEqual("SearchKernelService", Convert.ToString(sourceRefs["source"]));
        Assert.AreEqual("StartAdapterMap", Convert.ToString(sourceRefs["inputAdapter"]));
        Assert.AreEqual("definition.dormitory.roomSetupConfirm.v1", Convert.ToString(sourceRefs["definitionId"]));
        Assert.AreEqual("房源建档与基础就绪", title["zh-CN"]);
        StringAssert.Contains(summary["zh-CN"], "新建房间");
        Assert.AreEqual("prepare_only_confirm_denied", Value(command, "admissionDecision"));
        Assert.AreEqual("lodging.resource-basic-readiness", Value(command, "sourceScenario"));
        Assert.AreEqual("搜索结果只读；开始入口会先创建 WorkItem，再由 Runtime Prepare 校验。", readonlyReason["zh-CN"]);
        Assert.IsFalse(string.IsNullOrWhiteSpace(nextAction["zh-CN"]));
        Assert.AreEqual(1, legalActions.Count);
        Assert.AreEqual("startOperationsWorkspace", Convert.ToString(legalActions[0]["action"]));
        Assert.IsFalse((bool)legalActions[0]["writeBusinessFact"]!);
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

    [TestMethod]
    public void search_kernel_does_not_match_current_entries_by_technical_work_item_type()
    {
        var search = new SearchKernelService(
            new ProjectionWorkspaceSearchAdapter(),
            WorkItemDefinitionRegistryService.LoadDefault(),
            new AdmissionKernelService());
        var results = search.Search(ProjectionRuntime.OpenInMemory(), "Dorm.RoomSetupConfirm", OperatorActor(), "zh-CN")
            .Cast<Dictionary<string, object?>>()
            .ToArray();

        Assert.IsFalse(results.Any(item => Value(item, "workspaceId").StartsWith("W-DORM-MAINLINE", StringComparison.OrdinalIgnoreCase)));
        Assert.IsFalse(results.Any(item => Value(item, "cardId").Equals("cert.roomSetupConfirm", StringComparison.OrdinalIgnoreCase)));
        Assert.IsFalse(results.Any(item => Value(item, "resultType") == "command"));
    }

    [TestMethod]
    public void search_kernel_finds_mainline_completed_room_by_readonly_business_anchor()
    {
        var runtime = ProjectionRuntime.OpenInMemory();
        var workspace = runtime.StartWorkspace(AcceptedCapabilityRuntimeProjection.WorkspaceId);
        Assert.IsTrue(runtime.ProjectOperationsOutboxMessage(ConfirmedOperationMessage(
            workspace.Id,
            "cert.resourceReadinessConfirm",
            new Dictionary<string, object>
            {
                ["buildingName"] = "D01",
                ["roomNo"] = "A24126",
                ["roomId"] = "room-hidden-internal-id",
                ["operationsWorkItemId"] = "wi-hidden-internal-id"
            })));
        var search = new SearchKernelService(
            new ProjectionWorkspaceSearchAdapter(),
            WorkItemDefinitionRegistryService.LoadDefault(),
            new AdmissionKernelService());

        var results = search.Search(runtime, "A24126", OperatorActor(), "zh-CN")
            .Cast<Dictionary<string, object?>>()
            .ToArray();
        var technicalIdResults = search.Search(runtime, "room-hidden-internal-id", OperatorActor(), "zh-CN")
            .Cast<Dictionary<string, object?>>()
            .ToArray();

        var roomResult = results.SingleOrDefault(item =>
            Value(item, "workspaceId").Equals(workspace.Id, StringComparison.OrdinalIgnoreCase) &&
            Value(item, "resultType") == "workspaceCardCompatibility");

        Assert.IsNotNull(roomResult);
        var sourceRefs = (IReadOnlyDictionary<string, object?>)roomResult!["sourceRefs"]!;
        var legalActions = (IReadOnlyList<Dictionary<string, object?>>)roomResult["legalActions"]!;
        Assert.AreEqual("definition.dormitory.roomSetupConfirm.v1", Convert.ToString(sourceRefs["definitionId"]));
        Assert.AreEqual("prepare_only_confirm_denied", Value(roomResult, "admissionDecision"));
        Assert.AreEqual(1, legalActions.Count);
        Assert.AreEqual("openWorkItem", Convert.ToString(legalActions[0]["action"]));
        Assert.IsTrue((bool)legalActions[0]["allowed"]!);
        Assert.IsFalse((bool)legalActions[0]["writeBusinessFact"]!);
        Assert.IsFalse(technicalIdResults.Any(item =>
            Value(item, "workspaceId").Equals(workspace.Id, StringComparison.OrdinalIgnoreCase)));
    }

    [TestMethod]
    public void runtime_surface_policy_resolves_current_mainline_dynamic_instances()
    {
        var policy = RuntimeSurfacePolicyCatalog.LoadDefault()
            .ForWorkspace("W-DORM-MAINLINE-20260617093000-case");

        Assert.IsNotNull(policy);
        Assert.IsTrue(policy!.Search.Visible);
    }

    private static RuntimeActorContext OperatorActor() =>
        new(
            "u-operator-test",
            "operator",
            "tenant-s3",
            new[] { "workos.write", "operations.confirm", "search.read" },
            "test",
            "actor-token");

    private static OperationsOutboxMessage ConfirmedOperationMessage(
        string workspaceId,
        string cardId,
        IReadOnlyDictionary<string, object> fieldValues) =>
        new(
            $"out-{Guid.NewGuid():N}",
            $"evt-{Guid.NewGuid():N}",
            "tenant-s3",
            workspaceId,
            $"{workspaceId}:{cardId}",
            $"sub-{Guid.NewGuid():N}",
            "operations.work_item.confirmed",
            new Dictionary<string, object>
            {
                ["workspaceId"] = workspaceId,
                ["cardId"] = cardId,
                ["submissionId"] = $"sub-{Guid.NewGuid():N}",
                ["cardInstanceId"] = $"ci-{Guid.NewGuid():N}",
                ["aggregateRef"] = $"room:{Guid.NewGuid():N}",
                ["actorId"] = "u-operator-test",
                ["actorRole"] = "operator",
                ["fieldValues"] = fieldValues,
                ["evidenceIds"] = Array.Empty<string>()
            },
            DateTimeOffset.UtcNow);

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
