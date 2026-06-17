import { generatedBedLabelsForCount, splitBedLabels } from "./controls/bedLabelControls.js";
import { capacityForRoomType, defaultValueForField, fieldControlKind } from "./controls/fieldControls.js";
import {
  defaultBedTypeForCount,
  generatedFieldLabel,
  generatedSurfaceControlsForCard,
  isBedSetupCardId,
  isDormitoryScenario1CardId,
  isResourceReadinessCardId
} from "./capabilityProjection.js";
import { isScopedResourceFieldRequired, isScopedResourceFieldVisible } from "./controls/resourceScopeControls.js";
import { loadCompletedRecordSnapshots, loadDraft } from "./operationDrafts.js";
import { operationFieldId } from "./operationFieldKernel.js";
import { contextReferenceDisplayValue, generatedContextValue } from "./operationSystemValues.js";
import { isUnsafeLedgerCarryForward } from "./selectors/surfaceSelectors.js";
import { isTerminalCardStatus } from "./selectors/workspaceSelectors.js";
import {
  contextContractSummary,
  fieldContextRole,
  fieldRequiresUserAction,
  fieldVisibleByContext,
  isBackendDefaultField,
  isContextCarriedField,
  isDerivedContextField
} from "./systemContextContract.js";

export function operationInputFields(card, ctx, item = null) {
  const generatedFields = generatedOperationInputFields(card, ctx);
  const sourceFields = generatedFields.length ? generatedFields : (card.fields?.business || []);
  return sourceFields.filter((field) => operationFieldVisible(field, card, item, ctx));
}

export function operationValue(field, item, card, ctx) {
  return operationFieldState(field, item, card, ctx).value;
}

export function fieldSourceState(field, item, card, ctx) {
  return operationFieldState(field, item, card, ctx);
}

export function operationFieldState(field, item, card, ctx) {
  const draft = item ? loadDraft(item.id, card.id) : { values: {} };
  const values = draft.values || {};
  const fieldId = operationFieldId(field);
  if (isBackendDefaultField(card?.id, fieldId)) {
    return { value: backendDefaultValue(fieldId, ctx), displayValue: backendDefaultDisplayValue(fieldId, ctx), source: "backendDefault" };
  }
  if (isContextCarriedField(card?.id, fieldId) || isForcedCaseContextReadonlyField(fieldId, card)) {
    const carried = carriedForwardValue(field, item, card, values, ctx);
    if (carried) return { value: carried.value, displayValue: carried.displayValue, source: "caseContext" };
    return { value: "", displayValue: "", source: "missingContext" };
  }
  if (isBedSetupCardId(card?.id) && fieldId === "bedLabels") {
    const bedCount = carriedForwardValue({ id: "bedCount", label: { "zh-CN": "床位数" } }, item, card, values, ctx)?.value || values.bedCount || "";
    return { value: generatedBedLabelsForCount(bedCount), source: "derived" };
  }
  if (isBedSetupCardId(card?.id) && fieldId === "bedType") {
    return bedSetupGenerationModeState(field, item, card, values, ctx);
  }
  if (field?.classification === "contextReadonly" && fieldId === "buildingContextRef") {
    const contextValue = values.buildingContextRef || values.buildingName || item?.buildingContextRef || item?.buildingName || "当前楼栋/区域";
    return { value: contextValue, displayValue: contextValue, source: "caseContext" };
  }
  if (values[fieldId]) return { value: values[fieldId], source: "draft" };
  if (values[field.id]) return { value: values[field.id], source: "draft" };
  if (fieldId === "amount") {
    const derivedAmount = derivedChargeAmount(item, ctx, values);
    if (derivedAmount) return { value: derivedAmount, source: "derived" };
  }
  if (fieldId === "refundAmount") {
    const derivedRefundAmount = generatedContextValue("refundAmount", values, {
      workspace: item,
      card,
      payloads: sameWorkspaceEvents(item, ctx),
      currentValues: values
    }, { preferDirect: false });
    if (derivedRefundAmount?.value) return { value: derivedRefundAmount.value, source: "derived" };
  }
  if (isDerivedContextField(card?.id, fieldId)) return { value: values[fieldId] || "", source: "derived" };
  if (!fieldContextRole(card?.id, fieldId).contract && isCaseContextIdentityField(fieldId)) {
    const carried = carriedForwardValue(field, item, card, values, ctx);
    if (carried) return { value: carried.value, displayValue: carried.displayValue, source: "caseContext" };
  }
  if (field.ui?.derivedFrom === "roomType") {
    const roomType = Object.entries(values).find(([, candidate]) => ["single", "double", "four_bed", "six_bed", "单人间", "双人间", "四人间", "六人间"].includes(candidate))?.[1] || "four_bed";
    return { value: capacityForRoomType(roomType), source: "derived" };
  }
  return { value: defaultValueForField(field), source: "default" };
}

