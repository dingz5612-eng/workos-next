using System.Text.Json;

namespace WorkOS.Api.Runtime;

internal sealed class ArchitectureExceptionCatalog
{
    private static readonly Lazy<ArchitectureExceptionCatalog> Default = new(LoadFromRepo);
    private readonly IReadOnlyList<ArchitectureExceptionRecord> exceptions;

    private ArchitectureExceptionCatalog(IReadOnlyList<ArchitectureExceptionRecord> exceptions)
    {
        this.exceptions = exceptions;
    }

    public static ArchitectureExceptionCatalog LoadDefault() => Default.Value;

    public IReadOnlyList<string> ActiveRuleIds() =>
        exceptions
            .Where(item => item.ExpiresAt >= DateTimeOffset.UtcNow)
            .Select(item => item.RuleId)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private static ArchitectureExceptionCatalog LoadFromRepo()
    {
        var path = LocateArchitectureFile("architecture-exceptions.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var records = document.RootElement.GetProperty("exceptions").EnumerateArray()
            .Select(item => new ArchitectureExceptionRecord(
                item.GetProperty("ruleId").GetString() ?? string.Empty,
                DateTimeOffset.Parse(item.GetProperty("expiresAt").GetString() ?? DateTimeOffset.MinValue.ToString("O"))))
            .ToArray();
        return new ArchitectureExceptionCatalog(records);
    }

    private static string LocateArchitectureFile(string fileName)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "docs", "architecture", fileName);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate docs/architecture/{fileName}.");
    }

    private sealed record ArchitectureExceptionRecord(string RuleId, DateTimeOffset ExpiresAt);
}
