using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class OperationsOutboxProjectionMapperTests
{
    [TestMethod]
    public void operations_confirmed_outbox_maps_to_workspace_event_with_same_event_id()
    {
        var message = new OperationsOutboxMessage(
            "out-operations-room",
            "evt-operations-room",
            "W-STAY-RESOURCE-001",
            "case-resource-001",
            "wi-room-setup",
            "sub-room-setup",
            "operations.work_item.confirmed",
            new Dictionary<string, object>
            {
                ["workspaceId"] = "W-STAY-RESOURCE-001",
                ["cardId"] = "roomSetup",
                ["submissionId"] = "sub-room-setup",
                ["cardInstanceId"] = "ci-room-setup",
                ["aggregateRef"] = "roomId:R101",
                ["actorId"] = "actor-operator",
                ["actorRole"] = "operator",
                ["fieldValues"] = new Dictionary<string, object>
                {
                    ["buildingName"] = "D01",
                    ["roomNo"] = "R101",
                    ["bedCount"] = "4"
                },
                ["evidenceIds"] = new[] { "evd-room-check" }
            },
            DateTimeOffset.Parse("2026-06-04T10:00:00Z"));

        var workspaceEvent = OperationsOutboxProjectionMapper.ToWorkspaceEvent(message);

        Assert.IsNotNull(workspaceEvent);
        Assert.AreEqual("evt-operations-room", workspaceEvent!.EventId);
        Assert.AreEqual("W-STAY-RESOURCE-001", workspaceEvent.WorkspaceId);
        Assert.AreEqual("roomSetup", workspaceEvent.CardId);
        Assert.AreEqual("OperationsWorkItemConfirmed", workspaceEvent.EventType);
        Assert.AreEqual("sub-room-setup", workspaceEvent.SubmissionId);
        Assert.AreEqual("ci-room-setup", workspaceEvent.CardInstanceId);
        Assert.AreEqual("roomId:R101", workspaceEvent.AggregateRef);
        Assert.AreEqual("operator", workspaceEvent.ActorType);
        Assert.AreEqual("actor-operator", workspaceEvent.ActorId);
        Assert.AreEqual("R101", workspaceEvent.Payload["roomNo"]);
        Assert.AreEqual("wi-room-setup", workspaceEvent.Payload["operationsWorkItemId"]);
        CollectionAssert.Contains(workspaceEvent.EvidenceIds!.ToArray(), "evd-room-check");
    }
}
