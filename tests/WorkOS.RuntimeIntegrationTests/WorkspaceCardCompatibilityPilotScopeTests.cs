using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class WorkspaceCardCompatibilityPilotScopeTests
{
    [TestMethod]
    public void CompatibilityAdapterIsPolicyGatedAndNotTheDormIntNormalPath()
    {
        var adapter = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "WorkspaceCardCompatibilityAdapter.cs");
        var operationRuntime = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "operationRuntime.js");
        var controller = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "operationController.js");

        StringAssert.Contains(adapter, "policy.Validate(workspaceId, cardId, request, actorToken)");
        StringAssert.Contains(adapter, "compatibilitySource");
        StringAssert.Contains(adapter, "workspace_card_compatibility_adapter");
        StringAssert.Contains(adapter, "public static string WorkItemIdFor(string workspaceId, string cardId) => $\"wi-{OperationsHash.Short(workspaceId, cardId)}\";");
        Assert.IsFalse(adapter.Contains("=> $\"{workspaceId}:{cardId}\"", StringComparison.Ordinal), "Compatibility adapter must not use workspace/card id as persisted id.");
        StringAssert.Contains(operationRuntime, "allowCompatibilityFallback = false");
        StringAssert.Contains(operationRuntime, "persisted_work_item_required");
        StringAssert.Contains(controller, "submitWorkItemOperation");
        Assert.IsFalse(controller.Contains("submitCardOperation({", StringComparison.Ordinal), "DORM-INT normal path must not call card fallback.");
    }
}
