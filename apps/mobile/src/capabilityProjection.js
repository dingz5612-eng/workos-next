import mainlineControl from "./generated/oam/dormitory-13-scenario-control.generated.json" with { type: "json" };
import scenarioOneMirror from "./generated/oam/dormitory-scenario1-resource-basic-readiness.generated.json" with { type: "json" };
import generatedSurfaceModel from "./generated/oam/dormitory-surface-input-model.generated.json" with { type: "json" };
import capabilityProjection from "./generated/oam/capability-projection.generated.json" with { type: "json" };
import { businessDisplayZh } from "./businessDisplayLanguage.js";

export const DORMITORY_MAINLINE_AUTHORITY_ID = mainlineControl.authorityId;
export const FIRST_GOLDEN_CHAIN_WORKSPACE_ID = capabilityProjection.workspaceId;
export const DORMITORY_MAINLINE_WORKSPACE_ID = "W-DORM-MAINLINE";
export const DORMITORY_SCENARIO1_ID = scenarioOneMirror.scenarioId;
export const DORMITORY_SCENARIO1_NAME = scenarioOneMirror.nameZh;
export const DORMITORY_SCENARIO1_STEPS = (scenarioOneMirror.steps || []).map((step) => ({
  index: step.stepNo,
  total: scenarioOneMirror.steps?.length || 0,
  cardId: currentRouteCardId(step.commandId),
  workItemType: step.commandId,
  definitionId: `definition.dormitory.${step.stepId}.v1`,
  title: generatedRouteStepTitle(step.commandId, step.commandBusinessNameZh || step.nameZh)
}));

export const ACCEPTED_MAINLINE_DIGEST = mainlineControl.outputContentDigest;
export const MAINLINE_ENTRY_ADMISSION_CONTRACT = mainlineControl.entryAdmissionContract || {};
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
  const generatedSystemDerivedFields = generatedSurfaceModel.controls
    .filter((control) => control.workItemType === step.commandId)
    .filter((control) => control.userSubmitted === false && control.classification === "systemDerived")
    .filter((control) => control.hiddenSubmitOnly !== true && control.controlType !== "hidden")
    .map((control) => ({
      fieldId: canonicalSurfaceFieldId(control.fieldId),
      userSubmitted: false,
      fieldCategory: control.fieldCategory || "systemDerivedFields"
    }));
  const userFields = [
    ...(step.userFilledFields || []),
    ...(step.userSelectedFields || [])
  ].map((fieldId) => ({ fieldId: canonicalSurfaceFieldId(fieldId), userSubmitted: true, fieldCategory: "businessFields" }));
  const fields = [
    ...generatedSystemDerivedFields,
    ...userFields
  ];
  for (const systemField of step.systemGeneratedFields || []) {
    fields.push({ fieldId: canonicalSurfaceFieldId(systemField), userSubmitted: false, fieldCategory: "systemGeneratedFields" });
  }
  const uniqueFields = fields.filter((field, index, all) => all.findIndex((candidate) => candidate.fieldId === field.fieldId) === index);
  current.set(currentRouteCardId(step.commandId), uniqueFields);
  current.set(step.commandId, uniqueFields);
  return current;
}, new Map());

function canonicalSurfaceFieldId(fieldId = "") {
  return {
    capacity: "bedCount",
    roomId: "roomRef",
    basicReadinessConclusion: "readinessState"
  }[fieldId] || fieldId;
}

function currentRouteCardId(commandId = "") {
  const suffix = String(commandId || "").split(".").filter(Boolean).pop() || "";
  return suffix ? `cert.${suffix.charAt(0).toLowerCase()}${suffix.slice(1)}` : "";
}

function generatedRouteStepTitle(commandId = "", fallbackZh = "") {
  const generatedStep = (capabilityProjection.steps || []).find((step) =>
    step.workItemType === commandId || step.cardId === commandId);
  const generatedTitle = generatedStep?.title || {};
  const fallback = businessDisplayZh(fallbackZh);
  return {
    "zh-CN": stripStepOrdinal(generatedTitle["zh-CN"]) || fallback,
    "ru-RU": stripStepOrdinal(generatedTitle["ru-RU"]) || stripStepOrdinal(generatedTitle["zh-CN"]) || fallback,
    "ky-KG": stripStepOrdinal(generatedTitle["ky-KG"]) || stripStepOrdinal(generatedTitle["zh-CN"]) || fallback
  };
}

function stripStepOrdinal(value = "") {
  return String(value || "").replace(/^\s*\d+\s*\/\s*\d+\s+/, "").trim();
}

export function isDormitoryScenario1WorkspaceId(workspaceId = "") {
  const value = String(workspaceId || "");
  return value === DORMITORY_MAINLINE_WORKSPACE_ID || value.startsWith(`${DORMITORY_MAINLINE_WORKSPACE_ID}-`);
}

