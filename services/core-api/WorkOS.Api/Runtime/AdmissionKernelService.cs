namespace WorkOS.Api.Runtime;

public sealed class AdmissionKernelService
{
    private readonly BusinessLineAdmissionRegistry businessLines;

    public AdmissionKernelService()
        : this(BusinessLineAdmissionRegistry.LoadDefault())
    {
    }

    public AdmissionKernelService(BusinessLineAdmissionRegistry businessLines)
    {
        this.businessLines = businessLines;
    }

    public AdmissionKernelDecision EvaluateConfirm(
        WorkItemDefinitionResolution definition,
        RuntimeActorContext actor,
        string? workItemOwnerRole,
        string? deviceId,
        bool productionRequested)
    {
        var businessLine = businessLines.Find(definition.BusinessLineId);
        if (!definition.Resolved)
        {
            return AdmissionKernelDecision.BlockProductionOnly(
                definition,
                "prepare_only",
                "Definition Registry did not resolve this WorkItem; Operations Runtime confirm remains prepare-only for L1 observation and production confirm is blocked.",
                new[] { "docs/contracts/definition/workitem-definition-registry.json" },
                new[] { "definition_not_resolved_for_production_confirm" },
                businessLine?.Level ?? "unknown",
                businessLine?.SurfaceMode ?? "operations-runtime");
        }

        var highRisk = IsHighRisk(definition);
        var requiredCapabilities = RequiredCapabilitiesFor(definition).ToArray();
        var requiredDeviceTrust = highRisk ? new[] { "trusted_device" } : Array.Empty<string>();

        if (businessLine is null)
        {
            return AdmissionKernelDecision.Blocked(
                definition,
                "blocked",
                "Business line is not registered in BusinessLineRegistry; confirm is blocked.",
                new[] { "docs/business/business-line-registry.json" },
                requiredCapabilities,
                requiredDeviceTrust,
                "unknown",
                "unknown",
                new[] { "business_line_not_registered" });
        }

        if (businessLine.Level.Equals("L0 Contract Preview", StringComparison.OrdinalIgnoreCase))
        {
            return AdmissionKernelDecision.Blocked(
                definition,
                "contract_preview",
                "L0 Contract Preview can expose learning and prepare-only surfaces, but cannot confirm.",
                new[] { "docs/business/business-line-registry.json" },
                requiredCapabilities,
                requiredDeviceTrust,
                businessLine.Level,
                businessLine.SurfaceMode,
                new[] { "l0_contract_preview" });
        }

        if (productionRequested)
        {
            return AdmissionKernelDecision.Blocked(
                definition,
                "production_blocked",
                "Production confirm is blocked until Business Production, business-line admission, and definition productionConfirmAllowed all pass.",
                new[] { "docs/oam/current-admission-state.json", "docs/business/business-line-registry.json", "docs/contracts/definition/workitem-definition-registry.json" },
                requiredCapabilities,
                requiredDeviceTrust,
                businessLine.Level,
                businessLine.SurfaceMode,
                new[] { "business_production_blocked", "definition_production_confirm_blocked" });
        }

        var requiredOwnerRoles = RequiredOwnerRolesFor(workItemOwnerRole);
        if (requiredOwnerRoles.Length > 0 &&
            !requiredOwnerRoles.Contains(actor.Role, StringComparer.OrdinalIgnoreCase))
        {
            return AdmissionKernelDecision.Blocked(
                definition,
                "role_forbidden",
                "Actor role is not allowed to confirm this WorkItem owner role.",
                new[] { "docs/oam/current-architecture.md", "docs/contracts/admission/admission-matrix.json" },
                requiredCapabilities,
                requiredDeviceTrust,
                businessLine.Level,
                businessLine.SurfaceMode,
                new[] { $"admission_role_forbidden:{FirstNonEmpty(workItemOwnerRole, "unknown")}" });
        }

        var missingStandardCapabilities = requiredCapabilities
            .Where(capability => !HasCapability(actor, capability))
            .ToArray();
        if (missingStandardCapabilities.Length > 0)
        {
            return AdmissionKernelDecision.Blocked(
                definition,
                "capability_forbidden",
                "Actor capability set does not satisfy this WorkItem definition.",
                new[] { "docs/contracts/admission/admission-matrix.json", "docs/contracts/definition/risk-policy-refs.json" },
                requiredCapabilities,
                requiredDeviceTrust,
                businessLine.Level,
                businessLine.SurfaceMode,
                missingStandardCapabilities);
        }

        if (highRisk)
        {
            var missingCapabilities = requiredCapabilities
                .Where(capability => !HasCapability(actor, capability))
                .ToArray();
            var deviceMissing = string.IsNullOrWhiteSpace(deviceId);
            if (missingCapabilities.Length > 0 || deviceMissing)
            {
                return AdmissionKernelDecision.Blocked(
                    definition,
                    "production_blocked",
                    "High-risk action requires declared capability, trusted device context, admission reason, and evidence before confirm.",
                    new[] { "docs/contracts/admission/admission-matrix.json", "docs/contracts/runtime-surface-policy.json" },
                    requiredCapabilities,
                    requiredDeviceTrust,
                    businessLine.Level,
                    businessLine.SurfaceMode,
                    missingCapabilities.Concat(deviceMissing ? new[] { "trusted_device_context_required" } : Array.Empty<string>()).ToArray());
            }
        }

        return AdmissionKernelDecision.AllowedInternalPilot(
            definition,
            "Dormitory is admitted for L1 internal pilot observation; productionAllowed remains false.",
            requiredCapabilities,
            requiredDeviceTrust,
            businessLine.Level,
            businessLine.SurfaceMode);
    }

