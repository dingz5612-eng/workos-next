using System.Text.Json;
using NpgsqlTypes;

namespace WorkOS.Api.Runtime;

internal sealed class RuntimeEvidenceStorage
{
    private readonly PostgresConnectionFactory connections;

    public RuntimeEvidenceStorage(PostgresConnectionFactory connections)
    {
        this.connections = connections;
    }

    public EvidenceObject CreateDraft(EvidenceDraftRequest request, string actorId)
    {
        var evidenceId = string.IsNullOrWhiteSpace(request.EvidenceId)
            ? $"evd-{Guid.NewGuid():N}"
            : request.EvidenceId!;
        var now = DateTimeOffset.UtcNow;
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        using (var command = db.CreateCommand("""
            insert into evidence_objects(
                evidence_id, workspace_id, card_id, card_instance_id, submission_id, requirement_id,
                status, created_by, created_at_utc, audit_trail)
            values (
                @evidenceId, @workspaceId, @cardId, @cardInstanceId, @submissionId, @requirementId,
                'draft', @actorId, @now, @auditTrail::jsonb)
            on conflict(evidence_id) do nothing
            """))
        {
            command.Parameters.AddWithValue("evidenceId", evidenceId);
            command.Parameters.AddWithValue("workspaceId", request.WorkspaceId);
            command.Parameters.AddWithValue("cardId", request.CardId);
            command.Parameters.AddWithValue("cardInstanceId", request.CardInstanceId);
            command.Parameters.AddWithValue("submissionId", request.SubmissionId);
            command.Parameters.AddWithValue("requirementId", request.RequirementId);
            command.Parameters.AddWithValue("actorId", actorId);
            command.Parameters.AddWithValue("now", now);
            command.Parameters.AddWithValue("auditTrail", NpgsqlDbType.Jsonb, Trail("draft_created", actorId, now, string.Empty));
            command.ExecuteNonQuery();
        }

        using (var command = db.CreateCommand("""
            insert into evidence_requirements(evidence_id, workspace_id, card_id, requirement_id, required, created_at_utc)
            values (@evidenceId, @workspaceId, @cardId, @requirementId, true, @now)
            on conflict(evidence_id, requirement_id) do nothing
            """))
        {
            command.Parameters.AddWithValue("evidenceId", evidenceId);
            command.Parameters.AddWithValue("workspaceId", request.WorkspaceId);
            command.Parameters.AddWithValue("cardId", request.CardId);
            command.Parameters.AddWithValue("requirementId", request.RequirementId);
            command.Parameters.AddWithValue("now", now);
            command.ExecuteNonQuery();
        }

        db.Commit();
        return Get(evidenceId).Single();
    }

    public EvidenceObject Attach(string evidenceId, EvidenceAttachmentRequest request, string actorId)
    {
        var attachmentId = $"att-{Guid.NewGuid():N}";
        var now = DateTimeOffset.UtcNow;
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        using (var command = db.CreateCommand("""
            insert into evidence_attachments(
                attachment_id, evidence_id, file_name, content_type, content_sha256, size_bytes, attached_by, attached_at_utc)
            values (@attachmentId, @evidenceId, @fileName, @contentType, @contentSha256, @sizeBytes, @actorId, @now)
            """))
        {
            command.Parameters.AddWithValue("attachmentId", attachmentId);
            command.Parameters.AddWithValue("evidenceId", evidenceId);
            command.Parameters.AddWithValue("fileName", request.FileName);
            command.Parameters.AddWithValue("contentType", request.ContentType);
            command.Parameters.AddWithValue("contentSha256", request.ContentSha256);
            command.Parameters.AddWithValue("sizeBytes", request.SizeBytes);
            command.Parameters.AddWithValue("actorId", actorId);
            command.Parameters.AddWithValue("now", now);
            command.ExecuteNonQuery();
        }

        UpdateStatus(db, evidenceId, "attached", actorId, now, "attached");
        db.Commit();
        return Get(evidenceId).Single();
    }

