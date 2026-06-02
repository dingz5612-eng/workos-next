import { failIfNeeded, read, result, writeJson } from "./i18n-check-lib.mjs";

const scanFiles = [
  "apps/mobile/src/i18n.js",
  "apps/mobile/src/appState.js",
  "apps/mobile/src/selectors/workspaceSelectors.js"
];
const noGoItems = [];
for (const file of scanFiles) {
  const source = read(file);
  if (source.includes("[object Object]")) noGoItems.push(`${file} 不得包含 [object Object] copy。`);
  if (/FULLY_PASSED|PRODUCTION_READY|BUSINESS_PRODUCTION_GO|DORMITORY_L2_PRODUCTION_ALLOWED|DAY2_STARTED/.test(source)) {
    noGoItems.push(`${file} 包含禁止 release-state copy。`);
  }
}
if (!read("apps/mobile/src/i18n.js").includes('shellCopy[language] || shellCopy["zh-CN"]')) {
  noGoItems.push("i18n.js 必须以 zh-CN 作为 missing language fallback。");
}

const payload = result("check-no-hardcoded-user-copy", noGoItems, { scanFiles });
writeJson("artifacts/i18n/no-hardcoded-user-copy-result.json", payload);
failIfNeeded(noGoItems, "no hardcoded user copy check");
console.log("no hardcoded user copy check: PASS");
