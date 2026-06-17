import { loadCompletedRecordSnapshot } from "./operationDrafts.js";
import {
  capabilityCommandCatalog,
  DORMITORY_SCENARIO1_STEPS,
  generatedFieldLabel,
  generatedSurfaceControlsForCard,
  isDormitoryScenario1WorkspaceId
} from "./capabilityProjection.js";
import { isTerminalCardStatus } from "./selectors/workspaceSelectors.js";

export function resolveReadonlyCompletedRecordFromRoute(state = {}) {
  return projectedReadonlyCompletedRecord(state) || cachedReadonlyCompletedRecord(state);
}

function projectedReadonlyCompletedRecord(state = {}) {
  const workspace = (state.runtimeStore?.workspaces || []).find((entry) => entry.id === state.selectedWorkspace);
  const card = (workspace?.cards || []).find((entry) => entry.id === state.selectedCardId);
  if (!workspace || !card || !isTerminalCardStatus(card.status)) return null;
  return { workspace, card };
}

function cachedReadonlyCompletedRecord(state = {}) {
  const workspaceId = state.selectedWorkspace || "";
  const cardId = state.selectedCardId || "";
  if (!workspaceId || !cardId || !isDormitoryScenario1WorkspaceId(workspaceId)) return null;
  const selectedSnapshot = loadCompletedRecordSnapshot(workspaceId, cardId, {
    workItemId: state.selectedWorkItemId || ""
  });
  if (!selectedSnapshot) return null;

  const catalog = capabilityCommandCatalog()[0] || {};
  const cards = DORMITORY_SCENARIO1_STEPS.map((step) => cachedReadonlyCard(workspaceId, step, selectedSnapshot, state));
  const selectedCard = cards.find((entry) => entry.id === cardId);
  if (!selectedCard || !isTerminalCardStatus(selectedCard.status)) return null;

  const workspace = {
    id: workspaceId,
    domain: "stay",
    caseId: selectedSnapshot.caseId || `case:${workspaceId}`,
    title: catalog.title || { "zh-CN": "新建房间和床位" },
    summary: catalog.subtitle || { "zh-CN": "房间建档、确认床位信息和完成基础检查" },
    next: catalog.nextAction || { "zh-CN": "查看已完成记录" },
    blockers: [],
    readonlyRecordSource: "mobile_completed_record_read_cache",
    cards
  };
  return { workspace, card: selectedCard };
}

function cachedReadonlyCard(workspaceId, step = {}, selectedSnapshot = {}, state = {}) {
  const snapshot = loadCompletedRecordSnapshot(workspaceId, step.cardId) ||
    (step.cardId === selectedSnapshot.cardId ? selectedSnapshot : null);
  const isSelected = step.cardId === state.selectedCardId;
  const status = snapshot || isSelected ? "done" : "notStarted";
  return {
    id: step.cardId,
    status,
    workItemId: snapshot?.workItemId || (isSelected ? state.selectedWorkItemId || selectedSnapshot.workItemId || "" : ""),
    title: localizedStepTitle(step),
    fields: { business: generatedReadonlyFieldsForCard(step.cardId), system: [], analytics: [] },
    values: snapshot?.values || {},
    evidence: cachedEvidence(snapshot),
    checks: [],
    blockerRules: [],
    confirmation: { required: true, requiredRole: "operator", policyRef: "operations-runtime-policy" },
    readonlyRecordSource: snapshot?.source || ""
  };
}

function generatedReadonlyFieldsForCard(cardId = "") {
  return generatedSurfaceControlsForCard(cardId)
    .filter((control) => control.userSubmitted === true)
    .map((control) => ({
      id: control.fieldId,
      label: localizedFieldLabel(control.fieldId),
      required: control.required === true,
      type: control.controlType || "text",
      ui: {
        control: control.controlType || "text",
        optionSet: control.optionSet || "",
        options: [],
        defaultValue: control.defaultValue || "",
        readonly: true
      }
    }));
}

function localizedFieldLabel(fieldId = "") {
  return {
    "zh-CN": generatedFieldLabel(fieldId, "zh-CN") || fieldId,
    "ru-RU": generatedFieldLabel(fieldId, "ru-RU") || generatedFieldLabel(fieldId, "zh-CN") || fieldId,
    "ky-KG": generatedFieldLabel(fieldId, "ky-KG") || generatedFieldLabel(fieldId, "zh-CN") || fieldId
  };
}

function localizedStepTitle(step = {}) {
  return {
    "zh-CN": step.title?.["zh-CN"] || "",
    "ru-RU": step.title?.["ru-RU"] || step.title?.["zh-CN"] || "",
    "ky-KG": step.title?.["ky-KG"] || step.title?.["zh-CN"] || ""
  };
}

function cachedEvidence(snapshot = null) {
  if (!snapshot) return [];
  const fromDrafts = (snapshot.evidenceDrafts || [])
    .map((entry, index) => evidenceLabel(entry, index))
    .filter(Boolean);
  if (fromDrafts.length) return fromDrafts;
  return (snapshot.evidenceIds || []).map((_, index) => genericEvidenceLabel(index));
}

function evidenceLabel(entry = {}, index = 0) {
  const label = entry.label || entry.title || entry.fileName || entry.name || entry.evidenceType || "";
  if (!label) return genericEvidenceLabel(index);
  return {
    id: entry.evidenceId || entry.id || `completed-evidence-${index + 1}`,
    label: typeof label === "object" ? label : {
      "zh-CN": String(label),
      "ru-RU": String(label),
      "ky-KG": String(label)
    }
  };
}

function genericEvidenceLabel(index = 0) {
  const suffix = String(index + 1);
  return {
    id: `completed-evidence-${suffix}`,
    label: {
      "zh-CN": `已绑定材料 ${suffix}`,
      "ru-RU": `Связанный материал ${suffix}`,
      "ky-KG": `Байланган материал ${suffix}`
    }
  };
}
