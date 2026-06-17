import {
  kyBusinessTermReplacements,
  ruBusinessTermReplacements,
  zhBusinessTermReplacements,
  zhRiskLabelReplacements
} from "./generated/oam/business-display-language.generated.js";

export function businessDisplayZh(value = "") {
  return normalizeUserFacingText(replaceZhTerms(String(value ?? "")));
}

export function userFacingBusinessText(value = "", ctx = {}) {
  const lang = ctx?.state?.lang || ctx?.lang || "zh-CN";
  const text = String(value ?? "");
  if (lang === "ru-RU") return normalizeUserFacingText(replaceTerms(text, ruBusinessTermReplacements));
  if (lang === "ky-KG") return normalizeUserFacingText(replaceTerms(text, kyBusinessTermReplacements));
  return businessDisplayZh(text);
}

export function userFacingRiskLabel(value = "", ctx = {}) {
  const lang = ctx?.state?.lang || ctx?.lang || "zh-CN";
  const text = String(value ?? "").trim();
  if (lang !== "zh-CN") return text;
  return zhRiskLabelReplacements[text.toLowerCase()] || text;
}

function replaceZhTerms(value = "") {
  return replaceTerms(value, zhBusinessTermReplacements);
}

function replaceTerms(value = "", replacements = []) {
  return replacements.reduce((current, [from, to], index) => {
    const source = String(from ?? "");
    const target = String(to ?? "");
    if (!source || source === target) return current;
    if (!target.includes(source)) return current.split(source).join(target);
    const targetMarker = `__WORKOS_VISIBLE_COPY_TARGET_${index}__`;
    return current
      .split(target).join(targetMarker)
      .split(source).join(target)
      .split(targetMarker).join(target);
  }, String(value ?? ""));
}

function normalizeUserFacingText(value = "") {
  return String(value ?? "")
    .replace(/。；/g, "；")
    .replace(/；。/g, "。")
    .replace(/；\s*；/g, "；")
    .replace(/\s+/g, " ")
    .trim();
}
