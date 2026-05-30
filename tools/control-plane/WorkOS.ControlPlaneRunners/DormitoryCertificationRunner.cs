namespace WorkOS.ControlPlaneRunners;

public static class DormitoryCertificationRunner
{
    public static Task<RuntimeCertificationEvidence> Run(RunnerOptions options)
    {
        var args = new List<string>
        {
            $"--releaseId={options.Get("releaseId", "v5.4-dormitory-golden-pilot")}",
            $"--tenantId={options.Get("tenantId", "dormitory-pilot-tenant")}",
            $"--sliceId={options.Get("sliceId", "dormitory")}",
            $"--scenarios={options.Get("scenarios", Path.Combine("docs", "v5.4", "dormitory-certification-scenarios.json"))}",
            $"--out={options.Get("out", Path.Combine(".tmp", "v5_4", "dormitory-certification-report.json"))}",
            $"--invariantOut={options.Get("invariantOut", Path.Combine(".tmp", "v5_4", "dormitory-certification-invariants.json"))}",
            $"--shadowOut={options.Get("shadowOut", Path.Combine(".tmp", "v5_4", "dormitory-certification-shadow.json"))}",
            $"--sourceMode={options.Get("sourceMode", "real")}"
        };

        if (options.Get("ciRunId") is { } ciRunId)
        {
            args.Add($"--ciRunId={ciRunId}");
        }

        return RuntimeCertificationRunner.Run(RunnerOptions.Parse(args));
    }
}
