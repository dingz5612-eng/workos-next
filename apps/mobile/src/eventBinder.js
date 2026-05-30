import { login, logout } from "./authController.js";
import { runLearningSearch, setCoachStage, setLearningDomain, setLearningType, updateLearningQuery } from "./coachController.js";
import {
  acceptBankMatchCandidate,
  applyCorrectionRequest,
  approveCorrectionRequest,
  confirmBankImport,
  createCorrectionRequest,
  detectBankMismatches,
  generateBankMatchCandidates,
  ignoreBankTx,
  markBankMismatch,
  previewBankImport,
  rejectCorrectionRequest,
  rejectBankMatchCandidate
} from "./financeReconciliationController.js";
import { collectDraftingValuesOnInput, saveCurrentDraft, submitCurrentCard, toggleEvidenceSelection } from "./operationController.js";
import { requestGovernanceExport, revokeGovernanceDevice } from "./pcGovernanceController.js";
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
  document.querySelectorAll("[data-workspace]").forEach((node) => node.addEventListener("click", () => openWorkspace(node.dataset.workspace, ctx, node.dataset.cardId || "")));
  document.querySelectorAll("[data-card-index]").forEach((node) => node.addEventListener("click", () => selectCard(node.dataset.cardIndex, ctx)));
  document.querySelector("#query")?.addEventListener("input", (event) => updateSearchQuery(event.target.value, ctx));
  document.querySelector("#searchNow")?.addEventListener("click", () => runSearch(ctx));
  bindLearning(ctx);
  bindQueue(ctx);
  document.querySelector(".operation-inputs")?.addEventListener("input", (event) => collectDraftingValuesOnInput(event, ctx));
  document.querySelector(".operation-inputs")?.addEventListener("change", (event) => collectDraftingValuesOnInput(event, ctx));
  document.querySelector(".evidence-row")?.addEventListener("click", (event) => {
    if (event.target.matches("[data-evidence-id]")) toggleEvidenceSelection(event, ctx);
  });
  document.querySelector("#finish")?.addEventListener("click", () => setView("result", ctx));
  document.querySelector("[data-save-draft]")?.addEventListener("click", () => saveCurrentDraft(ctx));
  document.querySelectorAll("[data-submit-card]").forEach((node) => node.addEventListener("click", () => submitCurrentCard(ctx)));
  document.querySelector("[data-bank-preview]")?.addEventListener("click", () => previewBankImport(ctx));
  document.querySelector("[data-bank-confirm]")?.addEventListener("click", () => confirmBankImport(ctx));
  document.querySelector("[data-bank-generate-candidates]")?.addEventListener("click", () => generateBankMatchCandidates(ctx));
  document.querySelector("[data-bank-detect-mismatches]")?.addEventListener("click", () => detectBankMismatches(ctx));
  document.querySelectorAll("[data-candidate-accept]").forEach((node) =>
    node.addEventListener("click", () => acceptBankMatchCandidate(node.dataset.candidateAccept, ctx)));
  document.querySelectorAll("[data-candidate-reject]").forEach((node) =>
    node.addEventListener("click", () => rejectBankMatchCandidate(node.dataset.candidateReject, ctx)));
  document.querySelectorAll("[data-bank-mismatch]").forEach((node) =>
    node.addEventListener("click", () => markBankMismatch(node.dataset.bankMismatch, ctx)));
  document.querySelectorAll("[data-bank-ignore]").forEach((node) =>
    node.addEventListener("click", () => ignoreBankTx(node.dataset.bankIgnore, ctx)));
  document.querySelector("[data-correction-request]")?.addEventListener("click", () => createCorrectionRequest(ctx));
  document.querySelector("[data-correction-approve]")?.addEventListener("click", () => approveCorrectionRequest(ctx));
  document.querySelector("[data-correction-reject]")?.addEventListener("click", () => rejectCorrectionRequest(ctx));
  document.querySelector("[data-correction-apply]")?.addEventListener("click", () => applyCorrectionRequest(ctx));
  document.querySelectorAll("[data-governance-export]").forEach((node) =>
    node.addEventListener("click", () => requestGovernanceExport(node.dataset.governanceExport, ctx)));
  document.querySelectorAll("[data-device-revoke]").forEach((node) =>
    node.addEventListener("click", () => revokeGovernanceDevice(node.dataset.deviceRevoke, ctx)));
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
