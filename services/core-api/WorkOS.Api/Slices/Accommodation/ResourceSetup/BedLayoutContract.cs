using System.Text.Json;

namespace WorkOS.Api.Slices.Accommodation.ResourceSetup;

internal static class BedLayoutContract
{
    public static bool TryParse(string value, out IReadOnlyList<BedLayoutEntry> entries)
    {
        entries = Array.Empty<BedLayoutEntry>();
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        try
        {
            using var document = JsonDocument.Parse(value);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            var parsed = new List<BedLayoutEntry>();
            foreach (var item in document.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                {
                    return false;
                }

                var label = PropertyString(item, "label");
                if (string.IsNullOrWhiteSpace(label))
                {
                    return false;
                }

                var type = NormalizePerBedType(PropertyString(item, "type"));
                if (string.IsNullOrWhiteSpace(type))
                {
                    return false;
                }

                parsed.Add(new BedLayoutEntry(label, type));
            }

            entries = parsed;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static string BedTypeForTemplate(string template, int index)
    {
        var normalized = NormalizeBedType(template);
        return normalized switch
        {
            "upper" => "upper",
            "lower" => "lower",
            "whole" => "whole",
            _ => index % 2 == 0 ? "upper" : "lower"
        };
    }

    public static string NormalizeBedType(string value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "" => "bunk_pair",
            "bunk" => "bunk_pair",
            "bunk_pair" => "bunk_pair",
            "mixed_bunk" => "bunk_pair",
            "upper_lower" => "bunk_pair",
            "上下铺" => "bunk_pair",
            "上下铺一组" => "bunk_pair",
            "上下铺：两上两下" => "bunk_pair",
            "上下铺:两上两下" => "bunk_pair",
            "upper" => "upper",
            "all_upper" => "upper",
            "上铺" => "upper",
            "全部上铺" => "upper",
            "lower" => "lower",
            "all_lower" => "lower",
            "下铺" => "lower",
            "全部下铺" => "lower",
            "whole" => "whole",
            "flat" => "whole",
            "all_whole" => "whole",
            "整床" => "whole",
            "平铺" => "whole",
            "全部平铺" => "whole",
            _ => "bunk_pair"
        };
    }

    public static string NormalizePerBedType(string value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "upper" => "upper",
            "all_upper" => "upper",
            "上铺" => "upper",
            "全部上铺" => "upper",
            "lower" => "lower",
            "all_lower" => "lower",
            "下铺" => "lower",
            "全部下铺" => "lower",
            "whole" => "whole",
            "flat" => "whole",
            "all_whole" => "whole",
            "整床" => "whole",
            "平铺" => "whole",
            "全部平铺" => "whole",
            _ => string.Empty
        };
    }

    private static string PropertyString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString() ?? string.Empty
            : string.Empty;
}

internal sealed record BedLayoutEntry(string Label, string Type);
