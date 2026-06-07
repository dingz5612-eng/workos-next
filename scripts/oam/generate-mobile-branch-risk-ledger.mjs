import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const repoRoot = process.cwd();
const policyPath = "docs/oam/mobile-branch-risk-policy.json";
const defaultCoveragePath = "artifacts/oam/test-results/mobile/coverage/coverage-summary.json";
const outputPath = "docs/oam/mobile-branch-risk-ledger.json";

const policy = readJson(policyPath);
const coveragePath = policy.coverageSource || defaultCoveragePath;
if (!fs.existsSync(path.join(repoRoot, coveragePath))) {
  throw new Error(`Mobile coverage summary is required: ${coveragePath}`);
}

const coverage = readJson(coveragePath);
const policyByFile = new Map((policy.rules || []).map((rule) => [normalizeRepoPath(rule.filePath), rule]));
const gitStatusByPath = readGitStatusByPath();
const coveredFiles = Object.entries(coverage)
  .filter(([file]) => file !== "total")
  .map(([file, summary]) => buildLedgerEntry(file, summary, policyByFile, gitStatusByPath))
  .sort((left, right) => {
    const missingDiff = right.coverage.branches.missing - left.coverage.branches.missing;
    if (missingDiff !== 0) return missingDiff;
    return left.filePath.localeCompare(right.filePath);
  });

const sourceFiles = listMobileSourceFiles();
const coverageFiles = new Set(coveredFiles.map((entry) => entry.filePath));
const missingFromCoverage = sourceFiles
  .filter((file) => !coverageFiles.has(file))
  .map((file) => buildMissingCoverageEntry(file, policyByFile, gitStatusByPath))
  .sort((left, right) => left.filePath.localeCompare(right.filePath));

const ledger = {
  version: "current-oam.mobile-branch-risk-ledger.v1",
  status: "generated",
  generatedAt: new Date().toISOString(),
  generatedBy: "scripts/oam/generate-mobile-branch-risk-ledger.mjs",
  policyFile: policyPath,
  policyVersion: policy.version,
  coverageSource: coveragePath,
  sortOrder: "branches.missing desc, filePath asc",
  globalCoverage: metricSet(coverage.total || {}),
  stage: policy.stage,
  summary: {
    totalCoveredFiles: coveredFiles.length,
    registeredFiles: coveredFiles.filter((entry) => entry.policy.status === "registered").length,
    unregisteredFiles: coveredFiles.filter((entry) => entry.policy.status === "unregistered").length,
    newSourceFiles: [...coveredFiles, ...missingFromCoverage].filter((entry) => entry.source.isNewSourceFile).length,
    missingCoverageSourceFiles: missingFromCoverage.length,
    p0Files: coveredFiles.filter((entry) => entry.policy.layer === "P0 业务保护").length,
    p1Files: coveredFiles.filter((entry) => entry.policy.layer === "P1 状态决策").length,
    p2Files: coveredFiles.filter((entry) => entry.policy.layer === "P2 展示组合").length,
    pcGovernanceFiles: coveredFiles.filter((entry) => entry.policy.layer === "PC 治理或 debug").length
  },
  targetAssessment: buildTargetAssessment(coverage.total || {}, coveredFiles, policy),
  files: coveredFiles,
  missingCoverageSourceFiles: missingFromCoverage
};

writeJson(outputPath, ledger);
console.log(`Mobile branch risk ledger generated: ${outputPath}`);
console.log(`registered=${ledger.summary.registeredFiles} unregistered=${ledger.summary.unregisteredFiles} newSource=${ledger.summary.newSourceFiles}`);

function buildLedgerEntry(rawFile, summary, policyByFile, gitStatusByPath) {
  const filePath = normalizeCoveragePath(rawFile);
  const rule = policyByFile.get(filePath);
  const status = gitStatusByPath.get(filePath) || "";
  return {
    filePath,
    coverage: metricSet(summary),
    policy: policyView(filePath, rule),
    source: {
      isNewSourceFile: isNewSourceStatus(status),
      gitStatus: status || "tracked_or_unknown",
      isCoveredByCoverageSummary: true
    },
    risk: {
      level: rule?.riskLevel || "未登记",
      descriptionZh: rule?.riskDescriptionZh || "该文件未进入移动端分支风险政策，需要确认是否属于关键业务分支或允许暂缓。",
      allowDeferral: Boolean(rule?.allowDeferral),
      deferralReasonZh: rule?.deferralReasonZh || "未登记文件缺少中文暂缓原因。",
      nextActionZh: rule?.nextActionZh || "判断风险层级并登记 policy，或补充中文暂缓原因。"
    }
  };
}

function buildMissingCoverageEntry(filePath, policyByFile, gitStatusByPath) {
  const rule = policyByFile.get(filePath);
  const status = gitStatusByPath.get(filePath) || "";
  return {
    filePath,
    coverage: null,
    policy: policyView(filePath, rule),
    source: {
      isNewSourceFile: isNewSourceStatus(status),
      gitStatus: status || "tracked_or_unknown",
      isCoveredByCoverageSummary: false
    },
    risk: {
      level: rule?.riskLevel || "未登记",
      descriptionZh: rule?.riskDescriptionZh || "移动端源码文件未出现在 coverage-summary 中，需要确认测试收集范围。",
      allowDeferral: Boolean(rule?.allowDeferral),
      deferralReasonZh: rule?.deferralReasonZh || "未登记且未进入覆盖率产物，缺少中文暂缓原因。",
      nextActionZh: rule?.nextActionZh || "补充测试收集、policy 登记或中文暂缓原因。"
    }
  };
}

