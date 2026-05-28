namespace WorkOS.Api.Slices.Accommodation.ResourceSetup.ProjectorRules;

public static class ResourceSetupProjectorRules
{
    public static readonly IReadOnlyList<string> ProjectionTargets = new[]
    {
        "IntentWorkspaceProjection",
        "WorkspaceCardProjection",
        "WorkQueueProjection",
        "SearchProjection",
        "ScenarioCoachProjection",
        "AiContextProjection",
        "AuditEvidenceProjection"
    };
}
