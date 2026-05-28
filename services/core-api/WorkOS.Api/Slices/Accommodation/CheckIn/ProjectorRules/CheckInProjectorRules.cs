namespace WorkOS.Api.Slices.Accommodation.CheckIn.ProjectorRules;

public static class CheckInProjectorRules
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