export function isDormitoryScenario1CardId(cardId = "") {
  return DORMITORY_SCENARIO1_STEPS.some((step) => step.cardId === cardId || step.workItemType === cardId);
}

export function isRoomSetupCardId(cardId = "") {
  return isScenario1StepCard(cardId, 0);
}

export function isBedSetupCardId(cardId = "") {
  return isScenario1StepCard(cardId, 1);
}

export function isResourceReadinessCardId(cardId = "") {
  return isScenario1StepCard(cardId, 2);
}

function isScenario1StepCard(cardId = "", index = -1) {
  const step = DORMITORY_SCENARIO1_STEPS[index];
  return step ? step.cardId === cardId || step.workItemType === cardId : false;
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

export function generatedFieldLabel(fieldId = "", lang = "zh-CN") {
  const canonicalFieldId = canonicalSurfaceFieldId(fieldId);
  const generated = capabilityProjection.fieldLabels?.[canonicalFieldId];
  if (typeof generated === "string") return generated;
  if (generated?.[lang]) return generated[lang];
  if (generated?.["zh-CN"]) return generated["zh-CN"];
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
  return labels[canonicalFieldId] || canonicalFieldId;
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
    searchProjectionWorkspaceId: FIRST_GOLDEN_CHAIN_WORKSPACE_ID,
    firstCardId: firstStep.cardId || "",
    title: {
      "zh-CN": businessDisplayZh(scenarioOneMirror.nameZh),
      "ru-RU": "Паспорт жилья и базовая готовность",
      "ky-KG": "Турак жайды каттоо жана базалык даярдык"
    },
    subtitle: {
      "zh-CN": "填写房间信息、确认床位、完成基础检查；不涉及营业、价格或预订。",
      "ru-RU": "Завести комнату, подтвердить группу коек и базовую готовность без перехода к ценам или брони.",
      "ky-KG": "Бөлмөнү каттап, койка тобун жана базалык даярдыкты баа же бронго өтпөй тастыктоо."
    },
    nextAction: {
      "zh-CN": "开始新建房间和床位",
      "ru-RU": "Начать заполнение",
      "ky-KG": "Толтурууну баштоо"
    },
    keywords: currentCommandKeywords([
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
    ])
  }];
}

export function capabilitySearchProjectionPolicy() {
  return capabilityProjection.searchProjection || {};
}

export function isGeneratedObjectSearchQuery(query = "") {
  const policy = capabilitySearchProjectionPolicy();
  if (policy.objectQueriesStartCommand !== false) return false;
  const normalized = normalizeSearchObjectQuery(query);
  if (!normalized) return false;
  const examples = (policy.objectQueryExamples || []).map(normalizeSearchObjectQuery).filter(Boolean);
  if (examples.includes(normalized)) return true;
  if (policy.ordinaryRoomQueryStartsCommand === false && looksLikeRoomObjectQuery(normalized)) return true;
  return false;
}

function normalizeSearchObjectQuery(value = "") {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[，。；、,.!?！？:：;；/\\|()[\]{}"'`~]/g, "")
    .replace(/\s+/g, "");
}

function looksLikeRoomObjectQuery(value = "") {
  return (/^[a-z]?\d+[a-z]?$/.test(value) && value.length >= 2) ||
    (/^\d+房间$/.test(value)) ||
    (/^[a-z]\d+房间$/.test(value));
}

function currentCommandKeywords(fallback = []) {
  const generated = capabilityProjection.commandCatalog?.[0]?.keywords || [];
  return Array.from(new Set([...fallback, ...generated].filter(Boolean)));
}

export function mainlineScenarioCatalog() {
  return (mainlineControl.scenarios || []).map((scenario) => ({
    scenarioNo: scenario.scenarioNo,
    scenarioId: scenario.scenarioId,
    nameZh: scenario.nameZh,
    pageEntries: scenario.pageEntries || [],
    title: { "zh-CN": businessDisplayZh(scenario.nameZh) },
    subtitle: { "zh-CN": scenario.summaryOutputs?.join("、") || "来自住宿经营 13 场景总控" },
    status: { "zh-CN": "只读入口" },
    nextAction: { "zh-CN": scenario.scenarioNo === 1 ? "开始新建房间和床位" : "查看相关工作项" },
    keywords: scenarioKeywords(scenario)
  }));
}

function scenarioKeywords(scenario = {}) {
  const words = [
    scenario.nameZh,
    businessDisplayZh(scenario.nameZh),
    scenario.scenarioId,
    `场景${scenario.scenarioNo}`,
    `场景 ${scenario.scenarioNo}`
  ].filter(Boolean);
  return Array.from(new Set(words));
}

export function runtimeWorkItemMatchesCapabilityCard(item = {}, cardId = "") {
  const candidateCardId = item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.workItemType || item.work_item_type || "";
  return candidateCardId === cardId;
}

export function generatedSurfaceModelDigestRef() {
  return generatedSurfaceModel.outputContentDigest || generatedSurfaceModel.sourceContentDigest || "";
}
