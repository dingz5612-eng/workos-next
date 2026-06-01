import { apiBaseUrl } from "./apiClient.js";
import { runtimeApiPaths } from "./generated/runtimeApiPaths.js";

export async function fetchReleaseControlCenter() {
  const releasesResponse = await fetch(`${apiBaseUrl()}${runtimeApiPaths.controlPlaneReleases}`, { signal: AbortSignal.timeout(2400) });
  if (!releasesResponse.ok) throw new Error("release_control_failed");
  const releases = await releasesResponse.json();
  const firstReleaseId = releases?.[0]?.releaseId;
  if (!firstReleaseId) return { releases: releases || [], selectedRelease: null };

  const detailResponse = await fetch(`${apiBaseUrl()}${runtimeApiPaths.controlPlaneRelease(firstReleaseId)}`, { signal: AbortSignal.timeout(2400) });
  const selectedRelease = detailResponse.ok ? await detailResponse.json() : null;
  return { releases, selectedRelease };
}

export async function fetchProductionObservability() {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.observability}`, { signal: AbortSignal.timeout(2400) });
  if (!response.ok) throw new Error("production_observability_failed");
  return response.json();
}

export async function previewBankStatementImport(body) {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.bankStatementImportPreview}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4200)
  });
  if (!response.ok) throw await apiError("bank_statement_preview_failed", response);
  return response.json();
}

export async function confirmBankStatementImport(body, actorId = "runtime") {
  return postPcOperationsConfirm(runtimeApiPaths.bankStatementImports, {
    body,
    actorId,
    operationName: "bankStatementImport.confirm",
    workItemId: "pc-bank-statement-import"
  }, "bank_statement_import_failed");
}

export async function generateReconciliationCandidates(body) {
  return postPcOperationsConfirm(runtimeApiPaths.reconciliationGenerateCandidates, {
    body,
    actorId: body.actorId || "runtime",
    operationName: "reconciliation.matchCandidates.generate",
    workItemId: "pc-reconciliation-candidates"
  }, "reconciliation_candidates_failed");
}

export async function detectReconciliationMismatches(body) {
  return postPcOperationsConfirm(runtimeApiPaths.reconciliationDetectMismatches, {
    body,
    actorId: body.actorId || "runtime",
    operationName: "reconciliation.mismatches.detect",
    workItemId: "pc-reconciliation-mismatch-detection"
  }, "reconciliation_mismatch_detection_failed");
}

export async function fetchReconciliationCandidates(tenantId, bankTransactionId = "") {
  const url = new URL(`${apiBaseUrl()}${runtimeApiPaths.reconciliationCandidates}`);
  url.searchParams.set("tenantId", tenantId);
  if (bankTransactionId) url.searchParams.set("bankTransactionId", bankTransactionId);
  const response = await fetch(url, { signal: AbortSignal.timeout(4200) });
  if (!response.ok) throw await apiError("reconciliation_candidates_load_failed", response);
  return response.json();
}

export async function acceptReconciliationCandidate(candidateId, actorId = "runtime") {
  return postPcOperationsConfirm(runtimeApiPaths.reconciliationAcceptCandidate(candidateId), {
    actorId,
    operationName: "reconciliation.matchCandidate.accept",
    workItemId: "pc-reconciliation-match"
  }, "reconciliation_accept_failed");
}

export async function rejectReconciliationCandidate(candidateId, reason = "manual_rejected", actorId = "runtime") {
  return postPcOperationsConfirm(runtimeApiPaths.reconciliationRejectCandidate(candidateId), {
    body: { reason },
    actorId,
    operationName: "reconciliation.matchCandidate.reject",
    workItemId: "pc-reconciliation-match"
  }, "reconciliation_reject_failed");
}

export async function markBankTransactionMismatch(bankTransactionId, body, actorId = "runtime") {
  return postPcOperationsConfirm(runtimeApiPaths.reconciliationMismatchTransaction(bankTransactionId), {
    body,
    actorId,
    operationName: "reconciliation.bankTransaction.mismatch",
    workItemId: "pc-reconciliation-mismatch"
  }, "reconciliation_mismatch_failed");
}

export async function ignoreBankTransaction(bankTransactionId, body, actorId = "runtime") {
  return postPcOperationsConfirm(runtimeApiPaths.reconciliationIgnoreTransaction(bankTransactionId), {
    body,
    actorId,
    operationName: "reconciliation.bankTransaction.ignore",
    workItemId: "pc-reconciliation-transaction"
  }, "reconciliation_ignore_failed");
}

export async function requestLedgerCorrection(body, actorId = "runtime") {
  return postPcOperationsConfirm(runtimeApiPaths.correctionRequests, {
    body: { ...body, requestedBy: body.requestedBy || actorId },
    actorId,
    operationName: "correction.request",
    workItemId: body.workItemId || "pc-correction-request"
  }, "ledger_correction_request_failed");
}

export async function approveLedgerCorrection(correctionRequestId, body, actorId = "runtime") {
  return postPcOperationsConfirm(runtimeApiPaths.correctionApprove(correctionRequestId), {
    body: { ...body, approverId: body.approverId || actorId },
    actorId,
    operationName: "correction.approve",
    workItemId: "pc-correction-approval"
  }, "ledger_correction_approval_failed");
}

export async function rejectLedgerCorrection(correctionRequestId, body, actorId = "runtime") {
  return postPcOperationsConfirm(runtimeApiPaths.correctionReject(correctionRequestId), {
    body: { ...body, approverId: body.approverId || actorId },
    actorId,
    operationName: "correction.reject",
    workItemId: "pc-correction-approval"
  }, "ledger_correction_rejection_failed");
}

export async function applyLedgerCorrection(correctionRequestId, body, actorId = "runtime") {
  return postPcOperationsConfirm(runtimeApiPaths.correctionApply(correctionRequestId), {
    body: { ...body, actorId: body.actorId || actorId },
    actorId,
    operationName: "correction.apply",
    workItemId: body.workItemId || "pc-correction-apply"
  }, "ledger_correction_apply_failed");
}

export async function recordGovernanceAuditEvent(auditEvent, language = "zh-CN") {
  const response = await fetch(`${apiBaseUrl()}${runtimeApiPaths.behaviorEvents}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: auditEvent.eventType,
      objectType: auditEvent.auditType || "pc_governance_audit",
      objectId: auditEvent.auditEventId,
      language,
      source: JSON.stringify({
        exportType: auditEvent.exportType,
        status: auditEvent.status,
        reason: auditEvent.reason,
        errors: auditEvent.errors || [],
        actorId: auditEvent.actorId,
        deviceId: auditEvent.deviceId,
        expiresAtUtc: auditEvent.expiresAtUtc
      })
    }),
    signal: AbortSignal.timeout(2400)
  });
  if (!response.ok) throw await apiError("pc_governance_audit_failed", response);
  return response.json();
}

export async function postPcOperationsConfirm(path, { body = null, actorId = "runtime", operationName, workItemId }, errorCode) {
  const headers = {
    "X-WorkOS-Actor-Id": actorId,
    "X-WorkOS-Operation-Confirm": "true",
    "X-WorkOS-Operation-Name": operationName,
    "X-WorkOS-Gate-Result-Ref": "machine-gate-result-required",
    "X-WorkOS-WorkItem-Id": workItemId
  };
  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers,
    body: body === null ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(6400)
  });
  if (!response.ok) throw await apiError(errorCode, response);
  return response.json();
}

function cryptoRandomRequestId() {
  return globalThis.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function apiError(code, response) {
  let details = {};
  try {
    details = await response.json();
  } catch {
    details = {};
  }
  const error = new Error(details.error || code);
  error.code = details.error || code;
  error.reason = details.reason || "";
  error.status = response.status;
  error.requestId = cryptoRandomRequestId();
  return error;
}
