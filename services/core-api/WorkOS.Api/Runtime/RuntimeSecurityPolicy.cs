namespace WorkOS.Api.Runtime;

public static class RuntimeSecurityPolicy
{
    private const decimal HighAmountThreshold = 1000m;

    private static readonly IReadOnlyDictionary<string, string> HighRiskCapabilities =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["payment.confirm"] = "payment.confirm",
            ["deposit.refund.pay"] = "deposit.refund.pay",
            ["deposit.deduct"] = "deposit.deduct",
            ["case.close"] = "case.close",
            ["period.close"] = "period.close",
            ["ledger.export"] = "pc.export.ledger",
            ["correction.approve"] = "correction.approve",
            ["release.cutover"] = "release.cutover",
            ["projection.rebuild"] = "projection.rebuild",
            ["deadletter.replay"] = "deadletter.replay"
        };

    private static readonly HashSet<string> HighRiskCardIds = new(StringComparer.OrdinalIgnoreCase)
    {
        "depositRefundPayment",
        "depositDeduction",
        "finalBalanceClose",
        "periodClose"
    };

    private static readonly HashSet<string> HighRiskActionKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "payment.confirm",
        "deposit.refund.pay",
        "deposit.deduct",
        "case.close",
        "period.close",
        "ledger.export",
        "correction.approve",
        "release.cutover",
        "projection.rebuild",
        "deadletter.replay"
    };

    public static ConfirmResult? ValidateConfirm(
        CardProjection card,
        RuntimeUser actor,
        ConfirmCardRequest request,
        RuntimeDeviceSession? deviceSession,
        bool requireTrustedDeviceForHighRiskActions)
    {
        if (IsTerminalAction(card) && actor.Role.Equals("ai", StringComparison.OrdinalIgnoreCase))
        {
            return new ConfirmResult(ConfirmStatus.Forbidden, "ai_terminal_action_forbidden", null);
        }

        if (!requireTrustedDeviceForHighRiskActions || !IsHighRiskConfirm(card, request))
        {
            return null;
        }

        return TrustedDeviceCanPerformHighRiskAction(deviceSession)
            ? null
            : new ConfirmResult(ConfirmStatus.Forbidden, $"trusted_device_required:{HighRiskActionKeyFor(card)}", null);
    }

    public static bool TrustedDeviceCanPerformHighRiskAction(RuntimeDeviceSession? deviceSession)
    {
        if (deviceSession is null || deviceSession.RevokedAtUtc is not null)
        {
            return false;
        }

        return deviceSession.DeviceTrustStatus.Equals("trusted", StringComparison.OrdinalIgnoreCase);
    }

    public static bool TrustedDeviceCanPerformHighRiskAction(string deviceTrustStatus, string surface, DateTimeOffset? revokedAtUtc = null)
    {
        if (revokedAtUtc is not null)
        {
            return false;
        }

        return deviceTrustStatus.Equals("trusted", StringComparison.OrdinalIgnoreCase) &&
            surface.Equals("pc", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsHighRiskAction(string actionKey) =>
        HighRiskActionKeys.Contains(actionKey);

    public static void ValidateHighRiskOperation(
        string actionKey,
        string? actorId,
        string? actorRole,
        IReadOnlyList<string>? actorCapabilities,
        string? deviceTrustStatus,
        string? surface,
        string? reason)
    {
        if (!IsHighRiskAction(actionKey))
        {
            throw new InvalidOperationException($"high_risk_action_unknown:{actionKey}");
        }

        if (string.IsNullOrWhiteSpace(actorId))
        {
            throw new InvalidOperationException($"{actionKey}_actor_required");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new InvalidOperationException($"{actionKey}_reason_required");
        }

        var capabilities = new HashSet<string>(actorCapabilities ?? Array.Empty<string>(), StringComparer.OrdinalIgnoreCase);
        var requiredCapability = HighRiskCapabilities[actionKey];
        if (!capabilities.Contains(requiredCapability) &&
            !capabilities.Contains("runtime.high_risk.all") &&
            !(actorRole ?? string.Empty).Equals("admin", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"{actionKey}_capability_required");
        }

        if (!TrustedDeviceCanPerformHighRiskAction(deviceTrustStatus ?? string.Empty, surface ?? string.Empty))
        {
            throw new InvalidOperationException($"{actionKey}_trusted_device_required");
        }
    }

    public static bool IsHighRiskConfirm(CardProjection card, ConfirmCardRequest request)
    {
        if (card.Id.Equals("paymentConfirmation", StringComparison.OrdinalIgnoreCase))
        {
            return DecimalValue(request, "confirmedAmount", "paymentAmount") >= HighAmountThreshold;
        }

        return HighRiskCardIds.Contains(card.Id);
    }

    public static bool IsTerminalAction(CardProjection card) =>
        card.Transitions.OnConfirm.Equals("done", StringComparison.OrdinalIgnoreCase) ||
        card.Id.Contains("close", StringComparison.OrdinalIgnoreCase) ||
        card.Id.Equals("paymentConfirmation", StringComparison.OrdinalIgnoreCase) ||
        card.Id.Equals("depositConfirmation", StringComparison.OrdinalIgnoreCase) ||
        HighRiskCardIds.Contains(card.Id);

    private static string HighRiskActionKeyFor(CardProjection card) =>
        card.Id switch
        {
            "paymentConfirmation" => "payment.confirm",
            "depositRefundPayment" => "deposit.refund.pay",
            "depositDeduction" => "deposit.deduct",
            "finalBalanceClose" => "case.close",
            "periodClose" => "period.close",
            _ => card.Id
        };

    private static decimal DecimalValue(ConfirmCardRequest request, params string[] keys)
    {
        if (request.FieldValues is null)
        {
            return 0m;
        }

        foreach (var key in keys)
        {
            var raw = RuntimeFieldAliases.Value(request.FieldValues, key, string.Empty);
            if (decimal.TryParse(raw, out var value))
            {
                return value;
            }
        }

        return 0m;
    }
}

public static class RuntimeFileUploadPolicy
{
    public const long MaxEvidenceFileSizeBytes = 10 * 1024 * 1024;

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "text/csv",
        "text/plain"
    };

    public static void Validate(EvidenceAttachmentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ContentSha256))
        {
            throw new InvalidOperationException("evidence_file_hash_required");
        }

        if (!AllowedContentTypes.Contains(request.ContentType))
        {
            throw new InvalidOperationException("evidence_file_type_forbidden");
        }

        if (request.SizeBytes <= 0 || request.SizeBytes > MaxEvidenceFileSizeBytes)
        {
            throw new InvalidOperationException("evidence_file_size_forbidden");
        }
    }
}

