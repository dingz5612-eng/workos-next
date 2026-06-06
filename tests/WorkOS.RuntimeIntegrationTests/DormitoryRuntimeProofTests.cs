using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryRuntimeProofTests
{
    [TestMethod]
    public void CurrentOmaRuntimeContractRequiresConfirmUnitOfWorkTraceAndProjectionChain()
    {
        using var contract = JsonDocument.Parse(DormitoryRuntimeReplayHarness.ReadText("docs/contracts/oma.current.json"));
        var root = contract.RootElement;
        var dataModel = root.GetProperty("dataModel");
        var apiBoundary = root.GetProperty("apiBoundary");

        Assert.AreEqual("POST /api/operations/work-items/{workItemId}/confirm", root.GetProperty("primaryWritePath").GetString());
        Assert.AreEqual("operations_cases", dataModel.GetProperty("parent").GetString());
        Assert.AreEqual("operations_work_items", dataModel.GetProperty("child").GetString());
        Assert.AreEqual("projection-and-lens-are-read-side-only", dataModel.GetProperty("projectionRule").GetString());

        foreach (var required in new[]
        {
            "command_submissions",
            "work_item_transitions",
            "evidence_refs",
            "trace_refs",
            "audit_events"
        })
        {
            Assert.IsTrue(dataModel.GetProperty("mustReferenceWorkItem").EnumerateArray().Any(item => item.GetString() == required));
        }

        Assert.IsTrue(apiBoundary.GetProperty("writeRoutes").GetProperty("businessConfirm").EnumerateArray().Any(item => item.GetString() == root.GetProperty("primaryWritePath").GetString()));
        Assert.IsTrue(apiBoundary.GetProperty("forbidden").EnumerateArray().Any(item => item.GetString() == "legacyWorkspaceCardConfirm"));
    }

    [TestMethod]
    public void CurrentOmaEvidencePolicyKeepsOcrSuggestionOnly()
    {
        using var contract = JsonDocument.Parse(DormitoryRuntimeReplayHarness.ReadText("docs/contracts/oma.current.json"));
        var evidence = contract.RootElement.GetProperty("evidenceTraceAudit");

        Assert.IsTrue(evidence.GetProperty("evidenceObjectRequired").GetBoolean());
        Assert.AreEqual("suggestion-only-user-adopts-before-business-write", evidence.GetProperty("ocrPolicy").GetString());

        foreach (var required in new[] { "workItemId", "caseId", "submissionId", "actorId", "tenantId" })
        {
            Assert.IsTrue(evidence.GetProperty("traceRequired").EnumerateArray().Any(item => item.GetString() == required));
        }
    }
}
