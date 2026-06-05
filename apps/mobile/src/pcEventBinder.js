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
  revokeGovernanceDevice,
  updateGovernanceAccountDraft
} from "./pcGovernanceController.js";

const boundPcEvents = new WeakMap();
let governanceHashBound = false;

export function bindPcEvents(ctx) {
  bindGovernanceNavigation();
  bindAccountDraftEvents(ctx);
  bindOnce(document.querySelector("[data-bank-preview]"), "click", "bank-preview", () => previewBankImport(ctx));
  bindOnce(document.querySelector("[data-bank-confirm]"), "click", "bank-confirm", () => confirmBankImport(ctx));
  bindOnce(document.querySelector("[data-bank-generate-candidates]"), "click", "bank-generate-candidates", () => generateBankMatchCandidates(ctx));
  bindOnce(document.querySelector("[data-bank-detect-mismatches]"), "click", "bank-detect-mismatches", () => detectBankMismatches(ctx));
  document.querySelectorAll("[data-candidate-accept]").forEach((node) =>
    bindOnce(node, "click", `candidate-accept:${node.dataset.candidateAccept}`, () => acceptBankMatchCandidate(node.dataset.candidateAccept, ctx)));
  document.querySelectorAll("[data-candidate-reject]").forEach((node) =>
    bindOnce(node, "click", `candidate-reject:${node.dataset.candidateReject}`, () => rejectBankMatchCandidate(node.dataset.candidateReject, ctx)));
  document.querySelectorAll("[data-bank-mismatch]").forEach((node) =>
    bindOnce(node, "click", `bank-mismatch:${node.dataset.bankMismatch}`, () => markBankMismatch(node.dataset.bankMismatch, ctx)));
  document.querySelectorAll("[data-bank-ignore]").forEach((node) =>
    bindOnce(node, "click", `bank-ignore:${node.dataset.bankIgnore}`, () => ignoreBankTx(node.dataset.bankIgnore, ctx)));
  bindOnce(document.querySelector("[data-correction-request]"), "click", "correction-request", () => createCorrectionRequest(ctx));
  bindOnce(document.querySelector("[data-correction-approve]"), "click", "correction-approve", () => approveCorrectionRequest(ctx));
  bindOnce(document.querySelector("[data-correction-reject]"), "click", "correction-reject", () => rejectCorrectionRequest(ctx));
  bindOnce(document.querySelector("[data-correction-apply]"), "click", "correction-apply", () => applyCorrectionRequest(ctx));
  document.querySelectorAll("[data-governance-export]").forEach((node) =>
    bindOnce(node, "click", `governance-export:${node.dataset.governanceExport}`, () => requestGovernanceExport(node.dataset.governanceExport, ctx)));
  document.querySelectorAll("[data-device-revoke]").forEach((node) =>
    bindOnce(node, "click", `device-revoke:${node.dataset.deviceRevoke}`, () => revokeGovernanceDevice(node.dataset.deviceRevoke, ctx)));
  bindOnce(document.querySelector("[data-account-role-select]"), "change", "account-role-select", (event) => {
    applyAccountRolePreset(event.target.value);
    updateGovernanceAccountDraft(ctx, {
      role: event.target.value,
      capabilities: selectedAccountCapabilityValues()
    });
  });
  bindOnce(document.querySelector("[data-account-user-create]"), "click", "account-user-create", () => createGovernanceAccountUser(ctx));
  document.querySelectorAll("[data-account-user-disable]").forEach((node) =>
    bindOnce(node, "click", `account-user-disable:${node.dataset.accountUserDisable}`, () => disableGovernanceAccountUser(node.dataset.accountUserDisable, ctx)));
  document.querySelectorAll("[data-account-password-reset]").forEach((node) =>
    bindOnce(node, "click", `account-password-reset:${node.dataset.accountPasswordReset}`, () => resetGovernanceAccountPassword(node.dataset.accountPasswordReset, ctx)));
}

function bindAccountDraftEvents(ctx) {
  document.querySelectorAll("[data-account-draft-field]").forEach((node) => {
    bindOnce(node, "input", `account-draft:${node.dataset.accountDraftField}`, (event) =>
      updateGovernanceAccountDraft(ctx, { [event.target.dataset.accountDraftField]: event.target.value }));
    bindOnce(node, "change", `account-draft:${node.dataset.accountDraftField}`, (event) =>
      updateGovernanceAccountDraft(ctx, { [event.target.dataset.accountDraftField]: event.target.value }));
  });
  document.querySelectorAll("[data-account-capability]").forEach((node) =>
    bindOnce(node, "change", `account-capability:${node.value}`, () =>
      updateGovernanceAccountDraft(ctx, { capabilities: selectedAccountCapabilityValues() })));
}

function selectedAccountCapabilityValues(root = document) {
  return Array.from(root.querySelectorAll("[data-account-capability]:checked"))
    .map((node) => String(node.value || "").trim())
    .filter(Boolean);
}

function bindGovernanceNavigation() {
  const links = Array.from(document.querySelectorAll("[data-governance-nav]"));
  if (!links.length) return;
  links.forEach((node) =>
    bindOnce(node, "click", `governance-nav:${node.getAttribute("href") || node.dataset.governanceNav}`, () => {
      window.setTimeout(syncGovernanceNavigationState, 0);
    }));
  if (!governanceHashBound && typeof window !== "undefined") {
    governanceHashBound = true;
    window.addEventListener("hashchange", syncGovernanceNavigationState);
  }
  syncGovernanceNavigationState();
}

function syncGovernanceNavigationState() {
  const links = Array.from(document.querySelectorAll("[data-governance-nav]"));
  if (!links.length) return;
  const validIds = new Set(links.map((node) => String(node.getAttribute("href") || "").replace(/^#/, "")).filter(Boolean));
  const hashId = decodeURIComponent(String(window.location?.hash || "").replace(/^#/, ""));
  const activeId = validIds.has(hashId) ? hashId : "dashboard";
  links.forEach((node) => {
    const id = String(node.getAttribute("href") || "").replace(/^#/, "");
    const active = id === activeId;
    node.classList.toggle("is-active", active);
    if (active) {
      node.setAttribute("aria-current", "page");
    } else {
      node.removeAttribute("aria-current");
    }
  });
  document.querySelectorAll("[data-pc-section]").forEach((node) => {
    const id = node.dataset.pcSection || node.id || "";
    node.classList.toggle("is-active-section", id === activeId);
  });
}

function bindOnce(node, eventName, key, listener) {
  if (!node) return;
  const token = `${eventName}:${key}`;
  let tokens = boundPcEvents.get(node);
  if (!tokens) {
    tokens = new Set();
    boundPcEvents.set(node, tokens);
  }
  if (tokens.has(token)) return;
  tokens.add(token);
  node.addEventListener(eventName, listener);
}
