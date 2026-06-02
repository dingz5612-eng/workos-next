import { loadDraft } from "./operationDrafts.js";

export function buildOperationActionState(workItem = {}, card = {}, runtimeResult = null, state = {}) {
  const workspaceId = workItem.workspaceId || workItem.workspace?.id || state.selectedWorkspace || "";
  const cardId = card.id || workItem.cardId || state.selectedCardId || "";
  const draft = workspaceId && cardId ? loadDraft(workspaceId, cardId) : { evidenceDrafts: [] };
  const requiredEvidenceCount = (card.evidence || workItem.requiredEvidence || []).length;
  const attachedEvidenceCount = (draft.evidenceDrafts || []).length;
  const result = runtimeResult || state.lastActionResult || null;
  const resultStatus = result?.status || "";

  if (state.operationSubmitting || resultStatus === "submitting") return OperationActionStateVM("submitting", { disabled: true });
  if (resultStatus === "permission_blocked_403") return OperationActionStateVM("waitingPermission", { result });
  if (resultStatus === "idempotency_conflict_409") return OperationActionStateVM("submitted", { result });
  if (resultStatus === "business_blocked_422") return OperationActionStateVM("missingEvidence", { result });
  if (resultStatus === "committed_projection_pending") return OperationActionStateVM("projectionPending", { result });
  if (resultStatus === "committed_projection_failed" || resultStatus === "network_unknown") return OperationActionStateVM("failed", { result });
  if (resultStatus === "committed_projected") return OperationActionStateVM("submitted", { result });
  if (card.status === "done") return OperationActionStateVM("done", { disabled: true });
  if (card.status === "notStarted") return OperationActionStateVM("notStarted", { disabled: true });
  if (card.status === "blocked" || workItem.lifecycleState === "blocked") return OperationActionStateVM("blocked");
  if (requiredEvidenceCount > attachedEvidenceCount) return OperationActionStateVM("missingEvidence");
  return OperationActionStateVM("ready");
}

export function OperationActionStateVM(status, extra = {}) {
  return {
    status,
    disabled: Boolean(extra.disabled),
    result: extra.result || null,
    primaryAction: PrimaryActionVM(status, extra),
    submissionResult: SubmissionResultVM(extra.result),
    projectionStatus: ProjectionStatusVM(extra.result)
  };
}

export function PrimaryActionVM(status, extra = {}) {
  const table = {
    ready: { labelKey: "primarySubmit", disabled: false },
    blocked: { labelKey: "primaryViewBlocker", disabled: false },
    missingEvidence: { labelKey: "primaryCompleteEvidence", disabled: false },
    waitingPermission: { labelKey: "primaryViewPermission", disabled: false },
    notStarted: { labelKey: "primaryPreviousRequired", disabled: true, reasonKey: "notReadyCardHelp" },
    submitting: { labelKey: "primarySubmitting", disabled: true },
    submitted: { labelKey: "primaryViewTrace", disabled: false },
    projectionPending: { labelKey: "primaryRefreshStatus", disabled: false },
    done: { labelKey: "primaryDone", disabled: true, reasonKey: "completedCardHelp" },
    failed: { labelKey: "primaryViewFailure", disabled: false }
  };
  return { status, ...(table[status] || table.ready), disabled: Boolean(extra.disabled || table[status]?.disabled) };
}

export function SubmissionResultVM(result = null) {
  if (!result) return { status: "notSubmitted", messageKey: "notSubmitted" };
  const status = result.status || "notSubmitted";
  const messageByStatus = {
    submitting: "primarySubmitting",
    committed_projected: "submitDone",
    committed_projection_pending: "submitProjectionPending",
    committed_projection_failed: "submitProjectionFailed",
    permission_blocked_403: "confirmForbidden",
    idempotency_conflict_409: "confirmDuplicate",
    business_blocked_422: "confirmBusinessBlocked",
    network_unknown: "submitFailed"
  };
  return { status, messageKey: messageByStatus[status] || "notSubmitted" };
}

export function ProjectionStatusVM(result = null) {
  if (!result) return { status: "not_started", labelKey: "notSubmitted" };
  if (result.status === "committed_projection_pending") return { status: "pending", labelKey: "projectionPending" };
  if (result.status === "committed_projected") return { status: "projected", labelKey: "committed_projected" };
  if (result.status === "committed_projection_failed") return { status: "failed", labelKey: "failedSync" };
  return { status: result.status, labelKey: result.status };
}
