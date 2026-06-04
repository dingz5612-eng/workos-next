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
            DerivedFrom(label),
            label == "容量" || type == "readonly");
    }

    public static IReadOnlyDictionary<string, string> Help(string label, string type, string source)
    {
        if (label == "容量") return ContractText.Text("容量由房型自动带出，不需要手填。", "Вместимость заполняется по типу комнаты автоматически.");
        if (type == "readonly") return ContractText.Text("已自动带出，不需要填写。", "Заполнено автоматически.");
        if (Control(label, type, source) == "select") return ContractText.Text("请选择一个业务选项。", "Выберите вариант.");
        if (Control(label, type, source) == "searchSelect") return ContractText.Text("从已有对象中选择。", "Выберите существующий объект.");
        if (Control(label, type, source) is "dateTime" or "dateTimeRange") return ContractText.Text("请选择时间。", "Выберите дату и время.");
        if (Control(label, type, source) == "number") return ContractText.Text("请输入数字。", "Введите число.");
        return ContractText.Text("请输入本步需要的信息。", "Введите данные для этого шага.");
    }

    private static string Control(string label, string type, string source)
    {
        if (label is "预计入住/退房" or "入住周期") return "dateTimeRange";
        if (type == "readonly") return "readonly";
        if (type == "searchSelect" || source == "searchableProjection") return "searchSelect";
        if (type == "select" || source == "optionSet") return "select";
        if (type == "money") return "number";
        if (type == "number") return "number";
        if (type == "evidenceUpload") return "evidence";
        if (type == "confirmation") return "select";
        if (type == "dateTime") return "dateTime";
        return "text";
    }

    private static string DerivedFrom(string label) => label switch
    {
        "容量" => "roomType",
        "应收金额" => "tariffType",
        _ => string.Empty
    };
}
