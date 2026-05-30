namespace WorkOS.Api.Runtime;

public sealed partial class ProjectionRuntime
{
    public EvidenceObject CreateEvidenceDraft(EvidenceDraftRequest request, string actorId)
    {
        lock (gate) return store.CreateEvidenceDraft(request, actorId);
    }

    public EvidenceObject AttachEvidence(string evidenceId, EvidenceAttachmentRequest request, string actorId)
    {
        lock (gate) return store.AttachEvidence(evidenceId, request, actorId);
    }

    public EvidenceSignedUrlResponse CreateEvidenceSignedUrl(string evidenceId, EvidenceSignedUrlRequest request)
    {
        lock (gate) return store.CreateEvidenceSignedUrl(evidenceId, request);
    }

    public EvidenceObject VerifyEvidence(string evidenceId, EvidenceDecisionRequest request)
    {
        lock (gate) return store.VerifyEvidence(evidenceId, request);
    }

    public EvidenceObject RejectEvidence(string evidenceId, EvidenceDecisionRequest request)
    {
        lock (gate) return store.RejectEvidence(evidenceId, request);
    }

    public IReadOnlyList<EvidenceObject> GetEvidenceObjects(string? evidenceId = null) =>
        store.GetEvidenceObjects(evidenceId);
}
