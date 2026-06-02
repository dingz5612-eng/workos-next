import { exists, failIfNeeded, manualResult, readText, requiredManuals, sha256, writeJson } from "./manual-check-lib.mjs";

const noGoItems = [];
const manuals = requiredManuals.map((file) => {
  const present = exists(file);
  const content = present ? readText(file) : "";
  if (!present) noGoItems.push(`缺少手册：${file}`);
  if (present && !content.trim().startsWith("#")) noGoItems.push(`${file} 必须有 Markdown 标题。`);
  return {
    file,
    present,
    hash: present ? sha256(content) : null,
    containsCurrentState: /Dormitory|Business Production|Repair \/ Parts \/ HR|Day-2/.test(content)
  };
});

for (const file of requiredManuals) {
  const content = exists(file) ? readText(file) : "";
  if (file.includes("/user/")) {
    for (const phrase of ["今天应该看哪里", "工作台状态", "权限不足", "缺证据", "重复提交", "403 / 409 / 422", "提交结果", "不能做"]) {
      if (!content.includes(phrase)) noGoItems.push(`${file} 缺少用户手册段落：${phrase}`);
    }
  }
}

const result = manualResult("check-doc-inventory", noGoItems, { manuals });
writeJson("artifacts/docs/doc-inventory-result.json", result);
failIfNeeded(noGoItems, "doc inventory check");
console.log("doc inventory check: PASS");
