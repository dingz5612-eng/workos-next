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
        var searchTerms = SearchTerms(query, queryTerms);
        return SearchProjectionSources(runtime, searchTerms)
            .Select(item => BuildProjectionResult(item, searchTerms, actor, resolvedLanguage))
            .Concat(SearchCommandResults(searchTerms, actor, resolvedLanguage))
            .GroupBy(item => Convert.ToString(item["resultId"]), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.OrderByDescending(item => Convert.ToInt32(item["score"])).First())
            .OrderByDescending(item => Convert.ToInt32(item["score"]))
            .ThenBy(item => Convert.ToString(item["resultId"]))
            .Cast<object>()
            .ToArray();
    }

    private IReadOnlyList<object> SearchProjectionSources(
        ProjectionRuntime runtime,
        IReadOnlyList<string> searchTerms)
    {
        var sources = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        foreach (var term in searchTerms)
        {
            foreach (var item in projectionWorkspaceSearch.Search(runtime, term))
            {
                sources.TryAdd(SearchResultKey(item), item);
            }
        }

        return sources.Values.ToArray();
    }

    private IReadOnlyList<Dictionary<string, object?>> SearchCommandResults(
        IReadOnlyList<string> searchTerms,
        RuntimeActorContext actor,
        string language) =>
        searchTerms.Count == 0
            ? Array.Empty<Dictionary<string, object?>>()
            : SearchCommandCatalog
                .Where(command => CommandMatches(command, searchTerms))
                .Select(command => BuildCommandResult(command, searchTerms, actor, language))
                .ToArray();

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

    private Dictionary<string, object?> BuildProjectionResult(
        object projectionSource,
        IReadOnlyList<string> queryTerms,
        RuntimeActorContext actor,
        string language)
    {
        var workspaceId = ReadString(projectionSource, "workspaceId");
        var cardId = ReadString(projectionSource, "cardId");
        var resultId = FirstNonEmpty(ReadString(projectionSource, "resultId"), $"search:{workspaceId}:{cardId}");
        var definition = definitions.ResolveStartAdapter(workspaceId, cardId);
        var decision = admission.EvaluateSearch(definition, actor);
        var existingTerms = ReadStringArray(projectionSource, "matchedTerms");
        var text = SafeText(projectionSource);
        var matchedTerms = existingTerms
            .Concat(queryTerms.Where(term => text.Contains(term, StringComparison.OrdinalIgnoreCase)))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var baseScore = ReadInt(projectionSource, "score");
        var score = baseScore + matchedTerms.Length * 40;
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
                ["targetId"] = FirstNonEmpty(cardId, workspaceId, resultId),
                ["runtimeOwner"] = "ProjectionWorkspaceSearchAdapter",
                ["compatibility"] = "workspaceCardCompatibility",
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
            ["gateResult"] = GateResult(decision, indexedAt, "workspaceCardProjection"),
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

    private Dictionary<string, object?> BuildCommandResult(
        SearchCommandDefinition command,
        IReadOnlyList<string> queryTerms,
        RuntimeActorContext actor,
        string language)
    {
        var definition = definitions.ResolveStartAdapter(command.TemplateWorkspaceId, command.FirstCardId);
        var decision = admission.EvaluateSearch(definition, actor);
        var indexedAt = DateTimeOffset.UtcNow;
        var matchedTerms = command.Keywords
            .Concat(new[] { command.ZhTitle, command.RuTitle, command.KyTitle })
            .Where(keyword => queryTerms.Any(term => TermMatches(keyword, term)))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var sourceId = $"{command.TemplateWorkspaceId}:{command.FirstCardId}";

        return new Dictionary<string, object?>
        {
            ["resultId"] = $"search-command:{sourceId}",
            ["resultType"] = "command",
            ["objectKind"] = "operationsCommand",
            ["workspaceId"] = command.TemplateWorkspaceId,
            ["cardId"] = command.FirstCardId,
            ["templateWorkspaceId"] = command.TemplateWorkspaceId,
            ["firstCardId"] = command.FirstCardId,
            ["title"] = LocalizedByLanguage(language, command.ZhTitle, command.RuTitle, command.KyTitle),
            ["summary"] = LocalizedByLanguage(language, command.ZhSummary, command.RuSummary, command.KySummary),
            ["matchedTerms"] = matchedTerms,
            ["score"] = 120 + matchedTerms.Length * 40,
            ["target"] = new Dictionary<string, object?>
            {
                ["view"] = "operationPanel",
                ["kind"] = "operationsCommand",
                ["targetId"] = sourceId,
                ["runtimeOwner"] = "StartAdapterMap",
                ["compatibility"] = "currentStartAdapter",
                ["workspaceId"] = command.TemplateWorkspaceId,
                ["cardId"] = command.FirstCardId,
                ["writeThroughSearchAllowed"] = false
            },
            ["admission"] = decision.ToContract(),
            ["permission"] = Permission("visible", "none", "business", Array.Empty<string>(), indexedAt),
            ["lineage"] = Lineage("StartAdapterMap", "operationsCommandAdmission", sourceId, indexedAt, definition.DefinitionId),
            ["freshness"] = Freshness(indexedAt, 0, false),
            ["ranking"] = Ranking("oam.search-ranking-policy.v1", matchedTerms, decision.ConfirmAllowed),
            ["businessContext"] = new Dictionary<string, object?>
            {
                ["workspaceId"] = command.TemplateWorkspaceId,
                ["cardId"] = command.FirstCardId,
                ["businessLine"] = "dormitory"
            },
            ["availableActions"] = ReadonlyActions("navigate", "operationPanel"),
            ["gateResult"] = GateResult(decision, indexedAt, "operationsCommandAdmission"),
            ["traceRefs"] = Array.Empty<string>(),
            ["sourceRefs"] = new Dictionary<string, object?>
            {
                ["source"] = "SearchKernelService",
                ["sourceType"] = "operationsCommandAdmission",
                ["inputAdapter"] = "StartAdapterMap",
                ["projectionAdapter"] = "none",
                ["workspaceId"] = command.TemplateWorkspaceId,
                ["cardId"] = command.FirstCardId,
                ["definitionId"] = definition.DefinitionId,
                ["admissionDecisionRef"] = decision.AdmissionDecisionRef
            },
            ["language"] = language,
            ["explain"] = new Dictionary<string, string>
            {
                ["zh-CN"] = "Search Kernel 仅补充开始入口准入 envelope；Search 不写业务事实，最终确认仍由 Runtime 校验。",
                ["ru-RU"] = "Search Kernel добавляет только envelope допуска для входа; Search не пишет бизнес-факты, финальное подтверждение проверяет Runtime.",
                ["ky-KG"] = "Search Kernel баштоо кирүүсү үчүн гана уруксат envelope кошот; Search бизнес факт жазбайт, акыркы тастыктоону Runtime текшерет."
            }
        };
    }

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
            ["policyVersion"] = "oam.search-permission-policy.v1",
            ["decisionSource"] = "SearchPermissionPolicy",
            ["actorScope"] = "tenant-scoped"
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
            ["definitionVersion"] = definitionVersion,
            ["sourceVersion"] = definitionVersion,
            ["factRefs"] = Array.Empty<string>(),
            ["evidenceRefs"] = Array.Empty<string>(),
            ["transformRefs"] = new[] { "SearchIndexRecord", "OamObjectEnvelope", "LensReadModel" },
            ["outboxRefs"] = Array.Empty<string>(),
            ["readModelVersion"] = "oam.generated-read-model.v1"
        };

    private static Dictionary<string, object?> Freshness(DateTimeOffset indexedAt, long indexLagMs, bool stale) =>
        new()
        {
            ["indexedAt"] = indexedAt.ToString("O"),
            ["indexLagMs"] = indexLagMs,
            ["stale"] = stale,
            ["maxStalenessMs"] = 300000,
            ["checkedAt"] = indexedAt.ToString("O"),
            ["sourceUpdatedAt"] = indexedAt.AddMilliseconds(-indexLagMs).ToString("O"),
            ["computedAt"] = indexedAt.ToString("O"),
            ["lastDisplayedAt"] = indexedAt.ToString("O"),
            ["computeLagMs"] = indexLagMs,
            ["staleReason"] = stale ? "source_lag_exceeded" : "fresh",
            ["freshnessPolicyVersion"] = "oam.search-freshness-policy.v1"
        };

    private static Dictionary<string, object?> Ranking(
        string policyVersion,
        IReadOnlyList<string> matchedTerms,
        bool confirmAllowed) =>
        new()
        {
            ["policyVersion"] = policyVersion,
            ["matchedTermCount"] = matchedTerms.Count,
            ["rankReason"] = "permission_filtered_read_result"
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

    private static Dictionary<string, object?> GateResult(
        AdmissionKernelDecision decision,
        DateTimeOffset checkedAt,
        string sourceType) =>
        new()
        {
            ["status"] = decision.VisibleAllowed ? "visible_readonly" : "hidden",
            ["source"] = "SearchKernelService",
            ["sourceType"] = sourceType,
            ["checkedAt"] = checkedAt.ToString("O"),
            ["policyVersion"] = "oam.search-permission-policy.v1",
            ["admissionDecisionRef"] = decision.AdmissionDecisionRef,
            ["writeThroughSearchAllowed"] = false,
            ["writeBusinessFactAllowed"] = false
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

    private static bool CommandMatches(SearchCommandDefinition command, IReadOnlyList<string> searchTerms) =>
        command.Keywords
            .Concat(new[] { command.ZhTitle, command.RuTitle, command.KyTitle })
            .Any(keyword => searchTerms.Any(term => TermMatches(keyword, term)));

    private static bool TermMatches(string keyword, string term) =>
        !string.IsNullOrWhiteSpace(keyword) &&
        !string.IsNullOrWhiteSpace(term) &&
        (keyword.Contains(term, StringComparison.OrdinalIgnoreCase) ||
         term.Contains(keyword, StringComparison.OrdinalIgnoreCase));

    private static readonly IReadOnlyList<SearchCommandDefinition> SearchCommandCatalog = new[]
    {
        new SearchCommandDefinition(
            "W-STAY-RESOURCE",
            "roomSetup",
            "新增住宿房源",
            "Добавить комнату",
            "Бөлмө кошуу",
            "先录房号和床位数，价格和可租状态后面再补。",
            "Сначала внесите номер комнаты и число коек. Тарифы и готовность заполните дальше.",
            "Алгач бөлмө номерин жана койка санын жазыңыз. Баа жана даярдык кийин толтурулат.",
            new[] { "新增住宿房源", "创建房间", "房间", "房源", "room", "resource" }),
        new SearchCommandDefinition(
            "W-STAY-LEAD-RESERVATION",
            "leadCapture",
            "登记咨询和预订",
            "Записать заявку и бронь",
            "Суроо жана бронь каттоо",
            "先把来访咨询记清楚，再决定预订、取消或转入住。",
            "Сначала зафиксируйте обращение, затем бронь, отмена или заселение.",
            "Адегенде кайрылууну так жазыңыз, анан бронь, жокко чыгаруу же кирүү.",
            new[] { "线索", "预订", "咨询", "预约", "lead", "reservation" }),
        new SearchCommandDefinition(
            "W-STAY-CHECKIN",
            "lead",
            "安排入住和收款",
            "Оформить заезд и оплату",
            "Кирүү жана төлөм уюштуруу",
            "从入住人开始，完成分床、计费、押金和收款确认。",
            "От жильца к койке, начислению, депозиту и подтверждению оплаты.",
            "Жашоочудан баштап койка, эсеп, депозит жана төлөмдү тастыктоо.",
            new[] { "入住收款", "入住", "收款", "押金入住", "安排入住", "checkin", "payment" }),
        new SearchCommandDefinition(
            "W-STAY-LIFECYCLE",
            "residentProfile",
            "维护在住信息",
            "Обновить данные проживания",
            "Жашоо маалыматтарын жаңыртуу",
            "处理住客资料、分床、应收、续住和在住变更。",
            "Данные жильца, койка, начисления, продление и изменения проживания.",
            "Жашоочу, койка, эсеп, узартуу жана жашоо өзгөрүүлөрү.",
            new[] { "在住", "住客", "续住", "生命周期", "resident", "stay" }),
        new SearchCommandDefinition(
            "W-STAY-DEPOSIT-LEDGER",
            "depositAssessment",
            "处理押金",
            "Обработать депозит",
            "Депозитти иштетүү",
            "押金评估、收取、财务确认、扣除、退款和关闭。",
            "Оценка, прием, фин. подтверждение, удержание, возврат и закрытие.",
            "Баалоо, алуу, финансы тастыктоо, кармоо, кайтаруу жана жабуу.",
            new[] { "押金", "押金账本", "退款", "扣除", "deposit", "refund" }),
        new SearchCommandDefinition(
            "W-STAY-PAYMENT-LEDGER",
            "paymentReceipt",
            "登记普通收款",
            "Записать обычный платеж",
            "Кадимки төлөмдү каттоо",
            "登记收款、财务确认、分配到应收，后续处理欠款。",
            "Запись платежа, фин. подтверждение, распределение и долги.",
            "Төлөмдү каттоо, финансы тастыктоо, бөлүштүрүү жана карыз.",
            new[] { "普通收款", "收款账本", "欠款", "付款", "payment", "receipt" }),
        new SearchCommandDefinition(
            "W-STAY-SERVICE-TASK",
            "serviceTaskCreate",
            "安排清洁或维修",
            "Назначить уборку или ремонт",
            "Тазалоо же оңдоону дайындоо",
            "创建影响房间、床位可售状态的清洁、维修或配置任务。",
            "Создайте задачу, которая влияет на доступность комнаты или койки.",
            "Бөлмө же койканын сатылуу абалына таасир берген тапшырма түзүңүз.",
            new[] { "清洁", "维修", "服务任务", "保洁", "cleaning", "repair" }),
        new SearchCommandDefinition(
            "W-STAY-CHECKOUT-SETTLEMENT",
            "checkoutStart",
            "办理退住结算",
            "Рассчитать выезд",
            "Чыгуу эсептешүүсү",
            "处理退住、查房、押金、最终结算、床位释放和清洁任务。",
            "Выезд, проверка, депозит, финальный расчет, освобождение койки и уборка.",
            "Чыгуу, текшерүү, депозит, акыркы эсеп, койка бошотуу жана тазалоо.",
            new[] { "退住", "结算", "退住结算", "查房", "settlement" }),
        new SearchCommandDefinition(
            "W-STAY-EXPENSE-LEDGER",
            "expenseRecord",
            "登记宿舍支出",
            "Записать расход общежития",
            "Жатакана чыгымын каттоо",
            "登记宿舍支出，后续审批并关联到房间、床位或服务任务。",
            "Запишите расход, затем подтвердите и свяжите с комнатой, койкой или задачей.",
            "Чыгымды каттап, кийин бөлмө, койка же тапшырмага байланыштырыңыз.",
            new[] { "登记宿舍支出", "宿舍支出", "支出", "成本", "费用", "expense", "cost" }),
        new SearchCommandDefinition(
            "W-STAY-PERIOD-ANALYTICS",
            "periodScope",
            "做周期复盘",
            "Провести обзор периода",
            "Мезгилдик талдоо жүргүзүү",
            "确认周期范围，查看指标、财务、运营诊断和行动计划。",
            "Период, метрики, финансы, операционная диагностика и план действий.",
            "Мезгил, көрсөткүч, финансы, операциялык диагноз жана аракет планы.",
            new[] { "复盘", "周期", "经营", "指标", "period", "review" })
    };

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

    private static string ReadStringOrEmpty(object? source, string propertyName) =>
        source is null ? string.Empty : ReadString(source, propertyName);

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

internal sealed record SearchCommandDefinition(
    string TemplateWorkspaceId,
    string FirstCardId,
    string ZhTitle,
    string RuTitle,
    string KyTitle,
    string ZhSummary,
    string RuSummary,
    string KySummary,
    IReadOnlyList<string> Keywords);
