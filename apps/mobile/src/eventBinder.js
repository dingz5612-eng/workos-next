import { login, logout } from "./authController.js";
import { runLearningSearch, setCoachStage, setLearningDomain, setLearningType, updateLearningQuery } from "./coachController.js";
import { collectDraftingValuesOnInput, saveCurrentDraft, submitCurrentCard } from "./operationController.js";
import { closeAdvancedFilters, openAdvancedFilters, setQueueFilter, setQueueSort, toggleFilters } from "./queueController.js";
import { onboard, openWorkspace, runSearch, selectCard, setLang, setView, updateSearchQuery } from "./navigationController.js";

export function bindEvents(ctx) {
  document.querySelector("#language")?.addEventListener("change", (event) => setLang(event.target.value, ctx));
  document.querySelector("#retryApi")?.addEventListener("click", () => retryApi(ctx));
  document.querySelector("#loginSubmit")?.addEventListener("click", () => login(ctx));
  document.querySelector("#logout")?.addEventListener("click", () => logout(ctx));
  document.querySelector("#start")?.addEventListener("click", () => onboard(ctx));
  document.querySelector("#skip")?.addEventListener("click", () => onboard(ctx));
  document.querySelectorAll("[data-view]").forEach((node) => node.addEventListener("click", () => setView(node.dataset.view, ctx)));
  document.querySelectorAll("[data-workspace]").forEach((node) => node.addEventListener("click", () => openWorkspace(node.dataset.workspace, ctx)));
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
}

async function retryApi(ctx) {
  await ctx.hydrateProjectionFromApi();
  ctx.render();
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
  document.querySelector("#toggleFilters")?.addEventListener("click", () => toggleFilters(ctx));
  document.querySelector("#advanced")?.addEventListener("click", () => openAdvancedFilters(ctx));
  document.querySelector("#closeAdvanced")?.addEventListener("click", () => closeAdvancedFilters(ctx));
  document.querySelector("#sort")?.addEventListener("change", (event) => setQueueSort(event.target.value, ctx));
}
