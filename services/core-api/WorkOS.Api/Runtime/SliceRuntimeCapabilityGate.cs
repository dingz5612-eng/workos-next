using System.Text.Json;

namespace WorkOS.Api.Runtime;

public sealed class SliceRuntimeCapabilityGate
{
    private readonly IReadOnlyDictionary<string, SliceRuntimeCapability> capabilitiesByWorkspaceId;

    private SliceRuntimeCapabilityGate(IReadOnlyDictionary<string, SliceRuntimeCapability> capabilitiesByWorkspaceId)
    {
        this.capabilitiesByWorkspaceId = capabilitiesByWorkspaceId;
    }

    public static SliceRuntimeCapabilityGate LoadDefault() =>
        new(LoadCapabilities(FindManifestPath()));

    public SliceRuntimeCapability CapabilityFor(string workspaceId) =>
        capabilitiesByWorkspaceId.TryGetValue(workspaceId, out var capability)
            ? capability
            : new SliceRuntimeCapability("unknown", workspaceId, "runtime-skeleton");

    public ConfirmResult? ForbidConfirmIfContractOnly(string workspaceId)
    {
        var capability = CapabilityFor(workspaceId);
        return capability.Status.Equals("contract-only", StringComparison.OrdinalIgnoreCase)
            ? new ConfirmResult(ConfirmStatus.Forbidden, $"slice_runtime_forbidden:{capability.SliceId}:contract-only", null)
            : null;
    }

    private static IReadOnlyDictionary<string, SliceRuntimeCapability> LoadCapabilities(string? manifestPath)
    {
        if (manifestPath is null)
        {
            return new Dictionary<string, SliceRuntimeCapability>();
        }

        using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
        return manifest.RootElement
            .GetProperty("slices")
            .EnumerateArray()
            .Select(slice => new SliceRuntimeCapability(
                slice.GetProperty("id").GetString() ?? "unknown",
                slice.GetProperty("workspaceId").GetString() ?? "unknown",
                slice.GetProperty("status").GetString() ?? "contract-only"))
            .ToDictionary(item => item.WorkspaceId, StringComparer.OrdinalIgnoreCase);
    }

    private static string? FindManifestPath()
    {
        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "docs", "contracts", "slice-manifest.json");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        return null;
    }
}

public sealed record SliceRuntimeCapability(
    string SliceId,
    string WorkspaceId,
    string Status);
