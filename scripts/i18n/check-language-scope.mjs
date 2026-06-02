import { failIfNeeded, read, result, writeJson } from "./i18n-check-lib.mjs";

const i18nManifest = read("apps/mobile/src/i18n.js");
const doc = read("docs/manuals/localization/localization-architecture.md");
const noGoItems = [];

for (const token of ['"zh-CN"', '"ru-RU"', '"ky-KG"']) {
  if (!i18nManifest.includes(token)) noGoItems.push(`i18n manifest 缺少语言：${token}`);
}
if (!doc.includes("`zh-CN` 是 canonical")) noGoItems.push("Localization 手册必须声明 zh-CN canonical。");
if (!doc.includes("`ru-RU` 是 supported")) noGoItems.push("Localization 手册必须声明 ru-RU supported。");
if (!doc.includes("`ky-KG` 当前是 pilot")) noGoItems.push("Localization 手册必须声明 ky-KG pilot。");
if (/ky-KG\s+(is\s+)?supported/i.test(doc) || /`ky-KG`\s+是\s+supported/.test(doc)) {
  noGoItems.push("ky-KG 不得声明为 supported。");
}

const payload = result("check-language-scope", noGoItems);
writeJson("artifacts/i18n/language-scope-result.json", payload);
failIfNeeded(noGoItems, "language scope check");
console.log("language scope check: PASS");