export function operationFieldRequired(field, card, item, ctx) {
  const fieldId = operationFieldId(field);
  if (isBedSetupCardId(card?.id) && ["bedStatus", "bedNo", "bedLabel"].includes(fieldId)) return false;
  const values = operationDraftValues(item, card);
  const contextRequired = fieldRequiresUserAction(card?.id, fieldId, Boolean(field.required));
  if (isResourceReadinessCardId(card?.id) && fieldId === "basicReadinessRemark") {
    return values.readinessState === "needs_supplement";
  }
  return isScopedResourceFieldRequired(card?.id, fieldId, values, contextRequired);
}

export function operationFieldVisible(field, card, item, ctx) {
  const fieldId = operationFieldId(field);
  const values = operationDraftValues(item, card);
  if (isDormitoryScenario1CardId(card?.id) && isCaseContextIdentityField(fieldId) && fieldId !== "roomRef") return false;
  if (isBedSetupCardId(card?.id) && ["bedStatus", "bedNo", "bedLabel"].includes(fieldId)) return false;
  if (!fieldVisibleByContext(card?.id, fieldId)) return false;
  if (isResourceReadinessCardId(card?.id) && fieldId === "basicReadinessRemark") {
    return values.readinessState === "needs_supplement" || Boolean(values.basicReadinessRemark);
  }
  const fallbackVisible = operationFieldRequired(field, card, item, ctx) ||
    !["备注", "补充说明", "异议说明"].includes(ctx.localTerm(field, "zh-CN"));
  return isScopedResourceFieldVisible(card?.id, fieldId, values, fallbackVisible);
}

export function operationDraftValues(item, card) {
  return item ? loadDraft(item.id, card.id).values || {} : {};
}

export function currentMissingRequiredLabels(card, item, ctx) {
  const validation = ctx.state.fieldValidation || {};
  if (validation.workspaceId === item.id && validation.cardId === card.id && validation.missingLabels?.length) {
    return filteredValidationMissingLabels(validation, card, item, ctx);
  }
  return operationInputFields(card, ctx, item)
    .filter((field) => operationFieldRequired(field, card, item, ctx))
    .filter((field) => !hasRequiredFieldValue(field, item, card, ctx))
    .map((field) => ctx.localTerm(field));
}

export function currentMissingContextLabels(card, item, ctx) {
  const validation = ctx.state.fieldValidation || {};
  if (validation.workspaceId === item.id && validation.cardId === card.id && validation.missingContextLabels?.length) {
    return validation.missingContextLabels;
  }
  const fields = card.fields?.business || [];
  const fieldById = new Map(fields.map((field) => [operationFieldId(field), field]));
  return contextContractSummary(card?.id).inherited
    .map((fieldId) => {
      const field = fieldById.get(fieldId) || syntheticContextField(fieldId, ctx);
      return hasCarryValue(operationFieldState(field, item, card, ctx).value) ? "" : contextFieldLabel(field, fieldId, ctx);
    })
    .filter(Boolean);
}

