using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class MobileSurfaceRuntimeGuardTests
{
    [TestMethod]
    public void MobileOrdinarySurfaceCannotImportPcAdminApiOrOpenPcSurface()
    {
        var apiClient = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "apiClient.js");
        var pcApiClient = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "pcApiClient.js");
        var surfaceGuard = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "surfaceGuard.js");
        var contract = SurfaceRuntimeGuardTestFiles.Read("docs", "surface", "surface-runtime-guard-contract.yml");

        foreach (var forbidden in new[] { "fetchReleaseControlCenter", "recordGovernanceAuditEvent", "confirmBankStatementImport", "requestLedgerCorrection" })
        {
            Assert.IsFalse(apiClient.Contains(forbidden, StringComparison.Ordinal), $"{forbidden} must stay out of ordinary mobile apiClient.");
            StringAssert.Contains(pcApiClient, forbidden, $"{forbidden} must live in pcApiClient.");
        }

        StringAssert.Contains(surfaceGuard, "pc_surface_requires_pc_device");
        StringAssert.Contains(contract, "mobile token cannot call PC release/governance/finance admin API");
    }
}
