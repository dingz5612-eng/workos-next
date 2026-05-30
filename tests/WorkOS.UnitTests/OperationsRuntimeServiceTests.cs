using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class OperationsRuntimeServiceTests
{
    [TestMethod]
    public void operations_confirm_writes_or_records_submission()
    {
        var service = Service(out _, out var submissions);

        var result = service.ConfirmWorkItem("W-OPS:roomSetup", Request(), "actor-token", "req-1");

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual(1, submissions.Records.Count);
        Assert.AreEqual("operations_adapter", submissions.Records[0].Source);
        Assert.AreEqual(result.PayloadHash, submissions.Records[0].PayloadHash);
        Assert.AreEqual(result.CommandSubmissionId, submissions.Records[0].CommandSubmissionId);
    }

    [TestMethod]
    public void operations_confirm_returns_commit_projection_status()
    {
        var service = Service(out _, out _);

        var result = service.ConfirmWorkItem("W-OPS:roomSetup", Request(), "actor-token", "req-1");

        Assert.AreEqual("committed", result.CommitStatus);
        Assert.AreEqual("projected", result.ProjectionStatus);
        Assert.IsTrue(result.Confirmed);
        Assert.AreEqual("operations_adapter", result.Source);
    }

    [TestMethod]
    public void operations_confirm_same_idempotency_same_payload_stable()
    {
        var service = Service(out var runtime, out var submissions);
        var request = Request(idempotencyKey: "idem-stable");

        var first = service.ConfirmWorkItem("W-OPS:roomSetup", request, "actor-token", "req-1");
        var second = service.ConfirmWorkItem("W-OPS:roomSetup", request, "actor-token", "req-2");

        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual(1, submissions.Records.Count);
        Assert.AreEqual(first.CommandSubmissionId, second.CommandSubmissionId);
        Assert.AreEqual(first.PayloadHash, second.PayloadHash);
        Assert.AreEqual(first.ResultEventIds[0], second.ResultEventIds[0]);
    }

    [TestMethod]
    public void operations_confirm_same_idempotency_different_payload_409()
    {
        var service = Service(out var runtime, out var submissions);

        var first = service.ConfirmWorkItem("W-OPS:roomSetup", Request(idempotencyKey: "idem-conflict", roomNo: "A101"), "actor-token", "req-1");
        var second = service.ConfirmWorkItem("W-OPS:roomSetup", Request(idempotencyKey: "idem-conflict", roomNo: "B202"), "actor-token", "req-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status409Conflict, second.StatusCode);
        Assert.AreEqual("idempotency_conflict", second.Error);
        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual(1, submissions.Records.Count);
    }

    [TestMethod]
    public void operations_confirm_403_422_no_side_effects()
    {
        var forbidden = Service(out var forbiddenRuntime, out var forbiddenSubmissions, ConfirmStatus.Forbidden, "role_confirmation_forbidden:operator");
        var businessBlocked = Service(out var blockedRuntime, out var blockedSubmissions, ConfirmStatus.Forbidden, "deposit_evidence_required");

        var forbiddenResult = forbidden.ConfirmWorkItem("W-OPS:roomSetup", Request(idempotencyKey: "idem-403"), "actor-token", "req-403");
        var blockedResult = businessBlocked.ConfirmWorkItem("W-OPS:roomSetup", Request(idempotencyKey: "idem-422"), "actor-token", "req-422");

        Assert.AreEqual(StatusCodes.Status403Forbidden, forbiddenResult.StatusCode);
        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, blockedResult.StatusCode);
        Assert.AreEqual(1, forbiddenRuntime.ConfirmCount);
        Assert.AreEqual(1, blockedRuntime.ConfirmCount);
        Assert.AreEqual(0, forbiddenRuntime.BusinessResultCount);
        Assert.AreEqual(0, blockedRuntime.BusinessResultCount);
        Assert.AreEqual(1, forbiddenSubmissions.Records.Count);
        Assert.AreEqual(1, blockedSubmissions.Records.Count);
        Assert.AreEqual("rejected", forbiddenSubmissions.Records[0].ProcessingStatus);
        Assert.AreEqual("rejected", blockedSubmissions.Records[0].ProcessingStatus);
    }

    [TestMethod]
    public void same_key_same_payload_returns_same_result()
    {
        var service = Service(out var runtime, out var submissions);
        var request = Request(idempotencyKey: "idem-same-payload");

        var first = service.ConfirmWorkItem("W-OPS:roomSetup", request, "actor-token", "req-same-1");
        var second = service.ConfirmWorkItem("W-OPS:roomSetup", request, "actor-token", "req-same-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, second.StatusCode);
        Assert.AreEqual(first.CommandSubmissionId, second.CommandSubmissionId);
        Assert.AreEqual(first.PayloadHash, second.PayloadHash);
        CollectionAssert.AreEqual(first.ResultEventIds.ToArray(), second.ResultEventIds.ToArray());
        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual(1, runtime.BusinessResultCount);
        Assert.AreEqual(1, submissions.Records.Count);
        Assert.AreEqual("committed", submissions.Records[0].ProcessingStatus);
    }

    [TestMethod]
    public void same_key_different_payload_returns_409()
    {
        var service = Service(out var runtime, out var submissions);

        var first = service.ConfirmWorkItem("W-OPS:roomSetup", Request(idempotencyKey: "idem-409", roomNo: "A101"), "actor-token", "req-409-1");
        var conflict = service.ConfirmWorkItem("W-OPS:roomSetup", Request(idempotencyKey: "idem-409", roomNo: "B202"), "actor-token", "req-409-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.AreEqual("idempotency_conflict", conflict.Error);
        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual(1, runtime.BusinessResultCount);
        Assert.AreEqual(1, submissions.Records.Count);
    }

    [TestMethod]
    public void double_click_does_not_duplicate_submission()
    {
        var service = Service(out var runtime, out var submissions);
        var request = Request(idempotencyKey: "idem-double-click");

        var first = service.ConfirmWorkItem("W-OPS:roomSetup", request, "actor-token", "req-double-1");
        var second = service.ConfirmWorkItem("W-OPS:roomSetup", request, "actor-token", "req-double-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, second.StatusCode);
        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual(1, runtime.BusinessResultCount);
        Assert.AreEqual(1, submissions.Records.Count);
        Assert.AreEqual(submissions.Records[0].CommandSubmissionId, second.CommandSubmissionId);
    }

    [TestMethod]
    public void status_409_no_side_effects()
    {
        var service = Service(out var runtime, out var submissions);

        var first = service.ConfirmWorkItem("W-OPS:roomSetup", Request(idempotencyKey: "idem-no-side-effects", roomNo: "A101"), "actor-token", "req-ns-1");
        var conflict = service.ConfirmWorkItem("W-OPS:roomSetup", Request(idempotencyKey: "idem-no-side-effects", roomNo: "B202"), "actor-token", "req-ns-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual(1, runtime.BusinessResultCount);
        Assert.AreEqual(1, submissions.Records.Count);
        Assert.AreEqual(first.CommandSubmissionId, submissions.Records[0].CommandSubmissionId);
    }

    [TestMethod]
    public void status_422_no_side_effects()
    {
        var service = Service(out var runtime, out var submissions, ConfirmStatus.Forbidden, "deposit_evidence_required");

        var result = service.ConfirmWorkItem("W-OPS:roomSetup", Request(idempotencyKey: "idem-422-only"), "actor-token", "req-422-only");

        Assert.AreEqual(StatusCodes.Status422UnprocessableEntity, result.StatusCode);
        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual(0, runtime.BusinessResultCount);
        Assert.AreEqual(1, submissions.Records.Count);
        Assert.AreEqual("rejected", submissions.Records[0].ProcessingStatus);
    }

    [TestMethod]
    public void handler_failure_rolls_back_submission_event_outbox()
    {
        var runtime = new FakeOperationsRuntime(ConfirmStatus.Confirmed, null, throwOnConfirm: true);
        var service = Service(runtime, out var submissions);

        var result = service.ConfirmWorkItem("W-OPS:roomSetup", Request(idempotencyKey: "idem-handler-failure"), "actor-token", "req-handler-failure");

        Assert.AreEqual(StatusCodes.Status500InternalServerError, result.StatusCode);
        Assert.AreEqual("handler_failure", result.Error);
        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual(0, runtime.BusinessResultCount);
        Assert.AreEqual(0, submissions.Records.Count);
    }

    [TestMethod]
    public void same_tenant_key_conflicts_across_slices_before_handler()
    {
        var runtime = new FakeOperationsRuntime(
            ConfirmStatus.Confirmed,
            null,
            intents: new[]
            {
                Intent("wi-slice-a", "tenant-ops", "W-OPS", "roomSetup"),
                Intent("wi-slice-b", "tenant-ops", "W-OPS-B", "roomSetup")
            });
        var service = Service(runtime, out var submissions);

        var first = service.ConfirmWorkItem("wi-slice-a", Request(idempotencyKey: "idem-tenant", roomNo: "A101"), "actor-token", "req-tenant-1");
        var conflict = service.ConfirmWorkItem("wi-slice-b", Request(idempotencyKey: "idem-tenant", roomNo: "B202"), "actor-token", "req-tenant-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual(1, runtime.BusinessResultCount);
        Assert.AreEqual(1, submissions.Records.Count);
        Assert.AreEqual("tenant-ops", submissions.Records[0].TenantId);
    }

    [TestMethod]
    public void old_prepare_returns_compatible_payload()
    {
        var service = Service(out _, out _);

        var result = service.PrepareWorkspaceCard("W-OPS", "roomSetup", new PrepareCardRequest("sub-old", "ci-old", "room:A101"));
        var payload = Payload(result);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual(true, payload["prepared"]);
        Assert.AreEqual("W-OPS", payload["workspaceId"]);
        Assert.AreEqual("roomSetup", payload["cardId"]);
        Assert.AreEqual("W-OPS:roomSetup", payload["workItemId"]);
        Assert.AreEqual("W-OPS", payload["caseId"]);
        Assert.IsTrue(payload.ContainsKey("card"));
        Assert.IsTrue(payload.ContainsKey("allowedActions"));
        Assert.IsTrue(payload.ContainsKey("fieldDefaults"));
    }

    [TestMethod]
    public void old_confirm_calls_operations_service()
    {
        var service = Service(out var runtime, out _);

        var result = service.ConfirmWorkspaceCard("W-OPS", "roomSetup", LegacyRequest("idem-old-call"), "actor-token", "req-old-call");
        var payload = Payload(result);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual("operations_adapter", payload["source"]);
        Assert.AreEqual("W-OPS:roomSetup", payload["workItemId"]);
    }

    [TestMethod]
    public void old_confirm_writes_submission()
    {
        var service = Service(out _, out var submissions);

        var result = service.ConfirmWorkspaceCard("W-OPS", "roomSetup", LegacyRequest("idem-old-record"), "actor-token", "req-old-record");
        var payload = Payload(result);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual(1, submissions.Records.Count);
        Assert.AreEqual("operations_adapter", submissions.Records[0].Source);
        Assert.AreEqual("W-OPS", submissions.Records[0].WorkspaceId);
        Assert.AreEqual("roomSetup", submissions.Records[0].CardId);
        Assert.AreEqual(payload["commandSubmissionId"], submissions.Records[0].CommandSubmissionId);
    }

    [TestMethod]
    public void old_confirm_duplicate_payload_remains_compatible()
    {
        var service = Service(out var runtime, out var submissions);

        var first = service.ConfirmWorkspaceCard("W-OPS", "roomSetup", LegacyRequest("idem-old-duplicate", "A101"), "actor-token", "req-old-duplicate-1");
        var second = service.ConfirmWorkspaceCard("W-OPS", "roomSetup", LegacyRequest("idem-old-duplicate", "B202"), "actor-token", "req-old-duplicate-2");

        Assert.AreEqual(StatusCodes.Status200OK, first.StatusCode);
        Assert.AreEqual(StatusCodes.Status200OK, second.StatusCode);
        Assert.AreEqual(1, runtime.ConfirmCount);
        Assert.AreEqual(1, submissions.Records.Count);
        Assert.AreEqual(Payload(first)["commandSubmissionId"], Payload(second)["commandSubmissionId"]);
    }

    [TestMethod]
    public void old_confirm_not_break_existing_tests()
    {
        var service = Service(out _, out _, ConfirmStatus.ProjectionFailed);

        var result = service.ConfirmWorkspaceCard("W-OPS", "roomSetup", LegacyRequest("idem-old-projection-failed"), "actor-token", "req-old-projection-failed");
        var payload = Payload(result);

        Assert.AreEqual(StatusCodes.Status200OK, result.StatusCode);
        Assert.AreEqual(true, payload["confirmed"]);
        Assert.AreEqual("committed", payload["commitStatus"]);
        Assert.AreEqual("failed", payload["projectionStatus"]);
        CollectionAssert.AreEqual(new[] { "evt-1" }, ((IReadOnlyList<string>)payload["resultEventIds"]!).ToArray());
        Assert.IsTrue(payload.ContainsKey("events"));
        Assert.IsTrue(payload.ContainsKey("workspace"));
        Assert.IsTrue(payload.ContainsKey("projection"));
    }

    private static OperationsRuntimeService Service(
        out FakeOperationsRuntime runtime,
        out InMemoryOperationsCommandSubmissionStore submissions,
        ConfirmStatus status = ConfirmStatus.Confirmed,
        string? reason = null)
    {
        runtime = new FakeOperationsRuntime(status, reason);
        submissions = new InMemoryOperationsCommandSubmissionStore();
        return new OperationsRuntimeService(runtime, submissions);
    }

    private static OperationsRuntimeService Service(
        FakeOperationsRuntime runtime,
        out InMemoryOperationsCommandSubmissionStore submissions)
    {
        submissions = new InMemoryOperationsCommandSubmissionStore();
        return new OperationsRuntimeService(runtime, submissions);
    }

    private static ProcessWorkItemIntentRecord Intent(string workItemId, string tenantId, string workspaceId, string cardId) =>
        new(
            $"intent-{workItemId}",
            "process-run-ops",
            tenantId,
            workItemId,
            cardId,
            workspaceId,
            "operator",
            $"evt-{workItemId}",
            "open",
            DateTimeOffset.UtcNow,
            new Dictionary<string, string>
            {
                ["caseId"] = workspaceId,
                ["cardId"] = cardId
            });

    private static ConfirmWorkItemRequest Request(string idempotencyKey = "idem-1", string roomNo = "A101") =>
        new(
            Language: "zh-CN",
            IdempotencyKey: idempotencyKey,
            FieldValues: new Dictionary<string, string> { ["roomNo"] = roomNo },
            EvidenceIds: Array.Empty<string>(),
            SubmissionId: $"sub-{idempotencyKey}",
            CardInstanceId: $"ci-{idempotencyKey}");

    private static ConfirmCardRequest LegacyRequest(string idempotencyKey, string roomNo = "A101") =>
        new(
            "zh-CN",
            idempotencyKey,
            new Dictionary<string, string> { ["roomNo"] = roomNo },
            Array.Empty<string>(),
            $"sub-{idempotencyKey}",
            $"ci-{idempotencyKey}");

    private static IReadOnlyDictionary<string, object?> Payload(CompatibilityApiResult result) =>
        (IReadOnlyDictionary<string, object?>)result.Payload!;

    private sealed class FakeOperationsRuntime : IOperationsRuntimeAdapter
    {
        private readonly ConfirmStatus status;
        private readonly string? reason;
        private readonly bool throwOnConfirm;
        private readonly IReadOnlyList<WorkspaceProjection> workspaces;
        private readonly IReadOnlyList<ProcessWorkItemIntentRecord> intents;

        public FakeOperationsRuntime(
            ConfirmStatus status,
            string? reason,
            bool throwOnConfirm = false,
            IReadOnlyList<ProcessWorkItemIntentRecord>? intents = null)
        {
            this.status = status;
            this.reason = reason;
            this.throwOnConfirm = throwOnConfirm;
            this.intents = intents ?? Array.Empty<ProcessWorkItemIntentRecord>();
            workspaces = new[]
            {
                Workspace("W-OPS"),
                Workspace("W-OPS-B")
            };
        }

        public int ConfirmCount { get; private set; }

        public int BusinessResultCount { get; private set; }

        public WorkspaceProjection? FindWorkspace(string workspaceId) =>
            workspaces.FirstOrDefault(workspace => workspace.Id.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));

        public IReadOnlyList<ProcessWorkItemIntentRecord> GetProcessWorkItemIntents(string? tenantId = null) =>
            string.IsNullOrWhiteSpace(tenantId)
                ? intents
                : intents.Where(intent => intent.TenantId.Equals(tenantId, StringComparison.OrdinalIgnoreCase)).ToArray();

        public object? Prepare(string workspaceId, string cardId, PrepareCardRequest? request = null) =>
            new { prepared = true };

        public ConfirmResult ValidateConfirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken) =>
            status is ConfirmStatus.Confirmed or ConfirmStatus.ProjectionFailed
                ? new ConfirmResult(ConfirmStatus.Confirmed, null, null)
                : new ConfirmResult(status, reason, null);

        public ConfirmResult Confirm(string workspaceId, string cardId, ConfirmCardRequest request, string actorToken)
        {
            ConfirmCount++;
            if (throwOnConfirm)
            {
                throw new InvalidOperationException("handler_failure_after_validation");
            }

            if (status is not ConfirmStatus.Confirmed and not ConfirmStatus.ProjectionFailed)
            {
                return new ConfirmResult(status, reason, null);
            }

            var workspace = FindWorkspace(workspaceId)!;
            BusinessResultCount++;
            var response = new ConfirmCardResponse(
                true,
                "committed",
                status is ConfirmStatus.ProjectionFailed ? "failed" : "projected",
                workspaceId,
                $"{workspaceId}:{cardId}",
                request.SubmissionId ?? "sub",
                new[] { $"evt-{ConfirmCount}" },
                "已提交成功。",
                new Dictionary<string, object>
                {
                    ["disableRetry"] = true,
                    ["refreshProjection"] = true,
                    ["observeOutbox"] = false
                },
                Array.Empty<WorkspaceEvent>(),
                workspace);
            return new ConfirmResult(status, null, response);
        }

        private static WorkspaceProjection Workspace(string workspaceId) =>
            new(
                "IntentWorkspaceProjection",
                workspaceId,
                "stay",
                $"task-{workspaceId}",
                Text("Operations"),
                Text("Operations"),
                new[] { Card("roomSetup") },
                Text("Next"),
                Array.Empty<BlockerRule>());

        private static CardProjection Card(string cardId) =>
            new(
                "WorkspaceCardProjection",
                cardId,
                "ready",
                Text(cardId),
                new FieldSet(Array.Empty<FieldProjection>(), new[] { Field("roomNo") }, Array.Empty<FieldProjection>()),
                Array.Empty<EvidenceRequirement>(),
                Array.Empty<SystemCheck>(),
                Array.Empty<BlockerRule>(),
                Array.Empty<EventDefinition>(),
                new TransitionDefinition("prepare", "confirm", "block"),
                new ConfirmationPolicy(true, false, "operator", Text("Confirm")));

        private static FieldProjection Field(string fieldId) =>
            new(
                fieldId,
                Text(fieldId),
                "business",
                "text",
                true,
                "runtime",
                true,
                fieldId,
                new FieldUi("text", string.Empty, Array.Empty<FieldOption>(), string.Empty, string.Empty, false),
                Text(fieldId));

        private static IReadOnlyDictionary<string, string> Text(string value) =>
            new Dictionary<string, string>
            {
                ["zh-CN"] = value,
                ["ru-RU"] = value
            };
    }
}
