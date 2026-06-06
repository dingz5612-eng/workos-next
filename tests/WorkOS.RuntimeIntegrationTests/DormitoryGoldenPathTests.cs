using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Text.Json;
using WorkOS.Api.Runtime;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DormitoryGoldenPathTests
{
    [TestMethod]
    public void DormitoryCommittedScenariosProduceSubmissionEventTraceAndPendingProjection()
    {
        var harness = DormitoryScenarioHarness.Create();

        foreach (var scenario in DormitoryScenarioHarness.CommittedScenarios())
        {
            var result = harness.Commit(scenario);
            var trace = harness.Store.GetFactTraceBySubmission(result.SubmissionId);

            Assert.AreEqual("committed", result.CommitStatus);
            Assert.AreEqual("pending", result.ProjectionStatus, "projection pending must not fail the business commit");
            Assert.IsTrue(harness.Store.Submissions.Any(item => item.SubmissionId == result.SubmissionId));
            Assert.IsTrue(harness.Store.DomainEvents.Any(item => item.SubmissionId == result.SubmissionId));
            Assert.IsNotNull(trace);
            Assert.AreEqual(scenario.CaseId, trace!.CaseRef);
            Assert.AreEqual(scenario.WorkItemId, trace.WorkItemRef);
            Assert.AreEqual(result.SubmissionId, trace.SubmissionRef);
            Assert.IsTrue(trace.DomainEventRefs.Count > 0);
        }
    }

    [TestMethod]
    public void DormitoryOmaContractDeclaresScenarioCapabilities()
    {
        using var contract = JsonDocument.Parse(File.ReadAllText(DormitoryScenarioHarness.RepoPath("docs", "contracts", "oma.current.json")));
        var capabilities = contract.RootElement.GetProperty("productCapabilities")
            .EnumerateArray()
            .Select(item => item.GetProperty("id").GetString())
            .ToHashSet(StringComparer.Ordinal);

        foreach (var capability in new[]
        {
            "accommodation.resource",
            "accommodation.lead-reservation",
            "accommodation.checkin",
            "accommodation.lifecycle",
            "accommodation.checkout",
            "accommodation.service-task"
        })
        {
            Assert.IsTrue(capabilities.Contains(capability), $"{capability} must be part of the current OMA contract.");
        }
    }
}

internal sealed record DormitoryScenario(
    string ScenarioId,
    string CardId,
    string CaseId,
    string WorkItemId,
    string IdempotencyKey,
    IReadOnlyList<string> EvidenceIds,
    decimal? Amount = null,
    string Currency = "KGS");

internal sealed class DormitoryScenarioHarness
{
    private DormitoryScenarioHarness(InMemoryOperationsStore store, OperationsUnitOfWork unitOfWork)
    {
        Store = store;
        UnitOfWork = unitOfWork;
    }

    public InMemoryOperationsStore Store { get; }

    private OperationsUnitOfWork UnitOfWork { get; }

    public static DormitoryScenarioHarness Create()
    {
        var store = new InMemoryOperationsStore();
        var router = new SliceCommandHandlerRouter()
            .Register(CanonicalOperationsApiService.ConfirmCommandType, CanonicalOperationsApiService.HandleConfirmCommand);
        return new DormitoryScenarioHarness(
            store,
            new OperationsUnitOfWork(
                new CommandEnvelopeBuilder(),
                new CommandSubmissionService(store),
                new IdempotencyService(store),
                new PayloadHashService(),
                router));
    }

    public OperationsCommitResult Commit(DormitoryScenario scenario) =>
        UnitOfWork.Commit(Request(scenario));

    public OperationsCommitResult CommitWithPayload(DormitoryScenario scenario, IReadOnlyDictionary<string, object> extraFields) =>
        UnitOfWork.Commit(Request(scenario, extraFields));

    public OperationsCommandRequest Request(
        DormitoryScenario scenario,
        IReadOnlyDictionary<string, object>? extraFields = null)
    {
        var fields = new Dictionary<string, object>
        {
            ["currency"] = scenario.Currency
        };
        if (scenario.Amount is not null)
        {
            fields["amount"] = scenario.Amount.Value;
        }
        if (scenario.CardId.Equals("RefundDeposit", StringComparison.OrdinalIgnoreCase))
        {
            fields["depositAccountId"] = $"deposit-account-{scenario.CaseId}";
        }

        if (extraFields is not null)
        {
            foreach (var (key, value) in extraFields)
            {
                fields[key] = value;
            }
        }

        return new OperationsCommandRequest(
            "tenant-dormitory",
            scenario.CaseId,
            scenario.WorkItemId,
            CanonicalOperationsApiService.ConfirmCommandType,
            "CommandEnvelope.v1",
            $"dormitory:{scenario.CardId}:v1",
            scenario.IdempotencyKey,
            new Dictionary<string, object>
            {
                ["workspaceId"] = "W-DORMITORY-GOLDEN-PILOT",
                ["cardId"] = scenario.CardId,
                ["submissionId"] = $"submission-{scenario.ScenarioId}",
                ["cardInstanceId"] = $"card-instance-{scenario.ScenarioId}",
                ["fieldValues"] = fields,
                ["evidenceIds"] = scenario.EvidenceIds.ToArray(),
                ["source"] = "dormitory_certification"
            },
            "actor-dormitory-ops",
            $"tenant-dormitory:{scenario.WorkItemId}:confirm",
            $"cause-{scenario.ScenarioId}",
            $"corr-{scenario.ScenarioId}");
    }

    public static IReadOnlyList<DormitoryScenario> CommittedScenarios() =>
        new[]
        {
            new DormitoryScenario("dorm-cert-001", "BedAssignmentConfirm", "case-dorm-cert-001", "wi-dorm-cert-001", "idem-dorm-001", ["identity-document", "reservation-acknowledgement", "bed-availability-proof"]),
            new DormitoryScenario("dorm-cert-004", "ServiceTaskComplete", "case-dorm-cert-004", "wi-dorm-cert-004", "idem-dorm-004", ["completion-photo", "verification-check"]),
            new DormitoryScenario("dorm-cert-007", "PeriodReview", "case-dorm-cert-007", "wi-dorm-cert-007", "idem-dorm-007", ["period-review-pack"])
        };

    public static string RepoPath(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Assert.IsNotNull(current, "Could not locate repository root.");
        return Path.Combine(new[] { current!.FullName }.Concat(segments).ToArray());
    }
}
