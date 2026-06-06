using System.Reflection;
using System.Text.Json;

namespace WorkOS.Api.Runtime;

public sealed class SearchKernelService
{
    private readonly ProjectionWorkspaceSearchAdapter projectionWorkspaceSearch;
    private readonly OperationsRuntimeService? operations;
    private readonly OperationsReadStore? operationsReadStore;
    private readonly WorkItemDefinitionRegistryService definitions;
    private readonly AdmissionKernelService admission;
    private readonly LanguageSearchSynonymCatalog synonyms;

    public SearchKernelService(
        ProjectionWorkspaceSearchAdapter projectionWorkspaceSearch,
        WorkItemDefinitionRegistryService definitions,
        AdmissionKernelService admission,
        OperationsRuntimeService? operations = null,
        OperationsReadStore? operationsReadStore = null)
    {
        this.projectionWorkspaceSearch = projectionWorkspaceSearch;
        this.operations = operations;
        this.operationsReadStore = operationsReadStore;
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
            .Concat(SearchOperationsSources(query, queryTerms, actor, resolvedLanguage))
            .GroupBy(item => Convert.ToString(item["resultId"]), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.OrderByDescending(item => Convert.ToInt32(item["score"])).First())
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

    internal IReadOnlyList<Dictionary<string, object?>> SearchOperationsSources(
        string? query,
        IReadOnlyList<string> expandedTerms,
        RuntimeActorContext actor,
        string language)
    {
        if (operations is null || operationsReadStore is null || string.IsNullOrWhiteSpace(query))
        {
            return Array.Empty<Dictionary<string, object?>>();
        }

        var records = new Dictionary<string, OperationsSearchRecord>(StringComparer.OrdinalIgnoreCase);
        foreach (var term in SearchTerms(query, expandedTerms))
        {
            foreach (var record in operationsReadStore.SearchOperations(actor.TenantId, term))
            {
                records.TryAdd(record.EventId, record);
            }
        }

        return records.Values
            .Select(record => BuildOperationsResult(record, expandedTerms, actor, language))
            .OfType<Dictionary<string, object?>>()
            .ToArray();
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
        var indexedAt = DateTimeOffset.UtcNow;

        return new Dictionary<string, object?>
        {
            ["resultId"] = resultId,
            ["resultType"] = "workspaceCardCompatibility",
            ["objectKind"] = "workspaceCard",
            ["workspaceId"] = workspaceId,
            ["cardId"] = cardId,
            ["title"] = ReadValue(projectionSource, "title") ?? Localized("Search result"),
            ["summary"] = ReadValue(projectionSource, "summary") ?? Localized(decision.Reason),
            ["matchedTerms"] = matchedTerms,
            ["score"] = score,
            ["target"] = new Dictionary<string, object?>
            {
                ["view"] = "operationPanel",
                ["kind"] = "workspaceCard",
                ["workspaceId"] = workspaceId,
                ["cardId"] = cardId,
                ["writeThroughSearchAllowed"] = false
            },
            ["admission"] = decision.ToContract(),
            ["permission"] = Permission("visible", "none", "business", Array.Empty<string>(), indexedAt),
            ["lineage"] = Lineage("ProjectionRuntime", "workspaceCardProjection", $"{workspaceId}:{cardId}", indexedAt, definition.DefinitionId),
            ["freshness"] = Freshness(indexedAt, 0, false),
            ["ranking"] = Ranking("oam.search-ranking-policy.v1", matchedTerms, decision.ConfirmAllowed),
            ["businessContext"] = new Dictionary<string, object?>
            {
                ["workspaceId"] = workspaceId,
                ["cardId"] = cardId,
                ["businessLine"] = "dormitory"
            },
            ["availableActions"] = ReadonlyActions("navigate", "operationPanel"),
            ["traceRefs"] = Array.Empty<string>(),
            ["sourceRefs"] = new Dictionary<string, object?>
            {
                ["source"] = "SearchKernelService",
                ["sourceType"] = "workspaceCardProjection",
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

    private Dictionary<string, object?>? BuildOperationsResult(
        OperationsSearchRecord record,
        IReadOnlyList<string> queryTerms,
        RuntimeActorContext actor,
        string language)
    {
        if (operations is null)
        {
            return null;
        }

        var sourceWorkItem = operations.GetWorkItem(record.WorkItemId);
        var targetWorkItem = NextActionableWorkItem(record, sourceWorkItem, actor)
            ?? sourceWorkItem;
        if (targetWorkItem is null)
        {
            return null;
        }

        var cardId = PayloadValue(targetWorkItem.Payload, "cardId");
        var surface = operations.GetWorkItemSurface(targetWorkItem.WorkItemId);
        var workspace = surface?.Workspace;
        var card = surface?.Card;
        var definition = definitions.Resolve(targetWorkItem, cardId);
        var decision = admission.EvaluateSearch(definition, actor);
        var fieldValues = FieldValues(record.Payload);
        var businessAnchor = BusinessAnchorPayload(fieldValues);
        var title = card is null
            ? Localized(FirstNonEmpty(targetWorkItem.WorkItemType, cardId, "Operations WorkItem"))
            : card.Title;
        var workspaceTitle = workspace?.Title ?? Localized("Operations");
        var text = SafeText(record);
        var matchedTerms = queryTerms
            .Where(term => text.Contains(term, StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var targetIsTerminal = IsTerminalStatus(targetWorkItem.Status);
        var resultType = targetIsTerminal ? "operationCase" : "workItem";
        var score = 220 + matchedTerms.Length * 45 + (targetIsTerminal ? 0 : 80) + (decision.ConfirmAllowed ? 25 : 0);
        var indexedAt = DateTimeOffset.UtcNow;

        return new Dictionary<string, object?>
        {
            ["resultId"] = $"operations:{record.EventId}:{targetWorkItem.WorkItemId}",
            ["resultType"] = resultType,
            ["objectKind"] = targetIsTerminal ? "operationCase" : "workItem",
            ["workItemId"] = targetWorkItem.WorkItemId,
            ["workspaceId"] = targetWorkItem.WorkspaceId,
            ["cardId"] = cardId,
            ["caseId"] = targetWorkItem.CaseId,
            ["workItemType"] = targetWorkItem.WorkItemType,
            ["title"] = title,
            ["summary"] = workspaceTitle,
            ["subtitle"] = workspaceTitle,
            ["status"] = targetWorkItem.Status,
            ["nextAction"] = targetIsTerminal
                ? LocalizedByLanguage(language, "查看已完成记录", "View completed record", "View completed record")
                : LocalizedByLanguage(language, "继续当前办理", "Continue current work", "Continue current work"),
            ["matchedTerms"] = matchedTerms,
            ["score"] = score,
            ["businessAnchor"] = businessAnchor,
            ["payload"] = new Dictionary<string, object?>
            {
                ["fieldValues"] = fieldValues,
                ["sourceWorkItemId"] = record.WorkItemId,
                ["sourceSubmissionId"] = record.SubmissionId,
                ["sourceEventId"] = record.EventId
            },
            ["target"] = new Dictionary<string, object?>
            {
                ["view"] = targetIsTerminal ? "completedRecords" : "operationPanel",
                ["kind"] = "operationsWorkItem",
                ["workspaceId"] = targetWorkItem.WorkspaceId,
                ["cardId"] = cardId,
                ["workItemId"] = targetWorkItem.WorkItemId,
                ["caseId"] = targetWorkItem.CaseId,
                ["writeThroughSearchAllowed"] = false
            },
            ["admission"] = decision.ToContract(),
            ["permission"] = Permission("visible", "business-anchor", "business", new[] { "search.read" }, indexedAt),
            ["lineage"] = Lineage("OperationsRuntime", "operationsDomainEvent", record.EventId, record.OccurredAtUtc, definition.DefinitionId),
            ["freshness"] = Freshness(indexedAt, Math.Max(0, (long)(indexedAt - record.OccurredAtUtc).TotalMilliseconds), false),
            ["ranking"] = Ranking("oam.search-ranking-policy.v1", matchedTerms, decision.ConfirmAllowed),
            ["businessContext"] = new Dictionary<string, object?>
            {
                ["workspaceId"] = targetWorkItem.WorkspaceId,
                ["caseId"] = targetWorkItem.CaseId,
                ["workItemId"] = targetWorkItem.WorkItemId,
                ["businessLine"] = "dormitory"
            },
            ["availableActions"] = ReadonlyActions(targetIsTerminal ? "view" : "navigate", targetIsTerminal ? "completedRecords" : "operationPanel"),
            ["traceRefs"] = new[] { record.SubmissionId, record.EventId },
            ["sourceRefs"] = new Dictionary<string, object?>
            {
                ["source"] = "SearchKernelService",
                ["sourceType"] = "operationsDomainEvent",
                ["inputAdapter"] = "OperationsRuntime.SearchOperations",
                ["projectionAdapter"] = "OperationsReadStore.SearchOperations",
                ["workspaceId"] = targetWorkItem.WorkspaceId,
                ["cardId"] = cardId,
                ["workItemId"] = targetWorkItem.WorkItemId,
                ["caseId"] = targetWorkItem.CaseId,
                ["sourceEventId"] = record.EventId,
                ["sourceSubmissionId"] = record.SubmissionId,
                ["definitionId"] = definition.DefinitionId,
                ["admissionDecisionRef"] = decision.AdmissionDecisionRef
            },
            ["language"] = language,
            ["explain"] = new Dictionary<string, string>
            {
                ["zh-CN"] = "搜索结果来自 Operations Runtime 事件和工作项；姓名和电话只作检索与展示锚点。",
                ["ru-RU"] = "Результат найден по событиям и задачам Operations Runtime; имя и телефон используются только как поисковый якорь.",
                ["ky-KG"] = "Натыйжа Operations Runtime окуялары жана иштеринен табылды; ат жана телефон издөө белгиси гана."
            }
        };
    }

    private WorkItem? NextActionableWorkItem(
        OperationsSearchRecord record,
        WorkItem? sourceWorkItem,
        RuntimeActorContext actor)
    {
        if (operations is null)
        {
            return null;
        }

        var workItems = operations.ListWorkItems(actor.TenantId, record.CaseId)
            .Where(item => !IsTerminalStatus(item.Status))
            .Where(item => !item.WorkItemId.Equals(record.WorkItemId, StringComparison.OrdinalIgnoreCase))
            .ToArray();
        if (workItems.Length == 0)
        {
            return null;
        }

        var direct = workItems.FirstOrDefault(item =>
            PayloadValue(item.Payload, "sourceWorkItemId").Equals(record.WorkItemId, StringComparison.OrdinalIgnoreCase));
        if (direct is not null)
        {
            return direct;
        }

        if (sourceWorkItem is null)
        {
            return workItems.OrderBy(item => item.CreatedAtUtc).FirstOrDefault();
        }

        var templateWorkspaceId = FirstNonEmpty(
            PayloadValue(sourceWorkItem.Payload, "templateWorkspaceId"),
            WorkspaceSeedCatalog.FindWorkspace(sourceWorkItem.WorkspaceId)?.Id);
        var seed = WorkspaceSeedCatalog.FindWorkspace(templateWorkspaceId);
        var sourceCardId = PayloadValue(sourceWorkItem.Payload, "cardId");
        if (seed is null || string.IsNullOrWhiteSpace(sourceCardId))
        {
            return workItems.OrderBy(item => item.CreatedAtUtc).FirstOrDefault();
        }

        var sourceIndex = CardIndex(seed, sourceCardId);
        return workItems
            .Select(item => new { Item = item, Index = CardIndex(seed, PayloadValue(item.Payload, "cardId")) })
            .Where(item => item.Index > sourceIndex)
            .OrderBy(item => item.Index)
            .ThenBy(item => item.Item.CreatedAtUtc)
            .Select(item => item.Item)
            .FirstOrDefault()
            ?? workItems.OrderBy(item => item.CreatedAtUtc).FirstOrDefault();
    }

    private static int CardIndex(WorkspaceSeed seed, string cardId) =>
        seed.Cards.ToList().FindIndex(card => card.Id.Equals(cardId, StringComparison.OrdinalIgnoreCase));

    private static Dictionary<string, object?> Permission(
        string visibility,
        string redaction,
        string dataClassification,
        IReadOnlyList<string> requiredPermissions,
        DateTimeOffset checkedAt) =>
        new()
        {
            ["visibility"] = visibility,
            ["redaction"] = redaction,
            ["dataClassification"] = dataClassification,
            ["requiredPermissions"] = requiredPermissions,
            ["checkedAt"] = checkedAt.ToString("O"),
            ["policyVersion"] = "oam.search-permission-policy.v1"
        };

    private static Dictionary<string, object?> Lineage(
        string sourceSystem,
        string sourceType,
        string sourceId,
        DateTimeOffset sourceUpdatedAt,
        string definitionVersion) =>
        new()
        {
            ["sourceSystem"] = sourceSystem,
            ["sourceType"] = sourceType,
            ["sourceId"] = sourceId,
            ["sourceUpdatedAt"] = sourceUpdatedAt.ToString("O"),
            ["definitionVersion"] = definitionVersion
        };

    private static Dictionary<string, object?> Freshness(DateTimeOffset indexedAt, long indexLagMs, bool stale) =>
        new()
        {
            ["indexedAt"] = indexedAt.ToString("O"),
            ["indexLagMs"] = indexLagMs,
            ["stale"] = stale
        };

    private static Dictionary<string, object?> Ranking(
        string policyVersion,
        IReadOnlyList<string> matchedTerms,
        bool confirmAllowed) =>
        new()
        {
            ["policyVersion"] = policyVersion,
            ["matchedTermCount"] = matchedTerms.Count,
            ["rankReason"] = confirmAllowed ? "visible_with_confirm_admission" : "visible_readonly_or_prepare_only"
        };

    private static IReadOnlyList<Dictionary<string, object?>> ReadonlyActions(string action, string view) =>
        new[]
        {
            new Dictionary<string, object?>
            {
                ["action"] = action,
                ["view"] = view,
                ["writeBusinessFact"] = false
            }
        };

    private static string NormalizeLanguage(string? language) =>
        language is "ru-RU" or "ky-KG" ? language : "zh-CN";

    private static object Localized(string value) =>
        new Dictionary<string, string>
        {
            ["zh-CN"] = value,
            ["ru-RU"] = value,
            ["ky-KG"] = value
        };

    private static object LocalizedByLanguage(string language, string zh, string ru, string ky) =>
        new Dictionary<string, string>
        {
            ["zh-CN"] = zh,
            ["ru-RU"] = language == "ru-RU" ? ru : zh,
            ["ky-KG"] = language == "ky-KG" ? ky : zh
        };

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static bool IsTerminalStatus(string status) =>
        new[] { "done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped" }
            .Contains(status, StringComparer.OrdinalIgnoreCase);

    private static string PayloadValue(IReadOnlyDictionary<string, string> payload, string key) =>
        payload.TryGetValue(key, out var value) ? value : string.Empty;

    private static IReadOnlyDictionary<string, object> BusinessAnchorPayload(IReadOnlyDictionary<string, object> fieldValues) =>
        fieldValues
            .Where(item => BusinessAnchorKeys.Contains(item.Key))
            .ToDictionary(item => item.Key, item => item.Value, StringComparer.OrdinalIgnoreCase);

    private static IReadOnlyDictionary<string, object> FieldValues(IReadOnlyDictionary<string, object> payload)
    {
        var input = ReadObject(payload, "input");
        var fieldValues = ReadObject(input, "fieldValues") ?? ReadObject(payload, "fieldValues");
        if (fieldValues is IReadOnlyDictionary<string, object> typed)
        {
            return typed;
        }

        if (fieldValues is JsonElement element && element.ValueKind == JsonValueKind.Object)
        {
            return element.EnumerateObject()
                .ToDictionary(item => item.Name, item => JsonValue(item.Value), StringComparer.OrdinalIgnoreCase);
        }

        if (fieldValues is System.Collections.IDictionary dictionary)
        {
            return dictionary.Keys
                .Cast<object>()
                .ToDictionary(key => Convert.ToString(key) ?? string.Empty, key => dictionary[key] ?? string.Empty, StringComparer.OrdinalIgnoreCase);
        }

        return new Dictionary<string, object>();
    }

    private static object? ReadObject(object? value, string propertyName)
    {
        if (value is null)
        {
            return null;
        }

        if (value is IReadOnlyDictionary<string, object> dictionary &&
            dictionary.TryGetValue(propertyName, out var dictionaryValue))
        {
            return dictionaryValue;
        }

        if (value is JsonElement element && element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(propertyName, out var property))
        {
            return property;
        }

        return null;
    }

    private static object JsonValue(JsonElement element) =>
        element.ValueKind switch
        {
            JsonValueKind.String => element.GetString() ?? string.Empty,
            JsonValueKind.Number => element.ToString(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Object => element.EnumerateObject().ToDictionary(item => item.Name, item => JsonValue(item.Value), StringComparer.OrdinalIgnoreCase),
            JsonValueKind.Array => element.EnumerateArray().Select(JsonValue).ToArray(),
            _ => string.Empty
        };

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

    private static string SafeText(object? value) => SafeText(value, 0);

    private static string SafeText(object? value, int depth)
    {
        if (value is null || depth > 6)
        {
            return string.Empty;
        }

        if (value is string or int or long or decimal or double or bool or DateTimeOffset or DateTime or Guid ||
            value.GetType().IsEnum)
        {
            return Convert.ToString(value) ?? string.Empty;
        }

        if (value is Type type)
        {
            return type.Name;
        }

        if (value is JsonElement element)
        {
            return element.ValueKind switch
            {
                JsonValueKind.Object => string.Join(" ", element.EnumerateObject().Select(item => SafeText(item.Value, depth + 1))),
                JsonValueKind.Array => string.Join(" ", element.EnumerateArray().Select(item => SafeText(item, depth + 1))),
                JsonValueKind.String => element.GetString() ?? string.Empty,
                _ => element.ToString()
            };
        }

        if (value is System.Collections.IDictionary dictionary)
        {
            return string.Join(" ", dictionary.Values.Cast<object?>().Select(item => SafeText(item, depth + 1)));
        }

        if (value is System.Collections.IEnumerable enumerable && value is not string)
        {
            return string.Join(" ", enumerable.Cast<object?>().Select(item => SafeText(item, depth + 1)));
        }

        var valueType = value.GetType();
        if (valueType.Namespace?.StartsWith("System", StringComparison.OrdinalIgnoreCase) == true)
        {
            return Convert.ToString(value) ?? string.Empty;
        }

        return string.Join(" ", valueType
            .GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .Where(property => property.GetIndexParameters().Length == 0)
            .Select(property =>
            {
                try
                {
                    return SafeText(property.GetValue(value), depth + 1);
                }
                catch
                {
                    return string.Empty;
                }
            }));
    }

    private static readonly HashSet<string> BusinessAnchorKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "buildingName",
        "building",
        "roomLabel",
        "roomNo",
        "roomId",
        "bedLabel",
        "bedNo",
        "bedId",
        "bedType",
        "bedTypeLabel",
        "residentName",
        "guestName",
        "leadName",
        "customerName",
        "contactName",
        "name",
        "phone",
        "residentPhone",
        "customerPhone",
        "contactPhone",
        "mobile",
        "periodLabel",
        "depositStatus",
        "paymentStatus",
        "taskStatus",
        "checkoutStatus"
    };
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
