import { translateTerm } from "../termDictionary.js";

const optionValueLabels = {
  roomType: {
    single: "单人间",
    double: "双人间",
    four_bed: "四人间",
    six_bed: "六人间"
  },
  genderPolicy: {
    male: "男生房",
    female: "女生房",
    mixed: "混住",
    unrestricted: "未限制"
  },
  furnitureStatus: {
    complete: "家具齐全",
    partial: "部分缺失",
    missing: "缺失",
    pending: "待配置"
  },
  technicalState: {
    ready: "可入住",
    not_ready: "未准备",
    repair: "需维修",
    repair_required: "需维修"
  },
  gender: {
    male: "男",
    female: "女",
    unspecified: "未说明"
  }
};

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
  return (field?.ui?.options || []).map((entry) => ({
    value: entry.value,
    label: optionLabelForField(field, entry, lang)
  }));
}

function optionLabelForField(field, entry = {}, lang) {
  if (typeof entry.label === "string") return translateTerm(entry.label, lang);
  if (entry.label?.[lang]) return entry.label[lang];
  const zhLabel = entry.label?.["zh-CN"] ||
    optionValueLabels[field?.ui?.optionSet]?.[entry.value] ||
    entry.value;
  return translateTerm(zhLabel, lang);
}

export function defaultValueForField(field) {
  return field?.ui?.defaultValue || "";
}

export function isDerivedReadonlyField(field) {
  return Boolean(field?.ui?.readonly || field?.ui?.derivedFrom);
}
