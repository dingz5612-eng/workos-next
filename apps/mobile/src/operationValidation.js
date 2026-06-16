import { splitBedLabels } from "./controls/bedLabelControls.js";
import { isBedSetupCardId } from "./capabilityProjection.js";
import { isScopedResourceFieldRequired } from "./controls/resourceScopeControls.js";
import { operationFieldId } from "./operationFieldKernel.js";
import { contextContractSummary, fieldContextRole, fieldParticipatesInUserValidation } from "./systemContextContract.js";

export function validateRequiredFields(card, values, ctx) {
  const businessFields = card.fields?.business || [];
  const missingFields = businessFields
    .filter((field) => operationFieldParticipatesInUserSubmit(card, field))
    .filter((field) => isScopedResourceFieldRequired(card?.id, operationFieldId(field), values, Boolean(field.required)))
    .filter((field) => !hasBusinessValue(values, operationFieldId(field)));
  const fieldById = new Map(businessFields.map((field) => [operationFieldId(field), field]));
  const missingContextFields = contextContractSummary(card?.id).inherited
    .map((fieldId) => fieldById.get(fieldId) || syntheticContextField(fieldId, ctx))
    .filter((field) => !hasBusinessValue(values, operationFieldId(field)));
  const invalidFields = bedSetupCardinalityViolations(card, values, ctx);
  const invalidFieldSet = new Set(invalidFields.map((entry) => entry.field));
  return {
    missingFields: [
      ...missingContextFields,
      ...missingFields.filter((field) => !missingContextFields.some((candidate) => operationFieldId(candidate) === operationFieldId(field))),
      ...invalidFields.map((entry) => entry.field).filter((field) => !missingFields.includes(field))
    ],
    missingLabels: [
      ...missingFields.map((field) => labelForField(field, ctx)),
      ...invalidFields
        .filter((entry) => !missingFields.includes(entry.field) && invalidFieldSet.has(entry.field))
        .map((entry) => entry.label)
    ],
    missingContextLabels: missingContextFields.map((field) => labelForField(field, ctx)),
    displayLabels: [
      ...missingContextFields.map((field) => `${ctx.tr("upstreamContextMissing")}: ${labelForField(field, ctx)}`),
      ...missingFields.map((field) => labelForField(field, ctx)),
      ...invalidFields
        .filter((entry) => !missingFields.includes(entry.field) && invalidFieldSet.has(entry.field))
        .map((entry) => entry.label)
    ]
  };
}

function operationFieldParticipatesInUserSubmit(card = {}, field = {}) {
  const fieldId = operationFieldId(field);
  const role = fieldContextRole(card?.id, fieldId);
  if (role.kind !== "user") return false;
  if (!fieldParticipatesInUserValidation(card?.id, fieldId)) return false;
  if (isBedSetupCardId(card?.id) && ["bedStatus", "bedNo", "bedLabel"].includes(fieldId)) return false;
  return true;
}

function bedSetupCardinalityViolations(card = {}, values = {}, ctx) {
  if (!isBedSetupCardId(card.id)) return [];
  const bedCount = Number(values.bedCount || 0);
  if (!Number.isFinite(bedCount) || bedCount <= 0) return [];
  const labelField = (card.fields?.business || []).find((field) => operationFieldId(field) === "bedLabels");
  if (!labelField) return [];
  const labels = splitBedLabels(values.bedLabels || "");
  if (labels.length === bedCount && new Set(labels.map((item) => item.toLocaleLowerCase())).size === labels.length) return [];
  const label = labels.length === bedCount
    ? `${labelForField(labelField, ctx)}: ${ctx.tr("bedLabelsMustBeUnique")}`
    : `${labelForField(labelField, ctx)}: ${ctx.tr("bedLabelsMustMatchBedCount").replace("{count}", String(bedCount))}`;
  return [{ field: labelField, label }];
}

function hasBusinessValue(values = {}, fieldId = "") {
  const value = values[fieldId];
  return !(value === undefined || value === null || String(value).trim() === "");
}

function labelForField(field, ctx) {
  if (ctx.localTerm) return ctx.localTerm(field);
  return field?.label?.[ctx.state?.lang] || field?.label?.["zh-CN"] || field?.id || "";
}

function syntheticContextField(fieldId, ctx) {
  return { id: fieldId, label: { [ctx.state?.lang || "zh-CN"]: contextFieldLabel(fieldId, ctx), "zh-CN": contextFieldLabel(fieldId, { ...ctx, state: { ...ctx.state, lang: "zh-CN" } }) } };
}

function contextFieldLabel(fieldId, ctx) {
  const labels = {
    "zh-CN": {
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
  const lang = ctx.state?.lang || "zh-CN";
  return labels[lang]?.[fieldId] || labels["zh-CN"][fieldId] || fieldId;
}
