import { failIfNeeded, result, writeJson } from "./i18n-check-lib.mjs";
import { i18n } from "../../apps/mobile/src/i18n.js";
import { tr } from "../../apps/mobile/src/selectors/workspaceSelectors.js";

const noGoItems = [];
if (tr({ lang: "xx-XX" }, "today") !== i18n["zh-CN"].today) {
  noGoItems.push("未知语言必须 fallback 到 zh-CN。");
}
if (!i18n["ky-KG"]?.today || i18n["ky-KG"].today !== i18n["zh-CN"].today) {
  noGoItems.push("ky-KG pilot 必须使用 canonical fallback。");
}
for (const [language, copy] of Object.entries(i18n)) {
  for (const [key, value] of Object.entries(copy)) {
    if (!value || value === key) noGoItems.push(`${language}.${key} 不得为空或 raw key。`);
  }
}

const payload = result("check-i18n-runtime-fallback", noGoItems, { checkedLanguages: Object.keys(i18n) });
writeJson("artifacts/i18n/runtime-fallback-result.json", payload);
failIfNeeded(noGoItems, "i18n runtime fallback check");
console.log("i18n runtime fallback check: PASS");
