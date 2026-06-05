import { isTerminalCardStatus } from "./selectors/workspaceSelectors.js";
import { admissionCopy, admissionStateFromWorkItem } from "./admissionSurface.js";

export function buildOperationActionState(workItem = {}, card = {}, runtimeResult = null, state = {}) {
  const candidateResult = runtimeResult || state.lastActionResult || null;
  const result = resultAppliesToCurrentCard(candidateResult, workItem, card) ? candidateResult : null;
  const resultStatus = result?.status || "";

  if (state.operationSubmitting || resultStatus === "submitting") return OperationActionStateVM("submitting", { disabled: true });
  if (resultStatus === "permission_blocked_403") return OperationActionStateVM("waitingPermission", { result });
  if (resultStatus === "idempotency_conflict_409") return OperationActionStateVM("submitted", { result });
  if (resultStatus === "business_blocked_422" && result?.reason === "required_field_missing") return OperationActionStateVM("missingRequiredFields", { result });
  if (resultStatus === "business_blocked_422" && isEvidenceBlocker(result)) return OperationActionStateVM("missingEvidence", { result });
  if (resultStatus === "business_blocked_422") return OperationActionStateVM("blocked", { result });
  if (resultStatus === "committed_projection_pending") return OperationActionStateVM("projectionPending", { result });
  if (resultStatus === "committed_projection_failed" || resultStatus === "network_unknown") return OperationActionStateVM("failed", { result });
  if (resultStatus === "committed_projected") return OperationActionStateVM("submitted", { result });
  if (isTerminalCardStatus(card.status)) return OperationActionStateVM("done", { disabled: true });
  if (card.status === "notStarted") return OperationActionStateVM("notStarted", { disabled: true });
  if (card.status === "blocked" || workItem.lifecycleState === "blocked") return OperationActionStateVM("blocked");
  const admission = admissionStateFromWorkItem(workItem, state);
  if (!admission.confirmAllowed) return OperationActionStateVM("confirmDenied", { admission });
  if (!admission.productionAllowed) return OperationActionStateVM("readyObservation", { admission });
  return OperationActionStateVM("ready", { admission });
}

function isEvidenceBlocker(result = {}) {
  return /evidence|proof|credential|attachment|material|证据|材料/i.test(String(result.reason || result.code || result.message || ""));
}

function resultAppliesToCurrentCard(result, workItem = {}, card = {}) {
  if (!result) return false;
  if (result.cardId && card?.id && result.cardId !== card.id) return false;
  const currentWorkspaceId = workItem.workspaceId || workItem.workspace?.id || "";
  if (result.workspaceId && currentWorkspaceId && result.workspaceId !== currentWorkspaceId) return false;
  return true;
}

export function OperationActionStateVM(status, extra = {}) {
  return {
    status,
    disabled: Boolean(extra.disabled),
    result: extra.result || null,
    admission: extra.admission || null,
    admissionCopy: extra.admission ? admissionCopy(extra.admission, extra.ctx || {}, "operations") : null,
    primaryAction: PrimaryActionVM(status, extra),
    submissionResult: SubmissionResultVM(extra.result),
    projectionStatus: ProjectionStatusVM(extra.result)
  };
}

export function PrimaryActionVM(status, extra = {}) {
  const table = {
    ready: { labelKey: "primarySubmit", disabled: false },
    readyObservation: { labelKey: "primarySubmitObservation", disabled: false, reasonKey: "operations.admission.internalPilotObservation" },
    confirmDenied: { labelKey: "primaryViewBlocker", disabled: false, reasonKey: "operations.admission.confirmDenied" },
    blocked: { labelKey: "primaryViewBlocker", disabled: false },
    missingRequiredFields: { labelKey: "primaryCompleteRequiredFields", disabled: false },
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
