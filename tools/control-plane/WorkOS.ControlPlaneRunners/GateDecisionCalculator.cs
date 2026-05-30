namespace WorkOS.ControlPlaneRunners;

public static class GateDecisionCalculator
{
    public static GateDecision Calculate(GateDecisionInput input)
    {
        var noGo = new List<string>();
        var go = new List<string>();
        var severity = "P2";
        var status = "passed";

        foreach (var invariant in input.InvariantChecks)
        {
            var failed = invariant.Status.Equals("failed", StringComparison.OrdinalIgnoreCase);
            var warning = invariant.Status.Equals("warning", StringComparison.OrdinalIgnoreCase);
            if (failed && invariant.Mode == "blocking" && invariant.Severity == "P0")
            {
                noGo.Add($"P0 blocking invariant failed: {invariant.InvariantKey}");
                severity = "P0";
                status = "blocked";
            }
            else if (failed && invariant.Severity == "P1" && !input.WaiverRefs.Contains(invariant.InvariantCheckId))
            {
                noGo.Add($"P1 invariant failed without waiver: {invariant.InvariantKey}");
                if (status != "blocked")
                {
                    severity = "P1";
                    status = "failed";
                }
            }
            else if (warning && invariant.Severity == "P2" && status == "passed")
            {
                noGo.Add($"P2 observing invariant warning: {invariant.InvariantKey}");
                status = "warning";
            }
            else if (invariant.Status.Equals("passed", StringComparison.OrdinalIgnoreCase))
            {
                go.Add($"Invariant passed: {invariant.InvariantKey}");
            }
        }

        foreach (var report in input.ShadowCompareReports)
        {
            if (report.Grade == "red")
            {
                noGo.Add($"Red shadow compare report: {report.ShadowCompareReportId}");
                severity = "P0";
                status = "blocked";
            }
            else if (report.Grade == "yellow" && status == "passed")
            {
                noGo.Add($"Yellow shadow compare report: {report.ShadowCompareReportId}");
                status = "warning";
            }
            else if (report.Grade == "green")
            {
                go.Add($"Shadow compare green: {report.ShadowCompareReportId}");
            }
        }

        if ((status == "passed" || status == "warning") && input.RequireBusinessSignoff && input.BusinessSignoffRefs.Count == 0)
        {
            status = "not_run";
            noGo.Add("Business signoff refs are missing.");
        }

        if (status == "passed" && go.Count == 0)
        {
            go.Add("All automated control plane inputs passed.");
        }

        var result = new GateDecision(status, severity, noGo, go);
        return result;
    }
}

public sealed record GateDecisionInput(
    IReadOnlyList<InvariantCheckEvidence> InvariantChecks,
    IReadOnlyList<ShadowCompareEvidence> ShadowCompareReports,
    IReadOnlyList<string> BusinessSignoffRefs,
    IReadOnlySet<string> WaiverRefs,
    bool RequireBusinessSignoff);

public sealed record GateDecision(
    string Status,
    string Severity,
    IReadOnlyList<string> NoGoItems,
    IReadOnlyList<string> GoItems);
