namespace WorkOS.Api.Runtime;

internal static class RuntimeStateMigrator
{
    public const string CurrentSchemaVersion = "runtime-state.v2.card-instance-evidence";

    public static readonly IReadOnlyList<string> Entries = new[]
    {
        "v1.merge-seed-contracts",
        "v2.card-instance-evidence-envelope"
    };

    public static RuntimeState Migrate(RuntimeState state)
    {
        return string.Equals(state.SchemaVersion, CurrentSchemaVersion, StringComparison.OrdinalIgnoreCase)
            ? state
            : state with { SchemaVersion = CurrentSchemaVersion };
    }

    public static RuntimeState DryRun(RuntimeState state) => Migrate(state);
}
