import { failIfNeeded, read, result, writeJson } from "./i18n-check-lib.mjs";

const source = read("apps/mobile/src/termDictionary.js");
const requiredConcepts = [
  { label: "住宿", pattern: /入住|住宿/ },
  { label: "押金", pattern: /押金/ },
  { label: "收款", pattern: /付款|收款|到账|确认金额/ },
  { label: "退款", pattern: /退款|应退|退回/ },
  { label: "证据", pattern: /证据|凭证|照片/ },
  { label: "权限", pattern: /授权|权限|规则/ },
  { label: "房间", pattern: /房间/ },
  { label: "床位", pattern: /床位|房间床位/ }
];
const noGoItems = requiredConcepts
  .filter((concept) => !concept.pattern.test(source))
  .map((concept) => `termDictionary 缺少业务概念覆盖：${concept.label}`);

const payload = result("check-business-glossary-consistency", noGoItems, {
  requiredConcepts: requiredConcepts.map((concept) => concept.label)
});
writeJson("artifacts/i18n/business-glossary-consistency-result.json", payload);
failIfNeeded(noGoItems, "business glossary consistency check");
console.log("business glossary consistency check: PASS");
