namespace WorkOS.Api.Runtime;

internal static class RiskCommandLensBuilder
{
    public const string LensName = "RiskCommandLens";

    public static IReadOnlyList<RiskCommandLensItem> Build(IEnumerable<RiskCommandLensInput> inputs) =>
        inputs
            .Where(HasMagnitude)
            .Where(HasProductionSources)
            .Where(HasDrilldown)
            .Select(ToItem)
            .ToArray();

    private static RiskCommandLensItem ToItem(RiskCommandLensInput input)
    {
        var severityReason = string.IsNullOrWhiteSpace(input.severityReason)
            ? $"Severity is derived from {input.riskType} source facts."
            : input.severityReason;

        return new RiskCommandLensItem(
            LensName,
            Distinct(input.sourceOfTruthTables),
            input.projectionLagSeconds,
            input.riskId,
            input.riskType,
            input.severity,
            severityReason,
            input.amount,
            input.count,
            input.amount is null ? null : input.currency,
            input.ownerRole,
            input.ownerActorId,
            input.relatedObject,
            input.relatedCaseId,
            Distinct(input.relatedWorkItemIds),
            Distinct(input.relatedLedgerRefs),
            Distinct(input.relatedEvidenceRefs),
            Distinct(input.relatedEventIds),
            input.resolveAction,
            input.dueAt,
            input.drilldownUrl);
    }

    private static bool HasMagnitude(RiskCommandLensInput input) =>
        (input.amount.HasValue && input.amount.Value > 0m) ||
        (input.count.HasValue && input.count.Value > 0);

    private static bool HasProductionSources(RiskCommandLensInput input)
    {
        var sourceTables = Distinct(input.sourceOfTruthTables);
        if (sourceTables.Length == 0 || sourceTables.Any(IsDemoSource))
        {
            return false;
        }

        return Distinct(input.relatedWorkItemIds).Length > 0 ||
            Distinct(input.relatedLedgerRefs).Length > 0 ||
            Distinct(input.relatedEvidenceRefs).Length > 0 ||
            Distinct(input.relatedEventIds).Length > 0;
    }

    private static bool HasDrilldown(RiskCommandLensInput input) =>
        !string.IsNullOrWhiteSpace(input.drilldownUrl) &&
        !string.IsNullOrWhiteSpace(input.resolveAction) &&
        !string.IsNullOrWhiteSpace(input.ownerRole) &&
        !string.IsNullOrWhiteSpace(input.relatedObject);

    private static bool IsDemoSource(string source) =>
        source.Contains("demo", StringComparison.OrdinalIgnoreCase) ||
        source.Contains("fixture", StringComparison.OrdinalIgnoreCase) ||
        source.Contains("mock", StringComparison.OrdinalIgnoreCase) ||
        source.Contains("frontend", StringComparison.OrdinalIgnoreCase);

    private static string[] Distinct(IEnumerable<string>? values) =>
        values?
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray() ?? [];
}

internal sealed record RiskCommandLensInput(
    string riskId,
    string riskType,
    string severity,
    string? severityReason,
    decimal? amount,
    long? count,
    string? currency,
    string ownerRole,
    string? ownerActorId,
    string relatedObject,
    string? relatedCaseId,
    IReadOnlyList<string> relatedWorkItemIds,
    IReadOnlyList<string> relatedLedgerRefs,
    IReadOnlyList<string> relatedEvidenceRefs,
    IReadOnlyList<string> relatedEventIds,
    string resolveAction,
    DateTime? dueAt,
    string drilldownUrl,
    IReadOnlyList<string> sourceOfTruthTables,
    long projectionLagSeconds);

internal sealed record RiskCommandLensItem(
    string lens,
    IReadOnlyList<string> sourceOfTruthTables,
    long projectionLagSeconds,
    string riskId,
    string riskType,
    string severity,
    string severityReason,
    decimal? amount,
    long? count,
    string? currency,
    string ownerRole,
    string? ownerActorId,
    string relatedObject,
    string? relatedCaseId,
    IReadOnlyList<string> relatedWorkItemIds,
    IReadOnlyList<string> relatedLedgerRefs,
    IReadOnlyList<string> relatedEvidenceRefs,
    IReadOnlyList<string> relatedEventIds,
    string resolveAction,
    DateTime? dueAt,
    string drilldownUrl);
