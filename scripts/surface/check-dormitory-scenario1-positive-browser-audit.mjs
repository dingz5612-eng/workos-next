import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  digestObject,
  fileDigest,
  isSha256Digest
} from "../oam/lib/capability-projection-digests.mjs";

const root = process.cwd();
const reportRelPath = "artifacts/oam/evidence/dormitory-scenario1-resource-basic-readiness-positive-browser/scenario1-positive-browser-report.json";
const resultRelPath = "artifacts/oam/checks/dormitory-scenario1-positive-browser-result.json";
const contractPath = "docs/contracts/generated/dormitory/scenario1-resource-basic-readiness.generated.json";
const stepsPath = "docs/contracts/generated/dormitory/scenario1-steps-fields.generated.json";
const surfacePath = "docs/contracts/generated/dormitory/scenario1-surface-navigation.generated.json";
const testPlanPath = "docs/contracts/generated/dormitory/scenario1-test-plan.generated.json";

const report = readJsonIfExists(reportRelPath) ?? {};
const failures = [];
const currentHead = command("git rev-parse HEAD");
const analysisKeys = ["用户是否看得懂", "字段是否合理", "按钮是否顺", "是否暴露内部 ID", "是否误导为下游状态"];

if (report.status !== "passed") failures.push("positive browser report status must be passed.");
if (report.authorityId !== "Dormitory.Scenario1.ResourceBasicReadiness") failures.push("positive report must bind scenario1 authority.");
if (report.nameZh !== "房源建档与基础就绪") failures.push("positive report must show business name 房源建档与基础就绪.");
if (report.currentMainAudit !== true) failures.push("scenario1 positive report must be current main audit.");
if (report.sourceEvidencePolicy?.firstGoldenChainCurrentMainAudit !== false ||
  report.sourceEvidencePolicy?.oldChainBridgeReadOnly !== true) {
  failures.push("FirstGoldenChain bridge source must be readonly and not current main audit.");
}
for (const [field, expected] of Object.entries({
  generatedContractDigest: fileDigest(contractPath, root),
  stepsContractDigest: fileDigest(stepsPath, root),
  surfaceContractDigest: fileDigest(surfacePath, root),
  testPlanDigest: fileDigest(testPlanPath, root)
})) {
  if (report[field] !== expected) failures.push(`positive report ${field} mismatch: expected ${expected}, actual ${report[field] ?? "missing"}.`);
}
if (!isSha256Digest(report.positiveBrowserAuditDigest) ||
  report.positiveBrowserAuditDigest !== digestObject({ ...report, positiveBrowserAuditDigest: "sha256:pending" })) {
  failures.push("positiveBrowserAuditDigest mismatch.");
}
if (report.git?.headSha !== currentHead) {
  failures.push(`positive browser report headSha must equal current HEAD ${currentHead}, actual: ${report.git?.headSha ?? "missing"}.`);
}
if (report.productionConfirmAllowed !== false ||
  report.businessGoLiveAllowed !== false ||
  report.releaseAuthority !== false ||
  report.finalGoNoGo !== "NO_GO") {
  failures.push("positive browser report must keep production/release/final GO closed.");
}
if (!Array.isArray(report.steps) || report.steps.length < 12) failures.push("positive report must include scenario1 real browser steps.");
if (!JSON.stringify(report.steps ?? []).includes("房源建档与基础就绪完成")) {
  failures.push("positive report must prove 房源建档与基础就绪完成 is visible.");
}
for (const shot of report.screenshots ?? []) {
  if (!shot.path || !fs.existsSync(path.join(root, shot.path))) failures.push(`positive screenshot missing: ${shot.path ?? "(empty)"}.`);
  if (!/^[a-f0-9]{64}$/.test(String(shot.sha256 ?? ""))) failures.push(`positive screenshot sha256 invalid: ${shot.path ?? "(empty)"}.`);
  for (const key of analysisKeys) {
    if (!shot.analysis?.[key]) failures.push(`positive screenshot ${shot.path ?? "(empty)"} missing analysis key: ${key}.`);
  }
}
for (const assertionId of ["scenario1.current_mainline_evidence", "completion.scenario1_visible", "completion.no_raw_stable_id"]) {
  const assertion = (report.assertions ?? []).find((item) => item.id === assertionId);
  if (!assertion || assertion.status !== "passed") failures.push(`positive assertion must pass: ${assertionId}.`);
}

const result = {
  version: "oam.dormitory-scenario1-positive-browser-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  authorityId: report.authorityId ?? null,
  nameZh: report.nameZh ?? null,
  reportPath: reportRelPath,
  positiveBrowserAuditDigest: report.positiveBrowserAuditDigest ?? null,
  screenshotCount: report.screenshots?.length ?? 0,
  generatedContractDigest: report.generatedContractDigest ?? null,
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultRelPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory scenario1 positive browser audit check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory scenario1 positive browser audit check: PASS (${result.positiveBrowserAuditDigest})`);

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
