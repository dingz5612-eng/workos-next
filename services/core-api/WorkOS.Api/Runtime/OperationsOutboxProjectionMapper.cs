using System.Text.Json;

namespace WorkOS.Api.Runtime;

public static class OperationsOutboxProjectionMapper
{
    private static readonly IReadOnlyList<string> ProjectionTargets = new[]
    {
        "IntentWorkspaceProjection",
        "WorkspaceCardProjection",
        "WorkQueueProjection",
        "SearchProjection",
        "ScenarioCoachProjection",
        "AiContextProjection",
        "AuditEvidenceProjection"
    };

    public static WorkspaceEvent? ToWorkspaceEvent(OperationsOutboxMessage message)
    {
        if (!message.MessageType.Equals("operations.work_item.confirmed", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var workspaceId = Text(message.Payload, "workspaceId");
        var cardId = Text(message.Payload, "cardId");
        if (string.IsNullOrWhiteSpace(workspaceId) || string.IsNullOrWhiteSpace(cardId))
        {
            throw new InvalidOperationException("operations_projection_requires_workspace_card");
        }

        var submissionId = FirstNonEmpty(Text(message.Payload, "submissionId"), message.SubmissionId);
        var fields = StringMap(message.Payload, "fieldValues");
        var payload = new Dictionary<string, string>(fields, StringComparer.Ordinal)
        {
            ["operationsMessageId"] = message.MessageId,
            ["operationsWorkItemId"] = message.WorkItemId,
            ["operationsCaseId"] = message.CaseId,
            ["operationsSource"] = "operations_outbox_projection"
        };
        foreach (var key in new[] { "operationMode", "correctionMode", "sourceWorkItemId", "sourceSubmissionId" })
        {
            var value = Text(message.Payload, key);
            if (!string.IsNullOrWhiteSpace(value))
            {
                payload[key] = value;
            }
        }

        return new WorkspaceEvent(
            message.EventId,
            workspaceId,
            cardId,
            "OperationsWorkItemConfirmed",
            submissionId,
            null,
            submissionId,
            FirstNonEmpty(Text(message.Payload, "actorRole"), "operations"),
            FirstNonEmpty(Text(message.Payload, "actorId"), "operations-runtime"),
            message.CreatedAtUtc,
            payload,
            ProjectionTargets,
            StringArray(message.Payload, "evidenceIds"),
            submissionId,
            Text(message.Payload, "cardInstanceId"),
            Text(message.Payload, "aggregateRef"));
    }

    private static IReadOnlyDictionary<string, string> StringMap(IReadOnlyDictionary<string, object> source, string key)
    {
        if (!source.TryGetValue(key, out var value) || value is null)
        {
            return new Dictionary<string, string>();
        }

        if (value is JsonElement element && element.ValueKind == JsonValueKind.Object)
        {
            return element.EnumerateObject()
                .ToDictionary(item => item.Name, item => JsonText(item.Value), StringComparer.Ordinal);
        }

        if (value is IReadOnlyDictionary<string, object> objectMap)
        {
            return objectMap.ToDictionary(item => item.Key, item => TextValue(item.Value), StringComparer.Ordinal);
        }

        if (value is IReadOnlyDictionary<string, string> stringMap)
        {
            return new Dictionary<string, string>(stringMap, StringComparer.Ordinal);
        }

        return new Dictionary<string, string>();
    }

    private static IReadOnlyList<string> StringArray(IReadOnlyDictionary<string, object> source, string key)
    {
        if (!source.TryGetValue(key, out var value) || value is null)
        {
            return Array.Empty<string>();
        }

        if (value is JsonElement element && element.ValueKind == JsonValueKind.Array)
        {
            return element.EnumerateArray().Select(JsonText).Where(item => !string.IsNullOrWhiteSpace(item)).ToArray();
        }

        if (value is IEnumerable<string> strings)
        {
            return strings.Where(item => !string.IsNullOrWhiteSpace(item)).ToArray();
        }

        return Array.Empty<string>();
    }

    private static string Text(IReadOnlyDictionary<string, object> source, string key) =>
        source.TryGetValue(key, out var value) ? TextValue(value) : string.Empty;

    private static string TextValue(object? value) =>
        value switch
        {
            null => string.Empty,
            string text => text,
            JsonElement element => JsonText(element),
            _ => Convert.ToString(value) ?? string.Empty
        };

    private static string JsonText(JsonElement element) =>
        element.ValueKind == JsonValueKind.String ? element.GetString() ?? string.Empty : element.ToString();

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
}
