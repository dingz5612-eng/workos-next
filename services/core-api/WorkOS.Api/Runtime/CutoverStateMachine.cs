namespace WorkOS.Api.Runtime;

public static class CutoverStateMachine
{
    public static readonly string[] States =
    [
        "off",
        "shadow",
        "dual_compare",
        "adapter_primary",
        "operations_primary",
        "legacy_readonly",
        "locked",
        "rollback"
    ];

    public static CutoverTransitionDecision EvaluateTransition(CutoverTransitionRequest request)
    {
        if (!States.Contains(request.FromState, StringComparer.Ordinal) ||
            !States.Contains(request.ToState, StringComparer.Ordinal))
        {
            return Block(request, "unknown_cutover_state");
        }

        if (request.RedShadow)
        {
            return request.ToState == "rollback"
                ? Allow(request, "red_shadow_routes_to_rollback")
                : Hold(request, "red_shadow_requires_hold_or_rollback");
        }

        if (request.ToState == "rollback")
        {
            return Allow(request, "operator_requested_rollback");
        }

        return (request.FromState, request.ToState) switch
        {
            ("off", "shadow") when request.SchemaPass && request.ContractPass =>
                Allow(request, "schema_and_contract_pass"),
            ("off", "shadow") =>
                Block(request, "shadow_requires_schema_and_contract_pass"),

            ("shadow", "dual_compare") when request.CertificationPass =>
                Allow(request, "certification_pass"),
            ("shadow", "dual_compare") =>
                Block(request, "dual_compare_requires_certification_pass"),

            ("dual_compare", "adapter_primary") when request.SemanticShadowGreen =>
                Allow(request, "semantic_shadow_green"),
            ("dual_compare", "adapter_primary") =>
                Block(request, "adapter_primary_requires_semantic_shadow_green"),

            ("adapter_primary", "operations_primary") when request.BusinessSignoffPresent && request.RollbackInstructionPresent =>
                Allow(request, "business_signoff_and_rollback_present"),
            ("adapter_primary", "operations_primary") =>
                Block(request, "operations_primary_requires_signoff_and_rollback"),

            ("operations_primary", "legacy_readonly") when request.ObservationWindowComplete && !request.HasP0InvariantFailure =>
                Allow(request, "observation_window_green"),
            ("operations_primary", "locked") when request.ObservationWindowComplete && !request.HasP0InvariantFailure && request.BusinessSignoffPresent =>
                Allow(request, "observation_window_green_and_signoff_present"),
            ("operations_primary", "legacy_readonly") or ("operations_primary", "locked") =>
                Block(request, "locked_or_legacy_readonly_requires_observation_window_and_no_p0"),

            ("legacy_readonly", "locked") when request.ObservationWindowComplete && !request.HasP0InvariantFailure && request.BusinessSignoffPresent =>
                Allow(request, "legacy_readonly_lock_ready"),
            ("legacy_readonly", "locked") =>
                Block(request, "locked_requires_business_signoff_observation_and_no_p0"),

            var same when same.FromState == same.ToState =>
                Allow(request, "no_state_change"),

            _ => Block(request, "illegal_cutover_transition")
        };
    }

    public static string WritePathFor(string state) =>
        state switch
        {
            "off" => "legacy_workspace_card",
            "shadow" => "legacy_workspace_card_with_shadow_capture",
            "dual_compare" => "legacy_workspace_card_with_semantic_compare",
            "adapter_primary" => "legacy_adapter_to_operations_uow",
            "operations_primary" => "operations_runtime",
            "legacy_readonly" => "operations_runtime_with_legacy_readonly",
            "locked" => "operations_runtime_locked",
            "rollback" => "rollback_to_legacy_or_hold",
            _ => "unknown"
        };

    public static bool IsTargeted(CutoverFeatureFlagTarget target, CutoverFeatureFlagContext context)
    {
        if (!Matches(target.TenantIds, context.TenantId) ||
            !Matches(target.SliceIds, context.SliceId) ||
            !Matches(target.RoleIds, context.RoleId) ||
            !Matches(target.ActorIds, context.ActorId) ||
            !Matches(target.DeviceIds, context.DeviceId))
        {
            return false;
        }

        if (target.MinAmount is not null && context.Amount < target.MinAmount.Value)
        {
            return false;
        }

        if (target.MaxAmount is not null && context.Amount > target.MaxAmount.Value)
        {
            return false;
        }

        return true;
    }

    public static CutoverRuntimeDecision DecideRuntimePath(
        string state,
        CutoverFeatureFlagTarget target,
        CutoverFeatureFlagContext context)
    {
        var targeted = IsTargeted(target, context);
        if (!targeted)
        {
            return new CutoverRuntimeDecision(state, false, "legacy_workspace_card", "feature_flag_not_targeted");
        }

        var writePath = WritePathFor(state);
        return new CutoverRuntimeDecision(state, true, writePath, "slice_cutover_state_applied");
    }

    private static bool Matches(IReadOnlyList<string> allowed, string value) =>
        allowed.Count == 0 || allowed.Contains(value, StringComparer.OrdinalIgnoreCase) || allowed.Contains("*", StringComparer.Ordinal);

    private static CutoverTransitionDecision Allow(CutoverTransitionRequest request, string reason) =>
        new(request.FromState, request.ToState, true, false, false, reason, WritePathFor(request.ToState), []);

    private static CutoverTransitionDecision Hold(CutoverTransitionRequest request, string reason) =>
        new(request.FromState, request.ToState, false, true, true, reason, WritePathFor(request.FromState), [reason]);

    private static CutoverTransitionDecision Block(CutoverTransitionRequest request, string reason) =>
        new(request.FromState, request.ToState, false, false, false, reason, WritePathFor(request.FromState), [reason]);
}

public sealed record CutoverTransitionRequest(
    string FromState,
    string ToState,
    bool SchemaPass = false,
    bool ContractPass = false,
    bool CertificationPass = false,
    bool SemanticShadowGreen = false,
    bool BusinessSignoffPresent = false,
    bool RollbackInstructionPresent = false,
    bool ObservationWindowComplete = false,
    bool HasP0InvariantFailure = false,
    bool RedShadow = false);

public sealed record CutoverTransitionDecision(
    string FromState,
    string ToState,
    bool Allowed,
    bool Hold,
    bool RollbackRecommended,
    string Reason,
    string WritePath,
    IReadOnlyList<string> Blockers);

public sealed record CutoverFeatureFlagTarget(
    IReadOnlyList<string> TenantIds,
    IReadOnlyList<string> SliceIds,
    IReadOnlyList<string> RoleIds,
    IReadOnlyList<string> ActorIds,
    IReadOnlyList<string> DeviceIds,
    decimal? MinAmount,
    decimal? MaxAmount);

public sealed record CutoverFeatureFlagContext(
    string TenantId,
    string SliceId,
    string RoleId,
    string ActorId,
    string DeviceId,
    decimal Amount);

public sealed record CutoverRuntimeDecision(
    string State,
    bool Targeted,
    string WritePath,
    string Reason);
