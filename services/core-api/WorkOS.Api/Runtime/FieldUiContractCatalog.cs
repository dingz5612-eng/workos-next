namespace WorkOS.Api.Runtime;

internal static class FieldUiContractCatalog
{
    public static FieldUi ForField(string label, string type, string source)
    {
        var optionSet = OptionSetRegistry.ForLabel(label);
        return new FieldUi(
            Control(label, type, source),
            optionSet,
            OptionSetRegistry.Options(optionSet),
            OptionSetRegistry.DefaultValue(label),
            label == "容量" ? "房型" : string.Empty,
            label == "容量" || type == "readonly");
    }

    public static IReadOnlyDictionary<string, string> Help(string label, string type, string source)
    {
        if (label == "容量") return ContractText.Text("容量由房型自动带出，不需要手填。", "Вместимость заполняется по типу комнаты автоматически.");
        if (Control(label, type, source) == "select") return ContractText.Text("从合同给出的业务选项中选择。", "Выберите из вариантов, заданных контрактом.");
        if (Control(label, type, source) == "searchSelect") return ContractText.Text("从投影候选对象中搜索选择，不手写对象。", "Выберите объект из кандидатов проекции, не вводите вручную.");
        if (Control(label, type, source) is "dateTime" or "dateTimeRange") return ContractText.Text("使用日期时间控件，便于后端校验周期冲突。", "Используйте дату и время, чтобы backend мог проверить конфликты периода.");
        if (Control(label, type, source) == "number") return ContractText.Text("填写数值，提交后由系统检查规则。", "Введите число; система проверит правила после отправки.");
        return ContractText.Text("填写当前卡需要的业务信息。", "Заполните бизнес-данные для текущей карточки.");
    }

    private static string Control(string label, string type, string source)
    {
        if (label is "预计入住/退房" or "入住周期") return "dateTimeRange";
        if (label == "容量") return "number";
        if (type == "searchSelect" || source == "searchableProjection") return "searchSelect";
        if (type == "select" || source == "optionSet") return "select";
        if (type == "money") return "number";
        if (type == "evidenceUpload") return "evidence";
        if (type == "confirmation") return "select";
        if (type == "readonly") return "readonly";
        if (type == "dateTime") return "dateTime";
        return "text";
    }
}
