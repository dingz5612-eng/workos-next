using System.Security.Cryptography;
using System.Text;

namespace WorkOS.Api.Runtime;

public sealed class RuntimeAuthOptions
{
    public Dictionary<string, string> PasswordSha256ByUsername { get; init; } = new(StringComparer.OrdinalIgnoreCase);

    public bool RequireTrustedDeviceForHighRiskActions { get; set; }

    public static RuntimeAuthOptions Development => new()
    {
        PasswordSha256ByUsername = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["operator"] = RuntimePasswordHasher.Sha256("dev"),
            ["finance"] = RuntimePasswordHasher.Sha256("dev"),
            ["manager"] = RuntimePasswordHasher.Sha256("dev"),
            ["ai"] = RuntimePasswordHasher.Sha256("dev")
        }
    };

    public static bool UsesDevelopmentPasswords(RuntimeAuthOptions options)
    {
        var development = Development.PasswordSha256ByUsername;
        return options.PasswordSha256ByUsername.Count > 0 &&
            options.PasswordSha256ByUsername.All(item =>
                development.TryGetValue(item.Key, out var hash) &&
                hash.Equals(item.Value, StringComparison.OrdinalIgnoreCase));
    }
}

public static class RuntimePasswordHasher
{
    public static string Sha256(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    public static bool Verify(string value, string expectedSha256) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(Sha256(value)),
            Encoding.UTF8.GetBytes(expectedSha256.ToLowerInvariant()));
}

public sealed class RuntimeCorsOptions
{
    public string[] AllowedOrigins { get; init; } =
    {
        "http://127.0.0.1:5175",
        "http://localhost:5175",
        "http://127.0.0.1:5176",
        "http://localhost:5176"
    };
}
