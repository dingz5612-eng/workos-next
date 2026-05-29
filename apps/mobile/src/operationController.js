import { capacityForRoomType } from "./controls/fieldControls.js";
import { clearDraft, loadDraft, saveDraft } from "./operationDrafts.js";
import { submitCardOperation } from "./operationRuntime.js";
import { setView } from "./navigationController.js";
import { activeWorkspaceCard, isCardActionDisabled } from "./selectors/workspaceSelectors.js";
import { applyRuntimeProjection } from "./runtime/runtimeStore.js";

export function collectOperationValues() {
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

export function toggleEvidenceSelection(event, ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  if (!item || !card) return;
  const node = event.target;
  node.classList.toggle("selected");
  if (node.classList.contains("selected") && !node.dataset.evidenceDraftId) {
    node.dataset.evidenceDraftId = `evidence-${node.dataset.evidenceId}-${randomDraftId()}`;
  }
  saveDraft(item.id, card.id, collectOperationValues(), collectEvidenceDrafts());
}

export function saveCurrentDraft(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  if (!item || !card) return;
  saveDraft(item.id, card.id, collectOperationValues(), collectEvidenceDrafts());
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
}

export function collectDraftingValuesOnInput(event, ctx) {
  if (!event.target.matches("[data-operation-field], [data-operation-field-start], [data-operation-field-end]")) return;
  updateDerivedFields(ctx);
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  if (!item || !card) return;
  const evidenceDrafts = loadDraft(item.id, card.id).evidenceDrafts || [];
  saveDraft(item.id, card.id, collectOperationValues(), evidenceDrafts);
}

export async function submitCurrentCard(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  if (!item || !card || isCardActionDisabled(card)) return;
  if (!ctx.state.currentActor) {
    ctx.state.loginMessage = ctx.tr("loginRequired");
    setView("login", ctx);
    return;
  }
  if (ctx.state.apiStatus !== "online") {
    await ctx.hydrateProjectionFromApi();
    if (ctx.state.apiStatus !== "online") {
      ctx.state.operationMessage = ctx.tr("apiOffline");
      ctx.render();
      return;
    }
  }
  const fieldValues = collectOperationValues();
  const evidenceIds = collectEvidenceIds();
  saveDraft(item.id, card.id, fieldValues, collectEvidenceDrafts());
  ctx.state.operationMessage = ctx.tr("submitting");
  ctx.render();
  try {
    await submitCardOperation({
      workspace: item,
      card,
      actor: ctx.state.currentActor,
      language: ctx.state.lang,
      fieldValues,
      evidenceIds,
      onProjection: (payload) => applyProjectionPayload(payload, ctx),
      onLens: (payload) => applyLensPayload(payload, ctx)
    });
    clearDraft(item.id, card.id);
    ctx.state.selectedCardIndex = -1;
    ctx.state.operationMessage = ctx.tr("submitDone");
  } catch (error) {
    if (error?.status === 401 || error?.reason === "actor_session_required") {
      ctx.state.currentActor = null;
      ctx.state.loginMessage = ctx.tr("sessionExpired");
      localStorage.removeItem("workosnext.actorSession");
      setView("login", ctx);
      return;
    }
    ctx.state.operationMessage = confirmErrorMessage(error, ctx);
  }
  ctx.render(true);
}

function confirmErrorMessage(error, ctx) {
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

function randomDraftId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function applyProjectionPayload(payload, ctx) {
  if (payload?.workspaces) {
    applyRuntimeProjection(ctx.state, payload);
    if (ctx.state.runtimeStore) {
      ctx.state.runtimeStore.workQueue = [];
      ctx.state.runtimeStore.homeSurface = [];
      ctx.state.runtimeStore.learningCatalog = [];
      ctx.state.runtimeStore.queueSource = "projection-fallback";
      ctx.state.runtimeStore.homeSource = "projection-fallback";
      ctx.state.runtimeStore.learningSource = "projection-fallback";
    }
  }
}

function applyLensPayload(payload, ctx) {
  ctx.state.accommodationLenses = {
    ...(ctx.state.accommodationLenses || {}),
    ...(payload || {})
  };
}
