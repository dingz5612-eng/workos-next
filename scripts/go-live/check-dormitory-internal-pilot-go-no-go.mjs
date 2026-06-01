import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outPath = readArg("--out=", "artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
const reportPath = readArg("--report=", "docs/go-live/dormitory/internal-pilot-go-no-go.md");

const requiredStopConditions = [
  "money mismatch red",
  "duplicate ledger entry",
  "bed double occupancy",
  "evidence leak",
  "unable to rollback",
  "Finance Daily Close failed",
  "BStageGate red",
  "P0 invariant failed"
];
const requiredHoldConditions = [
  "projection lag > threshold",
  "evidence upload failure > threshold",
  "422 blocked rate abnormal",
  "finance case backlog > threshold",
  "SLA overdue > threshold"
];
const requiredUpgradeCriteria = [
  "7 days no P0",
  "SLA >= target",
  "finance daily close 100%",
  "evidence missing rate below threshold",
  "users trained and signed",
  "BStageGate remains green",
  "no Red ShadowCompareReport",
  "no unresolved P0 invariant"
];

if (process.argv.includes("--self-test")) {
  const blockers = [];
  assertPassed("self-test blocked artifact", { status: "blocked" }, blockers, "self-test.json");
  assert(blockers.some((item) => item.id === "dorm_int_final.artifact_not_passed"), "self-test must catch blocked artifact.");

  const registryBlockers = [];
  validateBusinessLineRegistry({
    businessLines: [
      { businessLineId: "dormitory", level: "L2 Production", internalPilotAllowed: true, productionAllowed: true, productionConfirmAllowed: true },
      { businessLineId: "repair", level: "L1 Pilot", productionAllowed: false, productionConfirmAllowed: false },
      { businessLineId: "parts", level: "L0 Contract Preview", productionAllowed: false, productionConfirmAllowed: false },
      { businessLineId: "hr", level: "L0 Contract Preview", productionAllowed: false, productionConfirmAllowed: false }
    ]
  }, registryBlockers);
  assert(registryBlockers.some((item) => item.id === "dorm_int_final.dormitory_production_enabled"), "self-test must catch Dormitory production drift.");
  assert(registryBlockers.some((item) => item.id === "dorm_int_final.downstream_line_not_l0"), "self-test must catch Repair/Parts/HR L0 drift.");
  console.log("Dormitory internal pilot go/no-go self-test: PASS");
  process.exit(0);
}

const blockers = [];
const evidence = {};

await evaluate();

const status = blockers.length === 0 ? "GO_FOR_INTERNAL_PILOT" : "NO-GO";
const result = {
  generated_at_utc: new Date().toISOString(),
  generated_by: "check-dormitory-internal-pilot-go-no-go",
  stage: "DORM-INT-FINAL",
  status,
  internalPilotAllowed: status === "GO_FOR_INTERNAL_PILOT",
  productionAllowed: false,
  nextStage: status === "GO_FOR_INTERNAL_PILOT" ? "L1 Internal Pilot Observation Window" : "Fix listed P0 blockers and rerun DORM-INT",
  dormitoryStatus: "L1 Internal Pilot",
  dormitoryL2ProductionAllowed: false,
  repairPartsHrStatus: "L0 Contract Preview",
  pilotOwners: evidence.pilotOwners,
  latestMain: evidence.latestMain,
  gateResults: evidence.gateResults,
  readiness: evidence.readiness,
  observationWindow: {
    observationDuration: "7 days",
    dailyReviewTime: "18:00 Asia/Shanghai",
    stopConditions: requiredStopConditions,
    holdConditions: requiredHoldConditions,
    L1_to_L2_upgradeCriteria: requiredUpgradeCriteria,
    rollbackCriteria: [
      "P0 stop condition triggered",
      "pilot pause cannot contain user-facing risk",
      "finance daily close cannot be reconciled before daily review",
      "rollback drill action is unavailable or cannot append compensation"
    ]
  },
  evidenceRefs: evidence.refs,
  noGoItems: blockers,
  nextAction: blockers.length
    ? "修复 noGoItems 中列出的 P0 blocker 后，重新运行 DORM-INT-00 到 DORM-INT-FINAL。"
    : "只允许进入 L1 Internal Pilot 内测观察窗口；不得进入 L2 Production，不得放开 Repair / Parts / HR production。"
};

writeJson(outPath, result);
writeMarkdown(reportPath, result);

if (blockers.length > 0) {
  for (const item of blockers) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Dormitory internal pilot go/no-go: NO-GO");
}

console.log("Dormitory internal pilot go/no-go: GO_FOR_INTERNAL_PILOT");

async function evaluate() {
  evidence.refs = [
    "docs/go-live/dormitory/internal-pilot-scope.yml",
    "artifacts/go-live/dormitory/pilot-scope-result.json",
    "docs/go-live/dormitory/master-data.yml",
    "artifacts/go-live/dormitory/master-data-readiness.json",
    "artifacts/go-live/dormitory/b-stage-gate-result.json",
    "artifacts/go-live/dormitory/evidence-policy-result.json",
    "artifacts/go-live/dormitory/finance-daily-close-result.json",
    "artifacts/go-live/dormitory/runtime-surface-alignment-result.json",
    "artifacts/go-live/dormitory/internal-pilot-run-result.json",
    "artifacts/go-live/dormitory/rollback-drill-result.json",
    "artifacts/go-live/dormitory/training-signoff-result.json",
    "artifacts/rt4/evidence-graph.json",
    "docs/business/business-line-registry.json",
    "docs/business/experience-contract.yml",
    "apps/mobile/src/__tests__/DormitoryWorkItemNativePilot.test.js",
    "artifacts/go-live/dormitory/dorm-int-experience-contract-report.json"
  ];
  evidence.gateResults = {};
  evidence.readiness = {};

  evidence.latestMain = await checkLatestMain(blockers);

  runRequiredCommand("Evidence Graph replay", ["node", "scripts/rt4/verify-evidence-graph.mjs"], blockers);
  runRequiredCommand("Experience Contract", ["node", "scripts/check-experience-contract.mjs", "--out=.tmp/rt5/dorm-int-experience-contract-report.json"], blockers);
  runRequiredCommand("Dormitory WorkItem-native mobile tests", ["npm", "--prefix", "apps/mobile", "run", "test", "--", "DormitoryWorkItemNativePilot"], blockers, 120000);
  runRequiredCommand("B2 executable scenario semantics", ["node", "scripts/check-executable-scenarios.mjs"], blockers);
  runRequiredCommand("Evidence Policy-as-Code", ["node", "scripts/check-policy-as-code.mjs"], blockers);
  runRequiredCommand("Admission surface alignment", ["node", "scripts/check-admission-surface-alignment.mjs"], blockers);
  persistArtifact(".tmp/v5_4/dormitory-evidence-policy-result.json", "artifacts/go-live/dormitory/evidence-policy-result.json", blockers);
  persistArtifact(".tmp/v5_4/runtime-surface-alignment-result.json", "artifacts/go-live/dormitory/runtime-surface-alignment-result.json", blockers);
  persistArtifact(".tmp/rt5/dorm-int-experience-contract-report.json", "artifacts/go-live/dormitory/dorm-int-experience-contract-report.json", blockers);

  const scopeDocument = readRequiredJson("docs/go-live/dormitory/internal-pilot-scope.yml", blockers);
  evidence.pilotOwners = summarizePilotOwners(scopeDocument, blockers);

  const scope = readRequiredJson("artifacts/go-live/dormitory/pilot-scope-result.json", blockers);
  evidence.readiness.scope = summarizeArtifact("DORM-INT-00", scope, "artifacts/go-live/dormitory/pilot-scope-result.json", blockers);

  const masterData = readRequiredJson("artifacts/go-live/dormitory/master-data-readiness.json", blockers);
  evidence.readiness.masterData = summarizeArtifact("DORM-INT-01", masterData, "artifacts/go-live/dormitory/master-data-readiness.json", blockers, { requireReal: true });

  const bStageGate = readRequiredJson("artifacts/go-live/dormitory/b-stage-gate-result.json", blockers);
  evidence.gateResults.bStageGate = summarizeArtifact("DORM-INT-06", bStageGate, "artifacts/go-live/dormitory/b-stage-gate-result.json", blockers, { requireReal: true });
  validateEmptyNoGo("BStageGateResult", bStageGate, blockers);

  const evidencePolicy = readRequiredJson("artifacts/go-live/dormitory/evidence-policy-result.json", blockers);
  evidence.readiness.evidencePolicy = summarizeArtifact("DORM-INT-04", evidencePolicy, "artifacts/go-live/dormitory/evidence-policy-result.json", blockers, { requireReal: true });

  const finance = readRequiredJson("artifacts/go-live/dormitory/finance-daily-close-result.json", blockers);
  evidence.readiness.financeDailyClose = summarizeArtifact("DORM-INT-05", finance, "artifacts/go-live/dormitory/finance-daily-close-result.json", blockers, { requireReal: true });

  const surface = readRequiredJson("artifacts/go-live/dormitory/runtime-surface-alignment-result.json", blockers);
  evidence.readiness.admissionSurfaceRuntime = summarizeArtifact("DORM-INT-07", surface, "artifacts/go-live/dormitory/runtime-surface-alignment-result.json", blockers, { requireReal: true });

  const scenarios = readRequiredJson("artifacts/go-live/dormitory/internal-pilot-run-result.json", blockers);
  evidence.readiness.internalPilotScenarios = summarizeArtifact("DORM-INT-08", scenarios, "artifacts/go-live/dormitory/internal-pilot-run-result.json", blockers, { requireReal: true });
  validateInternalPilotScenarios(scenarios, blockers);

  const rollback = readRequiredJson("artifacts/go-live/dormitory/rollback-drill-result.json", blockers);
  evidence.readiness.monitoringRollback = summarizeArtifact("DORM-INT-09", rollback, "artifacts/go-live/dormitory/rollback-drill-result.json", blockers, { requireReal: true });

  const training = readRequiredJson("artifacts/go-live/dormitory/training-signoff-result.json", blockers);
  evidence.readiness.trainingSignoff = summarizeArtifact("DORM-INT-10", training, "artifacts/go-live/dormitory/training-signoff-result.json", blockers, { requireReal: true });

  const registry = readRequiredJson("docs/business/business-line-registry.json", blockers);
  validateBusinessLineRegistry(registry, blockers);
}

async function checkLatestMain(blockers) {
  const evidence = {
    repository: "dingz5612-eng/workos-next",
    branch: "main",
    checkedAtUtc: new Date().toISOString(),
    commitSha: null,
    ci: null,
    v54ControlPlaneGuards: null
  };

  try {
    const lsRemote = spawnSync("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: root, encoding: "utf8", shell: isWindows() });
    if (lsRemote.status !== 0) {
      blockers.push(blocker("dorm_int_final.latest_main_unavailable", "无法读取 origin/main 最新 commit。", { stderr: lsRemote.stderr?.trim() }));
      return evidence;
    }
    evidence.commitSha = lsRemote.stdout.trim().split(/\s+/)[0] ?? null;
  } catch (error) {
    blockers.push(blocker("dorm_int_final.latest_main_unavailable", "无法读取 origin/main 最新 commit。", { error: error.message }));
    return evidence;
  }

  if (!evidence.commitSha) {
    blockers.push(blocker("dorm_int_final.latest_main_missing", "origin/main 最新 commit 为空。"));
    return evidence;
  }

  try {
    if (typeof fetch !== "function") {
      blockers.push(blocker("dorm_int_final.github_actions_fetch_unavailable", "当前 Node runtime 不支持 fetch，无法验证 latest main Actions。"));
      return evidence;
    }
    const response = await fetch("https://api.github.com/repos/dingz5612-eng/workos-next/actions/runs?branch=main&per_page=50", {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "workosnext-dorm-int-checker"
      }
    });
    if (!response.ok) {
      blockers.push(blocker("dorm_int_final.github_actions_unavailable", `GitHub Actions API 返回 ${response.status}。`));
      return evidence;
    }
    const payload = await response.json();
    evidence.ci = findWorkflowRun(payload.workflow_runs, "CI", evidence.commitSha);
    evidence.v54ControlPlaneGuards = findWorkflowRun(payload.workflow_runs, "V5.4 Control Plane Guards", evidence.commitSha);
  } catch (error) {
    blockers.push(blocker("dorm_int_final.github_actions_unavailable", "无法验证 latest main Actions。", { error: error.message }));
    return evidence;
  }

  if (!isGreenRun(evidence.ci)) {
    blockers.push(blocker("dorm_int_final.latest_main_ci_not_green", "latest main CI 未 green。", { commitSha: evidence.commitSha, run: evidence.ci }));
  }
  if (!isGreenRun(evidence.v54ControlPlaneGuards)) {
    blockers.push(blocker("dorm_int_final.latest_main_v54_guards_not_green", "latest main V5.4 Control Plane Guards 未 green。", { commitSha: evidence.commitSha, run: evidence.v54ControlPlaneGuards }));
  }

  return evidence;
}

function findWorkflowRun(runs, name, commitSha) {
  const run = (runs ?? []).find((item) =>
    item.name === name &&
    item.head_branch === "main" &&
    item.head_sha === commitSha);
  if (!run) return null;
  return {
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.head_sha,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at
  };
}

function isGreenRun(run) {
  return run?.status === "completed" && run?.conclusion === "success";
}

function runRequiredCommand(label, commandWithArgs, blockers, timeout = 90000) {
  const [command, ...args] = commandWithArgs;
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: isWindows(),
    timeout
  });
  if (result.status !== 0) {
    blockers.push(blocker("dorm_int_final.command_failed", `${label} 未通过。`, {
      command: commandWithArgs.join(" "),
      stdout: trimOutput(result.stdout),
      stderr: trimOutput(result.stderr)
    }));
  }
}

