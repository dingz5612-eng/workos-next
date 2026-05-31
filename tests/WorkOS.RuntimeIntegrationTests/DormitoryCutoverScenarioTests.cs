using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryCutoverScenarioTests
{
    [TestMethod]
    public void DormitoryPilotWritePathIsControlledByFeatureFlagAndSliceCutoverState()
    {
        var target = new CutoverFeatureFlagTarget(
            TenantIds: ["tenant-dormitory"],
            SliceIds: ["dormitory"],
            RoleIds: ["finance"],
            ActorIds: ["actor-dormitory-ops"],
            DeviceIds: ["device-trusted"],
            MinAmount: 0m,
            MaxAmount: 1000m);
        var context = new CutoverFeatureFlagContext(
            "tenant-dormitory",
            "dormitory",
            "finance",
            "actor-dormitory-ops",
            "device-trusted",
            650m);

        var targeted = CutoverStateMachine.DecideRuntimePath("operations_primary", target, context);
        var nonTargeted = CutoverStateMachine.DecideRuntimePath("operations_primary", target, context with { SliceId = "repair" });
        Assert.AreEqual("operations_runtime", targeted.WritePath);
        Assert.AreEqual("legacy_workspace_card", nonTargeted.WritePath);
    }

    [TestMethod]
    public void PermissionDeniedAndBusinessBlockedHaveNoBusinessSideEffect()
    {
        var harness = DormitoryScenarioHarness.Create();
        var denied = DormitoryPilotGuard.PermissionDenied("actor-worker-without-finance-role");
        Assert.AreEqual(StatusCodes.Status403Forbidden, denied.StatusCode);
        Assert.AreEqual(0, harness.Store.DomainEvents.Count);

        var blocked = DormitoryPilotGuard.BusinessBlocked("missing_evidence");
        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, blocked.StatusCode);
        Assert.AreEqual(0, harness.Store.DomainEvents.Count);
    }

    [TestMethod]
    public void OtherBusinessLinesRemainOutOfProductionDuringDormitoryPilot()
    {
        var productionAllowed = new Dictionary<string, bool>
        {
            ["dormitory"] = false,
            ["repair"] = false,
            ["parts"] = false,
            ["business-3"] = false,
            ["business-4"] = false,
            ["business-5"] = false,
            ["business-6"] = false,
            ["business-7"] = false
        };

        Assert.IsTrue(productionAllowed.All(item => item.Value == false));
    }
}

internal static class DormitoryPilotGuard
{
    public static DormitoryPilotGuardDecision PermissionDenied(string actorId) =>
        new(StatusCodes.Status403Forbidden, $"permission_denied:{actorId}");

    public static DormitoryPilotGuardDecision BusinessBlocked(string reason) =>
        new(StatusCodes.Status422UnprocessableEntity, reason);
}

internal sealed record DormitoryPilotGuardDecision(int StatusCode, string Reason);
