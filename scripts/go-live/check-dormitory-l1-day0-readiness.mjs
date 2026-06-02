import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const failures = [];
const holds = [];

function main() {
  const scope = readJson("docs/go-live/dormitory/internal-pilot-scope.yml");
  const masterData = readJson("docs/go-live/dormitory/master-data.yml");
  const currentState = readJson("artifacts/release-state/current-state.json");
  const goNoGo = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
  const masterReadiness = readJson("artifacts/go-live/dormitory/master-data-readiness.json");
  const runtimeProof = readJson("artifacts/proof/runtime-proof-result.json");
  const dormRuntimeProof = readJson("artifacts/go-live/dormitory/runtime-proof-result.json");
  const financeSemantic = readJson("artifacts/finance/finance-semantic-truth-result.json");
  const ledgerSemantic = readJson("artifacts/go-live/dormitory/ledger-semantic-result.json");
  const trustBoundary = readJson("artifacts/trust/trust-boundary-result.json");
  const slo = readJson("artifacts/operations/dormitory/slo-result.json");
  const observationDay = readJson("artifacts/operations/dormitory/observation-day-01.json");
  const l1ToL2 = readJson("artifacts/operations/dormitory/l1-to-l2-readiness.json");
  const rollback = readJson("artifacts/go-live/dormitory/rollback-drill-result.json");
  const financeClose = readJson("artifacts/go-live/dormitory/finance-daily-close-result.json");
  const training = readJson("artifacts/go-live/dormitory/training-signoff-result.json");
  const maturity = readJson("artifacts/portfolio/business-line-maturity-result.json");
  const alerts = readJson("docs/go-live/dormitory/alerts.yml");
  const mainHead = currentMainHead();

  assertEqual(currentState.currentMain?.headSha, mainHead, "current-state main HEAD 必须等于 origin/main。");
  assertEqual(goNoGo.latestMain?.commitSha, mainHead, "DORM-INT final artifact 必须绑定当前 main。");
  assertEqual(currentState.authoritativeState?.dormitory, "L1_INTERNAL_PILOT_OBSERVATION", "current-state 中宿舍必须是 L1_INTERNAL_PILOT_OBSERVATION。");
  assertEqual(currentState.authoritativeState?.businessProduction, "BLOCKED", "Business Production 必须 blocked。");
  assertEqual(currentState.authoritativeState?.dormitoryL2, "BLOCKED", "Dormitory L2 必须 blocked。");

  assertEqual(scope.tenantId, masterData.tenantRuntimeConfigs?.[0]?.tenantId, "scope tenantId 必须与主数据一致。");
  assertEqual(scope.siteId, masterData.tenantRuntimeConfigs?.[0]?.siteId, "scope siteId 必须与主数据一致。");
  assertEqual(scope.pilotId, masterData.tenantRuntimeConfigs?.[0]?.pilotId, "scope pilotId 必须与主数据一致。");
  assertStatus(masterReadiness.status, "passed", "主数据 readiness 必须 passed。");

  const scopeRoles = new Set(scope.enabledRoles ?? []);
  const scopeUsers = new Set((scope.enabledUsers ?? []).map((user) => user.userId));
  const scopeDevices = new Set((scope.enabledDevices ?? []).map((device) => device.deviceId));
  const scopeWorkItemTypes = new Set(scope.enabledWorkItemTypes ?? []);

  for (const role of scope.enabledRoles ?? []) {
    const users = (scope.enabledUsers ?? []).filter((user) => user.role === role);
    assert(users.length > 0, `角色 ${role} 必须至少有一个 enabled user。`);
  }

  for (const user of masterData.users ?? []) {
    if (scopeUsers.has(user.userId)) {
      assert(scopeRoles.has(user.role), `用户 ${user.userId} 的角色必须在 enabledRoles 内。`);
      assert((user.capabilities ?? []).length > 0, `用户 ${user.userId} 必须有 capability。`);
    }
  }

  for (const user of scope.enabledUsers ?? []) {
    assertEqual(user.tenantId, scope.tenantId, `用户 ${user.userId} tenant 必须在 scope 内。`);
    assertEqual(user.siteId, scope.siteId, `用户 ${user.userId} site 必须在 scope 内。`);
  }

  for (const device of scope.enabledDevices ?? []) {
    assertEqual(device.trustState, "trusted", `设备 ${device.deviceId} 必须 trusted。`);
    assert(scopeUsers.has(device.assignedUserId), `设备 ${device.deviceId} assignedUserId 必须在 enabledUsers 内。`);
  }

  for (const device of masterData.deviceTrust ?? []) {
    if (scopeDevices.has(device.deviceId)) assertEqual(device.trustState, "trusted", `主数据设备 ${device.deviceId} 必须 trusted。`);
  }

  for (const workItem of masterData.workItemTypes ?? []) {
    if (scopeWorkItemTypes.has(workItem.workItemType)) {
      assert(workItem.canCreateRealWorkItem === true, `${workItem.workItemType} 必须可创建真实 WorkItem。`);
    }
  }

  assertStatus(trustBoundary.status, "passed", "Trust Boundary Kernel 必须 passed。");
  assertStatus(runtimeProof.status, "passed", "Runtime Proof Harness 必须 passed。");
  assertStatus(dormRuntimeProof.status, "passed", "Dormitory Runtime Proof 必须 passed。");
  assertEqual(runtimeProof.sourceMode, "live_api_db", "Runtime Proof sourceMode 必须是 live_api_db。");
  assertEqual(dormRuntimeProof.sourceMode, "live_api_db", "Dormitory Runtime Proof sourceMode 必须是 live_api_db。");
  assertStatus(financeSemantic.status, "passed", "Finance Semantic Truth 必须 passed。");
  assertStatus(ledgerSemantic.status, "passed", "Ledger Semantic result 必须 passed。");
  assertStatus(slo.status, "passed", "Observation SLO thresholds 必须 configured 且 passed。");
  assert((slo.p0StopControlCount ?? 0) >= 14, "P0 stop controls 必须完整配置。");
  assert((slo.p1HoldControlCount ?? 0) >= 9, "P1 hold controls 必须完整配置。");
  assertStatus(rollback.status, "passed", "rollback readiness 必须 passed。");
  assertEqual(rollback.drill?.releaseControl?.visible, true, "Release Control 必须显示 hold reason。");
  assertStatus(financeClose.status, "passed", "Day-0 finance daily close baseline 必须 exists 且 passed。");
  assertEqual(financeClose.drill?.ledgerProjectionRebuild?.consistencyStatus, "consistent", "ledger projection rebuild 必须一致。");
  assertStatus(training.status, "passed", "training signoff 必须 passed。");
  assert((training.roleCount ?? 0) >= 6, "training signoff 必须覆盖 6 个角色。");

  for (const required of [
    "docs/go-live/dormitory/on-call-runbook.md",
    "docs/go-live/dormitory/alerts.yml",
    "docs/go-live/dormitory/rollback-playbook.md"
  ]) assertFile(required);

  for (const alert of alerts.alerts ?? []) {
    if (alert.severity === "P0") {
      assert(Boolean(alert.owner), `P0 alert ${alert.alertId} 必须有 owner。`);
      assert(Boolean(alert.responseTime), `P0 alert ${alert.alertId} 必须有 response time。`);
      assert(Boolean(alert.nextAction), `P0 alert ${alert.alertId} 必须有 next action。`);
      assert(Boolean(alert.escalationTarget), `P0 alert ${alert.alertId} 必须有 escalation target。`);
      assert(Boolean(alert.relatedRefType), `P0 alert ${alert.alertId} 必须有关联 WorkItem 或 GateResult。`);
    }
  }

  assertEqual(observationDay.status, "passed", "Day-0 观察基线必须 passed。");
  assertEqual(observationDay.p0StopCount, 0, "Day-0 不得有 P0 stop item。");
  assertEqual(observationDay.p1HoldCount, 0, "Day-0 不得有 unresolved P1 hold item。");
  assertEqual(observationDay.sloSummary?.rollbackReadiness, "green", "rollback readiness 必须 green。");
  assertEqual(l1ToL2.eligible, false, "L1-to-L2 readiness 默认必须 not eligible。");
  assertEqual(l1ToL2.status, "NOT_ELIGIBLE", "L1-to-L2 status 必须 NOT_ELIGIBLE。");
  assertFalse(l1ToL2.productionAllowed, "L1-to-L2 不得允许 production。");
  assertFalse(l1ToL2.l2ProductionAllowed, "L1-to-L2 不得允许 L2。");

  assertFalse(goNoGo.productionAllowed, "DORM-INT 不得允许 production。");
  assertFalse(goNoGo.dormitoryL2ProductionAllowed, "DORM-INT 不得允许 Dormitory L2。");
  assertFalse(maturity.dormitory?.productionAllowed, "Business-line maturity 不得允许 Dormitory production。");
  assertFalse(maturity.dormitory?.l2ProductionAllowed, "Business-line maturity 不得允许 Dormitory L2。");
  assert((maturity.l0BusinessLines ?? []).includes("repair"), "Repair 必须保持 L0。");
  assert((maturity.l0BusinessLines ?? []).includes("parts"), "Parts 必须保持 L0。");
  assert((maturity.l0BusinessLines ?? []).includes("hr"), "HR 必须保持 L0。");
  assertFalse(scope.featureFlags?.dormitoryL2Production, "scope featureFlag dormitoryL2Production 必须 false。");
  assertFalse(scope.featureFlags?.repairProduction, "scope featureFlag repairProduction 必须 false。");
  assertFalse(scope.featureFlags?.partsProduction, "scope featureFlag partsProduction 必须 false。");
  assertFalse(scope.featureFlags?.hrProduction, "scope featureFlag hrProduction 必须 false。");
  assert((scope.disabledActions ?? []).includes("productionBulkImport"), "productionBulkImport 必须 disabled。");
  assert((scope.disabledActions ?? []).includes("unrestrictedRefund"), "unrestrictedRefund 必须 disabled。");
  assert((scope.disabledActions ?? []).includes("periodClose"), "periodClose 必须 disabled。");

  const result = {
    generatedAtUtc: generatedAt,
    generatedBy: "check-dormitory-l1-day0-readiness",
    branch: currentBranch(),
    currentMainHead: mainHead,
    status: failures.length === 0 ? "passed" : "failed",
    finalStatus: failures.length === 0 ? "DORM_L1_OBSERVATION_DAY0_READY" : "DORM_L1_DAY0_FAILED",
    pilotId: scope.pilotId,
    tenantId: scope.tenantId,
    siteId: scope.siteId,
    day0Readiness: {
      internalPilotScope: "passed",
      masterData: masterReadiness.status,
      deviceTrust: "passed",
      evidenceTenantScope: trustBoundary.status,
      deviceSessionTenantScope: trustBoundary.status,
      runtimeProof: runtimeProof.status,
      financeSemanticTruth: financeSemantic.status,
      trustBoundary: trustBoundary.status,
      observationSlo: slo.status,
      rollbackReadiness: rollback.status,
      financeDailyCloseBaseline: financeClose.status,
      trainingSignoff: training.status,
      l1ToL2Readiness: l1ToL2.status
    },
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrProductionAllowed: false,
    p0StopItems: [],
    p1HoldItems: holds,
    noGoItems: failures,
    evidenceRefs: [
      "docs/go-live/dormitory/internal-pilot-scope.yml",
      "artifacts/go-live/dormitory/master-data-readiness.json",
      "artifacts/proof/runtime-proof-result.json",
      "artifacts/finance/finance-semantic-truth-result.json",
      "artifacts/trust/trust-boundary-result.json",
      "artifacts/operations/dormitory/slo-result.json",
      "artifacts/operations/dormitory/observation-day-01.json",
      "artifacts/go-live/dormitory/finance-daily-close-result.json",
      "artifacts/go-live/dormitory/rollback-drill-result.json",
      "artifacts/go-live/dormitory/training-signoff-result.json"
    ]
  };

  writeJson("artifacts/go-live/dormitory/day0-readiness-result.json", result);
  writeMarkdown("docs/go-live/dormitory/day0-readiness-report.md", renderReport(result));
  upsertEvidenceLedger([
    ledgerEntry("DORM_L1_OBSERVATION_DAY0", result.finalStatus, "artifacts/go-live/dormitory/day0-readiness-result.json", mainHead),
    ledgerEntry("DORMITORY_L1_OBSERVATION", "READY", "artifacts/operations/dormitory/observation-day-01.json", mainHead)
  ]);

  if (failures.length > 0) {
    for (const failure of failures) console.error(`P0 ${failure}`);
    throw new Error("Dormitory L1 Day-0 readiness failed.");
  }

  console.log("Dormitory L1 Day-0 readiness: PASS");
}

