using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class OperationsConfirmPilotScopeTests
{
    [TestMethod]
    public void CanonicalConfirmRequiresPersistedWorkItemBeforeUnitOfWorkCommit()
    {
        var service = SurfaceBoundaryTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "CanonicalOperationsApiService.cs");
        var endpoint = SurfaceBoundaryTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "OperationsRuntimeEndpoints.cs");

        Assert.Contains("MapPost(\"/api/operations/work-items/{workItemId}/confirm\"", endpoint);
        Assert.Contains("var workItem = catalog.GetWorkItem(workItemId);", service);
        Assert.Contains("ConfirmWorkItemResult.NotFound(workItemId, request.SubmissionId, request.IdempotencyKey, \"operation_work_item_not_found\")", service);
        Assert.Contains("OperationsCommandRequest(", service);
        Assert.Contains("unitOfWork.Commit(command)", service);
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

[TestClass]
public sealed class WorkspaceCardCompatibilityPilotScopeTests
{
    [TestMethod]
    public void CompatibilityAdapterIsPolicyGatedAndNotTheDormIntNormalPath()
    {
        var adapter = SurfaceBoundaryTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "WorkspaceCardCompatibilityAdapter.cs");
        var operationRuntime = SurfaceBoundaryTestFiles.Read("apps", "mobile", "src", "operationRuntime.js");
        var controller = SurfaceBoundaryTestFiles.Read("apps", "mobile", "src", "operationController.js");

        Assert.Contains("policy.Validate(workspaceId, cardId, request, actorToken)", adapter);
        Assert.Contains("compatibilitySource", adapter);
        Assert.Contains("workspace_card_compatibility_adapter", adapter);
        Assert.Contains("public static string WorkItemIdFor(string workspaceId, string cardId) => $\"wi-{OperationsHash.Short(workspaceId, cardId)}\";", adapter);
        Assert.DoesNotContain("=> $\"{workspaceId}:{cardId}\"", adapter);
        Assert.Contains("allowCompatibilityFallback = false", operationRuntime);
        Assert.Contains("persisted_work_item_required", operationRuntime);
        Assert.Contains("submitWorkItemOperation", controller);
        Assert.DoesNotContain("submitCardOperation({", controller);
    }
}

[TestClass]
public sealed class EvidenceAttachPilotScopeTests
{
    [TestMethod]
    public void EvidenceAttachIsScopedAndDoesNotBecomeMoneyConfirm()
    {
        var program = SurfaceBoundaryTestFiles.Read("services", "core-api", "WorkOS.Api", "Program.cs");
        var evidenceStorage = SurfaceBoundaryTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeEvidenceStorage.cs");
        var confirmUnitOfWork = SurfaceBoundaryTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "ConfirmUnitOfWork.cs");
        var apiClient = SurfaceBoundaryTestFiles.Read("apps", "mobile", "src", "apiClient.js");

        Assert.Contains("app.MapPost(\"/api/evidence/{evidenceId}/attachments\"", program);
        Assert.Contains("runtime.AttachEvidence(evidenceId, request, actorId)", program);
        Assert.Contains("evidence_object_scope_mismatch", evidenceStorage);
        Assert.Contains("evidence_object_not_attached", evidenceStorage);
        Assert.Contains("evidence_object_already_used", evidenceStorage);
        Assert.Contains("evidenceObjects.MarkUsed", confirmUnitOfWork);
        Assert.Contains("attachEvidence", apiClient);
        Assert.DoesNotContain("PaymentConfirmed", apiClient);
        Assert.DoesNotContain("/api/payment/confirm", apiClient);
    }
}

[TestClass]
public sealed class FinanceMoneyCommandPilotScopeTests
{
    [TestMethod]
    public void PcFinanceCommandsStayBehindOperationsConfirmAndGateResultIsAppendOnly()
    {
        var mobileApiClient = SurfaceBoundaryTestFiles.Read("apps", "mobile", "src", "apiClient.js");
        var pcApiClient = SurfaceBoundaryTestFiles.Read("apps", "mobile", "src", "pcApiClient.js");
        var correctionStorage = SurfaceBoundaryTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeCorrectionCenterStorage.cs");
        var gateHardeningMigration = SurfaceBoundaryTestFiles.Read("infra", "db", "migrations", "029_v5_5_gate_result_hardening.sql");

        foreach (var forbidden in new[]
        {
            "confirmBankStatementImport",
            "generateReconciliationCandidates",
            "detectReconciliationMismatches",
            "requestLedgerCorrection",
            "recordGovernanceAuditEvent"
        })
        {
            Assert.DoesNotContain(forbidden, mobileApiClient, $"{forbidden} must stay out of ordinary mobile apiClient.js.");
            Assert.Contains(forbidden, pcApiClient, $"{forbidden} must live in pcApiClient.js.");
        }

        Assert.Contains("postPcOperationsConfirm", pcApiClient);
        Assert.Contains("\"X-WorkOS-Operation-Confirm\": \"true\"", pcApiClient);
        Assert.Contains("\"X-WorkOS-Gate-Result-Ref\": \"machine-gate-result-required\"", pcApiClient);
        Assert.DoesNotContain("/api/payment/confirm", pcApiClient);
        Assert.Contains("InsertReversalEntry", correctionStorage);
        Assert.Contains("InsertCorrectionEntry", correctionStorage);
        Assert.Contains("before update or delete on control_plane.gate_results", gateHardeningMigration);
        Assert.Contains("prevent_gate_results_immutable_update", gateHardeningMigration);
        Assert.Contains("status <> 'passed' or generated_by = 'gate-runner'", gateHardeningMigration);
    }
}

internal static class SurfaceBoundaryTestFiles
{
    public static string Read(params string[] segments) =>
        File.ReadAllText(Path.Combine(new[] { RepoRoot() }.Concat(segments).ToArray()));

    private static string RepoRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate repository root.");
        return current!.FullName;
    }
}
