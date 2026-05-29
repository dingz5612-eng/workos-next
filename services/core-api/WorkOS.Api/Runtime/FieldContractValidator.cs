namespace WorkOS.Api.Runtime;

internal static class FieldContractValidator
{
    public static ConfirmResult? Validate(CardProjection card, ConfirmCardRequest request)
    {
        var values = request.FieldValues;
        if (values is null || values.Count == 0)
        {
            return null;
        }

        foreach (var field in AllFields(card))
        {
            if (!values.TryGetValue(field.Id, out var submitted) || string.IsNullOrWhiteSpace(submitted))
            {
                continue;
            }

            if (IsOptionField(field) && !IsValidOptionValue(field, submitted))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, $"invalid_option_value:{field.Id}", null);
            }
        }

        return null;
    }

    private static IEnumerable<FieldProjection> AllFields(CardProjection card) =>
        card.Fields.System.Concat(card.Fields.Business).Concat(card.Fields.Analytics);

    private static bool IsOptionField(FieldProjection field) =>
        field.Ui.Options.Count > 0 &&
        field.Type.Equals("select", StringComparison.OrdinalIgnoreCase);

    private static bool IsValidOptionValue(FieldProjection field, string submitted) =>
        field.Ui.Options.Any(option => option.Value.Equals(submitted, StringComparison.OrdinalIgnoreCase));
}
