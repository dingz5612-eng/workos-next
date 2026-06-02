import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const resultPath = path.join(root, "artifacts/surface/oam-04b-surface-productization-final-result.json");
const reportPath = path.join(root, "docs/surface/oam-04b-surface-productization-final-report.md");
const violations = [];

const requiredArtifacts = [
  "artifacts/surface/view-model-contract-result.json",
  "artifacts/surface/mobile-work-productization-result.json",
  "artifacts/surface/user-facing-surface-copy-result.json",
  "artifacts/surface/mobile-visible-copy-result.json",
  "artifacts/surface/pc-governance-productization-result.json",
  "artifacts/surface/experience-module-productization-result.json",
  "artifacts/surface/dormitory-scenario-journey-result.json",
  "artifacts/screenshots/oam-ux-baseline/index.json",
  "artifacts/screenshots/dormitory-journeys/index.json"
];

const artifacts = requiredArtifacts.map((ref) => ({ ref, body: readJson(ref) }));
for (const item of artifacts) {
  if (!item.body) continue;
  if (item.body.status && item.body.status !== "passed") {
    violations.push(v("oam04b.artifact_not_passed", `${item.ref} 必须为 passed。`, { ref: item.ref, status: item.body.status }));
  }
  if (item.body.productionAllowed === true || item.body.dormitoryL2ProductionAllowed === true || item.body.repairPartsHrProductionAllowed === true) {
    violations.push(v("oam04b.production_boundary", `${item.ref} 不得允许 production / L2 / Repair / Parts / HR。`, { ref: item.ref }));
  }
}

const journey = artifacts.find((item) => item.ref.includes("dormitory-scenario-journey-result"))?.body || {};
if (journey.scenarioCount !== 10) violations.push(v("oam04c.scenario_count", "OAM-04C 必须覆盖 10 条宿舍场景。"));
if (journey.day2Started !== false) violations.push(v("oam04c.day2_started", "OAM-04C 不得启动 Day-2。"));

const screenshotIndex = artifacts.find((item) => item.ref.includes("dormitory-journeys/index"))?.body || {};
if ((screenshotIndex.entries || []).length !== 10) violations.push(v("oam04c.screenshot_index", "宿舍旅程截图索引必须包含 10 条记录。"));

const gitHead = exec("git rev-parse HEAD");
const result = {
  generatedAtUtc: new Date().toISOString(),
  generatedBy: "scripts/surface/check-oam-04b-surface-productization-final.mjs",
  status: violations.length ? "failed" : "passed",
  gitHead,
  acceptedStatuses: [
    "OAM_04B_SURFACE_EXPERIENCE_PRODUCTIZATION_PASSED",
    "OAM_04C_DORMITORY_SCENARIO_JOURNEY_ACCEPTED"
  ],
  artifacts: artifacts.map((item) => ({ ref: item.ref, status: item.body?.status || "present" })),
  dormitoryStatus: "L1 Internal Pilot Observation only",
  dormitoryL2Production: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview",
  day2Started: false,
  violations
};

fs.mkdirSync(path.dirname(resultPath), { recursive: true });
fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, markdownReport(result), "utf8");

if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("OAM-04B/04C final productization check failed.");
}
console.log("OAM-04B/04C surface productization final check: PASS");

function readJson(ref) {
  const filePath = path.join(root, ref);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    violations.push(v("oam04b.artifact_missing", `缺少或无法读取 ${ref}。`, { ref, error: error.message }));
    return null;
  }
}

function markdownReport(result) {
  return `# OAM-04B / OAM-04C Surface Productization Final Report

中文结论：端面体验产品化与宿舍 10 场景旅程验收已完成本地聚合检查。

- 当前提交：${result.gitHead}
- OAM-04B 状态：OAM_04B_SURFACE_EXPERIENCE_PRODUCTIZATION_PASSED
- OAM-04C 状态：OAM_04C_DORMITORY_SCENARIO_JOURNEY_ACCEPTED
- 宿舍状态：L1 Internal Pilot Observation only
- Dormitory L2 Production：false
- Business Production：blocked
- Repair / Parts / HR：L0 Contract Preview
- Day-2：未启动

## 证据

${result.artifacts.map((item) => `- ${item.ref}: ${item.status}`).join("\n")}

## 边界

本报告不授予 L2 Production，不授予 Business Production，不放开 Repair / Parts / HR。
`;
}

function exec(command) {
  return execSync(command, { cwd: root, encoding: "utf8" }).trim();
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

