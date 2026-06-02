import fs from "node:fs";
import path from "node:path";
import { routeView } from "../../apps/mobile/src/appRouter.js";
import { createSurfaceCtx, visibleText } from "../../apps/mobile/src/__tests__/surfaceContractTestHelpers.js";

const root = process.cwd();
const artifactPath = "artifacts/surface/experience-module-productization-result.json";
const violations = [];

const ctx = createSurfaceCtx({ view: "operationPanel", selectedWorkItemId: "T-ROOM-CREATE" });
const operationPanel = routeView(ctx);
const me = routeView(createSurfaceCtx({ view: "me" }));
const permission = routeView(createSurfaceCtx({ view: "releaseFlightDeck" }));
const text = visibleText(`${operationPanel}\n${me}\n${permission}`);

for (const token of ["OperationPanelView", "TrustedConfirmSheet", "EvidenceSheet", "ProjectionPendingState", "ActionResult", "UploadQueue", "SubmitQueue", "DeviceTrustPanel"]) {
  if (text.includes(token)) violations.push(v("experience_module.component_name_visible", `普通用户可见文本不得出现组件名 ${token}`, { token }));
}

const technicalContainers = operationPanel.match(/<details class="operation-technical-details"[\s\S]*?<\/details>/g) || [];
const operationPanelWithoutTechnical = technicalContainers.reduce((html, container) => html.replace(container, ""), operationPanel);
for (const rawAttr of ["data-case-id", "data-submission-id", "data-payload-fingerprint"]) {
  if (operationPanelWithoutTechnical.includes(rawAttr)) violations.push(v("experience_module.raw_attr_visible", `普通展示容器不得出现 ${rawAttr}`, { rawAttr }));
}

if (!technicalContainers.some((container) => ["data-case-id", "data-submission-id", "data-payload-fingerprint"].every((rawAttr) => container.includes(rawAttr)))) {
  violations.push(v("experience_module.technical_audit_attrs_missing", "技术详情容器必须保留 case、submission 和 payload 审计属性。"));
}

if (!operationPanel.includes('data-work-item-id="W-STAY-RESOURCE:roomSetup"')) {
  violations.push(v("experience_module.work_item_open_binding_missing", "必须保留 persisted WorkItem 打开绑定。"));
}

if (operationPanel.includes("T-ROOM-CREATE")) {
  violations.push(v("experience_module.legacy_task_id_visible", "普通 Operation Panel 不得出现 legacy task id。"));
}

for (const label of ["可信确认", "提交结果", "可信证据", "当前设备", "权限诊断"]) {
  if (!text.includes(label)) violations.push(v("experience_module.localized_label_missing", `体验模块缺少中文文案：${label}`, { label }));
}

writeArtifact();
if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("experience module productization check failed.");
}
console.log("experience module productization check: PASS");

function writeArtifact() {
  const fullPath = path.join(root, artifactPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "scripts/surface/check-experience-module-productization.mjs",
    status: violations.length ? "failed" : "passed",
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    violations
  }, null, 2)}\n`, "utf8");
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
