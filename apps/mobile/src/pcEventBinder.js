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
import {
  applyAccountRolePreset,
  createGovernanceAccountUser,
  disableGovernanceAccountUser,
  requestGovernanceExport,
  resetGovernanceAccountPassword,
  revokeGovernanceDevice
} from "./pcGovernanceController.js";

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
  document.querySelector("[data-account-role-select]")?.addEventListener("change", (event) => applyAccountRolePreset(event.target.value));
  document.querySelector("[data-account-user-create]")?.addEventListener("click", () => createGovernanceAccountUser(ctx));
  document.querySelectorAll("[data-account-user-disable]").forEach((node) =>
    node.addEventListener("click", () => disableGovernanceAccountUser(node.dataset.accountUserDisable, ctx)));
  document.querySelectorAll("[data-account-password-reset]").forEach((node) =>
    node.addEventListener("click", () => resetGovernanceAccountPassword(node.dataset.accountPasswordReset, ctx)));
}