    public EvidenceObject Decide(string evidenceId, EvidenceDecisionRequest request, string status)
    {
        var now = DateTimeOffset.UtcNow;
        using var connection = connections.Open();
        using var db = new RuntimeDbSession(connection);
        UpdateStatus(db, evidenceId, status, request.ActorId, now, request.Reason);
        db.Commit();
        return Get(evidenceId).Single();
    }

    public IReadOnlyList<EvidenceObject> Get(string? evidenceId = null)
    {
        using var connection = connections.Open();
        using var command = connection.CreateCommand();
        command.CommandText = evidenceId is null
            ? """
              select evidence_id, workspace_id, card_id, card_instance_id, submission_id, requirement_id, status,
                     created_at_utc, attached_at_utc, verified_at_utc, rejected_at_utc, used_event_id, used_submission_id
              from evidence_objects
              order by created_at_utc, evidence_id
              """
            : """
              select evidence_id, workspace_id, card_id, card_instance_id, submission_id, requirement_id, status,
                     created_at_utc, attached_at_utc, verified_at_utc, rejected_at_utc, used_event_id, used_submission_id
              from evidence_objects
              where evidence_id = @evidenceId
              """;
        if (evidenceId is not null)
        {
            command.Parameters.AddWithValue("evidenceId", evidenceId);
        }

        var rows = new List<(string EvidenceId, string WorkspaceId, string CardId, string CardInstanceId, string SubmissionId, string RequirementId, string Status, DateTimeOffset CreatedAtUtc, DateTimeOffset? AttachedAtUtc, DateTimeOffset? VerifiedAtUtc, DateTimeOffset? RejectedAtUtc, string? UsedEventId, string? UsedSubmissionId)>();
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                rows.Add((
                    reader.GetString(0),
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetString(4),
                    reader.GetString(5),
                    reader.GetString(6),
                    reader.GetFieldValue<DateTimeOffset>(7),
                    reader.IsDBNull(8) ? null : reader.GetFieldValue<DateTimeOffset>(8),
                    reader.IsDBNull(9) ? null : reader.GetFieldValue<DateTimeOffset>(9),
                    reader.IsDBNull(10) ? null : reader.GetFieldValue<DateTimeOffset>(10),
                    reader.IsDBNull(11) ? null : reader.GetString(11),
                    reader.IsDBNull(12) ? null : reader.GetString(12)));
            }
        }

        var items = new List<EvidenceObject>();
        foreach (var row in rows)
        {
            items.Add(new EvidenceObject(
                row.EvidenceId,
                row.WorkspaceId,
                row.CardId,
                row.CardInstanceId,
                row.SubmissionId,
                row.RequirementId,
                row.Status,
                AttachmentsFor(connection, row.EvidenceId),
                row.CreatedAtUtc,
                row.AttachedAtUtc,
                row.VerifiedAtUtc,
                row.RejectedAtUtc,
                row.UsedEventId,
                row.UsedSubmissionId));
        }

        return items;
    }

    public ConfirmResult? ValidateForConfirm(string workspaceId, string cardId, ConfirmCardRequest request, IReadOnlyList<EvidenceRequirement> requirements)
    {
        var ids = request.EvidenceIds?.Where(item => !string.IsNullOrWhiteSpace(item)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray() ?? Array.Empty<string>();
        if (ids.Length == 0)
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "evidence_object_required", null);
        }

        var requiredIds = requirements.Select(item => item.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var evidenceId in ids)
        {
            var evidence = Get(evidenceId).SingleOrDefault();
            if (evidence is null)
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "evidence_object_not_found", null);
            }

            if (!evidence.WorkspaceId.Equals(workspaceId, StringComparison.OrdinalIgnoreCase) ||
                !evidence.CardId.Equals(cardId, StringComparison.OrdinalIgnoreCase) ||
                !evidence.CardInstanceId.Equals(request.CardInstanceId, StringComparison.OrdinalIgnoreCase) ||
                !evidence.SubmissionId.Equals(request.SubmissionId, StringComparison.OrdinalIgnoreCase))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "evidence_object_scope_mismatch", null);
            }

            if (requiredIds.Count > 0 && !requiredIds.Contains(evidence.RequirementId))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "evidence_requirement_mismatch", null);
            }

            if (evidence.Status is not ("attached" or "verified"))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "evidence_object_not_attached", null);
            }

            if (!string.IsNullOrWhiteSpace(evidence.UsedSubmissionId) &&
                !evidence.UsedSubmissionId.Equals(request.SubmissionId, StringComparison.OrdinalIgnoreCase))
            {
                return new ConfirmResult(ConfirmStatus.Forbidden, "evidence_object_already_used", null);
            }
        }

        return null;
    }

    public void MarkUsed(RuntimeDbSession db, IReadOnlyList<string>? evidenceIds, WorkspaceEvent workspaceEvent)
    {
        if (evidenceIds is null || evidenceIds.Count == 0)
        {
            return;
        }

        foreach (var evidenceId in evidenceIds.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            using var command = db.CreateCommand("""
                update evidence_objects
                set used_event_id = coalesce(used_event_id, @eventId),
                    used_submission_id = coalesce(used_submission_id, @submissionId),
                    used_at_utc = coalesce(used_at_utc, @usedAtUtc)
                where evidence_id = @evidenceId
                """);
            command.Parameters.AddWithValue("evidenceId", evidenceId);
            command.Parameters.AddWithValue("eventId", workspaceEvent.EventId);
            command.Parameters.AddWithValue("submissionId", (object?)workspaceEvent.SubmissionId ?? DBNull.Value);
            command.Parameters.AddWithValue("usedAtUtc", workspaceEvent.OccurredAtUtc);
            command.ExecuteNonQuery();
        }
    }

    private static IReadOnlyList<EvidenceAttachment> AttachmentsFor(Npgsql.NpgsqlConnection connection, string evidenceId)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            select attachment_id, evidence_id, file_name, content_type, content_sha256, size_bytes, attached_at_utc
            from evidence_attachments
            where evidence_id = @evidenceId
            order by attached_at_utc, attachment_id
            """;
        command.Parameters.AddWithValue("evidenceId", evidenceId);
        using var reader = command.ExecuteReader();
        var attachments = new List<EvidenceAttachment>();
        while (reader.Read())
        {
            attachments.Add(new EvidenceAttachment(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetInt64(5),
                reader.GetFieldValue<DateTimeOffset>(6)));
        }

        return attachments;
    }

    private static void UpdateStatus(RuntimeDbSession db, string evidenceId, string status, string actorId, DateTimeOffset now, string reason)
    {
        using var command = db.CreateCommand("""
            update evidence_objects
            set status = @status,
                attached_at_utc = case when @status = 'attached' then coalesce(attached_at_utc, @now) else attached_at_utc end,
                verified_by = case when @status = 'verified' then @actorId else verified_by end,
                verified_at_utc = case when @status = 'verified' then @now else verified_at_utc end,
                rejected_by = case when @status = 'rejected' then @actorId else rejected_by end,
                rejected_at_utc = case when @status = 'rejected' then @now else rejected_at_utc end,
                audit_trail = audit_trail || @auditTrail::jsonb
            where evidence_id = @evidenceId
            """);
        command.Parameters.AddWithValue("evidenceId", evidenceId);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("actorId", actorId);
        command.Parameters.AddWithValue("now", now);
        command.Parameters.AddWithValue("auditTrail", NpgsqlDbType.Jsonb, Trail(status, actorId, now, reason));
        command.ExecuteNonQuery();
    }

    private static string Trail(string action, string actorId, DateTimeOffset at, string reason) =>
        JsonSerializer.Serialize(new[]
        {
            new { action, actorId, atUtc = at, reason }
        }, PostgresProjectionStore.JsonOptions);
}
