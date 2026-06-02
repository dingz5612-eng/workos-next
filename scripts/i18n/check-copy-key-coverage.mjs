import { copyModules, failIfNeeded, keysForLanguage, read, result, writeJson } from "./i18n-check-lib.mjs";

const noGoItems = [];
const modules = [];
for (const file of copyModules) {
  const source = read(file);
  const zh = keysForLanguage(source, "zh-CN");
  const ru = keysForLanguage(source, "ru-RU");
  const missingRu = zh.filter((key) => !ru.includes(key));
  const extraRu = ru.filter((key) => !zh.includes(key));
  if (missingRu.length) noGoItems.push(`${file} ru-RU 缺少 keys：${missingRu.join(", ")}`);
  if (extraRu.length) noGoItems.push(`${file} ru-RU 存在非 canonical keys：${extraRu.join(", ")}`);
  modules.push({ file, zhKeyCount: zh.length, ruKeyCount: ru.length, missingRu, extraRu, kyKgMode: "pilot_canonical_fallback" });
}

const payload = result("check-copy-key-coverage", noGoItems, { modules });
writeJson("artifacts/i18n/copy-key-coverage-result.json", payload);
failIfNeeded(noGoItems, "copy key coverage check");
console.log("copy key coverage check: PASS");
