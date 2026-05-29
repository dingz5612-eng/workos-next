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
        if (type == "readonly") return ContractText.Text("由系统根据当前登录人、时间或上游字段生成。", "Система заполняет по пользователю, времени или предыдущим полям.");
        if (Control(label, type, source) == "select") return ContractText.Text("从业务选项中选择，避免手写造成口径不一致。", "Выберите из бизнес-вариантов, чтобы избежать расхождений.");
        if (Control(label, type, source) == "searchSelect") return ContractText.Text("选择已存在的业务对象，不能在这里新建对象编号。", "Выберите существующий бизнес-объект; новый номер здесь не создается.");
        if (Control(label, type, source) is "dateTime" or "dateTimeRange") return ContractText.Text("使用日期时间控件，便于后端校验周期冲突。", "Используйте дату и время, чтобы backend мог проверить конфликты периода.");
        if (Control(label, type, source) == "number") return ContractText.Text("填写数值，提交后由系统检查规则。", "Введите число; система проверит правила после отправки.");
        return ContractText.Text("手工填写本次新建或办理需要的业务信息。", "Вручную заполните данные для создания или обработки.");
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
        "容量" => "房型",
        "应收金额" => "计费方式",
        _ => string.Empty
    };
}
