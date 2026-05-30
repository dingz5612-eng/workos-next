using System.Text.Json;

namespace WorkOS.Api.Runtime;

internal interface IBankStatementImportWriter
{
    BankStatementImportResult Save(BankStatementImportWrite import);
}

internal sealed class BankStatementImportService
{
    private readonly BankStatementCsvParser parser = new();
    private readonly IBankStatementImportWriter writer;

    public BankStatementImportService(IBankStatementImportWriter writer)
    {
        this.writer = writer;
    }

    public BankStatementImportPreview Preview(BankStatementImportRequest request) =>
        parser.Preview(request);

    public BankStatementImportResult Confirm(BankStatementImportRequest request, string actorId)
    {
        var preview = Preview(request);
        var importId = string.IsNullOrWhiteSpace(request.ImportId)
            ? $"bank-import-{Guid.NewGuid():N}"
            : request.ImportId!;
        var importedAtUtc = DateTimeOffset.UtcNow;
        var importedBy = string.IsNullOrWhiteSpace(request.ImportedBy)
            ? actorId
            : request.ImportedBy!;
        var sourceType = string.IsNullOrWhiteSpace(request.SourceType)
            ? "manual_csv"
            : request.SourceType;
        var status = preview.ParsedCount == 0
            ? "failed"
            : preview.RejectedCount > 0 ? "partially_rejected" : "imported";
        var transactions = preview.Rows
            .Where(row => row.Valid)
            .Select(row => new BankTransactionImportRecord(
                $"bank-tx-{importId}-{row.RowNumber}".ToLowerInvariant(),
                request.TenantId,
                importId,
                row.ExternalRef,
                row.OccurredAtUtc!.Value,
                row.Amount!.Value,
                row.Currency,
                row.Direction,
                CounterpartyFrom(row.RawPayload),
                row.Description,
                row.RawPayload,
                "imported",
                importedAtUtc))
            .ToArray();
        var rejectedRows = preview.Rows
            .Where(row => !row.Valid)
            .Select(row => new BankStatementRejectedRow(row.RowNumber, row.ExternalRef, row.Errors))
            .ToArray();
        var metadataJson = JsonSerializer.Serialize(new
        {
            columnMapping = request.ColumnMapping ?? new BankStatementColumnMapping(),
            originalFileId = request.OriginalFileId,
            rejectedRows
        }, PostgresProjectionStore.JsonOptions);

        return writer.Save(new BankStatementImportWrite(
            importId,
            request.TenantId,
            sourceType,
            request.OriginalFileId,
            importedBy,
            status,
            preview.RowCount,
            preview.ParsedCount,
            preview.RejectedCount,
            importedAtUtc,
            metadataJson,
            transactions,
            rejectedRows));
    }

    private static string CounterpartyFrom(IReadOnlyDictionary<string, string> rawPayload) =>
        RuntimeFieldAliases.Value(rawPayload, "counterparty", string.Empty);
}
