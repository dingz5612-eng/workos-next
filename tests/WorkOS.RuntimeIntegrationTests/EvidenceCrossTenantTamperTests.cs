using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class EvidenceCrossTenantTamperTests
{
    [TestMethod]
    public void CrossTenantEvidenceUseIsBlockedBeforeConfirm()
    {
        var storage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeEvidenceStorage.cs");
        var contract = SurfaceRuntimeGuardTestFiles.Read("docs", "trust", "evidence-tenant-isolation-contract.yml");

        StringAssert.Contains(storage, "!evidence.TenantId.Equals(workspaceId");
        StringAssert.Contains(storage, "evidence_object_scope_mismatch");
        StringAssert.Contains(storage, "evidence_requirement_mismatch");
        StringAssert.Contains(contract, "tenant A evidence cannot be confirmed by tenant B");
        StringAssert.Contains(contract, "wrong-scope evidence returns 403 or 422");
    }
}
