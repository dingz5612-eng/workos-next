export function normalizeAdmissionState(value = {}) {
  return {
    visibleAllowed: value.visibleAllowed !== false,
    prepareAllowed: value.prepareAllowed === true,
    confirmAllowed: value.confirmAllowed === true,
    productionAllowed: value.productionAllowed === true,
    mode: normalizeAdmissionMode(value.mode),
    reason: safeReasonCode(value.reason || value.reasonCode || value.code || ""),
    blockingSources: Array.isArray(value.blockingSources) ? value.blockingSources : [],
    requiredCapabilities: Array.isArray(value.requiredCapabilities) ? value.requiredCapabilities : [],
    requiredDeviceTrust: Array.isArray(value.requiredDeviceTrust) ? value.requiredDeviceTrust : [],
    noGoItems: Array.isArray(value.noGoItems) ? value.noGoItems : [],
    admissionDecisionRef: value.admissionDecisionRef || ""
  };
}

export function admissionStateFromWorkItem(workItem = {}, state = {}) {
  const admission = workItem.admission || workItem.payload?.admission || workItem.Payload?.admission || {};
  const hasExplicitAdmission = Boolean(workItem.admission || workItem.payload?.admission || workItem.Payload?.admission);
  const businessAdmission = state.businessLineAdmission || state.runtimeStore?.businessLineAdmission || {};
  const releaseBlocked = globalProductionBlocked(state);
  const mode = admission.mode || businessAdmission.dormitory?.mode || businessAdmission.dormitory?.surfaceMode || "";
  if (!hasExplicitAdmission) return missingAdmissionState(mode || "contract_preview");
  return normalizeAdmissionState({
    visibleAllowed: admission.visibleAllowed,
    prepareAllowed: admission.prepareAllowed,
    confirmAllowed: admission.confirmAllowed ?? admission.confirm_allowed,
    productionAllowed: releaseBlocked ? false : admission.productionAllowed ?? admission.production_allowed,
    mode: releaseBlocked ? (mode || "internal_pilot_observation") : mode,
    reason: admission.reason || admission.reasonCode || (releaseBlocked ? "business_production_blocked" : "")
  });
}

export function missingAdmissionState(mode = "contract_preview") {
  return normalizeAdmissionState({
    visibleAllowed: true,
    prepareAllowed: false,
    confirmAllowed: false,
    productionAllowed: false,
    mode,
    reason: "missing_admission_contract",
    noGoItems: ["missing_admission_contract"]
  });
}

export function admissionCopy(admission = {}, ctx = {}, prefix = "operations") {
  const normalized = normalizeAdmissionState(admission);
  const labelKey = admissionLabelKey(normalized, prefix);
  const reasonKey = admissionReasonKey(normalized, prefix);
  return {
    labelKey,
    reasonKey,
    label: ctx.tr?.(labelKey) || labelKey,
    reason: ctx.tr?.(reasonKey) || reasonKey,
    modeLabelKey: modeLabelKey(normalized.mode, prefix),
    modeLabel: ctx.tr?.(modeLabelKey(normalized.mode, prefix)) || modeLabelKey(normalized.mode, prefix),
    decision: admissionDecisionCode(normalized),
    normalized
  };
}

export function safeConfirmErrorKey(status) {
  const keyByStatus = {
    400: "operations.error.safe.400",
    403: "operations.error.safe.403",
    409: "operations.error.safe.409",
    422: "operations.error.safe.422"
  };
  return keyByStatus[status] || "operations.error.safe.generic";
}

export function safeConfirmBlockedKey(result = {}) {
  if (result?.reason === "required_field_missing") return "operations.error.safe.422";
  if (/evidence|proof|credential|attachment|material|证据|材料/i.test(String(result?.reason || result?.code || ""))) {
    return "operations.error.safe.422";
  }
  return "operations.error.safe.422";
}

export function safeReasonCode(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-z0-9_.:-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function admissionLabelKey(admission, prefix) {
  if (!admission.visibleAllowed) return `${prefix}.admission.visibleDenied`;
  if (!admission.prepareAllowed) return `${prefix}.admission.visibleOnly`;
  if (!admission.confirmAllowed) return `${prefix}.admission.confirmDenied`;
  if (!admission.productionAllowed) return `${prefix}.admission.productionBlocked`;
  return `${prefix}.admission.confirmAllowed`;
}

function admissionReasonKey(admission, prefix) {
  if (isContractPreview(admission.mode)) return `${prefix}.admission.contractPreview`;
  if (isInternalPilot(admission.mode)) return `${prefix}.admission.internalPilotObservation`;
  if (!admission.productionAllowed) return `${prefix}.admission.productionBlocked`;
  if (!admission.confirmAllowed) return `${prefix}.admission.confirmDenied`;
  if (!admission.prepareAllowed) return `${prefix}.admission.visibleOnly`;
  return `${prefix}.admission.confirmAllowedHelp`;
}

function admissionDecisionCode(admission) {
  if (!admission.visibleAllowed) return "visible_blocked";
  if (!admission.prepareAllowed) return "visible_only";
  if (!admission.confirmAllowed) return "prepare_only_confirm_denied";
  if (!admission.productionAllowed) return "confirm_allowed_production_blocked";
  return "confirm_allowed_production_allowed";
}

function modeLabelKey(mode, prefix) {
  if (isContractPreview(mode)) return `${prefix}.admission.contractPreview`;
  if (isInternalPilot(mode)) return `${prefix}.admission.internalPilotObservation`;
  if (normalizeAdmissionMode(mode) === "production") return `${prefix}.admission.productionMode`;
  return `${prefix}.admission.prepareOnly`;
}

function normalizeAdmissionMode(mode = "") {
  const token = normalizeStructuredToken(mode);
  const map = {
    contract_preview: "contract_preview",
    contract_preview_scope: "contract_preview",
    l0_contract_preview: "contract_preview",
    internal_pilot: "internal_pilot_observation",
    internal_pilot_scope: "internal_pilot_observation",
    internal_pilot_observation: "internal_pilot_observation",
    l1_internal_pilot: "internal_pilot_observation",
    l1_internal_pilot_observation: "internal_pilot_observation",
    prepare_only: "prepare_only",
    production: "production",
    production_allowed: "production"
  };
  return map[token] || token || "prepare_only";
}

function isContractPreview(mode = "") {
  return normalizeAdmissionMode(mode) === "contract_preview";
}

function isInternalPilot(mode = "") {
  return normalizeAdmissionMode(mode) === "internal_pilot_observation";
}

function globalProductionBlocked(state = {}) {
  const currentState = state.currentState || state.releaseState || state.runtimeStore?.currentState || {};
  const businessProduction = currentState.businessProductionState || currentState.businessProduction || currentState.businessProductionStatus || currentState.business_production || "";
  if (isBlockedState(businessProduction)) return true;
  const admission = state.businessLineAdmission || state.runtimeStore?.businessLineAdmission || {};
  return admission.businessProduction?.productionAllowed === false || admission.dormitory?.productionAllowed === false;
}

function isBlockedState(value = "") {
  return ["blocked", "business_production_blocked", "production_blocked"].includes(normalizeStructuredToken(value));
}

function normalizeStructuredToken(value = "") {
  return String(value || "")
    .trim()
    .replaceAll("-", "_")
    .replaceAll(".", "_")
    .replace(/\s+/g, "_")
    .toLocaleLowerCase();
}
