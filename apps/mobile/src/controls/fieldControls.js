import { translateTerm } from "../termDictionary.js";
import { canonicalLabelForOptionValue, canonicalOptionLabels, normalizeOptionSetValue } from "./optionSetContract.js";

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
  const optionSet = optionSetForField(field);
  const explicit = field?.ui?.control || field?.type || "";
  if (optionSet && (!explicit || ["text", "string", "input"].includes(explicit))) return "select";
  return explicit || "text";
}

export function optionsForField(field, lang = "zh-CN") {
  const optionSet = optionSetForField(field);
  const canonical = canonicalOptionLabels(optionSet);
  const merged = new Map();
  const add = (entry = {}) => {
    const value = normalizeOptionSetValue(optionSet, entry.value);
    if (!value || merged.has(value)) return;
    const canonicalLabel = canonicalLabelForOptionValue(optionSet, value, lang);
    merged.set(value, {
      value,
      label: canonicalLabel ? translateTerm(canonicalLabel, lang) : optionLabelForField(field, { ...entry, value }, lang)
    });
  };

  for (const entry of field?.ui?.options || []) add(entry);
  if (canonical) {
    for (const value of Object.keys(canonical)) add({ value });
  }
  return Array.from(merged.values());
}

function optionSetForField(field = {}) {
  return field?.ui?.optionSet || fallbackOptionSetForField(field);
}

function fallbackOptionSetForField(field = {}) {
  const id = String(field?.id || "").trim();
  const zh = String(field?.label?.["zh-CN"] || "").trim();
  if (id === "bedType" || zh === "床铺生成方式" || zh === "床位类型") return "bunkType";
  if (id === "bedEnabledStatus" || zh === "床位启用状态") return "bedEnabledStatus";
  if (id === "bedTypeBatchSetting" || zh === "床型批量设置") return "bedTypeBatchSetting";
  if (["basicCheckResult", "cleaningBasicCheckResult", "facilityBasicCheckResult", "safetyBasicCheckResult"].includes(id)) return "basicReadinessCheckResult";
  if (id === "readinessState" || zh === "就绪状态") return "readinessState";
  if (id === "reservationNextAction" || zh === "预订后动作") return "reservationNextAction";
  return "";
}

function optionLabelForField(field, entry = {}, lang) {
  if (typeof entry.label === "string") return translateTerm(entry.label, lang);
  if (entry.label?.[lang]) return entry.label[lang];
  const zhLabel = entry.label?.["zh-CN"] ||
    canonicalLabelForOptionValue(field?.ui?.optionSet, entry.value, lang) ||
    entry.value;
  return translateTerm(zhLabel, lang);
}

export function defaultValueForField(field) {
  return field?.ui?.defaultValue || "";
}

export function isDerivedReadonlyField(field) {
  return Boolean(field?.ui?.readonly || field?.ui?.derivedFrom);
}
