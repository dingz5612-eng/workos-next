import { failIfNeeded, manualResult, readText, requiredManuals, writeJson } from "./manual-check-lib.mjs";

const refs = [
  "artifacts/release-state/current-state.json",
  "artifacts/release-state/post-merge-attestation.json",
  "artifacts/baseline/oam-clean-baseline-result.json",
  "docs/history/phase-0-1-archive.md",
  "docs/manuals/project/post-oam-04b-04c-pure-baseline-report.md"
];
const combined = requiredManuals.map(readText).join("\n");
const noGoItems = refs.filter((ref) => !combined.includes(ref)).map((ref) => `手册体系缺少交叉引用：${ref}`);

for (const userManual of requiredManuals.filter((file) => file.includes("/user/"))) {
  const content = readText(userManual);
  if (!content.includes("OperationPanel") && !content.includes("Control")) {
    noGoItems.push(`${userManual} 必须引用办理面板或控制面。`);
  }
}

const result = manualResult("check-manual-cross-links", noGoItems, { checkedRefs: refs });
writeJson("artifacts/docs/manual-cross-links-result.json", result);
failIfNeeded(noGoItems, "manual cross-links check");
console.log("manual cross-links check: PASS");
