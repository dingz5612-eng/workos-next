using System.Text.Json;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeSurfacePolicyCatalog
{
    private static readonly Lazy<RuntimeSurfacePolicyCatalog> Default = new(LoadFromRepo);
    private readonly IReadOnlyDictionary<string, RuntimeSurfacePolicy> byWorkspaceId;

    private RuntimeSurfacePolicyCatalog(IReadOnlyList<RuntimeSurfacePolicy> policies)
    {
        Policies = policies;
        byWorkspaceId = policies.ToDictionary(item => item.WorkspaceId, StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyList<RuntimeSurfacePolicy> Policies { get; }

    public static RuntimeSurfacePolicyCatalog LoadDefault() => Default.Value;

    public RuntimeSurfacePolicy? ForWorkspace(string workspaceId) =>
        byWorkspaceId.TryGetValue(workspaceId, out var policy) ? policy : null;

    public int MissingSurfaceCoverageCount(RuntimeState state) =>
        state.Workspaces.Count(workspace => ForWorkspace(workspace.Id) is null);

    public IReadOnlyList<string> MissingSurfaceCoverage(RuntimeState state) =>
        state.Workspaces
            .Where(workspace => ForWorkspace(workspace.Id) is null)
            .Select(workspace => workspace.Id)
            .OrderBy(id => id, StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private static RuntimeSurfacePolicyCatalog LoadFromRepo()
    {
        var path = LocateContract("runtime-surface-policy.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var policies = new List<RuntimeSurfacePolicy>();
        foreach (var item in document.RootElement.GetProperty("policies").EnumerateArray())
        {
            policies.Add(ParsePolicy(item));
        }

        return new RuntimeSurfacePolicyCatalog(policies);
    }

    private static RuntimeSurfacePolicy ParsePolicy(JsonElement item) =>
        new(
            RequiredString(item, "sliceId"),
            RequiredString(item, "workspaceId"),
            RequiredString(item, "domainGroup"),
            RequiredString(item, "defaultLens"),
            OptionalString(item, "hiddenReason"),
            ParseHome(item.GetProperty("home")),
            ParseWorkbench(item.GetProperty("workbench")),
            ParseSearch(item.GetProperty("search")),
            ParseLearning(item.GetProperty("learning")),
            ReadStringArray(item.GetProperty("lenses")),
            item.GetProperty("cards").EnumerateArray().Select(ParseCard).ToArray());

    private static SurfaceHomePolicy ParseHome(JsonElement item) =>
        new(ReadBool(item, "visible"), ReadInt(item, "priority"), RequiredString(item, "section"));

    private static SurfaceWorkbenchPolicy ParseWorkbench(JsonElement item) =>
        new(ReadBool(item, "visible"), RequiredString(item, "queueRule"));

    private static SurfaceSearchPolicy ParseSearch(JsonElement item) =>
        new(ReadBool(item, "visible"), ReadStringArray(item.GetProperty("keywords")), ReadStringArray(item.GetProperty("intentTags")));

    private static SurfaceLearningPolicy ParseLearning(JsonElement item) =>
        new(ReadBool(item, "visible"), RequiredString(item, "section"));

    private static SurfaceCardPolicy ParseCard(JsonElement item) =>
        new(
            RequiredString(item, "cardId"),
            ReadBool(item, "home"),
            ReadBool(item, "workbench"),
            ReadStringArray(item.GetProperty("searchKeywords")),
            ReadStringArray(item.GetProperty("intentTags")),
            RequiredString(item, "learningSection"),
            RequiredString(item, "defaultLens"),
            OptionalString(item, "hiddenReason"));

    private static string LocateContract(string fileName)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "docs", "contracts", fileName);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate docs/contracts/{fileName}.");
    }

    private static IReadOnlyList<string> ReadStringArray(JsonElement item) =>
        item.EnumerateArray()
            .Select(value => value.GetString() ?? string.Empty)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToArray();

    private static bool ReadBool(JsonElement item, string propertyName) =>
        item.TryGetProperty(propertyName, out var property) && property.GetBoolean();

    private static int ReadInt(JsonElement item, string propertyName) =>
        item.TryGetProperty(propertyName, out var property) ? property.GetInt32() : 0;

    private static string RequiredString(JsonElement item, string propertyName) =>
        item.GetProperty(propertyName).GetString() ?? string.Empty;

    private static string OptionalString(JsonElement item, string propertyName) =>
        item.TryGetProperty(propertyName, out var property) ? property.GetString() ?? string.Empty : string.Empty;
}

internal sealed record RuntimeSurfacePolicy(
    string SliceId,
    string WorkspaceId,
    string DomainGroup,
    string DefaultLens,
    string HiddenReason,
    SurfaceHomePolicy Home,
    SurfaceWorkbenchPolicy Workbench,
    SurfaceSearchPolicy Search,
    SurfaceLearningPolicy Learning,
    IReadOnlyList<string> Lenses,
    IReadOnlyList<SurfaceCardPolicy> Cards)
{
    public SurfaceCardPolicy? Card(string cardId) =>
        Cards.FirstOrDefault(item => item.CardId.Equals(cardId, StringComparison.OrdinalIgnoreCase));
}

internal sealed record SurfaceHomePolicy(bool Visible, int Priority, string Section);

internal sealed record SurfaceWorkbenchPolicy(bool Visible, string QueueRule);

internal sealed record SurfaceSearchPolicy(bool Visible, IReadOnlyList<string> Keywords, IReadOnlyList<string> IntentTags);

internal sealed record SurfaceLearningPolicy(bool Visible, string Section);

internal sealed record SurfaceCardPolicy(
    string CardId,
    bool Home,
    bool Workbench,
    IReadOnlyList<string> SearchKeywords,
    IReadOnlyList<string> IntentTags,
    string LearningSection,
    string DefaultLens,
    string HiddenReason);
