using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class FinanceMoneyCommandPilotScopeTests
{
    [TestMethod]
    public void PcFinanceCommandsStayBehindOperationsConfirmAndReleaseGovernanceIsAppendOnly()
    {
        var mobileApiClient = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "apiClient.js");
        var pcApiClient = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "pcApiClient.js");
        var correctionStorage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeCorrectionCenterStorage.cs");
        var gateAppendOnlyMigration = SurfaceRuntimeGuardTestFiles.Read("infra", "db", "migrations", "029_control_plane_gate_result_append_only.sql");

        foreach (var forbidden in new[]
        {
            "confirmBankStatementImport",
            "generateReconciliationCandidates",
            "detectReconciliationMismatches",
            "requestLedgerCorrection",
            "recordGovernanceAuditEvent"
        })
        {
            Assert.IsFalse(mobileApiClient.Contains(forbidden, StringComparison.Ordinal), $"{forbidden} must stay out of ordinary mobile apiClient.js.");
            StringAssert.Contains(pcApiClient, forbidden, $"{forbidden} must live in pcApiClient.js.");
        }

        StringAssert.Contains(pcApiClient, "postPcOperationsConfirm");
        StringAssert.Contains(pcApiClient, "\"X-WorkOS-Operation-Confirm\": \"true\"");
        StringAssert.Contains(pcApiClient, "\"X-WorkOS-Gate-Result-Ref\": \"machine-gate-result-required\"");
        Assert.IsFalse(pcApiClient.Contains("/api/payment/confirm", StringComparison.Ordinal), "PC finance surface must not call direct payment confirm.");
        StringAssert.Contains(correctionStorage, "InsertReversalEntry");
        StringAssert.Contains(correctionStorage, "InsertCorrectionEntry");
        StringAssert.Contains(gateAppendOnlyMigration, "before update or delete on control_plane.gate_results");
        StringAssert.Contains(gateAppendOnlyMigration, "prevent_gate_results_immutable_update");
        StringAssert.Contains(gateAppendOnlyMigration, "status <> 'passed' or generated_by = 'gate-runner'");
    }
}