export function stepDependencyValidationChips(card, item, ctx) {
  const summary = contextContractSummary(card?.id);
  if (!summary.inherited.length && !summary.derived.length && !summary.backend.length) return [];
  const fields = card.fields?.business || [];
  const fieldById = new Map(fields.map((field) => [operationFieldId(field), field]));
  const inheritedMissing = summary.inherited
    .map((fieldId) => {
      const field = fieldById.get(fieldId) || { id: fieldId, label: { "zh-CN": fieldId } };
      return hasCarryValue(operationFieldState(field, item, card, ctx).value) ? "" : ctx.localTerm(field);
    })
    .filter(Boolean);
  const userMissing = summary.user
    .map((fieldId) => {
      const field = fieldById.get(fieldId);
      if (!field || !operationFieldRequired(field, card, item, ctx)) return "";
      return hasRequiredFieldValue(field, item, card, ctx) ? "" : ctx.localTerm(field);
    })
    .filter(Boolean);
  const derivedReady = summary.derived.length
    ? summary.derived.every((fieldId) => {
      const field = fieldById.get(fieldId) || { id: fieldId, label: { "zh-CN": fieldId } };
      if (fieldId === "bedLabels") {
        const bedCount = Number(operationFieldState(fieldById.get("bedCount") || { id: "bedCount", label: { "zh-CN": "床位数" } }, item, card, ctx).value || 0);
        const labels = splitBedLabels(operationFieldState(field, item, card, ctx).value);
        return labels.length === bedCount && bedCount > 0;
      }
      return true;
    })
    : true;
  return [
    `${ctx.tr("systemInheritedCheck")}: ${inheritedMissing.length ? inheritedMissing.join(" · ") : ctx.tr("systemCheckReady")}`,
    `${ctx.tr("systemDerivedCheck")}: ${derivedReady ? ctx.tr("systemCheckReady") : ctx.tr("requiredFieldsMissing")}`,
    `${ctx.tr("systemInteractiveCheck")}: ${userMissing.length ? userMissing.join(" · ") : ctx.tr(summary.user.length ? "systemCheckReady" : "systemNoInteractiveFields")}`,
    summary.backend.length ? `${ctx.tr("systemBackendDefaultCheck")}: ${ctx.tr("systemCheckReady")}` : ""
  ];
}

export function hasCarryValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function missingFieldIdsFor(card, item, ctx) {
  const validation = ctx.state.fieldValidation || {};
  if (validation.workspaceId !== item.id || validation.cardId !== card.id) return [];
  return validation.missingFieldIds || [];
}

export function isCaseContextReadonlyField(fieldId, card) {
  const role = fieldContextRole(card?.id, fieldId);
  if (role.contract) return role.kind === "inherited";
  if (isForcedCaseContextReadonlyField(fieldId, card)) return true;
  if (isContextCarriedField(card?.id, fieldId)) return true;
  if (isCaseContextIdentityField(fieldId)) return true;
  return false;
}

export function isForcedCaseContextReadonlyField(fieldId, card) {
  if (isContextCarriedField(card?.id, fieldId)) return true;
  if (fieldContextRole(card?.id, fieldId).contract) return false;
  if (isResourceReadinessCardId(card?.id) && fieldId === "roomRef") return true;
  return isBedSetupCardId(card?.id) && ["roomRef", "roomId", "bedCount"].includes(fieldId);
}

