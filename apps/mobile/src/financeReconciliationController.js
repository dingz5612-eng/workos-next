import {
  acceptReconciliationCandidate,
  applyLedgerCorrection,
  approveLedgerCorrection,
  confirmBankStatementImport,
  detectReconciliationMismatches,
  generateReconciliationCandidates,
  ignoreBankTransaction,
  markBankTransactionMismatch,
  previewBankStatementImport,
  rejectLedgerCorrection,
  requestLedgerCorrection,
  rejectReconciliationCandidate
} from "./apiClient.js";

export async function previewBankImport(ctx) {
  const body = await requestFromForm(ctx);
  const preview = await previewBankStatementImport(body);
  ctx.state.bankStatementImport = { ...(ctx.state.bankStatementImport || {}), request: body, preview, result: null, error: "" };
  ctx.render();
}

export async function confirmBankImport(ctx) {
  const current = ctx.state.bankStatementImport?.request || await requestFromForm(ctx);
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const result = await confirmBankStatementImport(current, actorId);
  const previous = ctx.state.bankStatementImport || {};
  const importHistory = [result, ...(previous.importHistory || []).filter((item) => item.importId !== result.importId)];
  const bankTransactions = [...(result.transactions || []), ...(previous.bankTransactions || []).filter((item) => item.importId !== result.importId)];
  ctx.state.bankStatementImport = auditState({
    ...previous,
    request: current,
    result,
    importHistory,
    bankTransactions,
    error: ""
  }, "bankStatementImport.confirm", result);
  ctx.render();
}

export async function generateBankMatchCandidates(ctx) {
  const current = ctx.state.bankStatementImport?.request || await requestFromForm(ctx);
  const result = ctx.state.bankStatementImport?.result;
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const candidates = await generateReconciliationCandidates({
    tenantId: current.tenantId,
    importId: result?.importId || null,
    windowDays: Number(document.querySelector("#bankCandidateWindowDays")?.value || 3),
    actorId
  });
  ctx.state.bankStatementImport = auditState({ ...(ctx.state.bankStatementImport || {}), request: current, candidates, decision: null, error: "" }, "reconciliation.matchCandidates.generate", candidates);
  ctx.render();
}

export async function detectBankMismatches(ctx) {
  const current = ctx.state.bankStatementImport?.request || await requestFromForm(ctx);
  const result = ctx.state.bankStatementImport?.result;
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const mismatchCases = await detectReconciliationMismatches({
    tenantId: current.tenantId,
    importId: result?.importId || null,
    windowDays: Number(document.querySelector("#bankCandidateWindowDays")?.value || 3),
    confirmedPaymentThresholdDays: Number(document.querySelector("#bankPaymentThresholdDays")?.value || 3),
    refundThresholdDays: Number(document.querySelector("#bankRefundThresholdDays")?.value || 3),
    actorId
  });
  ctx.state.bankStatementImport = auditState({ ...(ctx.state.bankStatementImport || {}), request: current, mismatchCases, decision: null, error: "" }, "reconciliation.mismatches.detect", mismatchCases);
  ctx.render();
}

export async function acceptBankMatchCandidate(candidateId, ctx) {
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const decision = await acceptReconciliationCandidate(candidateId, actorId);
  await refreshCandidatesAfterDecision(ctx, decision, "reconciliation.matchCandidate.accept");
}

export async function rejectBankMatchCandidate(candidateId, ctx) {
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const decision = await rejectReconciliationCandidate(candidateId, "manual_rejected", actorId);
  await refreshCandidatesAfterDecision(ctx, decision, "reconciliation.matchCandidate.reject");
}

export async function markBankMismatch(bankTransactionId, ctx) {
  const tenantId = ctx.state.bankStatementImport?.request?.tenantId || value("#bankImportTenant", "tenant-1");
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const decision = await markBankTransactionMismatch(bankTransactionId, {
    tenantId,
    mismatchType: "manual_review",
    reason: "manual_mismatch"
  }, actorId);
  await refreshCandidatesAfterDecision(ctx, decision, "reconciliation.bankTransaction.mismatch");
}

export async function ignoreBankTx(bankTransactionId, ctx) {
  const tenantId = ctx.state.bankStatementImport?.request?.tenantId || value("#bankImportTenant", "tenant-1");
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const decision = await ignoreBankTransaction(bankTransactionId, { tenantId, reason: "manual_ignored" }, actorId);
  await refreshCandidatesAfterDecision(ctx, decision, "reconciliation.bankTransaction.ignore");
}

export async function createCorrectionRequest(ctx) {
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const body = correctionRequestFromForm(ctx, actorId);
  const result = await requestLedgerCorrection(body, actorId);
  const previous = ctx.state.bankStatementImport || {};
  const correctionRequests = [normalizeCorrectionRequest(body, result), ...(previous.correctionRequests || [])];
  ctx.state.bankStatementImport = auditState({
    ...previous,
    correctionRequests,
    selectedCorrectionRequestId: result.correctionRequestId,
    correctionRequestResult: result,
    error: ""
  }, "correction.request", result);
  ctx.render();
}

export async function approveCorrectionRequest(ctx) {
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const correctionRequestId = selectedCorrectionRequestId(ctx);
  const body = correctionApprovalFromForm(ctx, actorId);
  const result = await approveLedgerCorrection(correctionRequestId, body, actorId);
  ctx.state.bankStatementImport = updateCorrectionState(ctx, result, "approved", "correction.approve");
  ctx.render();
}

