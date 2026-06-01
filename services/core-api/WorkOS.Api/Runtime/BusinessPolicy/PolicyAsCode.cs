using System.Text.Json;

namespace WorkOS.Api.Runtime;

internal static class PolicyLoader
{
    public static BusinessPolicyDocument LoadPolicy(string policyFileName)
    {
        var path = LocateRepoFile("docs", "business", "policies", policyFileName);
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var root = document.RootElement;
        return new BusinessPolicyDocument(
            RequiredString(root, "policyId"),
            RequiredString(root, "policyType"),
            RequiredString(root, "version"),
            RequiredString(root, "owner"),
            ReadStringMap(root.GetProperty("runtimeBinding")),
            ReadStringMap(root.GetProperty("gateBinding")));
    }

    internal static string LocateRepoFile(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(new[] { current.FullName }.Concat(segments).ToArray());
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate repository file: {string.Join("/", segments)}");
    }

    internal static bool OptionalBool(JsonElement item, string propertyName) =>
        item.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.True;

    internal static string OptionalString(JsonElement item, string propertyName) =>
        item.TryGetProperty(propertyName, out var property) ? property.GetString() ?? string.Empty : string.Empty;

    internal static string RequiredString(JsonElement item, string propertyName) =>
        item.GetProperty(propertyName).GetString() ?? string.Empty;

    internal static IReadOnlyList<string> ReadStringArray(JsonElement item) =>
        item.ValueKind == JsonValueKind.Array
            ? item.EnumerateArray().Select(value => value.GetString() ?? string.Empty).Where(value => value.Length > 0).ToArray()
            : Array.Empty<string>();

    private static IReadOnlyDictionary<string, string> ReadStringMap(JsonElement item)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var property in item.EnumerateObject())
        {
            result[property.Name] = property.Value.ValueKind switch
            {
                JsonValueKind.String => property.Value.GetString() ?? string.Empty,
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                _ => property.Value.GetRawText()
            };
        }

        return result;
    }
}

internal static class PolicyEvaluator
{
    public static PolicyDecision Block(string code, params string[] reasons) =>
        new(false, code, reasons);

    public static PolicyDecision Allow(string code) =>
        new(true, code, Array.Empty<string>());
}

internal static class DormitoryEvidencePolicyLoader
{
    public static EvidencePolicyDocument LoadDefault() =>
        LoadFromFile(PolicyLoader.LocateRepoFile("docs", "business", "dormitory", "evidence-policy.yml"));

    public static EvidencePolicyDocument LoadFromFile(string path)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var root = document.RootElement;
        var requirements = root.GetProperty("requirements")
            .EnumerateArray()
            .Select(item => new EvidenceRequirementPolicy(
                PolicyLoader.RequiredString(item, "requirementId"),
                PolicyLoader.ReadStringArray(item.GetProperty("workItemTypes")),
                PolicyLoader.OptionalString(item, "trustLevel")))
            .ToArray();

        return new EvidencePolicyDocument(
            PolicyLoader.RequiredString(root, "domainId"),
            PolicyLoader.OptionalBool(root, "missingEvidenceBlocksConfirm"),
            PolicyLoader.OptionalBool(root, "rejectedEvidenceBlocksConfirm"),
            PolicyLoader.OptionalBool(root, "wrongScopeEvidenceBlocksConfirm"),
            PolicyLoader.ReadStringArray(root.GetProperty("bindingRules")),
            requirements);
    }
}

internal static class EvidencePolicyEvaluator
{
    public static PolicyDecision Evaluate(EvidencePolicyDocument policy, EvidencePolicyRequest request)
    {
        var required = policy.Requirements
            .Where(item => item.WorkItemTypes.Contains(request.WorkItemType, StringComparer.OrdinalIgnoreCase))
            .Select(item => item.RequirementId)
            .ToArray();
        var missing = required
            .Where(id => !request.EvidenceRefs.Any(refItem => refItem.RequirementId.Equals(id, StringComparison.OrdinalIgnoreCase)))
            .ToArray();
        if (missing.Length > 0 && policy.MissingEvidenceBlocksConfirm)
        {
            return PolicyEvaluator.Block("missing_required_evidence", missing);
        }

        var rejected = request.EvidenceRefs
            .Where(refItem => required.Contains(refItem.RequirementId, StringComparer.OrdinalIgnoreCase) &&
                refItem.Status.Equals("rejected", StringComparison.OrdinalIgnoreCase))
            .Select(refItem => refItem.RequirementId)
            .ToArray();
        if (rejected.Length > 0 && policy.RejectedEvidenceBlocksConfirm)
        {
            return PolicyEvaluator.Block("rejected_evidence_blocks_confirm", rejected);
        }

        var wrongScope = request.EvidenceRefs
            .Where(refItem => required.Contains(refItem.RequirementId, StringComparer.OrdinalIgnoreCase))
            .Where(refItem =>
                !refItem.TenantId.Equals(request.TenantId, StringComparison.OrdinalIgnoreCase) ||
                !refItem.WorkItemId.Equals(request.WorkItemId, StringComparison.OrdinalIgnoreCase) ||
                !refItem.SubmissionId.Equals(request.SubmissionId, StringComparison.OrdinalIgnoreCase))
            .Select(refItem => refItem.RequirementId)
            .ToArray();
        if (wrongScope.Length > 0 && policy.WrongScopeEvidenceBlocksConfirm)
        {
            return PolicyEvaluator.Block("wrong_scope_evidence_blocks_confirm", wrongScope);
        }

        return PolicyEvaluator.Allow("evidence_accepted");
    }
}

