import { translateTerm } from "../termDictionary.js";
import { canonicalLabelForOptionValue, canonicalOptionLabels, normalizeOptionSetValue, preferredOptionSetDefault } from "./optionSetContract.js";

const roomTypeCapacity = {
  single: "1",
  double: "2",
  four_bed: "4",
  six_bed: "6"
};

export function capacityForRoomType(roomType) {
  return roomTypeCapacity[roomType] || "";
}

export function fieldControlKind(field) {
  return field?.ui?.control || field?.type || "text";
}

export function optionsForField(field, lang = "zh-CN") {
  const optionSet = field?.ui?.optionSet || "";
  const canonical = canonicalOptionLabels(optionSet);
  const merged = new Map();
  const add = (entry = {}) => {
    const value = normalizeOptionSetValue(optionSet, entry.value);
    if (!value || merged.has(value)) return;
    const canonicalLabel = canonicalLabelForOptionValue(optionSet, value);
    merged.set(value, {
      value,
      label: canonicalLabel ? translateTerm(canonicalLabel, lang) : optionLabelForField(field, { ...entry, value }, lang)
    });
  };

  const preferredDefault = normalizeOptionSetValue(optionSet, field?.ui?.defaultValue || preferredOptionSetDefault(optionSet));
  if (canonical?.[preferredDefault]) add({ value: preferredDefault });
  for (const entry of field?.ui?.options || []) add(entry);
  if (canonical) {
    for (const value of Object.keys(canonical)) add({ value });
  }
  return Array.from(merged.values());
}

function optionLabelForField(field, entry = {}, lang) {
  if (typeof entry.label === "string") return translateTerm(entry.label, lang);
  if (entry.label?.[lang]) return entry.label[lang];
  const zhLabel = entry.label?.["zh-CN"] ||
    canonicalLabelForOptionValue(field?.ui?.optionSet, entry.value) ||
    entry.value;
  return translateTerm(zhLabel, lang);
}

export function defaultValueForField(field) {
  return field?.ui?.defaultValue || "";
}

export function isDerivedReadonlyField(field) {
  return Boolean(field?.ui?.readonly || field?.ui?.derivedFrom);
}
