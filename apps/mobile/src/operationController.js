import { generatedBedLabelsForCount, isGeneratedBedLabelList, splitBedLabels } from "./controls/bedLabelControls.js";
import { capacityForRoomType } from "./controls/fieldControls.js";
import { isScopedResourceFieldRequired } from "./controls/resourceScopeControls.js";
import { fetchOperationWorkItems } from "./apiClient.js";
import { clearDraft, loadDraft, saveCompletedRecordSnapshot, saveDraft } from "./operationDrafts.js";
import { createSubmissionProtocol, materializeEvidenceObjects, submitWorkItemOperation } from "./operationRuntime.js";
import { setView, syncUrlFromState } from "./navigationController.js";
import { normalizeOperationLifecycleState } from "./operationStatus.js";
import { activeWorkspaceCard, isCardActionDisabled, isTerminalCardStatus } from "./selectors/workspaceSelectors.js";
import { applyRuntimeProjection, applyRuntimeSurfacePayloads } from "./runtime/runtimeStore.js";
import { operationFieldId } from "./views/workspaceView.js";

export function collectOperationValues() {
  if (typeof document === "undefined") return {};
  const values = Array.from(document.querySelectorAll("[data-operation-field]")).reduce((current, node) => {
    current[node.dataset.operationField] = node.value || "";
    return current;
  }, {});
  Array.from(document.querySelectorAll("[data-operation-field-start]")).forEach((node) => {
    const key = node.dataset.operationFieldStart;
    const end = document.querySelector(`[data-operation-field-end="${key}"]`)?.value || "";
    values[key] = [node.value, end].filter(Boolean).join(" 至 ");
  });
  return values;
}

export function collectEvidenceIds() {
  return collectEvidenceDrafts().map((draft) => draft.evidenceId);
}

export function collectEvidenceDrafts() {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll("[data-evidence-id].selected"))
    .map((node) => {
      if (!node.dataset.evidenceDraftId) {
        node.dataset.evidenceDraftId = `evidence-${node.dataset.evidenceId}-${randomDraftId()}`;
      }
      return {
        requirementId: node.dataset.evidenceId,
        evidenceId: node.dataset.evidenceDraftId
      };
    })
    .filter((draft) => draft.requirementId && draft.evidenceId);
}

export function systemEvidenceDraftsFor(card = {}, currentDrafts = []) {
  const existing = new Map((currentDrafts || [])
    .filter((draft) => draft?.requirementId)
    .map((draft) => [draft.requirementId, draft]));
  for (const field of card.evidence || []) {
    if (!field?.id) continue;
    const current = existing.get(field.id);
    existing.set(field.id, {
      requirementId: field.id,
      evidenceId: (current?.source === "system" || current?.evidenceId?.startsWith("evd-")) && current.evidenceId
        ? current.evidenceId
        : `evidence-${field.id}-${randomDraftId()}`,
      source: "system",
      status: current?.evidenceId?.startsWith("evd-") ? "verified" : current?.status
    });
  }
  return Array.from(existing.values());
}

export function toggleEvidenceSelection(event, ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  if (!item || !card) return;
  const node = event.target;
  node.classList.toggle("selected");
  if (node.classList.contains("selected") && !node.dataset.evidenceDraftId) {
    node.dataset.evidenceDraftId = `evidence-${node.dataset.evidenceId}-${randomDraftId()}`;
  }
  const fieldValues = enrichCorrectionFieldValues(collectOperationValues(), ctx.state, item, card);
  const evidenceDrafts = collectEvidenceDrafts();
  saveDraft(item.id, card.id, fieldValues, evidenceDrafts, draftSubmissionProtocol(item, card, fieldValues, evidenceDrafts));
}

export function saveCurrentDraft(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  if (!item || !card) return;
  const fieldValues = enrichCorrectionFieldValues(collectOperationValues(), ctx.state, item, card);
  const evidenceDrafts = collectEvidenceDrafts();
  saveDraft(item.id, card.id, fieldValues, evidenceDrafts, draftSubmissionProtocol(item, card, fieldValues, evidenceDrafts));
  ctx.state.fieldValidation = null;
  ctx.state.operationMessage = ctx.tr("draftSaved");
  ctx.render();
}

