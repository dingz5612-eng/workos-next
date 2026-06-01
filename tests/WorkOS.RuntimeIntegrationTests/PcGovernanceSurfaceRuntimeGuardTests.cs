using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class PcGovernanceSurfaceRuntimeGuardTests
{
    [TestMethod]
    public void PcGovernanceCannotDirectWriteBusinessFactsOrManualPassGateResult()
    {
        var pcApiClient = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "pcApiClient.js");
        var correctionStorage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeCorrectionCenterStorage.cs");
        var gateHardeningMigration = SurfaceRuntimeGuardTestFiles.Read("infra", "db", "migrations", "029_v5_5_gate_result_hardening.sql");
        var contract = SurfaceRuntimeGuardTestFiles.Read("docs", "surface", "pc-governance-plane-contract.yml");

        StringAssert.Contains(pcApiClient, "postPcOperationsConfirm");
        StringAssert.Contains(pcApiClient, "\"X-WorkOS-Operation-Confirm\": \"true\"");
        StringAssert.Contains(pcApiClient, "\"X-WorkOS-Gate-Result-Ref\": \"machine-gate-result-required\"");
        Assert.IsFalse(pcApiClient.Contains("/api/payment/confirm", StringComparison.Ordinal), "PC finance surface must not call direct payment confirm.");
        StringAssert.Contains(correctionStorage, "InsertReversalEntry");
        StringAssert.Contains(correctionStorage, "InsertCorrectionEntry");
        StringAssert.Contains(gateHardeningMigration, "before update or delete on control_plane.gate_results");
        StringAssert.Contains(gateHardeningMigration, "prevent_gate_results_immutable_update");
        StringAssert.Contains(contract, "\"directBusinessFactWriteAllowed\": false");
        StringAssert.Contains(contract, "\"manualGateResultPassedUpdateAllowed\": false");
    }
}