export function sameWorkspaceEvents(item, ctx) {
  const events = [
    ...(ctx.state.projectionEvents || []),
    ...(ctx.state.runtimeStore?.events || [])
  ];
  const seen = new Set();
  return events
    .map((event) => ({
      ...event,
      workspaceId: event.workspaceId || event.WorkspaceId,
      cardId: event.cardId || event.CardId,
      aggregateRef: event.aggregateRef || event.AggregateRef,
      payload: event.payload || event.Payload || {}
    }))
    .filter((event) => item?.id && event.workspaceId === item.id && event.payload)
    .filter((event) => {
      const key = event.eventId || event.EventId || `${event.cardId}:${JSON.stringify(event.payload)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function bedSetupGenerationModeState(field, item, card, values, ctx) {
  const bedCount = carriedForwardValue({ id: "bedCount", label: { "zh-CN": "床位数" } }, item, card, values, ctx)?.value || values.bedCount || "";
  const generatedLabels = generatedBedLabelsForCount(bedCount);
  const draftMatchesCurrentCount = generatedLabels && values.bedLabels === generatedLabels;
  if (values.bedType && draftMatchesCurrentCount && values.bedLayout) {
    return { value: values.bedType, source: "draft" };
  }
  return { value: defaultValueForField(field) || defaultBedTypeForCount(bedCount), source: "default" };
}

function generatedOperationInputFields(card, ctx) {
  return generatedSurfaceControlsForCard(card?.id)
    .filter((control) => operationSurfaceControlVisible(control))
    .map((control) => generatedControlField(displayControlForSurface(control, card), ctx));
}

function operationSurfaceControlVisible(control) {
  if (control.hiddenSubmitOnly || control.controlType === "hidden") return false;
  if (control.classification === "contextReadonly") return control.fieldId === "buildingContextRef";
  return ["clientSubmitted", "selectedStableRef", "systemDerived"].includes(control.classification);
}

function displayControlForSurface(control, card) {
  if (isBedSetupCardId(card?.id) && control.fieldId === "roomId") {
    return {
      ...control,
      fieldId: "roomRef",
      classification: "selectedStableRef",
      controlType: "readonly",
      readonly: true,
      required: false,
      label: { "zh-CN": "所属房间", "ru-RU": "Комната", "ky-KG": "Бөлмө" }
    };
  }
  if (control.fieldId === "buildingContextRef") {
    return {
      ...control,
      classification: "selectedStableRef",
      controlType: "searchSelect",
      readonly: false,
      required: true,
      optionSet: "",
      defaultValue: ""
    };
  }
  return control;
}

function generatedControlField(control, ctx) {
  const lang = ctx?.state?.lang || "zh-CN";
  const generatedLabel = control.label?.[lang] || control.label?.["zh-CN"] || generatedFieldLabel(control.fieldId, lang);
  const controlKind = control.optionSet ? "select" : control.controlType || control.ui?.control || "text";
  return {
    id: control.fieldId,
    label: {
      [lang]: generatedLabel,
      "zh-CN": control.label?.["zh-CN"] || generatedFieldLabel(control.fieldId, "zh-CN")
    },
    required: control.required === true,
    classification: control.classification,
    userSubmitted: control.userSubmitted === true,
    readonly: control.readonly === true,
    source: control.source,
    ui: {
      control: controlKind,
      optionSet: control.optionSet || "",
      defaultValue: control.defaultValue || "",
      readonly: control.readonly === true,
      hiddenSubmitOnly: control.hiddenSubmitOnly === true
    }
  };
}

function backendDefaultValue(fieldId, ctx) {
  const actor = ctx.state?.currentActor || {};
  if (["operatorId", "receivedBy", "financeReviewer", "managerId", "approverId", "confirmer", "payerId"].includes(fieldId)) {
    return actor.actorId || actor.userId || actor.username || actor.displayName || "";
  }
  return "";
}

function backendDefaultDisplayValue(fieldId, ctx) {
  const actor = ctx.state?.currentActor || {};
  if (["operatorId", "receivedBy", "financeReviewer", "managerId", "approverId", "confirmer", "payerId"].includes(fieldId)) {
    return actor.displayName || actor.username || actor.actorId || actor.userId || "";
  }
  return "";
}

function derivedChargeAmount(item, ctx, values = {}) {
  const derived = generatedContextValue("amount", values, {
    workspace: item,
    card: { id: "chargeAssessment" },
    payloads: sameWorkspaceEvents(item, ctx),
    currentValues: values
  }, { preferDirect: false });
  return derived?.value || "";
}

function carriedForwardValue(field, item, card, values, ctx) {
  const fieldId = operationFieldId(field);
  if (isUnsafeLedgerCarryForward(item, fieldId)) return null;
  const aggregateRef = aggregateRefForValues(values);
  const events = sameWorkspaceEvents(item, ctx)
    .filter((event) => !aggregateRef || event.aggregateRef === aggregateRef || sameAggregatePayload(event.payload, aggregateRef))
    .slice()
    .reverse();
  for (const event of events) {
    const carried = carriedFieldFromPayload(fieldId, event.payload, ctx);
    if (carried) return carried;
  }
  const workItemPayload = carriedFieldFromCurrentWorkItemPayload(fieldId, item, card, ctx);
  if (workItemPayload) return workItemPayload;
  const completedSnapshot = carriedFieldFromLatestCompletedSnapshot(fieldId, item, card, ctx);
  if (completedSnapshot) return completedSnapshot;
  return carriedFieldFromCompletedDraft(fieldId, item, card, ctx);
}

function carriedFieldFromCompletedDraft(fieldId, item, card, ctx) {
  const currentIndex = (item.cards || []).findIndex((candidate) => candidate.id === card.id);
  const previousCards = (item.cards || [])
    .slice(0, currentIndex < 0 ? 0 : currentIndex)
    .filter((candidate) => isTerminalCardStatus(candidate.status))
    .reverse();
  for (const previous of previousCards) {
    const draft = loadDraft(item.id, previous.id);
    const carried = carriedFieldFromPayload(fieldId, draft.values || {}, ctx);
    if (carried) return carried;
  }
  return null;
}

function carriedFieldFromCurrentWorkItemPayload(fieldId, item, card, ctx) {
  const selectedWorkItemId = ctx.state?.selectedWorkItemId || "";
  const workspaceId = item?.id || "";
  const cardId = card?.id || "";
  const candidates = runtimeItemsForRecord(ctx.state)
    .filter((workItem) => {
      const itemId = workItemIdForRecord(workItem);
      if (selectedWorkItemId && itemId === selectedWorkItemId) return true;
      return workItemWorkspaceId(workItem) === workspaceId && workItemCardId(workItem) === cardId;
    })
    .map((workItem) => workItem.payload || workItem.Payload || {});
  for (const payload of candidates) {
    const carried = carriedFieldFromPayload(fieldId, payload, ctx);
    if (carried) {
      return {
        ...carried,
        source: payload.startContextSource || "operations-work-item-payload"
      };
    }
  }
  return null;
}

function carriedFieldFromPayload(fieldId, payload = {}, ctx) {
  const generated = generatedContextValue(fieldId, payload, {});
  if (generated) return generated;
  const direct = payload[fieldId];
  if (hasCarryValue(direct)) {
    return { value: String(direct), displayValue: contextDisplayValue(fieldId, String(direct), payload, ctx) };
  }
  if (fieldId === "roomRef" || fieldId === "roomId") {
    const roomNo = payload.roomNo || payload["房间号"];
    if (hasCarryValue(roomNo)) {
      const value = `room-${String(roomNo).trim()}`.toLowerCase();
      return { value, displayValue: roomDisplayValue(value, payload, ctx) };
    }
  }
  if (fieldId === "bedId") {
    const bedNo = payload.bedNo || payload["床位号"];
    if (hasCarryValue(bedNo)) {
      const value = `bed-${String(bedNo).trim()}`.toLowerCase();
      return { value, displayValue: bedDisplayValue(value, payload, ctx) };
    }
  }
  if (fieldId === "bedCount" && hasCarryValue(payload.capacity)) {
    return { value: String(payload.capacity), displayValue: String(payload.capacity) };
  }
  return null;
}

function carriedFieldFromLatestCompletedSnapshot(fieldId, item, card, ctx) {
  const currentIndex = (item.cards || []).findIndex((candidate) => candidate.id === card.id);
  const previousCardIds = new Set((item.cards || [])
    .slice(0, currentIndex < 0 ? 0 : currentIndex)
    .map((candidate) => candidate.id));
  if (!previousCardIds.size) return null;
  for (const snapshot of loadCompletedRecordSnapshots()) {
    if (snapshot.workspaceId !== item.id || !previousCardIds.has(snapshot.cardId)) continue;
    const carried = carriedFieldFromPayload(fieldId, snapshot.values || {}, ctx);
    if (carried) return carried;
  }
  return null;
}

function contextDisplayValue(fieldId, value, payload, ctx) {
  const sharedDisplay = contextReferenceDisplayValue(fieldId, value, payload);
  if (sharedDisplay && sharedDisplay !== value) return sharedDisplay;
  if (fieldId === "roomRef" || fieldId === "roomId") return roomDisplayValue(value, payload, ctx);
  if (fieldId === "bedId") return bedDisplayValue(value, payload, ctx);
  return value;
}

function roomDisplayValue(value, payload = {}, ctx) {
  const building = payload.buildingName || payload.buildingId || payload["楼栋"] || "";
  const roomNo = payload.roomNo || payload["房间号"] || "";
  const label = [building, roomNo].filter(Boolean).join(" / ");
  return label || value;
}

function bedDisplayValue(value, payload = {}, ctx) {
  const room = roomDisplayValue(payload.roomId || "", payload, ctx);
  const bedNo = payload.bedNo || payload["床位号"] || "";
  const label = [room, bedNo].filter(Boolean).join(" / ");
  return label || value;
}

function hasRequiredFieldValue(field, item, card, ctx) {
  const kind = fieldControlKind(field);
  const fieldId = operationFieldId(field);
  const value = operationFieldState(field, item, card, ctx).value;
  if (fieldId === "bedLabels") {
    const values = operationDraftValues(item, card);
    const bedCount = Number(carriedForwardValue({ id: "bedCount", label: { "zh-CN": "床位数" } }, item, card, values, ctx)?.value || values.bedCount || 0);
    const labels = splitBedLabels(value);
    return labels.length > 0 && (!Number.isFinite(bedCount) || bedCount <= 0 || labels.length === bedCount);
  }
  if (kind === "dateTimeRange") {
    const [start = "", end = ""] = String(value || "").split(" 至 ");
    return hasCarryValue(start) && hasCarryValue(end);
  }
  if (kind === "select") {
    return hasCarryValue(value) && !/请选择|select/i.test(String(value));
  }
  if (hasCarryValue(value)) return true;
  return false;
}

function filteredValidationMissingLabels(validation, card, item, ctx) {
  const missingIds = validation.missingFieldIds || [];
  if (!missingIds.length) return validation.missingLabels || [];
  const currentRequiredIds = new Set(operationInputFields(card, ctx, item)
    .filter((field) => operationFieldRequired(field, card, item, ctx))
    .map((field) => operationFieldId(field)));
  return (validation.missingLabels || []).filter((label, index) => {
    const fieldId = missingIds[index] || "";
    return !fieldId || currentRequiredIds.has(fieldId);
  });
}

function syntheticContextField(fieldId, ctx) {
  return { id: fieldId, label: { [ctx.state.lang]: contextFieldLabel(null, fieldId, ctx), "zh-CN": contextFieldLabel(null, fieldId, { ...ctx, state: { ...ctx.state, lang: "zh-CN" } }) } };
}

function contextFieldLabel(field, fieldId, ctx) {
  if (field) return ctx.localTerm(field);
  const labels = {
    "zh-CN": {
      roomRef: "所属房间",
      roomId: "所属房间",
      bedId: "床位",
      bedCount: "床位数",
      stayId: "入住单",
      residentId: "入住人",
      depositId: "押金单",
      paymentId: "收款记录",
      taskId: "服务任务",
      expenseId: "支出记录",
      periodId: "经营周期",
      checkoutId: "退住单"
    },
    "ru-RU": {
      roomRef: "Комната",
      roomId: "Комната",
      bedId: "Койка",
      bedCount: "Количество коек",
      stayId: "Заезд",
      residentId: "Житель",
      depositId: "Депозит",
      paymentId: "Платеж",
      taskId: "Задача",
      expenseId: "Расход",
      periodId: "Период",
      checkoutId: "Выезд"
    },
    "ky-KG": {
      roomRef: "Бөлмө",
      roomId: "Бөлмө",
      bedId: "Койка",
      bedCount: "Койка саны",
      stayId: "Кирүү",
      residentId: "Жашоочу",
      depositId: "Депозит",
      paymentId: "Төлөм",
      taskId: "Тапшырма",
      expenseId: "Чыгаша",
      periodId: "Мезгил",
      checkoutId: "Чыгуу"
    }
  };
  return labels[ctx.state.lang]?.[fieldId] || labels["zh-CN"][fieldId] || fieldId;
}

function isCaseContextIdentityField(fieldId) {
  return ["roomRef", "roomId", "bedId", "stayId", "residentId", "reservationId", "leadId", "depositId", "depositReceiptId", "paymentId", "chargeId", "taskId", "expenseId", "periodId"].includes(fieldId);
}

function aggregateRefForValues(values) {
  for (const key of ["depositId", "paymentId", "stayId", "residentId", "reservationId", "leadId", "roomRef", "roomId", "bedId", "taskId", "expenseId", "periodId"]) {
    if (values[key]) return `${key}:${values[key]}`;
  }
  return "";
}

function sameAggregatePayload(payload, aggregateRef) {
  const [key, value] = aggregateRef.split(":");
  return key && value && payload?.[key] === value;
}

function runtimeItemsForRecord(state = {}) {
  return [
    ...(state.runtimeStore?.operationWorkItems || []),
    ...(state.runtimeStore?.workQueue || [])
  ];
}

function workItemIdForRecord(item = {}) {
  return item.workItemId || item.work_item_id || "";
}

function workItemWorkspaceId(item = {}) {
  return item.workspaceId || item.workspace_id || item.workspace?.id || "";
}

function workItemCardId(item = {}) {
  return item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.card?.id || "";
}
