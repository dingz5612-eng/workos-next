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

public sealed record ReleaseAdmissionStatus(
    bool CanActivate,
    bool CanLock,
    IReadOnlyList<string> ActiveBlockers,
    IReadOnlyList<string> LockedBlockers);
