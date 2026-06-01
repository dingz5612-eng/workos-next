using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class RevokedDeviceHighRiskConfirmTests
{
    [TestMethod]
    public void RevokedDeviceCannotPerformHighRiskConfirmOrEvidenceAccess()
    {
        var security = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeSecurityPolicy.cs");
        var deviceStorage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeDeviceSessionStorage.cs");
        var evidenceStorage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeEvidenceStorage.cs");

        StringAssert.Contains(security, "deviceSession.RevokedAtUtc is not null");
        StringAssert.Contains(deviceStorage, "device_trust_status = 'revoked'");
        StringAssert.Contains(deviceStorage, "revoked_by");
        StringAssert.Contains(evidenceStorage, "evidence_device_revoked");
        StringAssert.Contains(evidenceStorage, "device_revoked");
    }
}
