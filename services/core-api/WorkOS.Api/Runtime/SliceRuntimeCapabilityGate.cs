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
            : DynamicTemplateCapability(workspaceId) is { } dynamicCapability
                ? dynamicCapability
            : new SliceRuntimeCapability("unknown", workspaceId, "unregistered");

    private SliceRuntimeCapability? DynamicTemplateCapability(string workspaceId)
    {
        foreach (var template in capabilitiesByWorkspaceId.Values)
        {
            if (workspaceId.StartsWith($"{template.WorkspaceId}-", StringComparison.OrdinalIgnoreCase))
            {
                return template with { WorkspaceId = workspaceId };
            }
        }

        return null;
    }

    public ConfirmResult? ForbidConfirmIfNotCurrentSlice(string workspaceId)
    {
        var capability = CapabilityFor(workspaceId);
        return IsConfirmAllowed(capability)
            ? null
            : new ConfirmResult(ConfirmStatus.Forbidden, $"slice_runtime_forbidden:{capability.SliceId}:{capability.Status}", null);
    }

    private static bool IsConfirmAllowed(SliceRuntimeCapability capability) =>
        capability.Status.Equals("production-slice", StringComparison.OrdinalIgnoreCase) ||
        (capability.SliceId.Equals(AcceptedCapabilityRuntimeProjection.CapabilityId, StringComparison.OrdinalIgnoreCase) &&
            capability.Status.Equals("runtime-test-admitted", StringComparison.OrdinalIgnoreCase)) ||
        (capability.SliceId.Equals(DormitoryScenario2RuntimeProjection.SliceId, StringComparison.OrdinalIgnoreCase) &&
            capability.Status.Equals("runtime-test-admitted", StringComparison.OrdinalIgnoreCase));

    private static IReadOnlyDictionary<string, SliceRuntimeCapability> LoadCapabilities(string? manifestPath)
    {
        if (manifestPath is null)
        {
            return new Dictionary<string, SliceRuntimeCapability>();
        }

        using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
        var sliceCapabilities = manifest.RootElement
            .GetProperty("slices")
            .EnumerateArray()
            .Select(slice => new SliceRuntimeCapability(
                slice.GetProperty("id").GetString() ?? "unknown",
                slice.GetProperty("workspaceId").GetString() ?? "unknown",
                slice.GetProperty("status").GetString() ?? "unregistered"))
            .ToList();
        sliceCapabilities.Add(AcceptedCapabilityRuntimeProjection.RuntimeCapability());
        sliceCapabilities.Add(DormitoryScenario2RuntimeProjection.RuntimeCapability());
        return sliceCapabilities
            .GroupBy(item => item.WorkspaceId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
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