export function updateDerivedFields(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  const roomTypeField = card?.fields?.business?.find((field) => field.ui?.optionSet === "roomType");
  const capacityField = card?.fields?.business?.find((field) => field.ui?.derivedFrom === "roomType");
  const roomType = roomTypeField ? document.querySelector(`[data-operation-field="${operationFieldId(roomTypeField)}"]`)?.value : "";
  const capacity = capacityField ? document.querySelector(`[data-operation-field="${operationFieldId(capacityField)}"]`) : null;
  if (roomType && capacity) capacity.value = capacityForRoomType(roomType);
  const bedCount = document.querySelector('[data-operation-field="bedCount"]');
  const bedLabels = document.querySelector('[data-operation-field="bedLabels"]');
  if (bedCount && bedLabels) {
    const generated = generatedBedLabelsForCount(bedCount.value);
    if (generated && (!bedLabels.value.trim() || isGeneratedBedLabelList(bedLabels.value))) {
      bedLabels.value = generated;
    }
  }
  const amount = document.querySelector('[data-operation-field="amount"]');
  const unitRate = decimalValue("unitRate");
  const tariffQuantity = decimalValue("tariffQuantity");
  if (amount && unitRate > 0 && tariffQuantity > 0) amount.value = String(unitRate * tariffQuantity);
  const refundAmount = document.querySelector('[data-operation-field="refundAmount"]');
  if (refundAmount) {
    const approved = decimalValue("confirmedAmount") || decimalValue("receivedAmount") || decimalValue("requiredDepositAmount");
    const deduction = decimalValue("deductionAmount");
    const applyToBalance = decimalValue("applyToBalanceAmount");
    const paid = decimalValue("refundPaidAmount");
    const available = approved - deduction - applyToBalance - paid;
    if (available > 0) refundAmount.value = String(available);
  }
}

