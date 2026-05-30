using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class ProductionObservabilityMetricsTests
{
    [TestMethod]
    public void production_observability_exposes_required_runtime_outbox_projection_metrics()
    {
        var now = DateTimeOffset.Parse("2026-05-30T00:00:00Z");
        var metrics = ProductionObservabilityMetricsBuilder.Build(
            new[]
            {
                Outbox("outbox-pending", now.AddSeconds(-90), processedAtUtc: null, deadLetteredAtUtc: null),
                Outbox("outbox-dead", now.AddSeconds(-120), processedAtUtc: null, deadLetteredAtUtc: now.AddSeconds(-10))
            },
            Array.Empty<BehaviorEventRecord>(),
            new Dictionary<string, int>
            {
                ["role_confirmation_forbidden:finance"] = 2,
                ["evidence_object_required"] = 3,
                ["idempotency_conflict:different_payload"] = 1,
                ["handler_failure:PaymentConfirm"] = 1
            },
            new long[] { 10, 20, 40, 100 },
            ProductionObservabilityDatabaseSnapshot.Empty with
            {
                ReplayCount = 4,
                RebuildCount = 5,
                StaleLensCount = 6
            },
            projectionLagSeconds: 7,
            now);

        Assert.AreEqual(100, metrics.Runtime.ConfirmLatencyP95Ms);
        Assert.AreEqual(7, metrics.Runtime.ConfirmFailureCount);
        Assert.AreEqual(2, metrics.Runtime.ForbiddenCount403);
        Assert.AreEqual(1, metrics.Runtime.ConflictCount409);
        Assert.AreEqual(4, metrics.Runtime.ValidationCount422);
        Assert.AreEqual(1, metrics.Runtime.HandlerFailureCount);
        Assert.AreEqual(90, metrics.Outbox.OutboxLagSeconds);
        Assert.AreEqual(1, metrics.Outbox.DeadLetterCount);
        Assert.AreEqual(4, metrics.Outbox.ReplayCount);
        Assert.AreEqual(7, metrics.Projection.ProjectionLagSeconds);
        Assert.AreEqual(5, metrics.Projection.RebuildCount);
        Assert.AreEqual(6, metrics.Projection.StaleLensCount);
    }

    [TestMethod]
    public void production_observability_exposes_mobile_money_deposit_checkout_control_plane_metrics()
    {
        var now = DateTimeOffset.Parse("2026-05-30T00:00:00Z");
        var metrics = ProductionObservabilityMetricsBuilder.Build(
            Array.Empty<OutboxMessage>(),
            new[]
            {
                Behavior("MobileWorkItemBundleLatency", "work_item_bundle", """{"durationMs":120}""", now),
                Behavior("MobileWorkItemBundleLatency", "work_item_bundle", """{"durationMs":300}""", now),
                Behavior("EvidenceUploadFailed", "mobile_upload", "", now),
                Behavior("SubmitRetryQueued", "mobile_submit", "", now),
                Behavior("DraftRecovered", "mobile_draft", "", now)
            },
            new Dictionary<string, int>(),
            Array.Empty<long>(),
            ProductionObservabilityDatabaseSnapshot.Empty with
            {
                PaymentConfirmWithoutEvidenceViolations = 1,
                AllocationOverAvailableViolations = 2,
                StayBalanceMismatchCount = 3,
                AvailableRefundNegativeCount = 4,
                RefundFailedDoubleCount = 5,
                HeldAmountNegativeCount = 6,
                OpenBlockers = 7,
                DuplicateBlockers = 8,
                FakeCloseAttempts = 9,
                GateResultStatus = "blocked",
                RedShadowReports = 10,
                BlockingInvariantFailures = 11,
                ReleaseState = "paused"
            },
            projectionLagSeconds: 0,
            now);

        Assert.AreEqual(300, metrics.Mobile.WorkItemBundleP95Ms);
        Assert.AreEqual(2, metrics.Mobile.WorkItemBundleSampleCount);
        Assert.AreEqual(1, metrics.Mobile.UploadFailureCount);
        Assert.AreEqual(1, metrics.Mobile.SubmitRetryCount);
        Assert.AreEqual(1, metrics.Mobile.DraftRecoveryCount);
        Assert.AreEqual(1, metrics.Money.PaymentConfirmWithoutEvidenceViolations);
        Assert.AreEqual(2, metrics.Money.AllocationOverAvailableViolations);
        Assert.AreEqual(3, metrics.Money.StayBalanceMismatchCount);
        Assert.AreEqual(4, metrics.Deposit.AvailableRefundNegativeCount);
        Assert.AreEqual(5, metrics.Deposit.RefundFailedDoubleCount);
        Assert.AreEqual(6, metrics.Deposit.HeldAmountNegativeCount);
        Assert.AreEqual(7, metrics.Checkout.OpenBlockers);
        Assert.AreEqual(8, metrics.Checkout.DuplicateBlockers);
        Assert.AreEqual(9, metrics.Checkout.FakeCloseAttempts);
        Assert.AreEqual("blocked", metrics.ControlPlane.GateResultStatus);
        Assert.AreEqual(10, metrics.ControlPlane.RedShadowReports);
        Assert.AreEqual(11, metrics.ControlPlane.BlockingInvariantFailures);
        Assert.AreEqual("paused", metrics.ControlPlane.ReleaseState);
    }

    private static BehaviorEventRecord Behavior(string eventType, string objectType, string source, DateTimeOffset now) =>
        new($"beh-{eventType}", eventType, objectType, "object-1", "zh-CN", source, now);

    private static OutboxMessage Outbox(
        string messageId,
        DateTimeOffset createdAtUtc,
        DateTimeOffset? processedAtUtc,
        DateTimeOffset? deadLetteredAtUtc) =>
        new(
            messageId,
            $"evt-{messageId}",
            "tenant-test",
            "card-test",
            "TestEvent",
            "corr-test",
            null,
            "req-test",
            createdAtUtc,
            processedAtUtc,
            new WorkspaceEvent(
                $"evt-{messageId}",
                "tenant-test",
                "card-test",
                "TestEvent",
                "corr-test",
                null,
                "req-test",
                "actor",
                "actor-test",
                createdAtUtc,
                new Dictionary<string, string>(),
                Array.Empty<string>()),
            DeadLetteredAtUtc: deadLetteredAtUtc);
}
