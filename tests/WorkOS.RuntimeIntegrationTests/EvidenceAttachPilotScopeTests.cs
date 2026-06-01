using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class EvidenceAttachPilotScopeTests
{
    [TestMethod]
    public void EvidenceAttachIsScopedAndDoesNotBecomeMoneyConfirm()
    {
        var program = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Program.cs");
        var evidenceStorage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeEvidenceStorage.cs");
        var confirmUnitOfWork = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "ConfirmUnitOfWork.cs");
        var apiClient = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "apiClient.js");

        StringAssert.Contains(program, "app.MapPost(\"/api/evidence/{evidenceId}/attachments\"");
        StringAssert.Contains(program, "runtime.AttachEvidence(evidenceId, request, actorId)");
        StringAssert.Contains(evidenceStorage, "evidence_object_scope_mismatch");
        StringAssert.Contains(evidenceStorage, "evidence_object_not_attached");
        StringAssert.Contains(evidenceStorage, "evidence_object_already_used");
        StringAssert.Contains(confirmUnitOfWork, "evidenceObjects.MarkUsed");
        StringAssert.Contains(apiClient, "attachEvidence");
        Assert.IsFalse(apiClient.Contains("PaymentConfirmed", StringComparison.Ordinal), "Evidence attach must not produce money fact directly.");
        Assert.IsFalse(apiClient.Contains("/api/payment/confirm", StringComparison.Ordinal), "Mobile apiClient must not call direct payment confirm.");
    }
}