function decimalValue(fieldId) {
  const raw = document.querySelector(`[data-operation-field="${fieldId}"]`)?.value || "";
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function collectDraftingValuesOnInput(event, ctx) {
  if (!event.target.matches("[data-operation-field], [data-operation-field-start], [data-operation-field-end]")) return;
  updateDerivedFields(ctx);
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  if (!item || !card) return;
  const evidenceDrafts = loadDraft(item.id, card.id).evidenceDrafts || [];
  const fieldValues = collectOperationValues();
  saveDraft(item.id, card.id, fieldValues, evidenceDrafts, draftSubmissionProtocol(item, card, fieldValues, evidenceDrafts));
  if (event.target.dataset.operationField === "resourceScope") {
    ctx.render();
    return;
  }
  if (ctx.state.fieldValidation?.workspaceId === item.id && ctx.state.fieldValidation?.cardId === card.id) {
    const requiredValidation = validateRequiredFields(card, fieldValues, ctx);
    if (!requiredValidation.missingFields.length) {
      ctx.state.fieldValidation = null;
      if (ctx.state.lastActionResult?.status === "business_blocked_422" && ctx.state.lastActionResult?.reason === "required_field_missing") {
        ctx.state.lastActionResult = null;
      }
      ctx.state.operationMessage = "";
      ctx.render();
      return;
    }
    ctx.state.fieldValidation = {
      ...ctx.state.fieldValidation,
      missingFieldIds: requiredValidation.missingFields.map((field) => operationFieldId(field)),
      missingLabels: requiredValidation.missingLabels
    };
  }
}

export function setSegmentedOperationField(source, ctx) {
  const target = source?.dataset?.operationFieldButton !== undefined
    ? source
    : source?.target?.closest ? source.target : source?.target?.parentElement;
  const button = target?.closest?.("[data-operation-field-button]") || target;
  if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
  const fieldId = button.dataset.operationFieldButton || "";
  const value = button.dataset.value || "";
  const input = document.querySelector(`[data-operation-field="${fieldId}"]`);
  if (!fieldId || !input) return;
  input.value = value;
  collectDraftingValuesOnInput({ target: input }, ctx);
}

export async function submitCurrentCard(ctx) {
  if (ctx.state.operationSubmitting) return;
  const item = ctx.workspace();
  const card = operationActiveCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  if (!item || !card || isCardActionDisabled(card)) return;
  if (!ctx.state.currentActor) {
    ctx.state.loginMessage = ctx.tr("loginRequired");
    setView("login", ctx);
    return;
  }
  const fieldValues = enrichCorrectionFieldValues(collectOperationValues(), ctx.state, item, card);
  const requiredValidation = validateRequiredFields(card, fieldValues, ctx);
  if (requiredValidation.missingFields.length) {
    const evidenceDrafts = collectEvidenceDrafts();
    saveDraft(item.id, card.id, fieldValues, evidenceDrafts, draftSubmissionProtocol(item, card, fieldValues, evidenceDrafts));
    ctx.state.fieldValidation = {
      workspaceId: item.id,
      cardId: card.id,
      missingFieldIds: requiredValidation.missingFields.map((field) => operationFieldId(field)),
      missingLabels: requiredValidation.missingLabels
    };
    ctx.state.operationMessage = `${ctx.tr("requiredFieldMissing")} ${requiredValidation.missingLabels.join("、")}`;
    ctx.state.lastActionResult = {
      confirmed: false,
      status: "business_blocked_422",
      commitStatus: "blocked",
      projectionStatus: "not_started",
      reason: "required_field_missing",
      message: ctx.state.operationMessage
    };
    ctx.render();
    return;
  }
  ctx.state.fieldValidation = null;
  if (ctx.state.apiStatus !== "online") {
    await ctx.hydrateProjectionFromApi();
    if (ctx.state.apiStatus !== "online") {
      ctx.state.operationMessage = ctx.tr("apiOfflineSubmit");
      ctx.render();
      return;
    }
  }
  const evidenceDrafts = systemEvidenceDraftsFor(card, collectEvidenceDrafts());
  const submissionProtocol = draftSubmissionProtocol(item, card, fieldValues, evidenceDrafts);
  saveDraft(item.id, card.id, fieldValues, evidenceDrafts, submissionProtocol);
  ctx.state.operationMessage = ctx.tr("submitting");
  ctx.state.lastActionResult = { status: "submitting", message: ctx.state.operationMessage };
  ctx.state.operationSubmitting = true;
  ctx.render();
  try {
    const evidenceIds = await materializeEvidenceObjects({
      workspace: item,
      card,
      actor: ctx.state.currentActor,
      submissionProtocol,
      evidenceDrafts
    });
    for (const draft of evidenceDrafts) {
      if (draft.evidenceId?.startsWith("evd-")) {
        draft.source = "system";
        draft.status = "verified";
      }
    }
    saveDraft(item.id, card.id, fieldValues, evidenceDrafts, submissionProtocol);
    const result = await submitWorkItemOperation({
      workspace: item,
      card,
      workItemId: persistedWorkItemIdFor(ctx.state, item, card),
      actor: ctx.state.currentActor,
      language: ctx.state.lang,
      fieldValues,
      evidenceIds,
      submissionProtocol,
      onProjection: (payload) => applyProjectionPayload(payload, ctx),
      onLens: (payload) => applyLensPayload(payload, ctx),
      onOperationWorkItems: (items) => applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems: normalizeOperationWorkItemsPayload(items) }),
      onReadSideSynced: (syncResult) => applyCommittedReadSideSync(syncResult, ctx, item.id, card.id, submissionProtocol.submissionId)
    });
    if (!isCommittedConfirmResult(result)) {
      ctx.state.operationMessage = confirmBlockedMessage(result, ctx);
      ctx.state.lastActionResult = actionResultFromBlockedConfirm(result, ctx.state.operationMessage, item, card);
    } else {
      const committedWorkItemId = persistedWorkItemIdFor(ctx.state, item, card);
      saveCompletedRecordSnapshot({
        workspaceId: item.id,
        cardId: card.id,
        workItemId: committedWorkItemId,
        sourceWorkItemId: selectedOperationWorkItem(ctx.state, item, card)?.payload?.sourceWorkItemId || "",
        submissionId: submissionProtocol.submissionId,
        cardInstanceId: submissionProtocol.cardInstanceId,
        aggregateRef: submissionProtocol.aggregateRef,
        values: fieldValues,
        evidenceDrafts,
        evidenceIds,
        result
      });
      applyCommittedCardLocalState(item.id, card.id, ctx);
      if (result?.projectionStatus === "projected") clearDraft(item.id, card.id);
      ctx.state.operationMessage = confirmSuccessMessage(result, ctx);
      const actionResult = {
        ...actionResultFromConfirm(result, ctx.state.operationMessage, item, card, fieldValues),
        workItemId: committedWorkItemId
      };
      let autoAdvanceTarget = postSubmitAutoAdvanceTarget(ctx.state, item.id, card.id, committedWorkItemId);
      if (!autoAdvanceTarget) {
        await refreshPostSubmitWorkItems(ctx, item.id);
        autoAdvanceTarget = postSubmitAutoAdvanceTarget(ctx.state, item.id, card.id, committedWorkItemId);
      }
      if (autoAdvanceTarget) {
        applyPostSubmitAutoAdvance(ctx, autoAdvanceTarget);
        ctx.state.lastActionResult = {
          ...actionResult,
          autoAdvanced: true,
          autoAdvancedToWorkItemId: autoAdvanceTarget.workItemId,
          autoAdvancedToCardId: autoAdvanceTarget.cardId
        };
      } else {
        ctx.state.selectedCardIndex = -1;
        ctx.state.selectedCardId = "";
        ctx.state.lastActionResult = actionResult;
      }
    }
  } catch (error) {
    if (applyConfirmError(error, ctx)) return;
  } finally {
    ctx.state.operationSubmitting = false;
  }
  syncUrlFromState(ctx);
  ctx.render(true);
}

