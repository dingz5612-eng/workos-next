import { capacityForRoomType } from "../projectionMetadata.js";

export { capacityForRoomType };

export function fieldControlKind(field) {
  return field?.ui?.control || field?.type || "text";
}

export function optionsForField(field, lang = "zh-CN") {
  return (field?.ui?.options || []).map((entry) => ({
    value: entry.value,
    label: entry.label?.[lang] || entry.label?.["zh-CN"] || entry.value
  }));
}

export function defaultValueForField(field) {
  return field?.ui?.defaultValue || "";
}

export function isDerivedReadonlyField(field) {
  return Boolean(field?.ui?.readonly || field?.ui?.derivedFrom);
}
