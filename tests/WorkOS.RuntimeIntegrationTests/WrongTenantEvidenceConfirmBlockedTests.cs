using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class WrongTenantEvidenceConfirmBlockedTests
{
    [TestMethod]
    public void ConfirmRejectsEvidenceFromAnotherTenant()
    {
        var storage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeEvidenceStorage.cs");
        var policy = SurfaceRuntimeGuardTestFiles.Read("docs", "business", "policies", "evidence-policy.yml");
        var contract = SurfaceRuntimeGuardTestFiles.Read("docs", "trust", "trust-boundary-kernel.yml");

        StringAssert.Contains(storage, "!evidence.TenantId.Equals(workspaceId");
        StringAssert.Contains(storage, "evidence_object_scope_mismatch");
        StringAssert.Contains(policy, "wrongScopeEvidenceBlocksConfirm");
        StringAssert.Contains(contract, "wrong-scope evidence");
    }
}
