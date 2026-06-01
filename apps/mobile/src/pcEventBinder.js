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
import { requestGovernanceExport, revokeGovernanceDevice } from "./pcGovernanceController.js";

export function bindPcEvents(ctx) {
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
