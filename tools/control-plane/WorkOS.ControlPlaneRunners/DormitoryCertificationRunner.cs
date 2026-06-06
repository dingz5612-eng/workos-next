namespace WorkOS.ControlPlaneRunners;

public static class DormitoryCertificationRunner
{
    public static Task<RuntimeCertificationEvidence> Run(RunnerOptions options)
    {
        var args = new List<string>
        {
            $"--releaseId={options.Get("releaseId", "oam.current-dormitory-golden-pilot")}",
            $"--tenantId={options.Get("tenantId", "dormitory-pilot-tenant")}",
            $"--sliceId={options.Get("sliceId", "dormitory")}",
            $"--scenarios={options.Get("scenarios", Path.Combine("docs", "oam", "dormitory-certification-scenarios.json"))}",
            $"--out={options.Get("out", Path.Combine(".tmp", "oam", "dormitory-certification-report.json"))}",
            $"--invariantOut={options.Get("invariantOut", Path.Combine(".tmp", "oam", "dormitory-certification-invariants.json"))}",
            $"--shadowOut={options.Get("shadowOut", Path.Combine(".tmp", "oam", "dormitory-certification-shadow.json"))}",
            $"--sourceMode={options.Get("sourceMode", "real")}"
        };

        if (options.Get("ciRunId") is { } ciRunId)
        {
            args.Add($"--ciRunId={ciRunId}");
        }

        return RuntimeCertificationRunner.Run(RunnerOptions.Parse(args));
    }
}
