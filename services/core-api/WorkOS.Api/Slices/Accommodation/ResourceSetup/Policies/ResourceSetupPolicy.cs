using WorkOS.Api.Runtime;

namespace WorkOS.Api.Slices.Accommodation.ResourceSetup.Policies;

internal static class ResourceSetupPolicy
{
    public static ConfirmResult? Validate(string cardId, ConfirmCardRequest request)
    {
        if (!cardId.Equals("bedSetup", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var values = request.FieldValues ?? new Dictionary<string, string>();
        var bedCount = RuntimeFieldAliases.IntValue(values, "bedCount", 0);
        if (bedCount <= 0)
        {
            return null;
        }

        var labels = SplitLabels(RuntimeFieldAliases.Value(values, "bedLabels", string.Empty));
        if (labels.Count != bedCount)
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "bed_labels_must_match_bed_count", new { bedCount, labelCount = labels.Count });
        }

        if (labels.Distinct(StringComparer.OrdinalIgnoreCase).Count() != labels.Count)
        {
            return new ConfirmResult(ConfirmStatus.Invalid, "bed_labels_must_be_unique", null);
        }

        return null;
    }

    private static IReadOnlyList<string> SplitLabels(string value) =>
        value.Split(new[] { ',', '，', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(label => !string.IsNullOrWhiteSpace(label))
            .ToArray();
}
