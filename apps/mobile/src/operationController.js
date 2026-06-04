import { capacityForRoomType } from "./controls/fieldControls.js";
import { clearDraft, loadDraft, saveDraft } from "./operationDrafts.js";
import { createSubmissionProtocol, materializeEvidenceObjects, submitWorkItemOperation } from "./operationRuntime.js";
import { setView } from "./navigationController.js";
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
  const fieldValues = collectOperationValues();
  const evidenceDrafts = collectEvidenceDrafts();
  saveDraft(item.id, card.id, fieldValues, evidenceDrafts, draftSubmissionProtocol(item, card, fieldValues, evidenceDrafts));
}

export function saveCurrentDraft(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  if (!item || !card) return;
  const fieldValues = collectOperationValues();
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
  const roomType = roomTypeField ? document.querySelector(`[data-operation-field="${roomTypeField.id}"]`)?.value : "";
  const capacity = capacityField ? document.querySelector(`[data-operation-field="${capacityField.id}"]`) : null;
  if (roomType && capacity) capacity.value = capacityForRoomType(roomType);
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
  const fieldValues = collectOperationValues();
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
      ctx.state.operationMessage = ctx.tr("apiOffline");
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
      onOperationWorkItems: (items) => applyRuntimeSurfacePayloads(ctx.state, { operationWorkItems: items })
    });
    if (!isCommittedConfirmResult(result)) {
      ctx.state.operationMessage = confirmBlockedMessage(result, ctx);
      ctx.state.lastActionResult = actionResultFromBlockedConfirm(result, ctx.state.operationMessage, item, card);
    } else {
      applyCommittedCardLocalState(item.id, card.id, ctx);
      if (result?.projectionStatus === "projected") clearDraft(item.id, card.id);
      ctx.state.selectedCardIndex = -1;
      ctx.state.selectedCardId = "";
      ctx.state.operationMessage = confirmSuccessMessage(result, ctx);
      ctx.state.lastActionResult = actionResultFromConfirm(result, ctx.state.operationMessage, item, card);
    }
  } catch (error) {
    if (applyConfirmError(error, ctx)) return;
  } finally {
    ctx.state.operationSubmitting = false;
  }
  ctx.render(true);
}

function validateRequiredFields(card, values, ctx) {
  const missingFields = (card.fields?.business || [])
    .filter((field) => field.required)
    .filter((field) => !hasBusinessValue(values, operationFieldId(field)));
  return {
    missingFields,
    missingLabels: missingFields.map((field) => labelForField(field, ctx))
  };
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

function actionResultFromConfirm(result, message, workspace = {}, card = {}) {
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
    traceRefs: result?.traceRefs || result?.resultEventIds || []
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
    const collection = runtimeStore?.[collectionName] || [];
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
  const runtimeItems = [
    ...(state.runtimeStore?.operationWorkItems || []),
    ...(state.runtimeStore?.workQueue || [])
  ];
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
