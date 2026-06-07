import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kernel = readJson("docs/business/dormitory/dormitory-operating-kernel.json");
const releaseTrain = readJson("docs/business/dormitory/dormitory-release-train.yml");
const violations = [];

requireValue((releaseTrain.derivedFrom ?? []).includes("docs/business/dormitory/dormitory-operating-kernel.json"), "release.derived_missing", "发布列车必须由宿舍内核派生。");
requireValue(releaseTrain.manualEditAllowed === false, "release.manual_edit", "发布列车不得手改。");
requireValue((releaseTrain.trains ?? []).length === 3, "release.train_count", "宿舍发布列车必须是三条。");
const trainIds = new Set((kernel.releaseTrains ?? []).map((item) => item.id));
for (const train of releaseTrain.trains ?? []) {
  requireValue(trainIds.has(train.id), "release.train_unknown", `未知发布列车：${train.id}`, { trainId: train.id });
  requireValue((train.workItems ?? []).length > 0, "release.workitems_missing", `${train.id} 缺少 WorkItem。`, { trainId: train.id });
  requireValue(String(train.sequenceZh ?? "").includes("内核定义") && String(train.sequenceZh ?? "").includes("内核修正"), "release.sequence_invalid", `${train.id} 缺少产品化推进顺序。`, { trainId: train.id });
}
const covered = new Set((releaseTrain.trains ?? []).flatMap((item) => item.workItems ?? []));
for (const item of kernel.workItems ?? []) {
  if (item.canonicalOwner === "dormitory") {
    requireValue(covered.has(item.workItemType), "release.workitem_not_covered", `${item.workItemType} 未进入发布列车。`, { workItemType: item.workItemType });
  }
}

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Dormitory release train check: PASS");

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}
