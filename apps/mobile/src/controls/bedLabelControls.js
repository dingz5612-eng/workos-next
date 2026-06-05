export function generatedBedLabelsForCount(count) {
  const parsed = Number(count);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return Array.from({ length: Math.min(Math.trunc(parsed), 20) }, (_, index) =>
    String(index + 1).padStart(2, "0")).join(", ");
}

export function isGeneratedBedLabelList(value = "") {
  const labels = splitBedLabels(value);
  return labels.length > 0 && value.trim() === generatedBedLabelsForCount(labels.length);
}

export function splitBedLabels(value = "") {
  return String(value || "")
    .split(/[,，;\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeBedTypePattern(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  const aliases = {
    "": "bunk_pair",
    bunk: "bunk_pair",
    bunk_pair: "bunk_pair",
    mixed_bunk: "bunk_pair",
    upper_lower: "bunk_pair",
    "上下铺": "bunk_pair",
    "上下铺一组": "bunk_pair",
    "上下铺：两上两下": "bunk_pair",
    "上下铺:两上两下": "bunk_pair",
    upper: "upper",
    all_upper: "upper",
    "上铺": "upper",
    "全部上铺": "upper",
    lower: "lower",
    all_lower: "lower",
    "下铺": "lower",
    "全部下铺": "lower",
    whole: "whole",
    flat: "whole",
    all_whole: "whole",
    "整床": "whole",
    "平铺": "whole",
    "全部平铺": "whole"
  };
  return aliases[normalized] || "bunk_pair";
}

export function bedTypeForPattern(pattern = "", index = 0) {
  const normalized = normalizeBedTypePattern(pattern);
  if (normalized === "upper") return "upper";
  if (normalized === "lower") return "lower";
  if (normalized === "whole") return "whole";
  return index % 2 === 0 ? "upper" : "lower";
}

export function labelForBedType(type = "", lang = "zh-CN") {
  const labels = {
    "zh-CN": { upper: "上铺", lower: "下铺", whole: "平铺" },
    "ru-RU": { upper: "верхняя", lower: "нижняя", whole: "обычная" },
    "ky-KG": { upper: "үстүңкү", lower: "астыңкы", whole: "жалгыз" }
  };
  const dictionary = labels[lang] || labels["zh-CN"];
  return dictionary[normalizeBedTypePattern(type)] || dictionary.lower;
}

export function bedLayoutForLabels(labelsOrValue = "", pattern = "", lang = "zh-CN") {
  const labels = Array.isArray(labelsOrValue) ? labelsOrValue : splitBedLabels(labelsOrValue);
  return labels.map((label, index) => {
    const type = bedTypeForPattern(pattern, index);
    return { label, type, typeLabel: labelForBedType(type, lang) };
  });
}

export function bedLayoutForCount(count, pattern = "", lang = "zh-CN") {
  return bedLayoutForLabels(generatedBedLabelsForCount(count), pattern, lang);
}

export function serializeBedLayout(layout = []) {
  return JSON.stringify(layout.map((entry) => ({ label: entry.label, type: entry.type })));
}
