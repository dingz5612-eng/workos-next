using System.Text.Json;
using WorkOS.Api.Runtime;

internal static class DormitoryFactTraceContractTests
{
    public static void Run()
    {
        var scenariosPath = RepoPath("docs", "v5.4", "dormitory-certification-scenarios.json");
        using var document = JsonDocument.Parse(File.ReadAllText(scenariosPath));
        var scenarios = document.RootElement.GetProperty("scenarios").EnumerateArray().ToArray();
        Require(scenarios.Length == 10, "Dormitory certification pack must define ten scenarios.");

        foreach (var scenario in scenarios)
        {
            foreach (var field in new[] { "scenario_id", "name", "expected_outcome", "card_id", "cutover_state", "rollback_or_compensation_path" })
            {
                Require(scenario.TryGetProperty(field, out var value) && value.ValueKind != JsonValueKind.Null && !string.IsNullOrWhiteSpace(value.ToString()),
                    $"Dormitory scenario missing {field}.");
            }
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
