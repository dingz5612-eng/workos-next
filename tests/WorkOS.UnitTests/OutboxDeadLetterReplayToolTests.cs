using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class OutboxDeadLetterReplayToolTests
{
    [TestMethod]
    public void dead_letter_single_replay()
    {
        var store = new FakeOutboxDeadLetterReplayStore(Message("outbox-1", "EVT-1", "T1", "Accommodation.PaymentConfirmed"));
        var result = new OutboxDeadLetterReplayService(store).Run(AuthorizedRequest(
            "replay",
            MessageId: "outbox-1",
            ActorId: "ops-user",
            Reason: "projector fix deployed"));

        Assert.AreEqual("replay_queued", result.Status);
        Assert.AreEqual(1, result.MessageCount);
        Assert.AreEqual("outbox-1", store.Released.Single());
        Assert.AreEqual(1, store.Audits.Count);
        Assert.AreEqual("replay", store.Audits.Single().Action);
    }

    [TestMethod]
    public void dead_letter_batch_replay()
    {
        var store = new FakeOutboxDeadLetterReplayStore(
            Message("outbox-1", "EVT-1", "T1", "Accommodation.PaymentConfirmed"),
            Message("outbox-2", "EVT-2", "T1", "Accommodation.PaymentConfirmed"),
            Message("outbox-3", "EVT-3", "T2", "Accommodation.DepositConfirmedReceived"));

        var result = new OutboxDeadLetterReplayService(store).Run(AuthorizedRequest(
            "replay",
            EventType: "Accommodation.PaymentConfirmed",
            TenantId: "T1",
            ActorId: "ops-user",
            Reason: "replay payment projection after deploy"));

        Assert.AreEqual("replay_queued", result.Status);
        CollectionAssert.AreEquivalent(new[] { "outbox-1", "outbox-2" }, store.Released.ToArray());
        Assert.AreEqual(2, store.Audits.Count);
        Assert.IsTrue(store.Audits.All(item => item.Reason == "replay payment projection after deploy"));
    }

    [TestMethod]
    public void replay_idempotent()
    {
        var store = new FakeOutboxDeadLetterReplayStore(Message("outbox-1", "EVT-1", "T1", "Accommodation.PaymentConfirmed"));
        var service = new OutboxDeadLetterReplayService(store);

        var first = service.Run(AuthorizedRequest("replay", MessageId: "outbox-1", ActorId: "ops-user", Reason: "first replay"));
        var second = service.Run(AuthorizedRequest("replay", MessageId: "outbox-1", ActorId: "ops-user", Reason: "duplicate click"));

        Assert.AreEqual("replay_queued", first.Status);
        Assert.AreEqual("already_pending", second.Status);
        Assert.AreEqual(1, store.Released.Count);
        Assert.AreEqual(2, store.Audits.Count);
    }

    [TestMethod]
    public void replay_audit_recorded()
    {
        var store = new FakeOutboxDeadLetterReplayStore(Message("outbox-1", "EVT-1", "T1", "Accommodation.PaymentConfirmed"));

        new OutboxDeadLetterReplayService(store).Run(AuthorizedRequest(
            "ignore",
            MessageId: "outbox-1",
            ActorId: "release-manager",
            Reason: "obsolete notification after manual reconciliation"));

        var audit = store.Audits.Single();
        Assert.AreEqual("ignore", audit.Action);
        Assert.AreEqual("ignored", audit.Status);
        Assert.AreEqual("release-manager", audit.ActorId);
        Assert.AreEqual("obsolete notification after manual reconciliation", audit.Reason);
        StringAssert.Contains(audit.DetailsJson, "outbox-1");
    }

    [TestMethod]
    public void unhandled_p0_dead_letter_blocks_final_release_until_handled()
    {
        var store = new FakeOutboxDeadLetterReplayStore(Message("outbox-1", "EVT-1", "T1", "Accommodation.PaymentConfirmed"));
        var service = new OutboxDeadLetterReplayService(store);

        var listed = service.Run(new DeadLetterReplayRequest("list", TenantId: "T1"));
        var replayed = service.Run(AuthorizedRequest(
            "replay",
            MessageId: "outbox-1",
            ActorId: "ops-user",
            Reason: "projector fixed before final lock"));

        Assert.AreEqual(1, listed.UnhandledP0DeadLetterCount);
        Assert.AreEqual(0, replayed.UnhandledP0DeadLetterCount);
    }

    [TestMethod]
    public void replay_does_not_duplicate_domain_event()
    {
        var source = File.ReadAllText(RepoPath("services", "core-api", "WorkOS.Api", "Runtime", "OutboxDeadLetterReplayTool.cs"));

        Assert.IsFalse(source.Contains("insert into audit_events", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(source.Contains("insert into domain_events", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(source.Contains("AppendAuditEventAndOutbox", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void dead_letter_list_and_inspect_support_body()
    {
        var store = new FakeOutboxDeadLetterReplayStore(Message("outbox-1", "EVT-1", "T1", "Accommodation.PaymentConfirmed"));
        var service = new OutboxDeadLetterReplayService(store);

        var listed = service.Run(new DeadLetterReplayRequest("list", TenantId: "T1"));
        var inspected = service.Run(new DeadLetterReplayRequest("inspect", MessageId: "outbox-1"));

        Assert.AreEqual("listed", listed.Status);
        Assert.IsNull(listed.Messages.Single().Body);
        Assert.AreEqual("inspected", inspected.Status);
        Assert.IsNotNull(inspected.Messages.Single().Body);
        StringAssert.Contains(inspected.Messages.Single().Body!, "Accommodation.PaymentConfirmed");
    }

    [TestMethod]
    public void dead_letter_replay_migration_declares_audit_and_release_blocker_contract()
    {
        var migration = File.ReadAllText(RepoPath("infra", "db", "migrations", "023_outbox_dead_letter_replay_ops.sql"));

        foreach (var term in new[]
        {
            "create table if not exists outbox_dead_letter_replay_audits",
            "actor_id text not null",
            "reason text not null",
            "action in ('replay', 'ignore')",
            "status in ('replay_queued', 'ignored', 'already_processed', 'already_pending', 'not_found', 'failed')"
        })
        {
            Assert.IsTrue(migration.Contains(term, StringComparison.OrdinalIgnoreCase), $"dead-letter migration missing {term}");
        }
    }

    [TestMethod]
    public void dead_letter_script_exposes_cli_actions()
    {
        var script = File.ReadAllText(RepoPath("scripts", "outbox", "dead-letter"));
        var parsed = OutboxDeadLetterReplayCli.Parse(new[]
        {
            "replay",
            "--event-type", "Accommodation.PaymentConfirmed",
            "--tenant", "T1",
            "--actor", "ops-user",
            "--reason", "projector fix deployed",
            "--actor-role", "operator",
            "--capabilities", "deadletter.replay",
            "--device-id", "pc-1",
            "--device-trust", "trusted",
            "--take", "10"
        });

        Assert.IsTrue(script.Contains("dead-letter"));
        Assert.AreEqual("replay", parsed.Request.Action);
        Assert.AreEqual("Accommodation.PaymentConfirmed", parsed.Request.EventType);
        Assert.AreEqual("T1", parsed.Request.TenantId);
        Assert.AreEqual("ops-user", parsed.Request.ActorId);
        Assert.AreEqual("projector fix deployed", parsed.Request.Reason);
        Assert.AreEqual(10, parsed.Request.Take);
        CollectionAssert.Contains(parsed.Request.ActorCapabilities!.ToArray(), "deadletter.replay");
        Assert.AreEqual("trusted", parsed.Request.DeviceTrustStatus);
    }

    [TestMethod]
    public void dead_letter_replay_requires_capability_trusted_device_and_audit_reason()
    {
        var store = new FakeOutboxDeadLetterReplayStore(Message("outbox-1", "EVT-1", "T1", "Accommodation.PaymentConfirmed"));
        var service = new OutboxDeadLetterReplayService(store);

        AssertInvalidOperation(() => service.Run(new DeadLetterReplayRequest(
            "replay",
            MessageId: "outbox-1",
            ActorId: "ops-user",
            Reason: "projector fix",
            ActorRole: "operator",
            ActorCapabilities: Array.Empty<string>(),
            DeviceId: "pc-1",
            DeviceTrustStatus: "trusted")));

        AssertInvalidOperation(() => service.Run(new DeadLetterReplayRequest(
            "replay",
            MessageId: "outbox-1",
            ActorId: "ops-user",
            Reason: "projector fix",
            ActorRole: "operator",
            ActorCapabilities: ["deadletter.replay"],
            DeviceId: "pc-1",
            DeviceTrustStatus: "untrusted")));
    }

    private static OutboxMessage Message(
        string messageId,
        string eventId,
        string tenantId,
        string eventType,
        DateTimeOffset? processedAtUtc = null,
        DateTimeOffset? deadLetteredAtUtc = null)
    {
        var occurredAt = DateTimeOffset.Parse("2026-05-30T00:00:00Z");
        var workspaceEvent = new WorkspaceEvent(
            eventId,
            tenantId,
            "paymentConfirm",
            eventType,
            $"corr-{eventId}",
            null,
            $"req-{eventId}",
            "human",
            "actor-1",
            occurredAt,
            new Dictionary<string, string> { ["tenantId"] = tenantId },
            ["PaymentRiskLens"]);

        return new OutboxMessage(
            messageId,
            eventId,
            tenantId,
            "paymentConfirm",
            eventType,
            $"corr-{eventId}",
            null,
            $"req-{eventId}",
            occurredAt,
            processedAtUtc,
            workspaceEvent,
            AttemptCount: 3,
            DeadLetteredAtUtc: deadLetteredAtUtc ?? occurredAt.AddMinutes(5),
            LastError: "projector timeout");
    }

    private static DeadLetterReplayRequest AuthorizedRequest(
        string action,
        string? MessageId = null,
        string? EventType = null,
        string? TenantId = null,
        string ActorId = "ops-user",
        string Reason = "production dead-letter repair",
        int Take = 50,
        bool IncludeBody = false) =>
        new(
            action,
            MessageId,
            EventType,
            TenantId,
            ActorId,
            Reason,
            Take,
            IncludeBody,
            ActorRole: "operator",
            ActorCapabilities: ["deadletter.replay"],
            DeviceId: "pc-1",
            DeviceTrustStatus: "trusted",
            Surface: "pc");

    private static void AssertInvalidOperation(Action action)
    {
        try
        {
            action();
        }
        catch (InvalidOperationException)
        {
            return;
        }

        Assert.Fail("Expected InvalidOperationException.");
    }

    private static string RepoPath(params string[] parts)
    {
        var cursor = new DirectoryInfo(AppContext.BaseDirectory);
        while (cursor is not null && !File.Exists(Path.Combine(cursor.FullName, "WorkOSNext.sln")))
        {
            cursor = cursor.Parent;
        }

        if (cursor is null)
        {
            throw new DirectoryNotFoundException("Could not locate WorkOSNext repo root.");
        }

        return Path.Combine(new[] { cursor.FullName }.Concat(parts).ToArray());
    }

    private sealed class FakeOutboxDeadLetterReplayStore : IOutboxDeadLetterReplayStore
    {
        private readonly Dictionary<string, OutboxMessage> messages;

        public FakeOutboxDeadLetterReplayStore(params OutboxMessage[] messages)
        {
            this.messages = messages.ToDictionary(item => item.MessageId, StringComparer.OrdinalIgnoreCase);
        }

        public List<string> Released { get; } = new();

        public List<OutboxDeadLetterReplayAuditWrite> Audits { get; } = new();

        public IReadOnlyList<OutboxMessage> ListDeadLetters(string? tenantId, string? eventType, int take) =>
            messages.Values
                .Where(item => item.ProcessedAtUtc is null)
                .Where(item => item.DeadLetteredAtUtc is not null)
                .Where(item => tenantId is null || item.WorkspaceId == tenantId)
                .Where(item => eventType is null || item.EventType == eventType)
                .OrderBy(item => item.CreatedAtUtc)
                .Take(take)
                .ToArray();

        public OutboxMessage? FindMessage(string messageId) =>
            messages.TryGetValue(messageId, out var message) ? message : null;

        public bool ReleaseDeadLetter(string messageId)
        {
            if (!messages.TryGetValue(messageId, out var message) ||
                message.ProcessedAtUtc is not null ||
                message.DeadLetteredAtUtc is null)
            {
                return false;
            }

            messages[messageId] = message with
            {
                DeadLetteredAtUtc = null,
                ClaimedBy = null,
                ClaimedAtUtc = null,
                ClaimExpiresAtUtc = null,
                LastError = null
            };
            Released.Add(messageId);
            return true;
        }

        public void WriteReplayAudit(OutboxDeadLetterReplayAuditWrite audit) =>
            Audits.Add(audit);

        public int CountUnhandledP0DeadLetters() =>
            messages.Values.Count(item =>
                item.ProcessedAtUtc is null &&
                item.DeadLetteredAtUtc is not null &&
                !Audits.Any(audit =>
                    audit.MessageId == item.MessageId &&
                    audit.Action == "ignore" &&
                    audit.Status == "ignored" &&
                    audit.CreatedAtUtc >= item.DeadLetteredAtUtc));
    }
}
