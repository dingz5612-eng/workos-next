import capabilityProjection from "./generated/oam/capability-projection.generated.json" with { type: "json" };
import generatedSurfaceModel from "./generated/oam/dormitory-surface-input-model.generated.json" with { type: "json" };

export const FIRST_GOLDEN_CHAIN_CAPABILITY_ID = capabilityProjection.capabilityId;
export const FIRST_GOLDEN_CHAIN_WORKSPACE_ID = capabilityProjection.workspaceId;
export const ACCEPTED_CAPABILITY_BUNDLE_DIGEST = capabilityProjection.acceptedGeneratedBundleDigest;
export const CAPABILITY_FIELD_CATEGORIES = capabilityProjection.fieldCategories || {};
export const CAPABILITY_DRAFT_POLICY = capabilityProjection.draftPolicy || {};
export const CAPABILITY_BUSINESS_UI = capabilityProjection.businessUi || {};

export const FIRST_GOLDEN_CHAIN_STEPS = (capabilityProjection.steps || []).map((step) => ({
  index: step.index,
  total: step.total,
  cardId: step.cardId,
  workItemType: step.workItemType,
  definitionId: step.definitionId,
  title: step.title
}));

const generatedControlsByWorkItem = generatedSurfaceModel.controls.reduce((current, control) => {
  const list = current.get(control.workItemType) || [];
  list.push(control);
  current.set(control.workItemType, list);
  return current;
}, new Map());

const generatedFieldLabels = capabilityProjection.fieldLabels || {};
const generatedFieldsByCard = (capabilityProjection.steps || []).reduce((current, step) => {
  current.set(step.cardId, step.fields || []);
  current.set(step.workItemType, step.fields || []);
  return current;
}, new Map());

export function isFirstGoldenChainWorkspaceId(workspaceId = "") {
  const value = String(workspaceId || "");
  return value === FIRST_GOLDEN_CHAIN_WORKSPACE_ID || value.startsWith(`${FIRST_GOLDEN_CHAIN_WORKSPACE_ID}-`);
}

export function isFirstGoldenChainCardId(cardId = "") {
  return FIRST_GOLDEN_CHAIN_STEPS.some((step) => step.cardId === cardId || step.workItemType === cardId);
}

export function isRoomSetupCardId(cardId = "") {
  return cardId === FIRST_GOLDEN_CHAIN_STEPS[0]?.cardId ||
    (capabilityProjection.legacyRegressionAliases?.roomSetupCardIds || []).includes(cardId);
}

export function isBedSetupCardId(cardId = "") {
  return cardId === FIRST_GOLDEN_CHAIN_STEPS[1]?.cardId ||
    (capabilityProjection.legacyRegressionAliases?.bedSetupCardIds || []).includes(cardId);
}

export function isResourceReadinessCardId(cardId = "") {
  return cardId === FIRST_GOLDEN_CHAIN_STEPS[2]?.cardId ||
    (capabilityProjection.legacyRegressionAliases?.resourceReadinessCardIds || []).includes(cardId);
}

export function firstGoldenChainStepForCard(cardId = "") {
  return FIRST_GOLDEN_CHAIN_STEPS.find((step) => step.cardId === cardId || step.workItemType === cardId) || null;
}

export function generatedSurfaceControlsForCard(cardId = "") {
  const step = firstGoldenChainStepForCard(cardId);
  return step ? [...(generatedControlsByWorkItem.get(step.workItemType) || [])] : [];
}

export function generatedFieldOrderForCard(cardId = "") {
  const fields = generatedFieldsByCard.get(cardId) || [];
  if (fields.length) {
    return fields
      .filter((field) => field.fieldCategory !== "plannedFields" && field.fieldCategory !== "evidenceFields")
      .map((field) => field.fieldId);
  }
  return generatedSurfaceControlsForCard(cardId)
    .filter((control) => ["clientSubmitted", "selectedStableRef", "systemDerived"].includes(control.classification))
    .map((control) => control.fieldId);
}

export function generatedFieldLabel(fieldId = "", language = "zh-CN") {
  const label = generatedFieldLabels[fieldId];
  return label?.[language] || label?.["zh-CN"] || fieldId;
}

export function generatedControlForField(cardId = "", fieldId = "") {
  return generatedSurfaceControlsForCard(cardId).find((control) => control.fieldId === fieldId) || null;
}

export function generatedCapabilityFieldForCard(cardId = "", fieldId = "") {
  return (generatedFieldsByCard.get(cardId) || []).find((field) => field.fieldId === fieldId) || null;
}

export function isSystemDerivedCapabilityField(cardId = "", fieldId = "") {
  const field = generatedCapabilityFieldForCard(cardId, fieldId);
  return field?.userSubmitted === false || field?.fieldCategory === "systemDerivedFields";
}

export function isUserSubmittedCapabilityField(cardId = "", fieldId = "") {
  const field = generatedCapabilityFieldForCard(cardId, fieldId);
  return field ? field.userSubmitted === true : true;
}

export function draftableCapabilityFieldIds(cardId = "") {
  return (generatedFieldsByCard.get(cardId) || [])
    .filter((field) => field.userSubmitted === true)
    .map((field) => field.fieldId);
}

export function capabilitySubmitLabelKey(cardId = "", mode = "runtime-test-only") {
  if (mode === "business-landing") return `capabilitySubmit.${cardId}`;
  return "capabilitySubmit.runtimeTestOnly";
}

export function defaultBedTypeForCount(count) {
  const value = Number(count);
  const defaults = capabilityProjection.optionSetDefaults?.bunkType || {};
  return Number.isFinite(value) && value <= 1 ? defaults.oneBed : defaults.multiBed;
}

export function capabilityCommandCatalog() {
  return (capabilityProjection.commandCatalog || []).map((command) => ({
    templateWorkspaceId: command.templateWorkspaceId,
    firstCardId: command.firstCardId,
    title: command.title,
    subtitle: command.subtitle,
    nextAction: command.nextAction,
    keywords: [...(command.keywords || [])]
  }));
}

export function runtimeWorkItemMatchesCapabilityCard(item = {}, cardId = "") {
  const candidateCardId = item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.workItemType || item.work_item_type || "";
  return candidateCardId === cardId;
}

export function generatedSurfaceModelDigestRef() {
  return generatedSurfaceModel.outputContentDigest || generatedSurfaceModel.sourceContentDigest || "";
}
