using System.Reflection;
using System.Text.Json;

namespace WorkOS.Api.Runtime;

public sealed class SearchKernelService
{
    private readonly ProjectionWorkspaceSearchAdapter projectionWorkspaceSearch;
    private readonly WorkItemDefinitionRegistryService definitions;
    private readonly AdmissionKernelService admission;
    private readonly LanguageSearchSynonymCatalog synonyms;

    public SearchKernelService(
        ProjectionWorkspaceSearchAdapter projectionWorkspaceSearch,
        WorkItemDefinitionRegistryService definitions,
        AdmissionKernelService admission)
    {
        this.projectionWorkspaceSearch = projectionWorkspaceSearch;
        this.definitions = definitions;
        this.admission = admission;
        synonyms = LanguageSearchSynonymCatalog.LoadDefault();
    }

    public IReadOnlyList<object> Search(
        ProjectionRuntime runtime,
        string? query,
        RuntimeActorContext actor,
        string? language = null)
    {
        var resolvedLanguage = NormalizeLanguage(language);
        var queryTerms = synonyms.Expand(query, resolvedLanguage);
        return SearchProjectionSources(runtime, query, queryTerms)
            .Select(item => BuildResult(item, queryTerms, actor, resolvedLanguage))
            .OrderByDescending(item => Convert.ToInt32(item["score"]))
            .ThenBy(item => Convert.ToString(item["resultId"]))
            .Cast<object>()
            .ToArray();
    }

    private IReadOnlyList<object> SearchProjectionSources(
        ProjectionRuntime runtime,
        string? query,
        IReadOnlyList<string> expandedTerms)
    {
        var sources = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        foreach (var term in SearchTerms(query, expandedTerms))
        {
            foreach (var item in projectionWorkspaceSearch.Search(runtime, term))
            {
                sources.TryAdd(SearchResultKey(item), item);
            }
        }

        return sources.Values.ToArray();
    }

