import generatedSurfaceModel from "./generated/oam/dormitory-surface-input-model.generated.json" with { type: "json" };

export const FIRST_GOLDEN_CHAIN_CAPABILITY_ID = "Dormitory.FirstGoldenChain";
export const FIRST_GOLDEN_CHAIN_WORKSPACE_ID = FIRST_GOLDEN_CHAIN_CAPABILITY_ID;
export const ACCEPTED_CAPABILITY_BUNDLE_DIGEST =
  "sha256:8d1db539de418a889ec3e741c921fb0436ef7d7d3ce43ac6f966ebf4e1e13b8e";

export const FIRST_GOLDEN_CHAIN_STEPS = [
  {
    index: 1,
    total: 3,
    cardId: "Dorm.RoomSetupConfirm",
    workItemType: "Dorm.RoomSetupConfirm",
    definitionId: "definition.dormitory.roomSetupConfirm.v1",
    title: { "zh-CN": "1/3 房间配置确认", "ru-RU": "1/3 Подтверждение комнаты", "ky-KG": "1/3 Бөлмө тастыктоо" }
  },
  {
    index: 2,
    total: 3,
    cardId: "Dorm.BedSetupConfirm",
    workItemType: "Dorm.BedSetupConfirm",
    definitionId: "definition.dormitory.bedSetupConfirm.v1",
    title: { "zh-CN": "2/3 床位配置确认", "ru-RU": "2/3 Подтверждение койки", "ky-KG": "2/3 Койка тастыктоо" }
  },
  {
    index: 3,
    total: 3,
    cardId: "Dorm.ResourceReadinessConfirm",
    workItemType: "Dorm.ResourceReadinessConfirm",
    definitionId: "definition.dormitory.resourceReadinessConfirm.v1",
    title: { "zh-CN": "3/3 资源就绪确认", "ru-RU": "3/3 Подтверждение готовности", "ky-KG": "3/3 Даярдык тастыктоо" }
  }
];

const generatedControlsByWorkItem = generatedSurfaceModel.controls.reduce((current, control) => {
  const list = current.get(control.workItemType) || [];
  list.push(control);
  current.set(control.workItemType, list);
  return current;
}, new Map());

const generatedFieldLabels = {
  roomNo: { "zh-CN": "房间号", "ru-RU": "Номер комнаты", "ky-KG": "Бөлмө номери" },
  floor: { "zh-CN": "楼层", "ru-RU": "Этаж", "ky-KG": "Кабат" },
  capacity: { "zh-CN": "床位数", "ru-RU": "Количество коек", "ky-KG": "Койка саны" },
  roomId: { "zh-CN": "所属房间", "ru-RU": "Комната", "ky-KG": "Бөлмө" },
  bedNo: { "zh-CN": "床位号", "ru-RU": "Номер койки", "ky-KG": "Койка номери" },
  bedType: { "zh-CN": "床位类型", "ru-RU": "Тип койки", "ky-KG": "Койка түрү" },
  bedId: { "zh-CN": "床位", "ru-RU": "Койка", "ky-KG": "Койка" },
  readinessState: { "zh-CN": "就绪状态", "ru-RU": "Статус готовности", "ky-KG": "Даярдык абалы" }
};

export function isFirstGoldenChainWorkspaceId(workspaceId = "") {
  const value = String(workspaceId || "");
  return value === FIRST_GOLDEN_CHAIN_WORKSPACE_ID || value.startsWith(`${FIRST_GOLDEN_CHAIN_WORKSPACE_ID}-`);
}

export function isFirstGoldenChainCardId(cardId = "") {
  return FIRST_GOLDEN_CHAIN_STEPS.some((step) => step.cardId === cardId || step.workItemType === cardId);
}

export function isRoomSetupCardId(cardId = "") {
  return cardId === "roomSetup" || cardId === FIRST_GOLDEN_CHAIN_STEPS[0].cardId;
}

export function isBedSetupCardId(cardId = "") {
  return cardId === "bedSetup" || cardId === FIRST_GOLDEN_CHAIN_STEPS[1].cardId;
}

export function isResourceReadinessCardId(cardId = "") {
  return cardId === "roomReadiness" || cardId === FIRST_GOLDEN_CHAIN_STEPS[2].cardId;
}

export function firstGoldenChainStepForCard(cardId = "") {
  return FIRST_GOLDEN_CHAIN_STEPS.find((step) => step.cardId === cardId || step.workItemType === cardId) || null;
}

export function generatedSurfaceControlsForCard(cardId = "") {
  const step = firstGoldenChainStepForCard(cardId);
  return step ? [...(generatedControlsByWorkItem.get(step.workItemType) || [])] : [];
}

export function generatedFieldOrderForCard(cardId = "") {
  return generatedSurfaceControlsForCard(cardId)
    .filter((control) => ["clientSubmitted", "selectedStableRef"].includes(control.classification))
    .map((control) => control.fieldId);
}

export function generatedFieldLabel(fieldId = "", language = "zh-CN") {
  const label = generatedFieldLabels[fieldId];
  return label?.[language] || label?.["zh-CN"] || fieldId;
}

export function generatedControlForField(cardId = "", fieldId = "") {
  return generatedSurfaceControlsForCard(cardId).find((control) => control.fieldId === fieldId) || null;
}

export function defaultBedTypeForCount(count) {
  const value = Number(count);
  return Number.isFinite(value) && value <= 1 ? "whole" : "bunk_pair";
}

export function capabilityCommandCatalog() {
  return [
    {
      templateWorkspaceId: FIRST_GOLDEN_CHAIN_WORKSPACE_ID,
      firstCardId: FIRST_GOLDEN_CHAIN_STEPS[0].cardId,
      title: { "zh-CN": "新增房间", "ru-RU": "Добавить комнату", "ky-KG": "Бөлмө кошуу" },
      subtitle: {
        "zh-CN": "只进入第一金链 accepted capability projection。",
        "ru-RU": "Только accepted projection первой цепочки.",
        "ky-KG": "Биринчи чынжырдын accepted projection гана."
      },
      nextAction: { "zh-CN": "先确认房间号", "ru-RU": "Начать с номера комнаты", "ky-KG": "Бөлмө номеринен баштоо" },
      keywords: ["新增房间", "创建房间", "宿舍建档", "房间建档", "新建房间", "配置房间", "宿舍第一金链", "room setup", "create room", "add room", "new room", "добавить комнату", "создать комнату", "бөлмө кошуу"]
    }
  ];
}

export function runtimeWorkItemMatchesCapabilityCard(item = {}, cardId = "") {
  const candidateCardId = item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.workItemType || item.work_item_type || "";
  return candidateCardId === cardId;
}

export function generatedSurfaceModelDigestRef() {
  return generatedSurfaceModel.outputContentDigest || generatedSurfaceModel.sourceContentDigest || "";
}
