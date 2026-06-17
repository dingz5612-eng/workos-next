import {
  zhBusinessTermReplacements,
  zhRiskLabelReplacements
} from "./generated/oam/business-display-language.generated.js";

export function businessDisplayZh(value = "") {
  return normalizeUserFacingText(replaceZhTerms(String(value ?? "")));
}

export function userFacingBusinessText(value = "", ctx = {}) {
  const lang = ctx?.state?.lang || ctx?.lang || "zh-CN";
  const text = String(value ?? "");
  if (lang !== "zh-CN") return text;
  return businessDisplayZh(text);
}

export function userFacingRiskLabel(value = "", ctx = {}) {
  const lang = ctx?.state?.lang || ctx?.lang || "zh-CN";
  const text = String(value ?? "").trim();
  if (lang !== "zh-CN") return text;
  return zhRiskLabelReplacements[text.toLowerCase()] || text;
}

function replaceZhTerms(value = "") {
  return zhBusinessTermReplacements.reduce(
    (current, [from, to]) => current.split(from).join(to),
    String(value ?? "")
  );
}

function normalizeUserFacingText(value = "") {
  return String(value ?? "")
    .replace(/。；/g, "；")
    .replace(/；。/g, "。")
    .replace(/；\s*；/g, "；")
    .replace(/\s+/g, " ")
    .trim();
}