function buildTargetAssessment(totalCoverage, files, policy) {
  const target = policy.stage?.nextStageTarget || {};
  const global = metricSet(totalCoverage);
  const branches70Reached = global.branches.pct >= Number(target.branchesPct || 70);
  const firstStageTargetReached = branches70Reached &&
    global.statements.pct >= Number(target.statementsPct || 82) &&
    global.functions.pct >= Number(target.functionsPct || 88) &&
    global.lines.pct >= Number(target.linesPct || 85);
  const nextBatchFiles = files
    .filter((entry) => ["P0 业务保护", "P1 状态决策"].includes(entry.policy.layer))
    .filter((entry) => entry.coverage.branches.pct < entry.policy.nextStageTargetPct || entry.coverage.branches.pct < 70)
    .slice(0, 8)
    .map((entry) => ({
      filePath: entry.filePath,
      layer: entry.policy.layer,
      missingBranches: entry.coverage.branches.missing,
      branchCoveragePct: entry.coverage.branches.pct,
      nextActionZh: entry.risk.nextActionZh
    }));
  return {
    status: firstStageTargetReached ? "first_stage_target_reached" : "no_regression_only",
    branches70Reached,
    firstStageTargetReached,
    currentCoverage: global,
    target,
    unmetReasonsZh: firstStageTargetReached
      ? []
      : [
        branches70Reached ? "" : `全局 Branches 当前 ${global.branches.pct}%，尚未达到 70%。`,
        global.statements.pct >= Number(target.statementsPct || 82) ? "" : `Statements 当前 ${global.statements.pct}%，尚未达到 ${target.statementsPct}%。`,
        global.functions.pct >= Number(target.functionsPct || 88) ? "" : `Functions 当前 ${global.functions.pct}%，尚未达到 ${target.functionsPct}%。`,
        global.lines.pct >= Number(target.linesPct || 85) ? "" : `Lines 当前 ${global.lines.pct}%，尚未达到 ${target.linesPct}%。`
      ].filter(Boolean),
    nextBatchFiles
  };
}

function policyView(filePath, rule) {
  if (!rule) {
    return {
      status: "unregistered",
      layer: "未登记",
      targetBranchCoveragePct: null,
      currentStageHardBaselinePct: null,
      nextStageTargetPct: null,
      affectsBusinessWrite: null,
      affectsAdmissionRejection: null,
      affectsSearchReadonly: null,
      affectsDeviceTrust: null,
      affectsOrdinaryMobileUser: null,
      testFiles: []
    };
  }

  return {
    status: "registered",
    layer: rule.layer,
    targetBranchCoveragePct: rule.targetBranchCoveragePct,
    currentStageHardBaselinePct: rule.currentStageHardBaselinePct,
    nextStageTargetPct: rule.nextStageTargetPct,
    affectsBusinessWrite: rule.affectsBusinessWrite,
    affectsAdmissionRejection: rule.affectsAdmissionRejection,
    affectsSearchReadonly: rule.affectsSearchReadonly,
    affectsDeviceTrust: rule.affectsDeviceTrust,
    affectsOrdinaryMobileUser: rule.affectsOrdinaryMobileUser,
    testFiles: rule.testFiles || []
  };
}

function metricSet(summary) {
  return {
    statements: metric(summary.statements),
    branches: metric(summary.branches),
    functions: metric(summary.functions),
    lines: metric(summary.lines)
  };
}

function metric(value = {}) {
  const total = Number(value.total || 0);
  const covered = Number(value.covered || 0);
  return {
    total,
    covered,
    missing: Math.max(0, total - covered),
    pct: Number(value.pct ?? (total === 0 ? 100 : ((covered / total) * 100).toFixed(2)))
  };
}

function listMobileSourceFiles() {
  const sourceRoot = path.join(repoRoot, "apps/mobile/src");
  if (!fs.existsSync(sourceRoot)) return [];
  const files = [];
  walk(sourceRoot, files);
  return files
    .map((file) => normalizeRepoPath(path.relative(repoRoot, file)))
    .filter((file) => !file.includes("/__tests__/"))
    .filter((file) => !file.startsWith("apps/mobile/src/generated/"))
    .filter((file) => file.endsWith(".js"))
    .sort((left, right) => left.localeCompare(right));
}

function walk(current, files) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
}

function readGitStatusByPath() {
  const output = git("status --porcelain=v1 -uall");
  const result = new Map();
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const status = line.slice(0, 2);
    const filePart = line.slice(3).trim();
    const filePath = normalizeRepoPath(filePart.includes(" -> ") ? filePart.split(" -> ").at(-1) : filePart);
    result.set(filePath, status);
  }
  return result;
}

function isNewSourceStatus(status) {
  return status.startsWith("??") || status.includes("A");
}

function normalizeCoveragePath(file) {
  const normalized = normalizeRepoPath(file);
  const marker = "apps/mobile/src/";
  const index = normalized.indexOf(marker);
  return index >= 0 ? normalized.slice(index) : normalized;
}

function normalizeRepoPath(file) {
  return file.replaceAll("\\", "/");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8"));
}

function writeJson(file, value) {
  const target = path.join(repoRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trimEnd();
  } catch {
    return "";
  }
}