    public AdmissionKernelDecision EvaluateSearch(
        WorkItemDefinitionResolution definition,
        RuntimeActorContext actor)
    {
        var businessLine = businessLines.Find(definition.BusinessLineId);
        if (businessLine is null)
        {
            return AdmissionKernelDecision.SearchVisible(
                definition,
                "blocked",
                "Search may show this retired result, but business line admission is unresolved and production remains blocked.",
                Array.Empty<string>(),
                Array.Empty<string>(),
                "unknown",
                "unknown",
                new[] { "business_line_not_registered" });
        }

        if (businessLine.Level.Equals("L0 Contract Preview", StringComparison.OrdinalIgnoreCase))
        {
            return AdmissionKernelDecision.SearchVisible(
                definition,
                "contract_preview",
                "This business line is L0 Contract Preview; search can show learning or prepare-only entry points, not confirm.",
                Array.Empty<string>(),
                Array.Empty<string>(),
                businessLine.Level,
                businessLine.SurfaceMode,
                new[] { "l0_contract_preview" });
        }

        var requiredCapabilities = RequiredCapabilitiesFor(definition).ToArray();
        var requiredDeviceTrust = IsHighRisk(definition) ? new[] { "trusted_device" } : Array.Empty<string>();
        return AdmissionKernelDecision.SearchVisible(
            definition,
            definition.Resolved ? "internal_pilot_observation" : "prepare_only",
            definition.Resolved
                ? "Search result is visible in L1 internal pilot observation; production confirm remains blocked."
                : "Search result is visible through retired, but production confirm is blocked until Definition Registry resolves it.",
            requiredCapabilities,
            requiredDeviceTrust,
            businessLine.Level,
            businessLine.SurfaceMode,
            definition.Resolved ? Array.Empty<string>() : new[] { "definition_not_resolved_for_production_confirm" });
    }

    private static bool IsHighRisk(WorkItemDefinitionResolution definition) =>
        definition.Definition?.AdmissionPolicyRef.Contains("high_risk", StringComparison.OrdinalIgnoreCase) == true ||
        definition.Definition?.RiskPolicyRef.Contains("high_risk", StringComparison.OrdinalIgnoreCase) == true ||
        definition.Definition?.RiskPolicyRef.Contains("money_out", StringComparison.OrdinalIgnoreCase) == true;

    private static IReadOnlyList<string> RequiredCapabilitiesFor(WorkItemDefinitionResolution definition)
    {
        var policy = definition.Definition?.RiskPolicyRef ?? string.Empty;
        var retiredCard = definition.RetiredCardId;
        if (policy.Contains("payment.high_risk_confirm", StringComparison.OrdinalIgnoreCase)) return new[] { "finance.payment.confirm" };
        if (policy.Contains("deposit.high_risk_confirm", StringComparison.OrdinalIgnoreCase)) return new[] { "finance.deposit.confirm" };
        if (policy.Contains("deposit.high_risk_refund", StringComparison.OrdinalIgnoreCase)) return new[] { "finance.deposit.refund" };
        if (policy.Contains("period.high_risk_close", StringComparison.OrdinalIgnoreCase)) return new[] { "period.close" };
        if (policy.Contains("ledger.high_risk_correction", StringComparison.OrdinalIgnoreCase)) return new[] { "finance.correction.apply" };
        if (retiredCard.Contains("room", StringComparison.OrdinalIgnoreCase) ||
            retiredCard.Contains("bed", StringComparison.OrdinalIgnoreCase) ||
            retiredCard.Contains("rate", StringComparison.OrdinalIgnoreCase))
        {
            return new[] { "operations.confirm" };
        }

        return Array.Empty<string>();
    }

    private static bool HasCapability(RuntimeActorContext actor, string capability) =>
        actor.Capabilities.Contains(capability, StringComparer.OrdinalIgnoreCase) ||
        actor.Capabilities.Contains("runtime.high_risk.all", StringComparer.OrdinalIgnoreCase);

