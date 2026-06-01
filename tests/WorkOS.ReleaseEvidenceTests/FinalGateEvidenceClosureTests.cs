using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.ReleaseEvidenceTests;

[TestClass]
public sealed class FinalGateEvidenceClosureTests
{
    [TestMethod]
    public void ReplayFinalGateSelfTestRejectsManualPassedEvidence()
    {
        var output = ReleaseEvidenceScriptRunner.RunNode("scripts/v5_4/replay-final-gate.mjs", "--self-test");

        StringAssert.Contains(output, "replay-final-gate self-test: PASS");
    }

    [TestMethod]
    public void ReleaseEvidenceGraphSelfTestBlocksPassedGateWithMissingEvidence()
    {
        var output = ReleaseEvidenceScriptRunner.RunNode("scripts/v5_4/check-release-evidence-graph.mjs", "--self-test");

        StringAssert.Contains(output, "check-release-evidence-graph self-test: PASS");
    }

    [TestMethod]
    public void ReleaseEvidenceFreshnessSelfTestRejectsStaleAndLocalProductionEvidence()
    {
        var output = ReleaseEvidenceScriptRunner.RunNode("scripts/v5_4/verify-release-evidence-freshness.mjs", "--self-test");

        StringAssert.Contains(output, "verify-release-evidence-freshness self-test: PASS");
    }

    [TestMethod]
    public void FinalReportConsistencySelfTestKeepsBusinessProductionBlocked()
    {
        var output = ReleaseEvidenceScriptRunner.RunNode("scripts/v5_4/check-final-report-consistency.mjs", "--self-test");

        StringAssert.Contains(output, "check-final-report-consistency self-test: PASS");
    }

    [TestMethod]
    public void CurrentRepositoryFinalGateReplaysAsDeclared()
    {
        var output = ReleaseEvidenceScriptRunner.RunNode("scripts/v5_4/replay-final-gate.mjs");

        StringAssert.Contains(output, "replay-final-gate: PASS");
    }

    [TestMethod]
    public void CurrentRepositoryReleaseEvidenceGraphIsConsistent()
    {
        var output = ReleaseEvidenceScriptRunner.RunNode("scripts/v5_4/check-release-evidence-graph.mjs");

        StringAssert.Contains(output, "check-release-evidence-graph: PASS");
    }

    [TestMethod]
    public void CurrentRepositoryFinalReportsMatchFinalGateState()
    {
        var output = ReleaseEvidenceScriptRunner.RunNode("scripts/v5_4/check-final-report-consistency.mjs");

        StringAssert.Contains(output, "check-final-report-consistency: PASS");
    }
}