function validateRequiredFields(card, values, ctx) {
  const missingFields = (card.fields?.business || [])
    .filter((field) => isScopedResourceFieldRequired(card?.id, operationFieldId(field), values, Boolean(field.required)))
    .filter((field) => !hasBusinessValue(values, operationFieldId(field)));
  const invalidFields = bedSetupCardinalityViolations(card, values, ctx);
  const invalidFieldSet = new Set(invalidFields.map((entry) => entry.field));
  return {
    missingFields: [...missingFields, ...invalidFields.map((entry) => entry.field).filter((field) => !missingFields.includes(field))],
    missingLabels: [
      ...missingFields.map((field) => labelForField(field, ctx)),
      ...invalidFields
        .filter((entry) => !missingFields.includes(entry.field) && invalidFieldSet.has(entry.field))
        .map((entry) => entry.label)
    ]
  };
}

function bedSetupCardinalityViolations(card = {}, values = {}, ctx) {
  if (card.id !== "bedSetup") return [];
  const bedCount = Number(values.bedCount || 0);
  if (!Number.isFinite(bedCount) || bedCount <= 0) return [];
  const labelField = (card.fields?.business || []).find((field) => operationFieldId(field) === "bedLabels");
  if (!labelField) return [];
  const labels = splitBedLabels(values.bedLabels || "");
  if (labels.length === bedCount && new Set(labels.map((item) => item.toLocaleLowerCase())).size === labels.length) return [];
  const label = labels.length === bedCount
    ? `${labelForField(labelField, ctx)}: ${ctx.tr("bedLabelsMustBeUnique")}`
    : `${labelForField(labelField, ctx)}: ${ctx.tr("bedLabelsMustMatchBedCount").replace("{count}", String(bedCount))}`;
  return [{ field: labelField, label }];
}

function enrichCorrectionFieldValues(values = {}, state = {}, workspace = {}, card = {}) {
  const selected = selectedOperationWorkItem(state, workspace, card);
  const correctionMode = selected?.payload?.correctionMode || selected?.Payload?.correctionMode || "";
  if (!correctionMode) return values;
  return {
    ...values,
    correctionMode
  };
}

function selectedOperationWorkItem(state = {}, workspace = {}, card = {}) {
  const selectedWorkItemId = state.selectedWorkItemId || "";
  const runtimeItems = runtimeWorkItems(state);
  return runtimeItems.find((item) => [item.workItemId, item.work_item_id].includes(selectedWorkItemId)) ||
    runtimeItems.find((item) =>
      (item.workspaceId || item.workspace_id) === workspace?.id &&
      (item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId) === card?.id) ||
    null;
}

function postSubmitAutoAdvanceTarget(state = {}, workspaceId = "", completedCardId = "", completedWorkItemId = "") {
  const workspace = state.runtimeStore?.workspaces?.find((item) => item.id === workspaceId);
  const cards = workspace?.cards || [];
  const completedIndex = cards.findIndex((card) => card.id === completedCardId);
  if (completedIndex < 0) return null;
  const nextCardIds = cards
    .slice(completedIndex + 1)
    .map((card) => card.id);
  if (!nextCardIds.length) return null;
  const runtimeItems = runtimeWorkItems(state);
  for (const cardId of nextCardIds) {
    const target = runtimeItems.find((item) =>
      workItemIdOf(item) &&
      workItemIdOf(item) !== completedWorkItemId &&
      workItemWorkspaceId(item) === workspaceId &&
      workItemCardId(item) === cardId &&
      isPostSubmitActionableStatus(item.lifecycleState || item.lifecycle_state || item.status || item.card?.status));
    if (target) {
      return {
        workItemId: workItemIdOf(target),
        workspaceId,
        cardId
      };
    }
  }
  return null;
}

