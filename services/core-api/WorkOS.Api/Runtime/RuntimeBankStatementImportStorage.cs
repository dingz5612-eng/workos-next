using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeBankStatementImportStorage : IBankStatementImportWriter
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeBankStatementImportStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public BankStatementImportResult Save(BankStatementImportWrite import)
    {
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        AuditOriginalFileAccess(db, import);
        InsertImport(db, import);
        foreach (var transaction in import.Transactions)
        {
            InsertTransaction(db, transaction);
        }

        db.Commit();
        return new BankStatementImportResult(
            import.ImportId,
            import.TenantId,
            import.SourceType,
            import.Status,
            import.RowCount,
            import.ParsedCount,
            import.RejectedCount,
            import.Transactions,
            import.RejectedRows);
    }

    private static void InsertImport(RuntimeDbSession db, BankStatementImportWrite import)
    {
        using var command = db.CreateCommand("""
            insert into bank_statement_imports(
                import_id, tenant_id, source_type, original_file_id, imported_by, status,
                row_count, parsed_count, rejected_count, imported_at_utc, metadata)
            values (
                @importId, @tenantId, @sourceType, @originalFileId, @importedBy, @status,
                @rowCount, @parsedCount, @rejectedCount, @importedAtUtc, @metadata::jsonb)
            on conflict(import_id) do update set
                status = excluded.status,
                row_count = excluded.row_count,
                parsed_count = excluded.parsed_count,
                rejected_count = excluded.rejected_count,
                metadata = excluded.metadata
            """);
        command.Parameters.AddWithValue("importId", import.ImportId);
        command.Parameters.AddWithValue("tenantId", import.TenantId);
        command.Parameters.AddWithValue("sourceType", import.SourceType);
        command.Parameters.AddWithValue("originalFileId", (object?)import.OriginalFileId ?? DBNull.Value);
        command.Parameters.AddWithValue("importedBy", import.ImportedBy);
        command.Parameters.AddWithValue("status", import.Status);
        command.Parameters.AddWithValue("rowCount", import.RowCount);
        command.Parameters.AddWithValue("parsedCount", import.ParsedCount);
        command.Parameters.AddWithValue("rejectedCount", import.RejectedCount);
        command.Parameters.AddWithValue("importedAtUtc", import.ImportedAtUtc);
        command.Parameters.AddWithValue("metadata", NpgsqlDbType.Jsonb, import.MetadataJson);
        command.ExecuteNonQuery();
    }

    private static void InsertTransaction(RuntimeDbSession db, BankTransactionImportRecord transaction)
    {
        using var command = db.CreateCommand("""
            insert into bank_transactions(
                bank_transaction_id, tenant_id, import_id, external_ref, occurred_at_utc,
                amount, currency, direction, counterparty, description, raw_payload,
                status, created_at_utc)
            values (
                @bankTransactionId, @tenantId, @importId, @externalRef, @occurredAtUtc,
                @amount, @currency, @direction, @counterparty, @description, @rawPayload::jsonb,
                @status, @createdAtUtc)
            on conflict(bank_transaction_id) do nothing
            """);
        command.Parameters.AddWithValue("bankTransactionId", transaction.BankTransactionId);
        command.Parameters.AddWithValue("tenantId", transaction.TenantId);
        command.Parameters.AddWithValue("importId", transaction.ImportId);
        command.Parameters.AddWithValue("externalRef", transaction.ExternalRef);
        command.Parameters.AddWithValue("occurredAtUtc", transaction.OccurredAtUtc);
        command.Parameters.AddWithValue("amount", NpgsqlDbType.Numeric, transaction.Amount);
        command.Parameters.AddWithValue("currency", transaction.Currency);
        command.Parameters.AddWithValue("direction", transaction.Direction);
        command.Parameters.AddWithValue("counterparty", transaction.Counterparty);
        command.Parameters.AddWithValue("description", transaction.Description);
        command.Parameters.AddWithValue("rawPayload", NpgsqlDbType.Jsonb, System.Text.Json.JsonSerializer.Serialize(transaction.RawPayload, PostgresProjectionStore.JsonOptions));
        command.Parameters.AddWithValue("status", transaction.Status);
        command.Parameters.AddWithValue("createdAtUtc", transaction.CreatedAtUtc);
        command.ExecuteNonQuery();
    }

    private static void AuditOriginalFileAccess(RuntimeDbSession db, BankStatementImportWrite import)
    {
        if (string.IsNullOrWhiteSpace(import.OriginalFileId))
        {
            return;
        }

        using (var verify = db.CreateCommand("""
            select count(*)
            from evidence_attachments
            where evidence_id = @evidenceId
              and content_sha256 <> ''
            """))
        {
            verify.Parameters.AddWithValue("evidenceId", import.OriginalFileId);
            if (Convert.ToInt32(verify.ExecuteScalar() ?? 0) <= 0)
            {
                throw new InvalidOperationException("bank_import_file_hash_required");
            }
        }

        using var audit = db.CreateCommand("""
            update evidence_objects
            set audit_trail = audit_trail || @auditTrail::jsonb
            where evidence_id = @evidenceId
            """);
        audit.Parameters.AddWithValue("evidenceId", import.OriginalFileId);
        audit.Parameters.AddWithValue("auditTrail", NpgsqlDbType.Jsonb, System.Text.Json.JsonSerializer.Serialize(new[]
        {
            new
            {
                action = "bank_statement_import_file_accessed",
                actorId = import.ImportedBy,
                importId = import.ImportId,
                atUtc = import.ImportedAtUtc
            }
        }, PostgresProjectionStore.JsonOptions));
        audit.ExecuteNonQuery();
    }
}
