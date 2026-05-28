namespace WorkOS.Api.Runtime;

internal static class MigrationScriptLoader
{
    public static IReadOnlyList<MigrationScript> Load(string? configuredPath)
    {
        var directory = ResolveDirectory(configuredPath);
        return Directory
            .GetFiles(directory, "*.sql")
            .OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase)
            .Select(path => new MigrationScript(
                Path.GetFileNameWithoutExtension(path),
                File.ReadAllText(path)))
            .ToArray();
    }

    private static string ResolveDirectory(string? configuredPath)
    {
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            return RequireDirectory(Path.GetFullPath(configuredPath));
        }

        var baseDirectory = AppContext.BaseDirectory;
        foreach (var candidate in new[]
                 {
                     Path.Combine(baseDirectory, "infra", "db", "migrations"),
                     Path.Combine(baseDirectory, "db", "migrations")
                 })
        {
            if (Directory.Exists(candidate))
            {
                return candidate;
            }
        }

        var cursor = new DirectoryInfo(baseDirectory);
        while (cursor is not null)
        {
            var candidate = Path.Combine(cursor.FullName, "infra", "db", "migrations");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            cursor = cursor.Parent;
        }

        throw new DirectoryNotFoundException("Could not find infra/db/migrations. Configure Migrations:Path for deployed environments.");
    }

    private static string RequireDirectory(string path) =>
        Directory.Exists(path)
            ? path
            : throw new DirectoryNotFoundException($"Migration directory does not exist: {path}");
}

internal sealed record MigrationScript(string MigrationId, string Sql);
