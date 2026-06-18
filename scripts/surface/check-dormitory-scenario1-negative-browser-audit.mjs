import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const reportRelPath = "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-negative-browser/scenario1-negative-browser-report.json";
const resultRelPath = "artifacts/oam/checks/dormitory-scenario1-negative-browser-result.json";
const contractPath = "docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json";
const runtimeRulesPath = "docs/contracts/generated/dormitory/scenario1-runtime-rules.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json";

const report = readJsonIfExists(reportRelPath) ?? {};
const failures = [];
const currentHead = command("git rev-parse HEAD");
const analysisKeys = ["失败是否业务可理解", "是否证明无副作用", "是否暴露内部 ID", "是否阻断越界", "是否可回到合法动作"];

if (report.status !== "passed") failures.push("negative browser report status must be passed.");
if (report.authorityId !== "Dormitory.Scenario1.ResourceBasicReadiness") failures.push("negative report must bind scenario1 authority.");
if (report.nameZh !== "房源建档与基础就绪") failures.push("negative report must show business name 房源建档与基础就绪.");
if (report.currentMainAudit !== true) failures.push("scenario1 negative report must be current main audit.");
if (report.sourceEvidencePolicy?.firstGoldenChainCurrentMainAudit !== false ||
  report.sourceEvidencePolicy?.oldChainBridgeReadOnly !== true) {
  failures.push("FirstGoldenChain bridge source must be readonly and not current main audit.");
}
for (const [field, expected] of Object.entries({
  generatedContractDigest: fileDigest(contractPath, root),
  runtimeRulesDigest: fileDigest(runtimeRulesPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root)
})) {
  if (report[field] !== expected) failures.push(`negative report ${field} mismatch: expected ${expected}, actual ${report[field] ?? "missing"}.`);
}
if (!isSha256Digest(report.negativeBrowserAuditDigest) ||
  report.negativeBrowserAuditDigest !== digestObject({ ...report, negativeBrowserAuditDigest: "sha256:pending" })) {
  failures.push("negativeBrowserAuditDigest mismatch.");
}
if (report.git?.headSha !== currentHead) {
  failures.push(`negative browser report headSha must equal current HEAD ${currentHead}, actual: ${report.git?.headSha ?? "missing"}.`);
}
if (report.productionConfirmAllowed !== false ||
  report.businessGoLiveAllowed !== false ||
  report.releaseAuthority !== false ||
  report.finalGoNoGo !== "NO_GO") {
  failures.push("negative browser report must keep production/release/final GO closed.");
}
if (!Array.isArray(report.scenarios) || report.scenarios.length < 12) failures.push("negative report must include scenario1 failure scenarios.");
for (const scenario of report.scenarios ?? []) {
  if (scenario.status !== "passed") failures.push(`negative scenario must pass: ${scenario.id ?? "(missing)"}.`);
  if (scenario.sideEffectsAllowed !== false) failures.push(`negative scenario sideEffectsAllowed must be false: ${scenario.id ?? "(missing)"}.`);
}
for (const shot of report.screenshots ?? []) {
  if (!shot.path || !fs.existsSync(path.join(root, shot.path))) failures.push(`negative screenshot missing: ${shot.path ?? "(empty)"}.`);
  if (!/^[a-f0-9]{64}$/.test(String(shot.sha256 ?? ""))) failures.push(`negative screenshot sha256 invalid: ${shot.path ?? "(empty)"}.`);
  for (const key of analysisKeys) {
    if (!shot.analysis?.[key]) failures.push(`negative screenshot ${shot.path ?? "(empty)"} missing analysis key: ${key}.`);
  }
}
const assertion = (report.assertions ?? []).find((item) => item.id === "scenario1.current_mainline_negative_evidence");
if (!assertion || assertion.status !== "passed") failures.push("scenario1.current_mainline_negative_evidence assertion must pass.");

const result = {
  version: "oam.dormitory-scenario1-negative-browser-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityId: report.authorityId ?? null,
  nameZh: report.nameZh ?? null,
  reportPath: reportRelPath,
  negativeBrowserAuditDigest: report.negativeBrowserAuditDigest ?? null,
  scenarioCount: report.scenarios?.length ?? 0,
  screenshotCount: report.screenshots?.length ?? 0,
  generatedContractDigest: report.generatedContractDigest ?? null,
  runtimeRulesDigest: report.runtimeRulesDigest ?? null,
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultRelPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario1 negative browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario1 negative browser audit check: PASS (${result.negativeBrowserAuditDigest})`);

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
