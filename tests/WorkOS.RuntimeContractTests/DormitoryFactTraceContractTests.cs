using System.Text.Json;
using WorkOS.Api.Runtime;

internal static class DormitoryFactTraceContractTests
{
    public static void Run()
    {
        using var contract = JsonDocument.Parse(File.ReadAllText(RepoPath("docs", "contracts", "oma.current.json")));
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
            Require(capabilities.Contains(capability), $"OMA contract missing dormitory capability {capability}.");
        }

        var trace = new FactTraceV1(
            "tenant-dormitory",
            "trace-dorm-cert",
            "case-dorm-cert",
            "wi-dorm-cert",
            "submission-dorm-cert",
            ["evt-dorm-cert"],
            ["ltx-dorm-cert"],
            ["le-dorm-cert-debit", "le-dorm-cert-credit"],
            ["projection-dorm-cert"]);

        Require(trace.CaseRef == "case-dorm-cert", "FactTrace must link case.");
        Require(trace.WorkItemRef == "wi-dorm-cert", "FactTrace must link work item.");
        Require(trace.SubmissionRef == "submission-dorm-cert", "FactTrace must link submission.");
        Require(trace.DomainEventRefs.Count == 1, "FactTrace must link domain events.");
        Require(trace.LedgerTransactionRefs.Count == 1, "FactTrace must link ledger transactions.");
        Require(trace.LedgerEntryRefs.Count == 2, "FactTrace must link ledger entries.");
    }

    private static string RepoPath(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        Require(current is not null, "Could not locate repository root.");
        return Path.Combine(new[] { current!.FullName }.Concat(segments).ToArray());
    }

    private static void Require(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
