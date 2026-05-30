using System.Globalization;

namespace WorkOS.Api.Runtime;

internal sealed class BankStatementCsvParser
{
    private static readonly HashSet<string> Directions = new(StringComparer.OrdinalIgnoreCase)
    {
        "credit",
        "debit"
    };

    public BankStatementImportPreview Preview(BankStatementImportRequest request)
    {
        var mapping = request.ColumnMapping ?? new BankStatementColumnMapping();
        var rows = ParseCsv(request.CsvContent ?? string.Empty);
        if (rows.Count == 0)
        {
            return new BankStatementImportPreview(0, 0, 0, Array.Empty<BankStatementPreviewRow>());
        }

        var headers = rows[0]
            .Select((value, index) => new { Value = NormalizeHeader(value), Index = index })
            .Where(item => !string.IsNullOrWhiteSpace(item.Value))
            .GroupBy(item => item.Value, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(item => item.Key, item => item.First().Index, StringComparer.OrdinalIgnoreCase);

        var previewRows = new List<BankStatementPreviewRow>();
        for (var i = 1; i < rows.Count; i++)
        {
            if (rows[i].All(string.IsNullOrWhiteSpace))
            {
                continue;
            }

            previewRows.Add(ParseRow(i + 1, rows[i], headers, mapping));
        }

        MarkDuplicateExternalRefs(previewRows);
        return new BankStatementImportPreview(
            previewRows.Count,
            previewRows.Count(item => item.Valid),
            previewRows.Count(item => !item.Valid),
            previewRows);
    }

    private static BankStatementPreviewRow ParseRow(
        int rowNumber,
        IReadOnlyList<string> values,
        IReadOnlyDictionary<string, int> headers,
        BankStatementColumnMapping mapping)
    {
        var errors = new List<string>();
        var rawPayload = headers.ToDictionary(
            item => item.Key,
            item => ValueAt(values, item.Value),
            StringComparer.OrdinalIgnoreCase);

        var occurredAtRaw = RequiredValue(values, headers, mapping.OccurredAt, errors);
        var amountRaw = RequiredValue(values, headers, mapping.Amount, errors);
        var currency = RequiredValue(values, headers, mapping.Currency, errors).ToUpperInvariant();
        var direction = RequiredValue(values, headers, mapping.Direction, errors).ToLowerInvariant();
        var externalRef = OptionalValue(values, headers, mapping.ExternalRef);
        var description = RequiredValue(values, headers, mapping.Description, errors);

        DateTimeOffset? occurredAtUtc = null;
        if (!string.IsNullOrWhiteSpace(occurredAtRaw))
        {
            if (TryParseOccurredAt(occurredAtRaw, out var parsedOccurredAt))
            {
                occurredAtUtc = parsedOccurredAt;
            }
            else
            {
                errors.Add("invalid_occurredAt");
            }
        }

        decimal? amount = null;
        if (!string.IsNullOrWhiteSpace(amountRaw))
        {
            if (decimal.TryParse(amountRaw, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsedAmount) && parsedAmount > 0)
            {
                amount = parsedAmount;
            }
            else
            {
                errors.Add("invalid_amount");
            }
        }

        if (string.IsNullOrWhiteSpace(currency))
        {
            errors.Add("missing_currency");
        }

        if (!Directions.Contains(direction))
        {
            errors.Add("invalid_direction");
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            errors.Add("missing_description");
        }

        if (string.IsNullOrWhiteSpace(externalRef))
        {
            externalRef = $"generated-row-{rowNumber}";
        }

        return new BankStatementPreviewRow(
            rowNumber,
            errors.Count == 0,
            occurredAtUtc,
            amount,
            currency,
            direction,
            externalRef,
            description,
            rawPayload,
            errors);
    }

    private static void MarkDuplicateExternalRefs(List<BankStatementPreviewRow> rows)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (!row.Valid)
            {
                continue;
            }

            if (seen.Add(row.ExternalRef))
            {
                continue;
            }

            rows[i] = row with
            {
                Valid = false,
                Errors = row.Errors.Concat(new[] { "duplicate_external_ref" }).ToArray()
            };
        }
    }

    private static string RequiredValue(
        IReadOnlyList<string> values,
        IReadOnlyDictionary<string, int> headers,
        string header,
        List<string> errors)
    {
        var value = OptionalValue(values, headers, header);
        if (string.IsNullOrWhiteSpace(value))
        {
            errors.Add($"missing_{header}");
        }

        return value;
    }

    private static string OptionalValue(IReadOnlyList<string> values, IReadOnlyDictionary<string, int> headers, string header)
    {
        return headers.TryGetValue(NormalizeHeader(header), out var index)
            ? ValueAt(values, index).Trim()
            : string.Empty;
    }

    private static string ValueAt(IReadOnlyList<string> values, int index) =>
        index >= 0 && index < values.Count ? values[index] : string.Empty;

    private static string NormalizeHeader(string value) =>
        value.Trim().Replace("_", string.Empty, StringComparison.Ordinal).Replace("-", string.Empty, StringComparison.Ordinal);

    private static bool TryParseOccurredAt(string value, out DateTimeOffset occurredAtUtc)
    {
        if (DateTimeOffset.TryParse(
            value,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var dateTimeOffset))
        {
            occurredAtUtc = dateTimeOffset.ToUniversalTime();
            return true;
        }

        occurredAtUtc = default;
        return false;
    }

    private static IReadOnlyList<IReadOnlyList<string>> ParseCsv(string csv)
    {
        var rows = new List<IReadOnlyList<string>>();
        var row = new List<string>();
        var cell = new System.Text.StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < csv.Length; i++)
        {
            var value = csv[i];
            if (value == '"')
            {
                if (inQuotes && i + 1 < csv.Length && csv[i + 1] == '"')
                {
                    cell.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (value == ',' && !inQuotes)
            {
                row.Add(cell.ToString());
                cell.Clear();
            }
            else if ((value == '\n' || value == '\r') && !inQuotes)
            {
                if (value == '\r' && i + 1 < csv.Length && csv[i + 1] == '\n')
                {
                    i++;
                }

                row.Add(cell.ToString());
                rows.Add(row);
                row = new List<string>();
                cell.Clear();
            }
            else
            {
                cell.Append(value);
            }
        }

        if (cell.Length > 0 || row.Count > 0)
        {
            row.Add(cell.ToString());
            rows.Add(row);
        }

        return rows;
    }
}
