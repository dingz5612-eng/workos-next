using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryRuntimeTraceReplayTests
{
    [TestMethod]
    public void runtime_replay_committed_submission_is_queryable_by_fact_trace()
    {
        var store = DormitoryRuntimeReplayHarness.CreatePostgresStore();
        var unitOfWork = DormitoryRuntimeReplayHarness.CreateUnitOfWork(store);
        var suffix = Guid.NewGuid().ToString("N");
        var request = DormitoryRuntimeReplayHarness.Request(
            tenantId: "tenant-d1-test",
            caseId: $"case-d1-trace-{suffix}",
            workItemId: $"wi-d1-trace-{suffix}",
            cardId: "depositReceipt",
            idempotencyKey: $"idem-d1-trace-{suffix}",
            fields: new Dictionary<string, object>
            {
                ["depositAmount"] = "1200",
                ["currency"] = "KGS",
                ["depositId"] = "deposit-account-d1-test"
            },
            evidenceIds: new[] { $"ev-d1-trace-{suffix}" });

        var result = unitOfWork.Commit(request);
        var trace = store.GetFactTraceBySubmission(result.SubmissionId);

        Assert.AreEqual(200, result.StatusCode);
        Assert.AreEqual("committed", result.CommitStatus);
        Assert.IsNotNull(trace);
        Assert.AreEqual(request.CaseId, trace.CaseRef);
        Assert.AreEqual(request.WorkItemId, trace.WorkItemRef);
        Assert.AreEqual(result.SubmissionId, trace.SubmissionRef);
        Assert.IsTrue(trace.DomainEventRefs.Count > 0, "committed replay must have DomainEvent refs.");
        Assert.IsTrue(trace.LedgerTransactionRefs.Count > 0, "deposit replay must have LedgerTransaction refs.");
        Assert.IsTrue(trace.LedgerEntryRefs.Count >= 2, "deposit replay must have balanced LedgerEntry refs.");
    }
}

internal static class DormitoryRuntimeReplayHarness
{
    public static PostgresOperationsStore CreatePostgresStore()
    {
        var connectionString = ConnectionString();
        ProjectionRuntime.OpenPostgres(connectionString, RuntimeAuthOptions.Development);
        return new PostgresOperationsStore(connectionString);
    }

    public static OperationsUnitOfWork CreateUnitOfWork(PostgresOperationsStore store) =>
        new(
            new CommandEnvelopeBuilder(),
            new CommandSubmissionService(store),
            new IdempotencyService(store),
            new PayloadHashService(),
            new SliceCommandHandlerRouter().Register(
                CanonicalOperationsApiService.ConfirmCommandType,
                CanonicalOperationsApiService.HandleConfirmCommand));

    public static OperationsCommandRequest Request(
        string tenantId,
        string caseId,
        string workItemId,
        string cardId,
        string idempotencyKey,
        IReadOnlyDictionary<string, object> fields,
        IReadOnlyList<string>? evidenceIds = null) =>
        new(
            tenantId,
            caseId,
            workItemId,
            CanonicalOperationsApiService.ConfirmCommandType,
            "CommandEnvelope.v1",
            $"work-item:{cardId}:v1",
            idempotencyKey,
            new Dictionary<string, object>
            {
                ["workspaceId"] = WorkspaceFor(cardId),
                ["cardId"] = cardId,
                ["submissionId"] = $"sub-{idempotencyKey}",
                ["cardInstanceId"] = $"ci-{idempotencyKey}",
                ["aggregateRef"] = caseId,
                ["deviceId"] = "device-d1-test",
                ["fieldValues"] = fields,
                ["evidenceIds"] = evidenceIds ?? Array.Empty<string>(),
                ["source"] = "operations_unit_of_work"
            },
            "operator-token",
            $"{tenantId}:{workItemId}:confirm",
            $"sub-{idempotencyKey}",
            $"corr-{idempotencyKey}");

    public static string ReadText(string relativePath) =>
        File.ReadAllText(ResolvePath(relativePath));

    public static JsonDocument ReadJson(string relativePath) =>
        JsonDocument.Parse(ReadText(relativePath));

    private static string ResolvePath(string relativePath)
    {
        var directory = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, relativePath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new FileNotFoundException($"Cannot resolve {relativePath} from test working directory.");
    }

    private static string WorkspaceFor(string cardId) =>
        cardId switch
        {
            "depositReceipt" or "depositRefundPayment" => "W-STAY-DEPOSIT-LEDGER",
            "paymentReceipt" or "paymentAdjustment" => "W-STAY-PAYMENT-LEDGER",
            "serviceTaskComplete" => "W-STAY-SERVICE-TASK",
            "periodClose" => "W-STAY-PERIOD-ANALYTICS",
            _ => "W-STAY-RESOURCE"
        };

    private static string ConnectionString() =>
        Environment.GetEnvironmentVariable("WORKOS_TEST_CONNECTION")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__WorkOSRuntime")
        ?? "Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev";
}