    private static IReadOnlyList<string> SearchTerms(string? query, IReadOnlyList<string> expandedTerms) =>
        new[] { query ?? string.Empty }
            .Concat(expandedTerms)
            .Select(term => term.Trim())
            .Where(term => term.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(16)
            .ToArray();

    private static string SearchResultKey(object item)
    {
        var resultId = ReadString(item, "resultId");
        if (!string.IsNullOrWhiteSpace(resultId))
        {
            return resultId;
        }

        return string.Join(":", ReadString(item, "workspaceId"), ReadString(item, "cardId"), ReadString(item, "resultType"));
    }

    private Dictionary<string, object?> BuildResult(
        object projectionSource,
        IReadOnlyList<string> queryTerms,
        RuntimeActorContext actor,
        string language)
    {
        var workspaceId = ReadString(projectionSource, "workspaceId");
        var cardId = ReadString(projectionSource, "cardId");
        var resultId = FirstNonEmpty(ReadString(projectionSource, "resultId"), $"search:{workspaceId}:{cardId}");
        var definition = definitions.ResolveByWorkspaceCard(workspaceId, cardId);
        var decision = admission.EvaluateSearch(definition, actor);
        var existingTerms = ReadStringArray(projectionSource, "matchedTerms");
        var text = SafeText(projectionSource);
        var matchedTerms = existingTerms
            .Concat(queryTerms.Where(term => text.Contains(term, StringComparison.OrdinalIgnoreCase)))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var baseScore = ReadInt(projectionSource, "score");
        var score = baseScore + matchedTerms.Length * 40 + (decision.ConfirmAllowed ? 25 : 0);

        return new Dictionary<string, object?>
        {
            ["resultId"] = resultId,
            ["resultType"] = FirstNonEmpty(ReadString(projectionSource, "resultType"), "workspaceCardProjection"),
            ["workspaceId"] = workspaceId,
            ["cardId"] = cardId,
            ["title"] = ReadValue(projectionSource, "title") ?? Localized("Search result"),
            ["summary"] = ReadValue(projectionSource, "summary") ?? Localized(decision.Reason),
            ["matchedTerms"] = matchedTerms,
            ["score"] = score,
            ["target"] = ReadValue(projectionSource, "target") ?? new Dictionary<string, object?>
            {
                ["kind"] = "workspaceCard",
                ["workspaceId"] = workspaceId,
                ["cardId"] = cardId
            },
            ["admission"] = decision.ToContract(),
            ["traceRefs"] = Array.Empty<string>(),
            ["sourceRefs"] = new Dictionary<string, object?>
            {
                ["source"] = "SearchKernelService",
                ["inputAdapter"] = "ProjectionWorkspaceSearchAdapter",
                ["projectionAdapter"] = "LensQueryService.Search",
                ["workspaceId"] = workspaceId,
                ["cardId"] = cardId,
                ["definitionId"] = definition.DefinitionId,
                ["admissionDecisionRef"] = decision.AdmissionDecisionRef
            },
            ["language"] = language,
            ["explain"] = new Dictionary<string, string>
            {
                ["zh-CN"] = "搜索结果已由 Search Kernel 补充准入裁决、语言词表和来源引用。",
                ["ru-RU"] = "Результат поиска дополнен ядром поиска: допуск, язык и ссылки на источник.",
                ["ky-KG"] = "Издөө натыйжасына Search Kernel кирүү чечимин, тилди жана булак шилтемелерин кошту."
            }
        };
    }

    private static string NormalizeLanguage(string? language) =>
        language is "ru-RU" or "ky-KG" ? language : "zh-CN";

    private static object Localized(string value) =>
        new Dictionary<string, string>
        {
            ["zh-CN"] = value,
            ["ru-RU"] = value,
            ["ky-KG"] = value
        };

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static object? ReadValue(object source, string propertyName)
    {
        if (source is IReadOnlyDictionary<string, object?> nullableDictionary &&
            nullableDictionary.TryGetValue(propertyName, out var nullableValue))
        {
            return nullableValue;
        }

        if (source is IReadOnlyDictionary<string, object> dictionary &&
            dictionary.TryGetValue(propertyName, out var value))
        {
            return value;
        }

        var property = source.GetType().GetProperty(
            propertyName,
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.IgnoreCase);
        return property?.GetValue(source);
    }

    private static string ReadString(object source, string propertyName) =>
        Convert.ToString(ReadValue(source, propertyName)) ?? string.Empty;

    private static int ReadInt(object source, string propertyName) =>
        int.TryParse(ReadString(source, propertyName), out var value) ? value : 0;

    private static IReadOnlyList<string> ReadStringArray(object source, string propertyName) =>
        ReadValue(source, propertyName) switch
        {
            IEnumerable<string> strings => strings.ToArray(),
            IEnumerable<object> objects => objects.Select(item => Convert.ToString(item)).Where(item => !string.IsNullOrWhiteSpace(item)).Select(item => item!).ToArray(),
            string value when !string.IsNullOrWhiteSpace(value) => new[] { value },
            _ => Array.Empty<string>()
        };

    private static string SafeText(object? value)
    {
        if (value is null)
        {
            return string.Empty;
        }

        if (value is string or int or long or decimal or double or bool)
        {
            return Convert.ToString(value) ?? string.Empty;
        }

        if (value is System.Collections.IDictionary dictionary)
        {
            return string.Join(" ", dictionary.Values.Cast<object?>().Select(SafeText));
        }

        if (value is System.Collections.IEnumerable enumerable && value is not string)
        {
            return string.Join(" ", enumerable.Cast<object?>().Select(SafeText));
        }

        return string.Join(" ", value.GetType()
            .GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .Select(property => SafeText(property.GetValue(value))));
    }
}

public sealed class ProjectionWorkspaceSearchAdapter
{
    public IReadOnlyList<object> Search(ProjectionRuntime runtime, string? query) =>
        runtime.Search(query);
}

internal sealed class LanguageSearchSynonymCatalog
{
    private static readonly Lazy<LanguageSearchSynonymCatalog> Default = new(LoadFromRepo);
    private readonly IReadOnlyList<SearchSynonymEntry> entries;

    private LanguageSearchSynonymCatalog(IReadOnlyList<SearchSynonymEntry> entries)
    {
        this.entries = entries;
    }

    public static LanguageSearchSynonymCatalog LoadDefault() => Default.Value;

    public IReadOnlyList<string> Expand(string? query, string language)
    {
        var parts = (query ?? string.Empty)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
        foreach (var entry in entries)
        {
            var languageTerms = entry.Languages.TryGetValue(language, out var terms)
                ? terms
                : Array.Empty<string>();
            if (languageTerms.Any(term => parts.Any(part => term.Contains(part, StringComparison.OrdinalIgnoreCase) || part.Contains(term, StringComparison.OrdinalIgnoreCase))))
            {
                parts.Add(entry.Canonical);
                parts.AddRange(languageTerms);
            }
        }

        return parts
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static LanguageSearchSynonymCatalog LoadFromRepo()
    {
        var path = LocateContract("language", "search-synonyms.json");
        var document = JsonSerializer.Deserialize<SearchSynonymDocument>(
            File.ReadAllText(path),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("language_search_synonyms_invalid");
        return new LanguageSearchSynonymCatalog(document.Synonyms ?? Array.Empty<SearchSynonymEntry>());
    }

    private static string LocateContract(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(new[] { current.FullName, "docs", "contracts" }.Concat(segments).ToArray());
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate docs/contracts/{string.Join("/", segments)}.");
    }
}

internal sealed record SearchSynonymDocument(IReadOnlyList<SearchSynonymEntry>? Synonyms);

internal sealed record SearchSynonymEntry(
    string Canonical,
    IReadOnlyDictionary<string, IReadOnlyList<string>> Languages);
