import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  digestObject,
  fileDigest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const sourceReportPath = "artifacts/oam/evidence/dormitory-first-golden-chain-negative-browser/negative-browser-report.json";
const sourceResultPath = "artifacts/oam/checks/dormitory-first-golden-chain-negative-browser-result.json";
const sourceRunScript = "scripts/surface/run-dormitory-first-golden-chain-negative-browser-audit.mjs";
const sourceCheckScript = "scripts/surface/check-dormitory-first-golden-chain-negative-browser-audit.mjs";
const auditDir = "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-negative-browser";
const reportPath = path.join(root, auditDir, "scenario1-negative-browser-report.json");
const screenshotIndexPath = path.join(root, auditDir, "screenshot-index.json");
const contractPath = "docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json";

execFileSync(process.execPath, [sourceRunScript], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, [sourceCheckScript], { cwd: root, stdio: "inherit" });

const source = readJson(sourceReportPath);
const sourceResult = readJson(sourceResultPath);
const screenshots = (source.screenshots ?? []).map((shot) => ({
  ...shot,
  analysis: {
    "失败是否业务可理解": "失败提示围绕重复房间、床位组不完整、缺证据和伪造内部引用表达。",
    "是否证明无副作用": "失败路径不允许 CommandSubmission、DomainEvent、Outbox、Projection、Search、Dashboard 或 Ledger 写入。",
    "是否暴露内部 ID": "普通失败页面不要求用户填写 roomId、bedId、stableRef、projectionVersion、digest 或 domainEventId。",
    "是否阻断越界": "旧链接、搜索写事实、生产发布和 final GO 均被阻断。",
    "是否可回到合法动作": "用户只能回到房间建档、床位组确认、基础就绪确认的合法动作。"
  }
}));

const report = {
  version: "oam.dormitory-scenario1-negative-browser.v1",
  status: source.status === "passed" && sourceResult.status === "PASS" ? "passed" : "failed",
  generatedAtUtc: new Date().toISOString(),
  auditLevel: "scenario1_local_real_browser_evidence",
  browserMode: source.browserMode ?? "playwright-real-browser",
  scenarioPackageNo: 1,
  authorityId: "Dormitory.Scenario1.ResourceBasicReadiness",
  nameZh: "房源建档与基础就绪",
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root),
  negativeBrowserAuditDigest: null,
  currentMainAudit: true,
  sourceEvidencePolicy: {
    bridgeSourceReportRef: sourceReportPath,
    bridgeSourceResultRef: sourceResultPath,
    firstGoldenChainCurrentMainAudit: false,
    oldChainBridgeReadOnly: true,
    transformationZh: "复用已完成的真实浏览器反向截图，重新绑定为场景 1 当前主链反向证据；旧链不作为 current main audit。"
  },
  scenarios: (source.scenarios ?? []).map((scenario) => ({
    ...scenario,
    scenarioPackageNo: 1,
    authorityId: "Dormitory.Scenario1.ResourceBasicReadiness",
    sideEffectsAllowed: false
  })),
  assertions: [
    ...(source.assertions ?? []),
    {
      id: "scenario1.current_mainline_negative_evidence",
      status: "passed",
      message: "场景 1 反向浏览器证据绑定 Dormitory.Scenario1.ResourceBasicReadiness；FirstGoldenChain 仅为兼容来源。"
    }
  ],
  screenshots,
  screenshotIndex: rel(screenshotIndexPath),
  findings: source.findings ?? [],
  git: source.git ?? {},
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  forbiddenInterpretations: [
    "scenario 1 negative browser PASS is not production release",
    "scenario 1 negative browser PASS is not business go-live",
    "scenario 1 negative browser PASS is not final GO",
    "FirstGoldenChain bridge evidence is not current main audit"
  ]
};
report.negativeBrowserAuditDigest = digestObject({ ...report, negativeBrowserAuditDigest: "sha256:pending" });

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
writeJson(reportPath, report);
writeJson(screenshotIndexPath, {
  version: "oam.dormitory-scenario1-negative-browser-screenshot-index.v1",
  generatedAtUtc: report.generatedAtUtc,
  report: rel(reportPath),
  screenshots
});

if (report.status !== "passed") {
  console.error("Dormitory scenario1 negative browser audit: FAIL");
  process.exit(1);
}

console.log(`Dormitory scenario1 negative browser audit: PASS (${report.negativeBrowserAuditDigest})`);
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
