using System.Text.Json;

namespace WorkOS.Api.Runtime;

public static class ReleaseAdmissionPolicy
{
    public static ReleaseAdmissionStatus Evaluate(
        GateResultRead? gateResult,
        IReadOnlyList<ShadowCompareReportRead> shadowReports,
        IReadOnlyList<RuntimeInvariantCheckRead> invariantChecks,
        RollbackInstructionRead? rollbackInstruction)
    {
        var activeBlockers = new List<string>();
        var currentAdmission = CurrentAdmissionStateRead.Load();
        if (currentAdmission.BusinessProduction.Equals("BLOCKED", StringComparison.OrdinalIgnoreCase))
        {
            activeBlockers.Add("business_production_blocked_by_current_admission_state");
        }

        if (currentAdmission.DormitoryProduction.Equals("BLOCKED", StringComparison.OrdinalIgnoreCase))
        {
            activeBlockers.Add("dormitory_l2_blocked_by_current_admission_state");
        }

        if (currentAdmission.ProductionConfirmAllowed is false)
        {
            activeBlockers.Add("production_confirm_blocked_by_current_admission_state");
        }

        if (gateResult?.Status is not "passed")
        {
            activeBlockers.Add("gate_result_not_passed");
        }

        if (shadowReports.Any(report => report.Grade.Equals("red", StringComparison.OrdinalIgnoreCase)))
        {
            activeBlockers.Add("red_shadow_report");
        }

        if (invariantChecks.Any(IsBlockingP0Failure))
        {
            activeBlockers.Add("p0_blocking_invariant_failed");
        }

        if (rollbackInstruction is null)
        {
            activeBlockers.Add("rollback_instruction_missing");
        }

        var lockedBlockers = new List<string>(activeBlockers);
        if (gateResult is null || gateResult.BusinessSignoffRefs.Count == 0)
        {
            lockedBlockers.Add("business_signoff_missing");
        }

        return new ReleaseAdmissionStatus(
            activeBlockers.Count == 0,
            lockedBlockers.Count == 0,
            activeBlockers,
            lockedBlockers);
    }

    private static bool IsBlockingP0Failure(RuntimeInvariantCheckRead check) =>
        check.Mode.Equals("blocking", StringComparison.OrdinalIgnoreCase) &&
        check.Severity.Equals("P0", StringComparison.OrdinalIgnoreCase) &&
        (check.Status.Equals("failed", StringComparison.OrdinalIgnoreCase) ||
         check.Status.Equals("blocked", StringComparison.OrdinalIgnoreCase) ||
         check.ViolationCount > 0);
}

internal sealed record CurrentAdmissionStateRead(
    string BusinessProduction,
    string DormitoryProduction,
    bool ProductionConfirmAllowed)
{
    public static CurrentAdmissionStateRead Load()
    {
        var path = Locate("docs", "oam", "current-admission-state.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var root = document.RootElement;
        return new CurrentAdmissionStateRead(
            root.GetProperty("businessProduction").GetString() ?? "BLOCKED",
            root.GetProperty("dormitoryProduction").GetString() ?? "BLOCKED",
            root.TryGetProperty("productionConfirmAllowed", out var productionConfirm) &&
                productionConfirm.ValueKind is JsonValueKind.True);
    }

    private static string Locate(params string[] segments)
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

        throw new FileNotFoundException($"Could not locate {string.Join("/", segments)}.");
    }
}

public sealed record ReleaseAdmissionStatus(
    bool CanActivate,
    bool CanLock,
    IReadOnlyList<string> ActiveBlockers,
    IReadOnlyList<string> LockedBlockers);
