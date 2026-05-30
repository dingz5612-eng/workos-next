export function capacityForRoomType(roomType) {
  if (roomType === "single" || roomType === "单人间") return "1";
  if (roomType === "double" || roomType === "双人间") return "2";
  if (roomType === "four_bed" || roomType === "四人间") return "4";
  if (roomType === "six_bed" || roomType === "六人间") return "6";
  return "";
}

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
