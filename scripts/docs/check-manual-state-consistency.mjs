import { failIfNeeded, manualResult, readText, requiredManuals, requiredStateLines, writeJson } from "./manual-check-lib.mjs";

const noGoItems = [];
const stateBearingManuals = requiredManuals.filter((file) =>
  file.includes("/system/") ||
  file.includes("/project/") ||
  file.includes("/operations/")
);
for (const file of stateBearingManuals) {
  const content = readText(file);
  for (const line of requiredStateLines) {
    if (!content.includes(line)) noGoItems.push(`${file} 缺少当前状态：${line}`);
  }
  if (/Day-2 started|Day-2 已启动|启动 Day-2/.test(content)) {
    noGoItems.push(`${file} 不得暗示 Day-2 已启动。`);
  }
}

const result = manualResult("check-manual-state-consistency", noGoItems, { stateBearingManuals, requiredStateLines });
writeJson("artifacts/docs/manual-state-consistency-result.json", result);
failIfNeeded(noGoItems, "manual state consistency check");
console.log("manual state consistency check: PASS");
