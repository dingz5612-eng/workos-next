using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class UntrustedDeviceEvidenceAccessTests
{
    [TestMethod]
    public void UntrustedDeviceCannotAccessTrustedEvidenceOrHighRiskConfirm()
    {
        var security = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeSecurityPolicy.cs");
        var evidenceStorage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeEvidenceStorage.cs");
        var contract = SurfaceRuntimeGuardTestFiles.Read("docs", "trust", "device-session-tenant-scope-contract.yml");

        StringAssert.Contains(security, "DeviceTrustStatus.Equals(\"trusted\"");
        StringAssert.Contains(security, "trusted_device_required");
        StringAssert.Contains(evidenceStorage, "evidence_device_untrusted");
        StringAssert.Contains(evidenceStorage, "device_untrusted");
        StringAssert.Contains(contract, "untrusted device cannot high-risk confirm");
    }
}
