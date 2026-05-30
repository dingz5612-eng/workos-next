namespace WorkOS.Api.Runtime;

public sealed partial class PostgresProjectionStore
{
    public EvidenceObject CreateEvidenceDraft(EvidenceDraftRequest request, string actorId) =>
        evidenceObjects.CreateDraft(request, actorId);

    public EvidenceObject AttachEvidence(string evidenceId, EvidenceAttachmentRequest request, string actorId) =>
        evidenceObjects.Attach(evidenceId, request, actorId);

    public EvidenceObject VerifyEvidence(string evidenceId, EvidenceDecisionRequest request) =>
        evidenceObjects.Decide(evidenceId, request, "verified");

    public EvidenceObject RejectEvidence(string evidenceId, EvidenceDecisionRequest request) =>
        evidenceObjects.Decide(evidenceId, request, "rejected");

    public IReadOnlyList<EvidenceObject> GetEvidenceObjects(string? evidenceId = null) =>
        evidenceObjects.Get(evidenceId);

    public EvidenceSignedUrlResponse CreateEvidenceSignedUrl(string evidenceId, EvidenceSignedUrlRequest request) =>
        evidenceObjects.CreateSignedUrl(evidenceId, request);

    public ConfirmResult? ValidateEvidenceForConfirm(
        string workspaceId,
        string cardId,
        ConfirmCardRequest request,
        IReadOnlyList<EvidenceRequirement> requirements) =>
        evidenceObjects.ValidateForConfirm(workspaceId, cardId, request, requirements);
}