    private static string[] RequiredOwnerRolesFor(string? ownerRole) =>
        ownerRole?.ToLowerInvariant() switch
        {
            "operator" => new[] { "operator", "frontdesk", "housekeeping", "manager", "admin", "releaseowner" },
            "operations" => new[] { "operations", "operator", "manager", "admin", "releaseowner" },
            "finance" => new[] { "finance", "admin", "releaseowner" },
            "manager" => new[] { "manager", "admin", "releaseowner" },
            "frontdesk" => new[] { "frontdesk", "operator", "manager", "admin", "releaseowner" },
            "housekeeping" => new[] { "housekeeping", "operator", "manager", "admin", "releaseowner" },
            "repair" => new[] { "repair", "admin", "releaseowner" },
            null or "" => Array.Empty<string>(),
            _ => new[] { ownerRole! }
        };

    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
}

public sealed record AdmissionKernelDecision(
    bool VisibleAllowed,
    bool PrepareAllowed,
    bool ConfirmAllowed,
    bool ProductionAllowed,
    string Mode,
    string Reason,
    IReadOnlyList<string> BlockingSources,
    IReadOnlyList<string> RequiredCapabilities,
    IReadOnlyList<string> RequiredDeviceTrust,
    string BusinessLineState,
    string ReleaseState,
    string SurfaceState,
    IReadOnlyList<string> NoGoItems,
    string AdmissionDecisionRef)
{
    public static AdmissionKernelDecision AllowedInternalPilot(
        WorkItemDefinitionResolution definition,
        string reason,
        IReadOnlyList<string> requiredCapabilities,
        IReadOnlyList<string> requiredDeviceTrust,
        string businessLineState,
        string surfaceState) =>
        new(
            true,
            true,
            true,
            false,
            "internal_pilot_observation",
            reason,
            new[] { "docs/oam/current-admission-state.json" },
            requiredCapabilities,
            requiredDeviceTrust,
            businessLineState,
            "BUSINESS_PRODUCTION_BLOCKED",
            surfaceState,
            Array.Empty<string>(),
            RefFor(definition, "internal_pilot_observation"));

    public static AdmissionKernelDecision BlockProductionOnly(
        WorkItemDefinitionResolution definition,
        string mode,
        string reason,
        IReadOnlyList<string> blockingSources,
        IReadOnlyList<string> noGoItems,
        string businessLineState,
        string surfaceState) =>
        new(
            true,
            true,
            true,
            false,
            mode,
            reason,
            blockingSources,
            Array.Empty<string>(),
            Array.Empty<string>(),
            businessLineState,
            "BUSINESS_PRODUCTION_BLOCKED",
            surfaceState,
            noGoItems,
            RefFor(definition, mode));

    public static AdmissionKernelDecision Blocked(
        WorkItemDefinitionResolution definition,
        string mode,
        string reason,
        IReadOnlyList<string> blockingSources,
        IReadOnlyList<string> requiredCapabilities,
        IReadOnlyList<string> requiredDeviceTrust,
        string businessLineState,
        string surfaceState,
        IReadOnlyList<string> noGoItems) =>
        new(
            true,
            true,
            false,
            false,
            mode,
            reason,
            blockingSources,
            requiredCapabilities,
            requiredDeviceTrust,
            businessLineState,
            "BUSINESS_PRODUCTION_BLOCKED",
            surfaceState,
            noGoItems,
            RefFor(definition, mode));

    public static AdmissionKernelDecision SearchVisible(
        WorkItemDefinitionResolution definition,
        string mode,
        string reason,
        IReadOnlyList<string> requiredCapabilities,
        IReadOnlyList<string> requiredDeviceTrust,
        string businessLineState,
        string surfaceState,
        IReadOnlyList<string> noGoItems) =>
        new(
            true,
            true,
            false,
            false,
            mode,
            reason,
            noGoItems.Count == 0 ? Array.Empty<string>() : new[] { "docs/contracts/admission/admission-matrix.json" },
            requiredCapabilities,
            requiredDeviceTrust,
            businessLineState,
            "BUSINESS_PRODUCTION_BLOCKED",
            surfaceState,
            noGoItems,
            RefFor(definition, $"search:{mode}"));

    public IReadOnlyDictionary<string, object> ToContract() =>
        new Dictionary<string, object>
        {
            ["visibleAllowed"] = VisibleAllowed,
            ["prepareAllowed"] = PrepareAllowed,
            ["confirmAllowed"] = ConfirmAllowed,
            ["productionAllowed"] = ProductionAllowed,
            ["mode"] = Mode,
            ["reason"] = Reason,
            ["blockingSources"] = BlockingSources,
            ["requiredCapabilities"] = RequiredCapabilities,
            ["requiredDeviceTrust"] = RequiredDeviceTrust,
            ["businessLineState"] = BusinessLineState,
            ["releaseState"] = ReleaseState,
            ["surfaceState"] = SurfaceState,
            ["noGoItems"] = NoGoItems,
            ["admissionDecisionRef"] = AdmissionDecisionRef
        };

    private static string RefFor(WorkItemDefinitionResolution definition, string mode) =>
        $"admission:{definition.RetiredCardId}:{mode}:{OperationsHash.Short(definition.DefinitionId, definition.RetiredCardId, mode)[..12]}";
}