function applyPostSubmitAutoAdvance(ctx, target) {
  ctx.state.operationRouteIssue = null;
  ctx.state.view = "operationPanel";
  ctx.state.selectedWorkItemId = target.workItemId;
  ctx.state.selectedWorkspace = target.workspaceId;
  ctx.state.selectedCardId = target.cardId;
  ctx.state.selectedCardIndex = -1;
}

async function refreshPostSubmitWorkItems(ctx, workspaceId = "") {
  try {
    const payload = await fetchOperationWorkItems(workspaceId ? { workspaceId } : {});
    const operationWorkItems = normalizeOperationWorkItemsPayload(payload);
    applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems });
    return true;
  } catch {
    return false;
  }
}

function isPostSubmitActionableStatus(status = "") {
  const normalized = normalizeOperationLifecycleState(status, "");
  return ["ready", "blocked", "inProgress"].includes(normalized);
}

function workItemIdOf(item = {}) {
  return item.workItemId || item.work_item_id || "";
}

function workItemWorkspaceId(item = {}) {
  return item.workspaceId || item.workspace_id || item.workspace?.id || "";
}

function workItemCardId(item = {}) {
  return item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.card?.id || "";
}

function runtimeWorkItems(state = {}) {
  return [
    ...arrayPayload(state.runtimeStore?.operationWorkItems),
    ...arrayPayload(state.runtimeStore?.workQueue)
  ];
}

function normalizeOperationWorkItemsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.operationWorkItems)) return payload.operationWorkItems;
  if (Array.isArray(payload?.workItems)) return payload.workItems;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function arrayPayload(value) {
  return Array.isArray(value) ? value : [];
}

function hasBusinessValue(values = {}, fieldId = "") {
  const value = values[fieldId];
  return !(value === undefined || value === null || String(value).trim() === "");
}

function labelForField(field, ctx) {
  if (ctx.localTerm) return ctx.localTerm(field);
  return field?.label?.[ctx.state?.lang] || field?.label?.["zh-CN"] || field?.id || "";
}

function operationActiveCard(item, selectedCardIndex, selectedCardId) {
  if (!item) return null;
  const requested = activeWorkspaceCard(item, selectedCardIndex, selectedCardId);
  const workspaceCompleted = (item.cards || []).every((card) => isTerminalCardStatus(card.status));
  if (requested && isTerminalCardStatus(requested.status) && !workspaceCompleted) {
    return activeWorkspaceCard(item, -1, "");
  }
  return requested;
}

export function applyConfirmError(error, ctx) {
  if (error?.status === 401 || error?.reason === "actor_session_required") {
    ctx.state.currentActor = null;
    ctx.state.loginMessage = ctx.tr("sessionExpired");
    localStorage.removeItem("workosnext.actorSession");
    setView("login", ctx);
    return true;
  }

  ctx.state.operationMessage = confirmErrorMessage(error, ctx);
  ctx.state.lastActionResult = actionResultFromError(error, ctx.state.operationMessage);
  if (error?.status === 403) {
    localStorage.removeItem("workosnext.actorSession");
    ctx.state.permissionDiagnostic = {
      reason: error.reason || error.code || "permission_blocked_403",
      owner: "manager",
      requiredPermission: error.requiredPermission || "operation.confirm",
      nextAction: error.nextAction || ctx.tr("confirmForbidden"),
      status: "permission_blocked_403"
    };
  }
  return false;
}

export function confirmErrorMessage(error, ctx) {
  const keyByStatus = {
    400: "confirmBadRequest",
    403: "confirmForbidden",
    409: "confirmDuplicate",
    422: "confirmBusinessBlocked"
  };
  const prefix = ctx.tr(keyByStatus[error?.status] || "submitFailed");
  const detail = error?.reason || error?.code || "";
  return [prefix, detail].filter(Boolean).join(" ");
}

