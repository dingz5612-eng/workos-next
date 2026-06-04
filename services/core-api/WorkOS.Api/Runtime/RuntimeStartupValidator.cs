using Npgsql;

namespace WorkOS.Api.Runtime;

public sealed class RuntimeMigrationOptions
{
    public string? Path { get; init; }

    public bool? RunOnStartup { get; init; }
}

public sealed record RuntimeStartupValidationResult(
    string Status,
    IReadOnlyList<string> Errors);

public static class RuntimeStartupValidator
{
    public static RuntimeStartupValidationResult Validate(
        string environmentName,
        RuntimeAuthOptions authOptions,
        string? connectionString,
        RuntimeCorsOptions corsOptions,
        string? allowedHosts,
        RuntimeMigrationOptions migrationOptions)
    {
        var errors = new List<string>();
        if (IsDevelopment(environmentName))
        {
            return new RuntimeStartupValidationResult("passed", errors);
        }

        if (authOptions.AllowDevelopmentAccounts)
        {
            errors.Add("Production / Pilot 下禁止启用 development-only demo accounts。");
        }

        if (RuntimeAuthOptions.UsesDevelopmentPasswords(authOptions))
        {
            errors.Add("Production 下禁止使用 development password。");
        }

        foreach (var item in authOptions.PasswordSha256ByUsername)
        {
            if (!RuntimePasswordHasher.IsVersionedSlowHash(item.Value))
            {
                errors.Add($"Production 下 {item.Key} 必须使用 pbkdf2-sha256 versioned slow hash，禁止旧式 SHA-256。");
            }
        }

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            errors.Add("Production 下 ConnectionStrings:WorkOSRuntime 不能为空。");
        }
        else if (LooksLikeDevelopmentConnection(connectionString))
        {
            errors.Add("Production 下 ConnectionStrings:WorkOSRuntime 禁止使用 localhost、127.0.0.1 或 workosnext_dev。");
        }

        if (corsOptions.AllowedOrigins.Length == 0)
        {
            errors.Add("Production 下 Cors.AllowedOrigins 不能为空。");
        }

        if (string.IsNullOrWhiteSpace(allowedHosts) || allowedHosts.Trim() == "*")
        {
            errors.Add("Production 下 AllowedHosts 禁止为空或使用 *。");
        }

        return new RuntimeStartupValidationResult(errors.Count == 0 ? "passed" : "failed", errors);
    }

    public static void ThrowIfInvalid(
        string environmentName,
        RuntimeAuthOptions authOptions,
        string? connectionString,
        RuntimeCorsOptions corsOptions,
        string? allowedHosts,
        RuntimeMigrationOptions migrationOptions)
    {
        var result = Validate(environmentName, authOptions, connectionString, corsOptions, allowedHosts, migrationOptions);
        if (result.Errors.Count == 0)
        {
            return;
        }

        throw new InvalidOperationException(string.Join(" ", result.Errors));
    }

    public static bool ShouldRunMigrations(string environmentName, RuntimeMigrationOptions options) =>
        options.RunOnStartup ?? IsDevelopment(environmentName);

    private static bool IsDevelopment(string environmentName) =>
        environmentName.Equals("Development", StringComparison.OrdinalIgnoreCase);

    private static bool LooksLikeDevelopmentConnection(string connectionString)
    {
        var normalized = connectionString.ToLowerInvariant();
        return normalized.Contains("host=localhost", StringComparison.Ordinal) ||
            normalized.Contains("host=127.0.0.1", StringComparison.Ordinal) ||
            normalized.Contains("workosnext_dev", StringComparison.Ordinal);
    }
}

public sealed record RuntimeReadinessResult(
    string Status,
    bool DatabaseConnected,
    bool SchemaMigrationsAccessible,
    IReadOnlyList<string> MissingTables,
    IReadOnlyList<string> Errors);

public static class RuntimeReadiness
{
    private static readonly string[] RequiredTables =
    {
        "schema_migrations",
        "runtime_documents",
        "account_users",
        "account_audit_events",
        "runtime_sessions",
        "device_sessions",
        "operations_cases",
        "operations_work_items",
        "operations_command_submissions",
        "operations_domain_events",
        "ledger_transactions",
        "evidence_objects"
    };

    public static RuntimeReadinessResult Check(string connectionString)
    {
        var missing = new List<string>();
        var errors = new List<string>();
        try
        {
            using var connection = new NpgsqlConnection(connectionString);
            connection.Open();

            foreach (var table in RequiredTables)
            {
                using var command = connection.CreateCommand();
                command.CommandText = "select to_regclass(@tableName)::text";
                command.Parameters.AddWithValue("tableName", table);
                if (command.ExecuteScalar() is null or DBNull)
                {
                    missing.Add(table);
                }
            }

            return new RuntimeReadinessResult(
                missing.Count == 0 ? "ready" : "not_ready",
                DatabaseConnected: true,
                SchemaMigrationsAccessible: !missing.Contains("schema_migrations", StringComparer.OrdinalIgnoreCase),
                MissingTables: missing,
                Errors: errors);
        }
        catch (Exception ex) when (ex is NpgsqlException or TimeoutException or InvalidOperationException)
        {
            errors.Add(ex.Message);
            return new RuntimeReadinessResult(
                "not_ready",
                DatabaseConnected: false,
                SchemaMigrationsAccessible: false,
                MissingTables: RequiredTables,
                Errors: errors);
        }
    }
}
