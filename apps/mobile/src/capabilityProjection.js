import mainlineControl from "./generated/oam/dormitory-13-scenario-control.generated.json" with { type: "json" };
import scenarioOneMirror from "./generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json" with { type: "json" };
import generatedSurfaceModel from "./generated/oam/dormitory-surface-input-model.generated.json" with { type: "json" };

export const DORMITORY_MAINLINE_AUTHORITY_ID = mainlineControl.authorityId;
export const DORMITORY_MAINLINE_WORKSPACE_ID = "W-DORM-MAINLINE";
export const DORMITORY_SCENARIO1_ID = scenarioOneMirror.scenarioId;
export const DORMITORY_SCENARIO1_NAME = scenarioOneMirror.nameZh;
export const DORMITORY_SCENARIO1_STEPS = (scenarioOneMirror.steps || []).map((step) => ({
  index: step.stepNo,
  total: scenarioOneMirror.steps?.length || 0,
  cardId: currentRouteCardId(step.commandId),
  workItemType: step.commandId,
  definitionId: `definition.dormitory.${step.stepId}.v1`,
  title: { "zh-CN": step.commandBusinessNameZh || step.nameZh }
}));

export const ACCEPTED_MAINLINE_DIGEST = mainlineControl.outputContentDigest;
export const MAINLINE_FIELD_CATEGORIES = scenarioOneMirror.fields || {};
export const MAINLINE_DRAFT_POLICY = { editableUntilConfirmed: true };
export const MAINLINE_BUSINESS_UI = { technicalDetailsDefaultExpanded: false };

const generatedControlsByWorkItem = generatedSurfaceModel.controls.reduce((current, control) => {
  const list = current.get(control.workItemType) || [];
  list.push(control);
  current.set(control.workItemType, list);
  return current;
}, new Map());

const generatedFieldsByCard = (scenarioOneMirror.steps || []).reduce((current, step) => {
  const fields = [
    ...(step.userFilledFields || []),
    ...(step.userSelectedFields || [])
  ].map((fieldId) => ({ fieldId, userSubmitted: true, fieldCategory: "businessFields" }));
  for (const systemField of step.systemGeneratedFields || []) {
    fields.push({ fieldId: systemField, userSubmitted: false, fieldCategory: "systemGeneratedFields" });
  }
  current.set(currentRouteCardId(step.commandId), fields);
  current.set(step.commandId, fields);
  return current;
}, new Map());

function currentRouteCardId(commandId = "") {
  const suffix = String(commandId || "").split(".").filter(Boolean).pop() || "";
  return suffix ? `cert.${suffix.charAt(0).toLowerCase()}${suffix.slice(1)}` : "";
}

export function isDormitoryScenario1WorkspaceId(workspaceId = "") {
  const value = String(workspaceId || "");
  return value === DORMITORY_MAINLINE_WORKSPACE_ID || value.startsWith(`${DORMITORY_MAINLINE_WORKSPACE_ID}-`);
}

export function isDormitoryScenario1CardId(cardId = "") {
  return DORMITORY_SCENARIO1_STEPS.some((step) => step.cardId === cardId || step.workItemType === cardId);
}

export function isRoomSetupCardId(cardId = "") {
  return cardId === DORMITORY_SCENARIO1_STEPS[0]?.cardId;
}

export function isBedSetupCardId(cardId = "") {
  return cardId === DORMITORY_SCENARIO1_STEPS[1]?.cardId;
}

export function isResourceReadinessCardId(cardId = "") {
  return cardId === DORMITORY_SCENARIO1_STEPS[2]?.cardId;
}

export function dormitoryScenario1StepForCard(cardId = "") {
  return DORMITORY_SCENARIO1_STEPS.find((step) => step.cardId === cardId || step.workItemType === cardId) || null;
}

export function generatedSurfaceControlsForCard(cardId = "") {
  const step = dormitoryScenario1StepForCard(cardId);
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

export function generatedFieldLabel(fieldId = "") {
  const labels = {
    floor: "楼层",
    roomNo: "房间号",
    bedCount: "床位数量",
    roomRemark: "房间备注",
    bedType: "床型",
    bedRemark: "床位备注",
    specialNotes: "特殊说明",
    basicCheckResult: "基础检查结果",
    cleaningBasicCheckResult: "保洁基础检查结果",
    facilityBasicCheckResult: "设施基础检查结果",
    safetyBasicCheckResult: "安全基础检查结果",
    basicReadinessRemark: "备注",
    buildingContextRef: "楼栋/区域",
    bedEnabledStatus: "床位启用状态",
    bedTypeBatchSetting: "床型批量设置",
    basicReadinessConclusion: "基础就绪结论"
  };
  return labels[fieldId] || fieldId;
}

export function generatedControlForField(cardId = "", fieldId = "") {
  return generatedSurfaceControlsForCard(cardId).find((control) => control.fieldId === fieldId) || null;
}

export function generatedCapabilityFieldForCard(cardId = "", fieldId = "") {
  return (generatedFieldsByCard.get(cardId) || []).find((field) => field.fieldId === fieldId) || null;
}

export function isSystemDerivedCapabilityField(cardId = "", fieldId = "") {
  const field = generatedCapabilityFieldForCard(cardId, fieldId);
  return field?.userSubmitted === false || field?.fieldCategory === "systemGeneratedFields";
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

export function capabilitySubmitLabelKey(cardId = "", mode = "default-submit") {
  if (mode === "business-landing") return `capabilitySubmit.${cardId}`;
  return "capabilitySubmit.runtimeTestOnly";
}

export function defaultBedTypeForCount(count) {
  const value = Number(count);
  return Number.isFinite(value) && value <= 1 ? "whole" : "bunk_pair";
}

export function capabilityCommandCatalog() {
  const firstStep = DORMITORY_SCENARIO1_STEPS[0] || {};
  return [{
    templateWorkspaceId: DORMITORY_MAINLINE_WORKSPACE_ID,
    firstCardId: firstStep.cardId || "",
    title: {
      "zh-CN": scenarioOneMirror.nameZh,
      "ru-RU": "Паспорт жилья и базовая готовность",
      "ky-KG": "Турак жайды каттоо жана базалык даярдык"
    },
    subtitle: {
      "zh-CN": scenarioOneMirror.businessGoalZh,
      "ru-RU": "Завести комнату, подтвердить группу коек и базовую готовность без перехода к ценам или брони.",
      "ky-KG": "Бөлмөнү каттап, койка тобун жана базалык даярдыкты баа же бронго өтпөй тастыктоо."
    },
    nextAction: {
      "zh-CN": "发起房源建档与基础就绪",
      "ru-RU": "Начать заполнение",
      "ky-KG": "Толтурууну баштоо"
    },
    keywords: [
      "房源建档",
      "房源建档与基础就绪",
      "房间建档",
      "床位组确认",
      "基础就绪确认",
      "住宿经营",
      "добавить комнату",
      "готовность комнаты",
      "бөлмө кошуу",
      "базалык даярдык"
    ]
  }];
}

export function runtimeWorkItemMatchesCapabilityCard(item = {}, cardId = "") {
  const candidateCardId = item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.workItemType || item.work_item_type || "";
  return candidateCardId === cardId;
}

export function generatedSurfaceModelDigestRef() {
  return generatedSurfaceModel.outputContentDigest || generatedSurfaceModel.sourceContentDigest || "";
}