function persistArtifact(sourceRef, targetRef, blockers) {
  const sourcePath = path.join(root, sourceRef);
  const targetPath = path.join(root, targetRef);
  if (!fs.existsSync(sourcePath)) {
    blockers.push(blocker("dorm_int_final.persistent_evidence_source_missing", `无法持久化证据，缺少源文件：${sourceRef}`, { sourceRef, targetRef }));
    return;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function summarizeArtifact(stage, payload, ref, blockers, options = {}) {
  if (!payload) {
    return { stage, status: "missing", ref };
  }
  assertPassed(stage, payload, blockers, ref);
  if (options.requireReal && !isRealSource(payload)) {
    blockers.push(blocker("dorm_int_final.source_mode_not_real", `${stage} 必须使用 sourceMode=real。`, { ref, sourceMode: payload.sourceMode ?? payload.source_mode }));
  }
  return {
    stage,
    status: payload.status,
    sourceMode: payload.sourceMode ?? payload.source_mode ?? "n/a",
    ref
  };
}

function assertPassed(label, payload, blockers, ref) {
  if (!payload || payload.status !== "passed") {
    blockers.push(blocker("dorm_int_final.artifact_not_passed", `${label} 结果不是 passed。`, { ref, status: payload?.status ?? "missing" }));
  }
}

function isRealSource(payload) {
  return (payload.sourceMode ?? payload.source_mode) === "real";
}

function validateEmptyNoGo(label, payload, blockers) {
  const noGoItems = payload?.noGoItems ?? payload?.no_go_items ?? [];
  if (!Array.isArray(noGoItems) || noGoItems.length > 0) {
    blockers.push(blocker("dorm_int_final.no_go_items_present", `${label} 存在 no-go items。`, { noGoItems }));
  }
}

function validateInternalPilotScenarios(result, blockers) {
  if (result?.scenarioCount !== 10 || result?.passedCount !== 10) {
    blockers.push(blocker("dorm_int_final.internal_pilot_scenario_count", "DORM-INT-08 必须 10 个场景全部 passed。", {
      scenarioCount: result?.scenarioCount,
      passedCount: result?.passedCount
    }));
  }

  const scenarios = result?.scenarios ?? [];
  const denied = scenarios.find((item) => item.scenarioId === "dorm-live-008");
  if (!denied?.rejectedCommandSubmission || denied.rejectedCommandSubmission.responseStatusCode !== 403 || (denied.domainEvents ?? []).length > 0 || (denied.ledgerTransactions ?? []).length > 0 || !denied.rejectionTrace) {
    blockers.push(blocker("dorm_int_final.permission_rejection_trace_missing", "dorm-live-008 必须是 403 rejected CommandSubmission + RejectionTrace，且无 DomainEvent / LedgerTransaction。"));
  }

  const duplicate = scenarios.find((item) => item.scenarioId === "dorm-live-009");
  if (duplicate?.duplicateSubmissionResult?.statusCode !== 409 || duplicate?.duplicateSubmissionResult?.stableRecord !== true || duplicate?.duplicateSubmissionResult?.newSideEffectCount !== 0) {
    blockers.push(blocker("dorm_int_final.idempotency_trace_missing", "dorm-live-009 必须有 409 stable record 且无重复副作用。"));
  }

  const missingEvidence = scenarios.find((item) => item.scenarioId === "dorm-live-010");
  if (!missingEvidence?.rejectedCommandSubmission || missingEvidence.rejectedCommandSubmission.responseStatusCode !== 422 || !missingEvidence.rejectionTrace || missingEvidence?.remediation?.confirmAfterEvidence !== true) {
    blockers.push(blocker("dorm_int_final.missing_evidence_trace_missing", "dorm-live-010 必须先 422 rejected，再补证据后 confirm。"));
  }
}

function validateBusinessLineRegistry(registry, blockers) {
  const lines = registry?.businessLines ?? [];
  const dormitory = lines.find((item) => item.businessLineId === "dormitory");
  if (!dormitory || dormitory.level !== "L1 Internal Pilot" || dormitory.internalPilotAllowed !== true) {
    blockers.push(blocker("dorm_int_final.dormitory_not_l1_internal_pilot", "Dormitory 必须标记为 L1 Internal Pilot 且 internalPilotAllowed=true。", { dormitory }));
  }
  if (dormitory?.productionAllowed !== false || dormitory?.productionConfirmAllowed !== false || dormitory?.level === "L2 Production") {
    blockers.push(blocker("dorm_int_final.dormitory_production_enabled", "Dormitory 不得进入 L2 Production 或 production confirm。", { dormitory }));
  }
  for (const id of ["repair", "parts", "hr"]) {
    const line = lines.find((item) => item.businessLineId === id);
    if (!line || line.level !== "L0 Contract Preview" || line.productionAllowed !== false || line.productionConfirmAllowed !== false) {
      blockers.push(blocker("dorm_int_final.downstream_line_not_l0", `${id} 必须保持 L0 Contract Preview 且 production disabled。`, { businessLineId: id, line }));
    }
  }
}

function summarizePilotOwners(scope, blockers) {
  const owners = {
    internalPilotOwner: scope?.businessOwner ?? null,
    technicalOwner: scope?.technicalOwner ?? null,
    financeOwner: "finance",
    operationsOwner: scope?.businessOwner ?? null,
    onCallOwner: scope?.supportOwner ?? null,
    releaseOwner: scope?.rollbackOwner ?? null
  };
  for (const [field, value] of Object.entries(owners)) {
    if (!value) {
      blockers.push(blocker("dorm_int_final.owner_missing", `最终准入报告缺少 ${field}。`, { field }));
    }
  }
  return owners;
}

function readRequiredJson(relativePath, blockers) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    blockers.push(blocker("dorm_int_final.evidence_missing", `缺少准入证据文件：${relativePath}`, { ref: relativePath }));
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    blockers.push(blocker("dorm_int_final.evidence_unreadable", `无法读取准入证据文件：${relativePath}`, { ref: relativePath, error: error.message }));
    return null;
  }
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeMarkdown(relativePath, result) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const lines = [
    "# Dormitory Internal Pilot Go/No-Go",
    "",
    `- status: ${result.status}`,
    `- internalPilotAllowed: ${result.internalPilotAllowed}`,
    `- productionAllowed: ${result.productionAllowed}`,
    `- dormitoryStatus: ${result.dormitoryStatus}`,
    "- dormitoryL2ProductionAllowed: false",
    "- Repair / Parts / HR: L0 Contract Preview",
    "",
    "## Owners",
    `- 内测负责人: ${result.pilotOwners.internalPilotOwner}`,
    `- 技术负责人: ${result.pilotOwners.technicalOwner}`,
    `- 财务负责人: ${result.pilotOwners.financeOwner}`,
    `- 运营负责人: ${result.pilotOwners.operationsOwner}`,
    `- 值守负责人: ${result.pilotOwners.onCallOwner}`,
    `- Release owner: ${result.pilotOwners.releaseOwner}`,
    "",
    "## 中文结论",
    result.status === "GO_FOR_INTERNAL_PILOT"
      ? "宿舍可以进入 L1 Internal Pilot 内测观察窗口；宿舍不允许 L2 Production；Repair / Parts / HR 不允许 production。"
      : "宿舍不允许进入内测；必须修复下列 P0 blocker 后重新运行 DORM-INT。",
    "",
    "## Evidence Refs",
    ...result.evidenceRefs.map((ref) => `- ${ref}`),
    "",
    "## No-Go Items",
    ...(result.noGoItems.length ? result.noGoItems.map((item) => `- ${item.id}: ${item.message}`) : ["- none"]),
    "",
    "## Observation Window",
    `- observationDuration: ${result.observationWindow.observationDuration}`,
    `- dailyReviewTime: ${result.observationWindow.dailyReviewTime}`,
    "- P0 stop conditions:",
    ...result.observationWindow.stopConditions.map((item) => `  - ${item}`),
    "- P1 hold conditions:",
    ...result.observationWindow.holdConditions.map((item) => `  - ${item}`),
    "- L1 to L2 upgrade criteria:",
    ...result.observationWindow.L1_to_L2_upgradeCriteria.map((item) => `  - ${item}`)
  ];
  fs.writeFileSync(fullPath, `${lines.join("\n")}\n`, "utf8");
}

function blocker(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function trimOutput(value) {
  const text = `${value ?? ""}`.trim();
  return text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function isWindows() {
  return process.platform === "win32";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
