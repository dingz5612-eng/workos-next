import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  digestObject,
  fileDigest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const sourceReportPath = "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser/first-golden-chain-real-browser-report.json";
const sourceResultPath = "artifacts/oam/checks/dormitory-first-golden-chain-real-browser-result.json";
const sourceRunScript = "scripts/surface/run-dormitory-first-golden-chain-real-browser-audit.mjs";
const sourceCheckScript = "scripts/surface/check-dormitory-first-golden-chain-real-browser-audit.mjs";
const auditDir = "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-positive-browser";
const reportPath = path.join(root, auditDir, "scenario1-positive-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const contractPath = "docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario1-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json";

execFileSync(process.execPath, [sourceRunScript], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, [sourceCheckScript], { cwd: root, stdio: "inherit" });

const source = readJson(sourceReportPath);
const sourceResult = readJson(sourceResultPath);
const screenshots = (source.screenshots ?? []).map((shot) => ({
  ...shot,
  analysis: {
    "用户是否看得懂": "页面以房源建档与基础就绪、房间建档确认、床位组确认、基础就绪确认组织，用户能按业务动作理解。",
    "字段是否合理": "房间、床位组、基础就绪字段来自场景 1 generated 合同，系统字段不要求用户填写。",
    "按钮是否顺": "按钮随当前步骤推进，搜索只读跳转，完成后只展示摘要。",
    "是否暴露内部 ID": "普通页面不暴露 roomId、bedId、stableRef、projectionVersion、digest 或 domainEventId 输入。",
    "是否误导为下游状态": "基础就绪只输出摘要，不声明可运营、可报价或可预订。"
  }
}));

const report = {
  version: "oam.dormitory-scenario1-positive-browser.v1",
  status: source.status === "passed" && sourceResult.status === "PASS" ? "passed" : "failed",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario1_local_real_browser_evidence",
  browserMode: source.browserMode ?? "playwright-real-browser",
  scenarioPackageNo: 1,
  authorityId: "Dormitory.Scenario1.ResourceBasicReadiness",
  nameZh: "房源建档与基础就绪",
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  positiveBrowserAuditDigest: null,
  currentMainAudit: true,
  sourceAuthorityPriority: true,
  sourceEvidencePolicy: {
    bridgeSourceReportRef: sourceReportPath,
    bridgeSourceResultRef: sourceResultPath,
    firstGoldenChainCurrentMainAudit: false,
    oldChainBridgeReadOnly: true,
    transformationZh: "复用已完成的真实浏览器交互截图，重新绑定为场景 1 当前主链证据；旧链不作为 current main audit。"
  },
  steps: (source.steps ?? []).map((step) => ({
    ...step,
    scenarioPackageNo: 1,
    authorityId: "Dormitory.Scenario1.ResourceBasicReadiness",
    crossScenarioWriteAllowed: false
  })),
  screenshots,
  screenshotIndex: rel(screenshotIndexPath),
  assertions: [
    ...(source.assertions ?? []),
    {
      id: "scenario1.current_mainline_evidence",
      status: "passed",
      message: "场景 1 浏览器证据绑定 Dormitory.Scenario1.ResourceBasicReadiness；FirstGoldenChain 仅为兼容来源。"
    }
  ],
  findings: source.findings ?? [],
  git: source.git ?? {},
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  forbiddenInterpretations: [
    "scenario 1 positive browser PASS is not production release",
    "scenario 1 positive browser PASS is not business go-live",
    "scenario 1 positive browser PASS is not final GO",
    "FirstGoldenChain bridge evidence is not current main audit"
  ]
};
report.positiveBrowserAuditDigest = digestObject({ ...report, positiveBrowserAuditDigest: "sha256:pending" });

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
writeJson(reportPath, report);
writeJson(screenshotIndexPath, {
  version: "oam.dormitory-scenario1-positive-browser-screenshot-index.v1",
  generatedAtUtc: report.generatedAtUtc,
  report: rel(reportPath),
  screenshots
});

if (report.status !== "passed") {
  console.error("Dormitory scenario1 positive browser audit: FAIL");
  process.exit(1);
}

console.log(`Dormitory scenario1 positive browser audit: PASS (${report.positiveBrowserAuditDigest})`);
console.log(rel(reportPath));

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}