export function confirmSuccessMessage(result, ctx) {
  if (!isCommittedConfirmResult(result)) return confirmBlockedMessage(result, ctx);
  if (result?.commitStatus === "committed" && result?.projectionStatus === "pending") {
    return ctx.tr("submitProjectionPending");
  }
  if (result?.commitStatus === "committed" && result?.projectionStatus === "failed") {
    return ctx.tr("submitProjectionFailed");
  }
  return ctx.tr("submitDone");
}

export function confirmBlockedMessage(result, ctx) {
  return result?.message || result?.reason || result?.code || ctx.tr("confirmBusinessBlocked");
}

function randomDraftId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function draftSubmissionProtocol(item, card, fieldValues, evidenceDrafts) {
  const protocol = loadDraft(item.id, card.id).submissionProtocol;
  if (isCompleteSubmissionProtocol(protocol, fieldValues)) {
    return protocol;
  }

  const created = createSubmissionProtocol(item, card, fieldValues);
  saveDraft(item.id, card.id, fieldValues, evidenceDrafts, created);
  return created;
}

function isCompleteSubmissionProtocol(protocol, fieldValues = {}) {
  const aggregateRef = Object.entries(fieldValues || {}).find(([key, value]) =>
    ["roomId", "bedId", "stayId", "depositId", "depositReceiptId", "paymentId", "paymentReceiptId", "leadId", "reservationId", "serviceTaskId", "expenseId", "periodId", "settlementId"].includes(key) && value);
  const expectedAggregateRef = aggregateRef ? `${aggregateRef[0]}:${aggregateRef[1]}` : null;
  return !!protocol?.idempotencyKey &&
    !!protocol?.submissionId &&
    !!protocol?.cardInstanceId &&
    (protocol.aggregateRef || null) === expectedAggregateRef;
}

function applyProjectionPayload(payload, ctx) {
  if (payload?.workspaces) {
    applyRuntimeProjection(ctx.state, payload);
    if (ctx.state.runtimeStore) {
      ctx.state.runtimeStore.workQueue = [];
      ctx.state.runtimeStore.homeSurface = [];
      ctx.state.runtimeStore.learningCatalog = [];
      ctx.state.runtimeStore.queueSource = "runtime-projection";
      ctx.state.runtimeStore.homeSource = "runtime-projection";
      ctx.state.runtimeStore.learningSource = "runtime-projection";
    }
  }
}

function applyLensPayload(payload, ctx) {
  ctx.state.accommodationLenses = {
    ...(ctx.state.accommodationLenses || {}),
    ...(payload || {})
  };
}

function isCommittedConfirmResult(result) {
  return result?.confirmed === true && result?.commitStatus === "committed";
}

function actionResultFromConfirm(result, message, workspace = {}, card = {}, fieldValues = {}) {
  const status = result?.commitStatus === "committed" && result?.projectionStatus === "pending"
    ? "committed_projection_pending"
    : result?.commitStatus === "committed" && result?.projectionStatus === "failed"
      ? "committed_projection_failed"
      : "committed_projected";
  return {
    status,
    message,
    workspaceId: workspace?.id || result?.caseId || result?.workspace?.id || "",
    cardId: card?.id || "",
    commandSubmissionId: result?.commandSubmissionId || result?.submissionId || "",
    traceRefs: result?.traceRefs || result?.resultEventIds || [],
    fieldValues: fieldValues || {}
  };
}

function actionResultFromBlockedConfirm(result = {}, message, workspace = {}, card = {}) {
  return {
    status: result.status || "business_blocked_422",
    message,
    workspaceId: workspace?.id || result?.caseId || result?.workspace?.id || "",
    cardId: card?.id || "",
    reason: result.reason || result.error || result.code || "",
    commitStatus: result.commitStatus || "blocked",
    projectionStatus: result.projectionStatus || "not_started",
    commandSubmissionId: result?.commandSubmissionId || result?.submissionId || ""
  };
}

function actionResultFromError(error, message) {
  const byStatus = {
    403: "permission_blocked_403",
    409: "idempotency_conflict_409",
    422: "business_blocked_422"
  };
  return {
    status: byStatus[error?.status] || "network_unknown",
    message,
    permissionDiagnostic: error?.status === 403 ? {
      reason: error.reason || error.code || "permission_blocked_403",
      owner: "manager",
      requiredPermission: error.requiredPermission || "operation.confirm",
      nextAction: error.nextAction || message
    } : null
  };
}