internal static class BusinessAdmissionPolicyLoader
{
    public static IReadOnlyList<BusinessLineAdmissionPolicy> LoadDefault()
    {
        var directory = Path.GetDirectoryName(PolicyLoader.LocateRepoFile("docs", "business", "admission", "repair-l0-admission.yml"))!;
        return Directory.GetFiles(directory, "*-l0-admission.yml")
            .Select(LoadFromFile)
            .ToArray();
    }

    public static BusinessLineAdmissionPolicy LoadFromFile(string path)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var root = document.RootElement;
        return new BusinessLineAdmissionPolicy(
            PolicyLoader.RequiredString(root, "businessLineId"),
            PolicyLoader.OptionalString(root, "displayName"),
            PolicyLoader.RequiredString(root, "level"),
            PolicyLoader.OptionalBool(root, "productionAllowed"));
    }
}

internal static class AdmissionPolicyEvaluator
{
    public static PolicyDecision EvaluateProductionConfirm(BusinessLineAdmissionPolicy policy) =>
        policy.ProductionAllowed && !policy.Level.Equals("L0 Contract Preview", StringComparison.OrdinalIgnoreCase)
            ? PolicyEvaluator.Allow("admission_allows_production_confirm")
            : PolicyEvaluator.Block("admission_blocks_production_confirm", policy.BusinessLineId, policy.Level);
}

