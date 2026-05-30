namespace WorkOS.Api.Runtime;

public sealed record BankStatementColumnMapping(
    string OccurredAt = "occurredAt",
    string Amount = "amount",
    string Currency = "currency",
    string Direction = "direction",
    string ExternalRef = "externalRef",
    string Description = "description");

public sealed record BankStatementImportRequest(
    string TenantId,
    string SourceType,
    string CsvContent,
    BankStatementColumnMapping? ColumnMapping = null,
    string? OriginalFileId = null,
    string? ImportedBy = null,
    string? ImportId = null);

public sealed record BankStatementImportPreview(
    int RowCount,
    int ParsedCount,
    int RejectedCount,
    IReadOnlyList<BankStatementPreviewRow> Rows);

public sealed record BankStatementPreviewRow(
    int RowNumber,
    bool Valid,
    DateTimeOffset? OccurredAtUtc,
    decimal? Amount,
    string Currency,
    string Direction,
    string ExternalRef,
    string Description,
    IReadOnlyDictionary<string, string> RawPayload,
    IReadOnlyList<string> Errors);

public sealed record BankStatementImportResult(
    string ImportId,
    string TenantId,
    string SourceType,
    string Status,
    int RowCount,
    int ParsedCount,
    int RejectedCount,
    IReadOnlyList<BankTransactionImportRecord> Transactions,
    IReadOnlyList<BankStatementRejectedRow> RejectedRows);

public sealed record BankTransactionImportRecord(
    string BankTransactionId,
    string TenantId,
    string ImportId,
    string ExternalRef,
    DateTimeOffset OccurredAtUtc,
    decimal Amount,
    string Currency,
    string Direction,
    string Counterparty,
    string Description,
    IReadOnlyDictionary<string, string> RawPayload,
    string Status,
    DateTimeOffset CreatedAtUtc);

public sealed record BankStatementRejectedRow(
    int RowNumber,
    string ExternalRef,
    IReadOnlyList<string> Errors);

internal sealed record BankStatementImportWrite(
    string ImportId,
    string TenantId,
    string SourceType,
    string? OriginalFileId,
    string ImportedBy,
    string Status,
    int RowCount,
    int ParsedCount,
    int RejectedCount,
    DateTimeOffset ImportedAtUtc,
    string MetadataJson,
    IReadOnlyList<BankTransactionImportRecord> Transactions,
    IReadOnlyList<BankStatementRejectedRow> RejectedRows);