function applyCommittedReadSideSync(syncResult, ctx, workspaceId, cardId, submissionId) {
  const current = ctx.state.lastActionResult;
  if (!current || current.commandSubmissionId !== submissionId) return;
  if (syncResult?.projectionStatus !== "projected") {
    ctx.render(true);
    return;
  }
  clearDraft(workspaceId, cardId);
  applyCommittedCardLocalState(workspaceId, cardId, ctx);
  ctx.state.operationMessage = ctx.tr("submitDone");
  const autoAdvanceTarget = current.autoAdvanced
    ? null
    : postSubmitAutoAdvanceTarget(ctx.state, workspaceId, cardId, current.workItemId || ctx.state.selectedWorkItemId || "");
  if (autoAdvanceTarget) {
    applyPostSubmitAutoAdvance(ctx, autoAdvanceTarget);
  }
  ctx.state.lastActionResult = {
    ...current,
    status: "committed_projected",
    message: ctx.state.operationMessage,
    projectionStatus: "projected",
    ...(autoAdvanceTarget ? {
      autoAdvanced: true,
      autoAdvancedToWorkItemId: autoAdvanceTarget.workItemId,
      autoAdvancedToCardId: autoAdvanceTarget.cardId
    } : {})
  };
  syncUrlFromState(ctx);
  ctx.render(true);
}

function applyCommittedCardLocalState(workspaceId, cardId, ctx) {
  const workspace = ctx.state.runtimeStore?.workspaces?.find((item) => item.id === workspaceId);
  if (!workspace) return;
  const cards = workspace.cards || [];
  const cardIndex = cards.findIndex((item) => item.id === cardId);
  if (cardIndex < 0) return;
  cards[cardIndex] = {
    ...cards[cardIndex],
    status: "done",
    blockerRules: []
  };
  if (cards[cardIndex + 1]?.status === "notStarted") {
    cards[cardIndex + 1] = {
      ...cards[cardIndex + 1],
      status: "ready"
    };
  }
  markRuntimeWorkItemCompleted(ctx.state.runtimeStore, workspaceId, cardId, ctx.state.selectedWorkItemId);
}

function markRuntimeWorkItemCompleted(runtimeStore = {}, workspaceId = "", cardId = "", selectedWorkItemId = "") {
  for (const collectionName of ["operationWorkItems", "workQueue"]) {
    const collection = arrayPayload(runtimeStore?.[collectionName]);
    for (let index = 0; index < collection.length; index += 1) {
      const item = collection[index];
      if (!matchesCompletedCard(item, workspaceId, cardId, selectedWorkItemId)) continue;
      collection[index] = {
        ...item,
        status: "done",
        lifecycleState: "done",
        lifecycle_state: "done",
        badges: Array.from(new Set([...(item.badges || []).filter((badge) => badge !== "ready"), "done"])),
        card: item.card ? { ...item.card, status: "done", blockerRules: [] } : item.card
      };
    }
  }
}

function matchesCompletedCard(item = {}, workspaceId = "", cardId = "", selectedWorkItemId = "") {
  const itemWorkItemId = item.workItemId || item.work_item_id || "";
  const itemWorkspaceId = item.workspaceId || item.workspace_id || item.workspace?.id || "";
  const itemCardId = item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.card?.id || "";
  if (selectedWorkItemId && itemWorkItemId === selectedWorkItemId) return true;
  return itemWorkspaceId === workspaceId && (!itemCardId || itemCardId === cardId);
}

function persistedWorkItemIdFor(state, workspace, card) {
  const selectedWorkItemId = state.selectedWorkItemId || "";
  const runtimeItems = runtimeWorkItems(state);
  const selected = runtimeItems.find((item) =>
    [item.workItemId, item.work_item_id].includes(selectedWorkItemId));
  if (selected?.workItemId || selected?.work_item_id) {
    return selected.workItemId || selected.work_item_id;
  }

  const byWorkspaceCard = runtimeItems.find((item) =>
    (item.workspaceId || item.workspace_id) === workspace?.id &&
    (!(item.cardId || item.card_id) || (item.cardId || item.card_id) === card?.id) &&
    (item.workItemId || item.work_item_id));
  if (byWorkspaceCard?.workItemId || byWorkspaceCard?.work_item_id) {
    return byWorkspaceCard.workItemId || byWorkspaceCard.work_item_id;
  }

  return "";
}
