import { capacityForRoomType } from "./controls/fieldControls.js";
import { clearDraft, saveDraft } from "./operationDrafts.js";
import { submitCardOperation } from "./operationRuntime.js";
import { setView } from "./navigationController.js";
import { activeWorkspaceCard, isCardActionDisabled } from "./selectors/workspaceSelectors.js";

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

export function saveCurrentDraft(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex);
  if (!item || !card) return;
  saveDraft(item.id, card.id, collectOperationValues());
  ctx.state.operationMessage = ctx.tr("draftSaved");
  ctx.render();
}

export function updateDerivedFields(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex);
  const roomTypeField = card?.fields?.business?.find((field) => field.ui?.optionSet === "roomType");
  const capacityField = card?.fields?.business?.find((field) => field.ui?.derivedFrom === "房型");
  const roomType = roomTypeField ? document.querySelector(`[data-operation-field="${roomTypeField.id}"]`)?.value : "";
  const capacity = capacityField ? document.querySelector(`[data-operation-field="${capacityField.id}"]`) : null;
  if (roomType && capacity) capacity.value = capacityForRoomType(roomType);
}

export function collectDraftingValuesOnInput(event, ctx) {
  if (!event.target.matches("[data-operation-field], [data-operation-field-start], [data-operation-field-end]")) return;
  updateDerivedFields(ctx);
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex);
  if (!item || !card) return;
  saveDraft(item.id, card.id, collectOperationValues());
}

export async function submitCurrentCard(ctx) {
  const item = ctx.workspace();
  const card = activeWorkspaceCard(item, ctx.state.selectedCardIndex);
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
  ctx.state.operationMessage = ctx.tr("submitting");
  ctx.render();
  try {
    await submitCardOperation({
      workspace: item,
      card,
      actor: ctx.state.currentActor,
      language: ctx.state.lang,
      fieldValues: collectOperationValues(),
      onProjection: (payload) => ctx.replaceIntentWorkspaces(payload.workspaces)
    });
    clearDraft(item.id, card.id);
    ctx.state.selectedCardIndex = -1;
    ctx.state.operationMessage = ctx.tr("submitDone");
  } catch {
    ctx.state.apiStatus = "offline";
    ctx.state.operationMessage = ctx.tr("submitFailed");
  }
  ctx.render(true);
}
