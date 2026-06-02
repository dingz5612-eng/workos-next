import { failIfNeeded, manualResult, readText, requiredManuals, writeJson } from "./manual-check-lib.mjs";

const scanFiles = ["README.md", ...requiredManuals];
const forbidden = [
  "FULLY_PASSED",
  "PRODUCTION_READY",
  "BUSINESS_PRODUCTION_GO",
  "DORMITORY_L2_PRODUCTION_ALLOWED",
  "REPAIR_PARTS_HR_PRODUCTION_ALLOWED",
  "DAY2_STARTED",
  "production-ready"
];
const noGoItems = [];
for (const file of scanFiles) {
  const content = readText(file);
  for (const token of forbidden) {
    if (content.includes(token)) noGoItems.push(`${file} 包含禁止文案：${token}`);
  }
}

const result = manualResult("check-no-production-ready-copy", noGoItems, { scanFiles, forbidden });
writeJson("artifacts/docs/no-production-ready-copy-result.json", result);
failIfNeeded(noGoItems, "no production-ready copy check");
console.log("no production-ready copy check: PASS");