public static class RuntimeSignedUrlPolicy
{
    public const int MaxTtlSeconds = 15 * 60;

    public static DateTimeOffset Expiration(DateTimeOffset nowUtc, int requestedTtlSeconds)
    {
        var ttl = Math.Clamp(requestedTtlSeconds <= 0 ? MaxTtlSeconds : requestedTtlSeconds, 1, MaxTtlSeconds);
        return nowUtc.AddSeconds(ttl);
    }

    public static bool IsUsable(DateTimeOffset expiresAtUtc, DateTimeOffset nowUtc) =>
        nowUtc < expiresAtUtc;
}

public static class RuntimeGovernanceExportPolicy
{
    private static readonly Dictionary<string, (string Capability, bool HighRisk)> Definitions =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["ledger"] = ("pc.export.ledger", true),
            ["caseTimeline"] = ("pc.export.case_timeline", false),
            ["evidenceAudit"] = ("pc.export.evidence_audit", true),
            ["periodSnapshot"] = ("pc.export.period_snapshot", true)
        };

    public static GovernanceExportResult Validate(GovernanceExportRequest request)
    {
        var now = request.NowUtc ?? DateTimeOffset.UtcNow;
        var expiresAtUtc = RuntimeSignedUrlPolicy.Expiration(now, RuntimeSignedUrlPolicy.MaxTtlSeconds);
        var errors = new List<string>();
        Definitions.TryGetValue(request.ExportType, out var definition);

        if (definition.Capability is null)
        {
            errors.Add("EXPORT_TYPE_UNKNOWN");
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            errors.Add("EXPORT_REASON_REQUIRED");
        }

        var capabilities = new HashSet<string>(request.ActorCapabilities ?? Array.Empty<string>(), StringComparer.OrdinalIgnoreCase);
        if (definition.Capability is not null &&
            !capabilities.Contains(definition.Capability) &&
            !capabilities.Contains("pc.export.all") &&
            !request.ActorRole.Equals("admin", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("EXPORT_CAPABILITY_REQUIRED");
        }

        if (definition.HighRisk &&
            !RuntimeSecurityPolicy.TrustedDeviceCanPerformHighRiskAction(request.DeviceTrustStatus, request.Surface))
        {
            errors.Add("TRUSTED_PC_REQUIRED");
        }

        var auditEventId = $"export-audit-{Guid.NewGuid():N}";
        return new GovernanceExportResult(
            errors.Count == 0,
            errors.Count == 0 ? "accepted" : "blocked",
            request.ExportType,
            request.Reason.Trim(),
            errors,
            errors.Count == 0
                ? $"/api/pc-governance/exports/{Uri.EscapeDataString(request.ExportType)}/download?expiresAtUtc={Uri.EscapeDataString(expiresAtUtc.ToString("O"))}&auditEventId={auditEventId}"
                : null,
            expiresAtUtc,
            auditEventId);
    }
}
