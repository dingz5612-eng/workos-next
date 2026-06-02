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
            ["admin"] = RuntimePasswordHasher.Sha256("dev"),
            ["releaseOwner"] = RuntimePasswordHasher.Sha256("dev"),
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
    private const int SaltBytes = 16;
    private const int HashBytes = 32;
    public const int DefaultPbkdf2Iterations = 210_000;

    public static string Sha256(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    public static string Pbkdf2Sha256(string value, int iterations = DefaultPbkdf2Iterations)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(value),
            salt,
            iterations,
            HashAlgorithmName.SHA256,
            HashBytes);

        return $"pbkdf2-sha256:{iterations}:{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string value, string expectedHash)
    {
        if (IsPbkdf2Sha256(expectedHash))
        {
            return VerifyPbkdf2Sha256(value, expectedHash);
        }

        if (IsLegacySha256(expectedHash))
        {
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(Sha256(value)),
                Encoding.UTF8.GetBytes(expectedHash.ToLowerInvariant()));
        }

        return false;
    }

    public static bool IsVersionedSlowHash(string hash) =>
        IsPbkdf2Sha256(hash);

    public static bool IsLegacySha256(string hash) =>
        hash.Length == 64 && hash.All(Uri.IsHexDigit);

    private static bool IsPbkdf2Sha256(string hash) =>
        hash.StartsWith("pbkdf2-sha256:", StringComparison.OrdinalIgnoreCase);

    private static bool VerifyPbkdf2Sha256(string value, string expectedHash)
    {
        var parts = expectedHash.Split(':');
        if (parts.Length != 4 ||
            !int.TryParse(parts[1], out var iterations) ||
            iterations < 100_000)
        {
            return false;
        }

        byte[] salt;
        byte[] expected;
        try
        {
            salt = Convert.FromBase64String(parts[2]);
            expected = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(value),
            salt,
            iterations,
            HashAlgorithmName.SHA256,
            expected.Length);

        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
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
