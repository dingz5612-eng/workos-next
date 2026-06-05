import { login, logout } from "./authController.js";
import { bindFeedbackEvents } from "./feedbackEventBinder.js";
import { runLearningSearch, setCoachStage, setLearningDomain, setLearningType, updateLearningQuery } from "./coachController.js";
import { collectDraftingValuesOnInput, saveCurrentDraft, setSegmentedOperationField, submitCurrentCard } from "./operationController.js";
import { handleOperationRecovery, retryApi, startCompletedStepCorrection } from "./operationRecoveryController.js";
import { clearQueueFilterState, setQueueFilter, setQueueSort, setWorkFilter } from "./queueController.js";
import { onboard, openWorkspace, openWorkItem, runSearch, selectCard, setLang, setView, startOperationsWorkspaceCommand, updateSearchQuery } from "./navigationController.js";
import { isPcSurfaceView } from "./surfaceRegistry.js";

let activeEventContext = null;
let delegatedClickBound = false;
let bindPass = 0;

export function bindEvents(ctx) {
  activeEventContext = ctx;
  const currentBindPass = ++bindPass;
  bindDelegatedOperationActions();
  document.querySelector("#language")?.addEventListener("change", (event) => setLang(event.target.value, ctx));
  document.querySelector("#retryApi")?.addEventListener("click", () => retryApi(ctx));
  document.querySelector("#loginSubmit")?.addEventListener("click", () => login(ctx));
  document.querySelector("#logout")?.addEventListener("click", () => logout(ctx));
  document.querySelector("#start")?.addEventListener("click", () => onboard(ctx));
  document.querySelector("#skip")?.addEventListener("click", () => onboard(ctx));
  document.querySelector("#query")?.addEventListener("input", (event) => updateSearchQuery(event.target.value, ctx));
  document.querySelector("#searchNow")?.addEventListener("click", () => runSearch(ctx));
  bindLearning(ctx);
  bindQueue(ctx);
  bindFeedbackEvents(ctx);
  document.querySelector(".operation-inputs")?.addEventListener("input", (event) => collectDraftingValuesOnInput(event, ctx));
  document.querySelector(".operation-inputs")?.addEventListener("change", (event) => collectDraftingValuesOnInput(event, ctx));
  document.querySelector("#finish")?.addEventListener("click", () => setView("result", ctx));
  document.querySelector("[data-save-draft]")?.addEventListener("click", () => saveCurrentDraft(ctx));
  if (isPcSurfaceView(ctx.state.view)) {
    import("./pcEventBinder.js").then(({ bindPcEvents }) => {
      if (currentBindPass !== bindPass || activeEventContext !== ctx || !isPcSurfaceView(ctx.state.view)) return;
      bindPcEvents(ctx);
    });
  }
}

function bindDelegatedOperationActions() {
  if (delegatedClickBound) return;
  delegatedClickBound = true;
  document.addEventListener("click", (event) => {
    const target = event.target?.closest ? event.target : event.target?.parentElement;
    const node = target?.closest?.(`
      button[data-start-operations-workspace],
      button[data-operation-field-button],
      button[data-work-item-id],
      button[data-workspace],
      button[data-card-index],
      button[data-submit-card],
      button[data-correction-work-item],
      button[data-action-state],
      button[data-search-query],
      button[data-view],
      a[data-view],
      [role="button"][data-view]
    `);
    if (!node || node.disabled || node.getAttribute("aria-disabled") === "true") return;
    const ctx = activeEventContext;
    if (!ctx) return;
    event.preventDefault();
    if (node.dataset.operationFieldButton !== undefined) return setSegmentedOperationField(node, ctx);
    if (node.dataset.startOperationsWorkspace !== undefined) {
      void startOperationsWorkspaceCommand(ctx, node.dataset.startOperationsWorkspace, node.dataset.firstCardId || "");
      return;
    }
    if (node.dataset.correctionWorkItem !== undefined) {
      void startCompletedStepCorrection(ctx, node.dataset);
      return;
    }
    if (node.dataset.workItemId) {
      openWorkItem(node.dataset.workItemId, ctx, {
        workspaceId: node.dataset.workspaceId,
        cardId: node.dataset.cardId
      });
      return;
    }
    if (node.dataset.workspace) {
      openWorkspace(node.dataset.workspace, ctx, node.dataset.cardId || "");
      return;
    }
    if (node.dataset.cardIndex !== undefined) {
      selectCard(node.dataset.cardIndex, ctx);
      return;
    }
    if (node.dataset.submitCard !== undefined) {
      void submitCurrentCard(ctx);
      return;
    }
    if (node.dataset.actionState) {
      void handleOperationRecovery(node.dataset.actionState, ctx);
      return;
    }
    if (node.dataset.searchQuery !== undefined) {
      ctx.state.query = node.dataset.searchQuery || "";
      void runSearch(ctx, node.dataset.searchQuery || "");
      return;
    }
    if (node.dataset.view) {
      setView(node.dataset.view, ctx);
    }
  });
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
