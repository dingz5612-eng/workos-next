namespace WorkOS.ControlPlaneRunners;

public sealed class RunnerOptions
{
    private readonly Dictionary<string, string> values;

    private RunnerOptions(Dictionary<string, string> values)
    {
        this.values = values;
    }

    public static RunnerOptions Parse(IEnumerable<string> args)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var arg in args)
        {
            if (!arg.StartsWith("--", StringComparison.Ordinal))
            {
                continue;
            }

            var pair = arg[2..].Split('=', 2);
            values[pair[0]] = pair.Length == 2 ? pair[1] : "true";
        }

        return new RunnerOptions(values);
    }

    public string Get(string name, string defaultValue) =>
        values.TryGetValue(name, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value
            : defaultValue;

    public string? Get(string name) =>
        values.TryGetValue(name, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value
            : null;

    public bool GetBool(string name, bool defaultValue = false)
    {
        var value = Get(name);
        if (value is null)
        {
            return defaultValue;
        }

        return value.Equals("true", StringComparison.OrdinalIgnoreCase) ||
               value.Equals("1", StringComparison.OrdinalIgnoreCase) ||
               value.Equals("yes", StringComparison.OrdinalIgnoreCase);
    }
}