export async function rejectCorrectionRequest(ctx) {
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const correctionRequestId = selectedCorrectionRequestId(ctx);
  const body = correctionApprovalFromForm(ctx, actorId);
  const result = await rejectLedgerCorrection(correctionRequestId, { ...body, reason: body.note || "manual_rejected" }, actorId);
  ctx.state.bankStatementImport = updateCorrectionState(ctx, result, "rejected", "correction.reject");
  ctx.render();
}

export async function applyCorrectionRequest(ctx) {
  const actorId = ctx.state.currentActor?.userId || "runtime";
  const correctionRequestId = selectedCorrectionRequestId(ctx);
  const body = correctionApplyFromForm(ctx, actorId);
  const result = await applyLedgerCorrection(correctionRequestId, body, actorId);
  ctx.state.bankStatementImport = updateCorrectionState(ctx, result, "applied", "correction.apply");
  ctx.render();
}

async function refreshCandidatesAfterDecision(ctx, decision, operationName) {
  const current = ctx.state.bankStatementImport?.request || await requestFromForm(ctx);
  const candidates = await generateReconciliationCandidates({
    tenantId: current.tenantId,
    importId: ctx.state.bankStatementImport?.result?.importId || null,
    windowDays: Number(document.querySelector("#bankCandidateWindowDays")?.value || 3),
    actorId: ctx.state.currentActor?.userId || "runtime"
  });
  ctx.state.bankStatementImport = auditState({ ...(ctx.state.bankStatementImport || {}), request: current, candidates, decision, error: "" }, operationName, decision);
  ctx.render();
}

async function requestFromForm(ctx) {
  const fileText = await readSelectedFile();
  return {
    tenantId: value("#bankImportTenant", "tenant-1"),
    sourceType: value("#bankImportSourceType", "manual_csv"),
    csvContent: fileText || value("#bankCsvContent", ""),
    originalFileId: value("#bankImportEvidenceId", "") || null,
    importedBy: ctx.state.currentActor?.userId || "runtime",
    columnMapping: {
      occurredAt: value("#bankMapOccurredAt", "occurredAt"),
      amount: value("#bankMapAmount", "amount"),
      currency: value("#bankMapCurrency", "currency"),
      direction: value("#bankMapDirection", "direction"),
      externalRef: value("#bankMapExternalRef", "externalRef"),
      description: value("#bankMapDescription", "description")
    }
  };
}

function value(selector, fallback) {
  return document.querySelector(selector)?.value?.trim() || fallback;
}

function readSelectedFile() {
  const file = document.querySelector("#bankCsvFile")?.files?.[0];
  if (!file) return Promise.resolve("");
  return file.text();
}

function correctionRequestFromForm(ctx, actorId) {
  return {
    tenantId: value("#correctionTenant", ctx.state.bankStatementImport?.request?.tenantId || "tenant-1"),
    workItemId: value("#correctionWorkItemId", "pc-correction-request"),
    caseId: value("#correctionCaseId", "") || null,
    targetLedgerType: value("#correctionTargetLedgerType", "payment"),
    targetEntryId: value("#correctionTargetEntryId", ""),
    targetObjectType: value("#correctionTargetObjectType", "payment"),
    targetObjectId: value("#correctionTargetObjectId", ""),
    correctionType: value("#correctionType", "allocation_reversal"),
    reason: value("#correctionReason", "manual reconciliation correction"),
    requestedBy: actorId,
    riskLevel: value("#correctionRiskLevel", "high")
  };
}

function correctionApprovalFromForm(ctx, actorId) {
  return {
    tenantId: value("#correctionDecisionTenant", ctx.state.bankStatementImport?.request?.tenantId || "tenant-1"),
    approverId: value("#correctionApproverId", actorId),
    note: value("#correctionApprovalNote", "approved from PC Correction Center")
  };
}

function correctionApplyFromForm(ctx, actorId) {
  const adjustment = value("#correctionAdjustmentAmount", "");
  return {
    tenantId: value("#correctionDecisionTenant", ctx.state.bankStatementImport?.request?.tenantId || "tenant-1"),
    actorId: value("#correctionApplyActorId", actorId),
    workItemId: value("#correctionApplyWorkItemId", "pc-correction-apply"),
    adjustmentAmount: adjustment === "" ? null : Number(adjustment),
    reason: value("#correctionApplyReason", "append-only correction applied")
  };
}

function selectedCorrectionRequestId(ctx) {
  return value("#correctionRequestId", ctx.state.bankStatementImport?.selectedCorrectionRequestId || ctx.state.bankStatementImport?.correctionRequests?.[0]?.correctionRequestId || "");
}

function normalizeCorrectionRequest(body, result) {
  return {
    ...body,
    correctionRequestId: result.correctionRequestId,
    status: result.status,
    eventId: result.eventId,
    workItemIntent: result.workItemIntent
  };
}

function updateCorrectionState(ctx, result, status, operationName) {
  const previous = ctx.state.bankStatementImport || {};
  const correctionRequests = (previous.correctionRequests || []).map((item) =>
    item.correctionRequestId === result.correctionRequestId ? { ...item, status, lastResult: result } : item);
  return auditState({
    ...previous,
    correctionRequests,
    selectedCorrectionRequestId: result.correctionRequestId,
    correctionDecision: result,
    error: ""
  }, operationName, result);
}

function auditState(state, operationName, result) {
  const entry = {
    operationName,
    status: result?.status || "completed",
    gateResultRef: result?.gateResultId || "machine-gate-result-required",
    auditRef: result?.eventId || result?.matchedEventId || result?.correctionRequestId || result?.matchId || result?.importId || "",
    recordedAtUtc: new Date().toISOString()
  };
  return {
    ...state,
    operationAudit: [entry, ...(state.operationAudit || [])].slice(0, 20)
  };
}
