using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class OperationsConfirmPilotScopeTests
{
    [TestMethod]
    public void CanonicalConfirmRequiresPersistedWorkItemBeforeUnitOfWorkCommit()
    {
        var service = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "CanonicalOperationsApiService.cs");
        var endpoint = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "OperationsRuntimeEndpoints.cs");

        StringAssert.Contains(endpoint, "MapPost(\"/api/operations/work-items/{workItemId}/confirm\"");
        StringAssert.Contains(service, "var workItem = catalog.GetWorkItem(workItemId);");
        StringAssert.Contains(service, "ConfirmWorkItemResult.NotFound(workItemId, request.SubmissionId, request.IdempotencyKey, \"operation_work_item_not_found\")");
        StringAssert.Contains(service, "OperationsCommandRequest(");
        StringAssert.Contains(service, "unitOfWork.Commit(command)");
        Assert.IsFalse(
            service.Contains("projectionRuntime.Confirm", StringComparison.Ordinal) ||
            service.Contains("ProjectDormitoryResourceLifecycle", StringComparison.Ordinal),
            "Canonical confirm must not synchronously route through ProjectionRuntime retired facade.");
        Assert.IsTrue(
            service.IndexOf("var workItem = catalog.GetWorkItem(workItemId);", StringComparison.Ordinal)
            < service.IndexOf("unitOfWork.Commit(command)", StringComparison.Ordinal),
            "Canonical confirm must resolve persisted WorkItem before committing facts.");
        Assert.IsTrue(
            service.IndexOf("ConfirmWorkItemResult.NotFound(workItemId", StringComparison.Ordinal)
            < service.IndexOf("unitOfWork.Commit(command)", StringComparison.Ordinal),
            "Missing persisted WorkItem must return operation_work_item_not_found before any UoW commit.");
    }
}
