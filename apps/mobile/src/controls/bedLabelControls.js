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
