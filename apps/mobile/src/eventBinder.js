import { login, logout } from "./authController.js";
import { runLearningSearch, setCoachStage, setLearningDomain, setLearningType, updateLearningQuery } from "./coachController.js";
import { collectDraftingValuesOnInput, saveCurrentDraft, submitCurrentCard } from "./operationController.js";
import { clearQueueFilterState, setQueueFilter, setQueueSort, setWorkFilter } from "./queueController.js";
import { onboard, openWorkspace, openWorkItem, runSearch, selectCard, setLang, setView, startResourceSetupCommand, startWorkspaceCommand, updateSearchQuery } from "./navigationController.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";

export function bindEvents(ctx) {
  document.querySelector("#language")?.addEventListener("change", (event) => setLang(event.target.value, ctx));
  document.querySelector("#retryApi")?.addEventListener("click", () => retryApi(ctx));
  document.querySelector("#loginSubmit")?.addEventListener("click", () => login(ctx));
  document.querySelector("#logout")?.addEventListener("click", () => logout(ctx));
  document.querySelector("#start")?.addEventListener("click", () => onboard(ctx));
  document.querySelector("#skip")?.addEventListener("click", () => onboard(ctx));
  document.querySelectorAll("[data-view]").forEach((node) => node.addEventListener("click", () => setView(node.dataset.view, ctx)));
  document.querySelectorAll("[data-workspace]").forEach((node) => node.addEventListener("click", () => openWorkspace(node.dataset.workspace, ctx, node.dataset.cardId || "")));
  document.querySelectorAll("[data-work-item-id]").forEach((node) => node.addEventListener("click", () => openWorkItem(node.dataset.workItemId, ctx, {
    workspaceId: node.dataset.workspaceId,
    cardId: node.dataset.cardId
  })));
  document.querySelectorAll("[data-start-resource-setup]").forEach((node) => node.addEventListener("click", () => startResourceSetupCommand(ctx)));
  document.querySelectorAll("[data-start-workspace]").forEach((node) => node.addEventListener("click", () => startWorkspaceCommand(ctx, node.dataset.startWorkspace, node.dataset.firstCardId || "")));
  document.querySelectorAll("[data-card-index]").forEach((node) => node.addEventListener("click", () => selectCard(node.dataset.cardIndex, ctx)));
  document.querySelector("#query")?.addEventListener("input", (event) => updateSearchQuery(event.target.value, ctx));
  document.querySelector("#searchNow")?.addEventListener("click", () => runSearch(ctx));
  bindLearning(ctx);
  bindQueue(ctx);
  document.querySelector(".operation-inputs")?.addEventListener("input", (event) => collectDraftingValuesOnInput(event, ctx));
  document.querySelector(".operation-inputs")?.addEventListener("change", (event) => collectDraftingValuesOnInput(event, ctx));
  document.querySelector("#finish")?.addEventListener("click", () => setView("result", ctx));
  document.querySelector("[data-save-draft]")?.addEventListener("click", () => saveCurrentDraft(ctx));
  document.querySelectorAll("[data-submit-card]").forEach((node) => node.addEventListener("click", () => submitCurrentCard(ctx)));
  document.querySelectorAll("[data-action-state]").forEach((node) => node.addEventListener("click", () => handleOperationRecovery(node.dataset.actionState, ctx)));
  if (isPcSurfaceView(ctx.state.view)) {
    import("./pcEventBinder.js").then(({ bindPcEvents }) => bindPcEvents(ctx));
  }
}

async function retryApi(ctx) {
  await ctx.hydrateProjectionFromApi();
  ctx.render();
}

async function handleOperationRecovery(actionState, ctx) {
  if (actionState === "projectionPending" || actionState === "failed") {
    await ctx.hydrateProjectionFromApi();
    ctx.render();
    return;
  }
  if (actionState === "submitted") {
    setView("recentTraces", ctx);
    return;
  }
  if (actionState === "blocked" || actionState === "missingEvidence") {
    setView("learning", ctx);
    return;
  }
  if (actionState === "waitingPermission") {
    setView("permissions", ctx);
  }
}

function bindLearning(ctx) {
  document.querySelector("#learningQuery")?.addEventListener("input", (event) => updateLearningQuery(event.target.value, ctx));
  document.querySelector("#learningSearch")?.addEventListener("click", () => runLearningSearch(ctx));
  document.querySelectorAll("[data-learning-domain]").forEach((node) => node.addEventListener("click", () => setLearningDomain(node.dataset.learningDomain, ctx)));
  document.querySelectorAll("[data-learning-type]").forEach((node) => node.addEventListener("click", () => setLearningType(node.dataset.learningType, ctx)));
  document.querySelectorAll("[data-coach-flow]").forEach((node) => node.addEventListener("click", () => setCoachStage(node.dataset.coachFlow, node.dataset.coachStage, ctx)));
}

function bindQueue(ctx) {
  document.querySelectorAll("[data-filter-field]").forEach((node) => node.addEventListener("click", () => setQueueFilter(node.dataset.filterField, node.dataset.filterValue, ctx)));
  document.querySelectorAll("[data-work-filter]").forEach((node) => node.addEventListener("click", () => setWorkFilter(node.dataset.workFilter, ctx)));
  document.querySelector("#clearQueueFilters")?.addEventListener("click", () => clearQueueFilterState(ctx));
  document.querySelector("#sort")?.addEventListener("change", (event) => setQueueSort(event.target.value, ctx));
}