function renderReport(result) {
  const lines = [
    "# 宿舍 L1 观察窗口 Day-0 门禁报告",
    "",
    `生成时间：${result.generatedAtUtc}`,
    `当前 main HEAD：${result.currentMainHead}`,
    `pilotId：${result.pilotId}`,
    `tenantId：${result.tenantId}`,
    `siteId：${result.siteId}`,
    `最终状态：${result.finalStatus}`,
    "",
    "## 裁决",
    "",
    "- 宿舍允许启动 L1 Internal Pilot Observation Day-0。",
    "- Dormitory L2 Production = false。",
    "- Business Production = blocked。",
    "- Repair / Parts / HR productionAllowed = false。",
    "",
    "## Day-0 前置项",
    "",
    ...Object.entries(result.day0Readiness).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## No-Go / Hold",
    "",
    ...(result.noGoItems.length ? result.noGoItems.map((item) => `- ${item}`) : ["- 无 P0 No-Go。"]),
    ...(result.p1HoldItems.length ? result.p1HoldItems.map((item) => `- ${item}`) : ["- 无未决 P1 Hold。"])
  ];
  return `${lines.join("\n")}\n`;
}

function ledgerEntry(id, status, ref, mainHead) {
  return {
    id,
    generatedAtUtc: generatedAt,
    status,
    ref,
    currentMainHead: mainHead,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHr: "L0 Contract Preview"
  };
}

function upsertEvidenceLedger(entries) {
  const ledgerPath = path.join(root, "artifacts/evidence/evidence-ledger.jsonl");
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const existing = fs.existsSync(ledgerPath)
    ? fs.readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of entries) byId.set(entry.id, entry);
  fs.writeFileSync(ledgerPath, `${[...byId.values()].map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
}

function readJson(relativePath) {
  assertFile(relativePath);
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMarkdown(relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

function currentMainHead() {
  return execFileSync("git", ["rev-parse", "origin/main"], { cwd: root, encoding: "utf8" }).trim();
}

function currentBranch() {
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

function assertFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) failures.push(`缺少文件：${relativePath}`);
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) failures.push(`${message} actual=${actual ?? "null"} expected=${expected ?? "null"}`);
}

function assertStatus(actual, expected, message) {
  if (actual !== expected) failures.push(`${message} actual=${actual ?? "null"} expected=${expected}`);
}

function assertFalse(actual, message) {
  if (actual !== false) failures.push(`${message} actual=${actual ?? "null"}`);
}

main();