internal static class SurfacePolicyEvaluator
{
    public static PolicyDecision EvaluateL0SurfaceAlignment(
        BusinessLineAdmissionPolicy admission,
        SurfacePolicySnapshot surface)
    {
        if (!admission.Level.Equals("L0 Contract Preview", StringComparison.OrdinalIgnoreCase))
        {
            return PolicyEvaluator.Allow("surface_policy_not_l0");
        }

        var errors = new List<string>();
        if (!surface.HomeSection.Equals("contract-preview", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("home_section_not_contract_preview");
        }

        if (!surface.WorkbenchQueueRule.Equals("prepare_only", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("workbench_not_prepare_only");
        }

        if (!surface.IntentTags.Contains("contract_preview", StringComparer.OrdinalIgnoreCase))
        {
            errors.Add("search_missing_contract_preview");
        }

        if (!surface.LearningSection.StartsWith("Contract Preview", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("learning_not_contract_preview");
        }

        return errors.Count == 0
            ? PolicyEvaluator.Allow("surface_aligned_for_l0")
            : PolicyEvaluator.Block("surface_blocks_l0_production_like_exposure", errors.ToArray());
    }
}

internal static class FinancePolicyEvaluator
{
    public static PolicyDecision Evaluate(FinancePolicyRequest request)
    {
        if (request.WriterKind.Equals("business-domain", StringComparison.OrdinalIgnoreCase) &&
            (request.FactKind.Equals("PaymentFact", StringComparison.OrdinalIgnoreCase) ||
             request.FactKind.Equals("DepositFact", StringComparison.OrdinalIgnoreCase) ||
             request.FactKind.Equals("LedgerEntry", StringComparison.OrdinalIgnoreCase)))
        {
            return PolicyEvaluator.Block("finance_policy_blocks_direct_money_fact", request.FactKind);
        }

        if (request.FactKind.Equals("DepositRevenue", StringComparison.OrdinalIgnoreCase))
        {
            return PolicyEvaluator.Block("finance_policy_blocks_deposit_as_revenue", request.FactKind);
        }

        return PolicyEvaluator.Allow("finance_policy_allows_basis_or_kernel_commit");
    }
}

internal static class TruthOwnerPolicyEvaluator
{
    private static readonly IReadOnlyDictionary<string, string> CentralOwners = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["Subject"] = "SharedGovernancePack",
        ["Vehicle"] = "SharedGovernancePack",
        ["PaymentFact"] = "FinanceTruthPack",
        ["DepositFact"] = "FinanceTruthPack",
        ["LedgerTransaction"] = "MoneyKernelPack",
        ["EvidenceObject"] = "EvidenceTrustPack"
    };

    public static PolicyDecision EvaluateOwnershipClaim(string packId, string fact)
    {
        if (CentralOwners.TryGetValue(fact, out var owner) &&
            !packId.Equals(owner, StringComparison.OrdinalIgnoreCase))
        {
            return PolicyEvaluator.Block("truth_owner_policy_blocks_central_truth_claim", $"{fact}:{owner}");
        }

        return PolicyEvaluator.Allow("truth_owner_policy_allows_claim");
    }
}

internal static class PermissionPolicyEvaluator
{
    public static PolicyDecision EvaluateHighRisk(PermissionPolicyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return PolicyEvaluator.Block("permission_policy_requires_reason", request.ActionKey);
        }

        var capabilities = new HashSet<string>(request.ActorCapabilities, StringComparer.OrdinalIgnoreCase);
        if (!capabilities.Contains(request.RequiredCapability) &&
            !capabilities.Contains("runtime.high_risk.all") &&
            !request.ActorRole.Equals("admin", StringComparison.OrdinalIgnoreCase))
        {
            return PolicyEvaluator.Block("permission_policy_requires_capability", request.RequiredCapability);
        }

        if (!request.DeviceTrustStatus.Equals("trusted", StringComparison.OrdinalIgnoreCase))
        {
            return PolicyEvaluator.Block("permission_policy_requires_trusted_device", request.ActionKey);
        }

        return PolicyEvaluator.Allow("permission_policy_allows_high_risk_action");
    }
}

internal static class CutoverPolicyEvaluator
{
    public static PolicyDecision Evaluate(CutoverPolicyRequest request)
    {
        if (request.TargetState.Equals("active_locked", StringComparison.OrdinalIgnoreCase) &&
            request.ShadowGrade.Equals("red", StringComparison.OrdinalIgnoreCase))
        {
            return PolicyEvaluator.Block("cutover_policy_blocks_red_shadow", request.ShadowReportId);
        }

        if (request.TargetState.Equals("active_locked", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(request.RollbackInstructionId))
        {
            return PolicyEvaluator.Block("cutover_policy_blocks_missing_rollback", request.TargetState);
        }

        if (request.EvidenceMode.Equals("skeleton", StringComparison.OrdinalIgnoreCase) ||
            request.EvidenceMode.Equals("not_run", StringComparison.OrdinalIgnoreCase))
        {
            return PolicyEvaluator.Block("cutover_policy_blocks_non_real_evidence", request.EvidenceMode);
        }

        return PolicyEvaluator.Allow("cutover_policy_allows_transition");
    }
}

internal sealed record BusinessPolicyDocument(
    string PolicyId,
    string PolicyType,
    string Version,
    string Owner,
    IReadOnlyDictionary<string, string> RuntimeBinding,
    IReadOnlyDictionary<string, string> GateBinding);

internal sealed record PolicyDecision(bool Allowed, string Code, IReadOnlyList<string> Reasons)
{
    public int StatusCode => Allowed ? 200 : 422;
}

internal sealed record EvidencePolicyDocument(
    string DomainId,
    bool MissingEvidenceBlocksConfirm,
    bool RejectedEvidenceBlocksConfirm,
    bool WrongScopeEvidenceBlocksConfirm,
    IReadOnlyList<string> BindingRules,
    IReadOnlyList<EvidenceRequirementPolicy> Requirements);

internal sealed record EvidenceRequirementPolicy(
    string RequirementId,
    IReadOnlyList<string> WorkItemTypes,
    string TrustLevel);

internal sealed record EvidencePolicyRequest(
    string WorkItemType,
    string TenantId,
    string WorkItemId,
    string SubmissionId,
    IReadOnlyList<EvidencePolicyRef> EvidenceRefs);

internal sealed record EvidencePolicyRef(
    string RequirementId,
    string TenantId,
    string WorkItemId,
    string SubmissionId,
    string Status);

internal sealed record BusinessLineAdmissionPolicy(
    string BusinessLineId,
    string DisplayName,
    string Level,
    bool ProductionAllowed);

internal sealed record SurfacePolicySnapshot(
    string SliceId,
    string HomeSection,
    string WorkbenchQueueRule,
    IReadOnlyList<string> IntentTags,
    string LearningSection);

internal sealed record FinancePolicyRequest(string WriterKind, string FactKind);

internal sealed record PermissionPolicyRequest(
    string ActionKey,
    string ActorRole,
    IReadOnlyList<string> ActorCapabilities,
    string RequiredCapability,
    string DeviceTrustStatus,
    string Reason);

internal sealed record CutoverPolicyRequest(
    string TargetState,
    string ShadowGrade,
    string ShadowReportId,
    string? RollbackInstructionId,
    string EvidenceMode);
