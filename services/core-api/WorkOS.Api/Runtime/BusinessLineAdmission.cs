using System.Text.Json;

namespace WorkOS.Api.Runtime;

public sealed class BusinessLineAdmissionRegistry
{
    private readonly Dictionary<string, BusinessLineAdmissionEntry> entries;

    public BusinessLineAdmissionRegistry(IEnumerable<BusinessLineAdmissionEntry> entries)
    {
        this.entries = entries.ToDictionary(item => item.BusinessLineId, StringComparer.OrdinalIgnoreCase);
    }

    public static BusinessLineAdmissionRegistry LoadDefault() =>
        Load(Path.Combine("docs", "business", "business-line-registry.json"));

    public static BusinessLineAdmissionRegistry Load(string path)
    {
        var fullPath = ResolveRepoPath(path);
        var document = JsonSerializer.Deserialize<BusinessLineRegistryDocument>(
            File.ReadAllText(fullPath),
            new JsonSerializerOptions(JsonSerializerDefaults.Web)
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                ReadCommentHandling = JsonCommentHandling.Skip
            }) ?? throw new InvalidOperationException("business_line_registry_invalid");
        return new BusinessLineAdmissionRegistry(document.BusinessLines);
    }

    public BusinessLineAdmissionEntry? Find(string businessLineId) =>
        entries.TryGetValue(businessLineId, out var entry) ? entry : null;

    public IReadOnlyList<BusinessLineAdmissionEntry> Entries => entries.Values.ToArray();

    private static string ResolveRepoPath(string path)
    {
        if (Path.IsPathRooted(path) || File.Exists(path))
        {
            return path;
        }

        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "WorkOSNext.sln")))
        {
            current = current.Parent;
        }

        return Path.Combine(current?.FullName ?? Directory.GetCurrentDirectory(), path);
    }
}

public sealed class BusinessLineAdmissionEvaluator
{
    private readonly BusinessLineAdmissionRegistry registry;

    public BusinessLineAdmissionEvaluator(BusinessLineAdmissionRegistry registry)
    {
        this.registry = registry;
    }

    public BusinessLineAdmissionDecision Evaluate(string businessLineId, string action, string scope)
    {
        var entry = registry.Find(businessLineId);
        if (entry is null)
        {
            return BusinessLineAdmissionDecision.Blocked(404, "business_line_not_registered");
        }

        if (entry.ProductionAllowed is false &&
            (action.Equals("production_confirm", StringComparison.OrdinalIgnoreCase) ||
             scope.Equals("production", StringComparison.OrdinalIgnoreCase)))
        {
            return BusinessLineAdmissionDecision.Blocked(403, "business_line_production_not_allowed");
        }

        if (entry.Level.StartsWith("L0", StringComparison.OrdinalIgnoreCase) &&
            action.Contains("confirm", StringComparison.OrdinalIgnoreCase))
        {
            return BusinessLineAdmissionDecision.Blocked(403, "l0_business_line_confirm_blocked");
        }

        if (!entry.ProductionConfirmAllowed &&
            action.Equals("production_confirm", StringComparison.OrdinalIgnoreCase))
        {
            return BusinessLineAdmissionDecision.Blocked(403, "production_confirm_blocked_by_admission");
        }

        return new BusinessLineAdmissionDecision(true, 200, "admission_allowed", entry.SurfaceMode, entry.Level);
    }
}

public sealed class BusinessLineAdmissionGuard
{
    private readonly BusinessLineAdmissionEvaluator evaluator;

    public BusinessLineAdmissionGuard(BusinessLineAdmissionEvaluator evaluator)
    {
        this.evaluator = evaluator;
    }

    public BusinessLineAdmissionDecision EnsureCanConfirm(string businessLineId, string scope = "production") =>
        evaluator.Evaluate(businessLineId, "production_confirm", scope);
}

public sealed record BusinessLineRegistryDocument(
    string Version,
    IReadOnlyList<BusinessLineAdmissionEntry> BusinessLines);

public sealed record BusinessLineAdmissionEntry(
    string BusinessLineId,
    string DisplayName,
    string Level,
    bool ProductionAllowed,
    bool InternalPilotAllowed,
    bool ProductionConfirmAllowed,
    string SurfaceMode,
    IReadOnlyList<string> AllowedScopes,
    IReadOnlyList<string> BlockedActions,
    string Owner,
    string NextGate);

public sealed record BusinessLineAdmissionDecision(
    bool Allowed,
    int StatusCode,
    string Reason,
    string SurfaceMode,
    string Level)
{
    public static BusinessLineAdmissionDecision Blocked(int statusCode, string reason) =>
        new(false, statusCode, reason, "blocked", "unknown");
}
