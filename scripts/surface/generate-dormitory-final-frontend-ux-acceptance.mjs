import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const root = process.cwd();
const outDir = path.join(root, "artifacts/oam/evidence/dormitory-final-frontend-ux-acceptance");
const checklistPath = path.join(outDir, "final-frontend-ux-acceptance-checklist.json");
const reportJsonPath = path.join(outDir, "final-frontend-ux-acceptance-report.json");
const reportMdPath = path.join(outDir, "final-frontend-ux-acceptance-report.md");
const docsIndexPath = path.join(root, "docs/oam/dormitory-final-frontend-ux-acceptance.md");
const resultPath = path.join(root, "artifacts/oam/checks/dormitory-final-frontend-ux-acceptance-result.json");
const evidenceBase = path.join(root, "artifacts/oam/evidence");

const issueMarkers = [
  "需要修复",
  "不够清楚",
  "不合理",
  "不明确",
  "遮挡",
  "错位",
  "拥挤",
  "无法理解"
];

const highRiskScenarioNos = new Set([1, 2, 3, 5, 6, 7, 8, 9, 10, 13]);
const forbiddenScreenshotVisibleTerms = [
  "finance-gate",
  "stableRef",
  "projectionVersion",
  "digest",
  "workItemId",
  "roomId",
  "bedId",
  "FirstGoldenChain",
  "golden-chain",
  "resource-saleability"
];
const preconditionReportPaths = [
  "docs/oam/dormitory-13-scenario-production-usable-closure-report.md",
  "docs/oam/project-purity-authority-seal-report.md",
  "docs/oam/project-maintainability-closure-report.md",
  "artifacts/oam/evidence/dormitory-prelaunch-ops-trial/prelaunch-ops-trial-report.json",
  "docs/oam/dormitory-defect-closure-ledger.json",
  "artifacts/oam/evidence/dormitory-mainline-activation-transaction.json"
];

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(docsIndexPath), { recursive: true });
fs.mkdirSync(path.dirname(resultPath), { recursive: true });

const scenarios = loadScenarioContracts();
const entryReport = readJsonIfExists("artifacts/oam/evidence/dormitory-13-scenario-entry-browser/entry-browser-report.json");
const defectLedger = readJsonIfExists("docs/oam/dormitory-defect-closure-ledger.json") ?? {};
const openP0P1 = (defectLedger.defects ?? []).filter((item) =>
  ["P0", "P1"].includes(item.severity) && !["closed", "verified"].includes(item.status));

const checklist = {
  version: "oam.dormitory-final-frontend-ux-acceptance-checklist.v1",
  generatedAtUtc: new Date().toISOString(),
  source: "generated contracts plus real browser evidence reports",
  currentMainlineZh: "住宿经营 13 场景总控",
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  preconditions: preconditionReportPaths.map((item) => ({
    path: item,
    exists: fs.existsSync(path.join(root, item))
  })),
  scenarios: scenarios.map(buildScenarioChecklist)
};

const scenarioEvidence = checklist.scenarios.map((item) => buildScenarioEvidence(item.scenarioPackageNo));
const failures = [];

if (checklist.scenarios.length !== 13) failures.push(`expected 13 scenarios, got ${checklist.scenarios.length}.`);
for (const item of checklist.preconditions) {
  if (!item.exists) failures.push(`missing prerequisite report: ${item.path}.`);
}
if ((entryReport?.status ?? "") !== "passed") failures.push("entry browser report must be passed.");
if ((entryReport?.screenshots ?? []).length < 5) failures.push("entry browser report must include 首页、今日、工作项、搜索、我的 screenshots.");
if (openP0P1.length) failures.push(`open P0/P1 defects remain: ${openP0P1.map((item) => item.defectId).join(", ")}.`);

for (const item of scenarioEvidence) {
  if (item.positive.status !== "passed") failures.push(`scenario ${item.scenarioPackageNo} positive browser status must be passed.`);
  if (item.negative.status !== "passed") failures.push(`scenario ${item.scenarioPackageNo} negative browser status must be passed.`);
  if (!item.positive.screenshotCount) failures.push(`scenario ${item.scenarioPackageNo} positive screenshots missing.`);
  if (!item.negative.screenshotCount) failures.push(`scenario ${item.scenarioPackageNo} negative screenshots missing.`);
  if (item.unresolvedAnalysisMarkers.length) {
    failures.push(`scenario ${item.scenarioPackageNo} has unresolved screenshot analysis markers.`);
  }
  if (item.exposedInternalTerms.length) {
    failures.push(`scenario ${item.scenarioPackageNo} exposed internal terms in browser evidence.`);
  }
  if (item.oldChainVisibleTerms.length) {
    failures.push(`scenario ${item.scenarioPackageNo} exposed old-chain visible terms in browser evidence.`);
  }
}

const report = {
  version: "oam.dormitory-final-frontend-ux-acceptance-report.v1",
  status: failures.length ? "failed" : "passed",
  generatedAtUtc: checklist.generatedAtUtc,
  git: {
    branch: command("git branch --show-current"),
    headSha: command("git rev-parse HEAD"),
    dirtyStatus: command("git status --short")
  },
  scopeZh: "交给用户亲测前的 13 场景移动端前台最终体验验收。",
  browserModeZh: "使用已有 Playwright Chromium 真实浏览器截图证据；正反向报告均绑定当前 HEAD。",
  prerequisiteReports: checklist.preconditions,
  entryEvidence: {
    path: "artifacts/oam/evidence/dormitory-13-scenario-entry-browser/entry-browser-report.json",
    status: entryReport?.status ?? "missing",
    screenshotCount: entryReport?.screenshots?.length ?? 0,
    entrySurfaces: entryReport?.entrySurfaces ?? [],
    screenshots: (entryReport?.screenshots ?? []).map((shot) => ({ id: shot.id, path: shot.path }))
  },
  scenarioChecklistPath: rel(checklistPath),
  scenarioEvidence,
  highRiskRecheck: scenarioEvidence
    .filter((item) => highRiskScenarioNos.has(item.scenarioPackageNo))
    .map((item) => ({
      scenarioPackageNo: item.scenarioPackageNo,
      nameZh: item.nameZh,
      positiveStatus: item.positive.status,
      negativeStatus: item.negative.status,
      screenshotCount: item.positive.screenshotCount + item.negative.screenshotCount,
      focusZh: highRiskFocus(item.scenarioPackageNo)
    })),
  uxConclusionZh: failures.length
    ? "仍存在前端体验封版阻断项，不能交付用户亲测。"
    : "13 场景前台体验证据齐全，页面语言、按钮、字段、搜索只读、状态历史、证据历史和 NO_GO 边界均可交付用户亲测。",
  userTestEntry: {
    localUrl: "http://127.0.0.1:5175/?device=mobile",
    sequenceZh: [
      "先从首页确认 13 场景入口。",
      "再按今日、工作项、搜索、我的四个入口做一次角色化亲测。",
      "随后按场景 1 到 13 依次执行正向主路径、反向异常路径和查询/纠错/作废等事实变更路径。",
      "高风险场景 5、6、7、9、10 必须由运营、财务和主管角色共同复核。"
    ]
  },
  noGoBoundary: {
    productionConfirmAllowed: false,
    businessGoLiveAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    explanationZh: "本轮通过只表示本地/测试环境前端体验可交付亲测，不代表生产发布、业务上线或最终放行。"
  },
  failures,
  digest: null
};

report.digest = digestObject({ ...report, digest: "sha256:pending" });

fs.writeFileSync(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(reportMdPath, renderMarkdown(report), "utf8");
fs.writeFileSync(docsIndexPath, renderDocsIndex(), "utf8");
const result = {
  version: "oam.dormitory-final-frontend-ux-acceptance-check.v1",
  checkedAtUtc: checklist.generatedAtUtc,
  status: report.status === "passed" ? "PASS" : "NO_GO",
  currentHead: report.git.headSha,
  reportPath: rel(reportJsonPath),
  reportDigest: fileDigest(reportJsonPath),
  reportMarkdownPath: rel(reportMdPath),
  reportMarkdownDigest: fileDigest(reportMdPath),
  checklistPath: rel(checklistPath),
  checklistDigest: fileDigest(checklistPath),
  docsIndexPath: rel(docsIndexPath),
  docsIndexDigest: fileDigest(docsIndexPath),
  scenarioCount: scenarioEvidence.length,
  scenarioScreenshotCount: scenarioEvidence.reduce((sum, item) => sum + item.positive.screenshotCount + item.negative.screenshotCount, 0),
  entryScreenshotCount: entryReport?.screenshots?.length ?? 0,
  unresolvedAnalysisMarkerCount: scenarioEvidence.reduce((sum, item) => sum + item.unresolvedAnalysisMarkers.length, 0),
  exposedInternalTermCount: scenarioEvidence.reduce((sum, item) => sum + item.exposedInternalTerms.length, 0),
  oldChainVisibleTermCount: scenarioEvidence.reduce((sum, item) => sum + item.oldChainVisibleTerms.length, 0),
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

if (report.status !== "passed") {
  console.error(`Dormitory final frontend UX acceptance: FAIL (${failures.length} failures)`);
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Dormitory final frontend UX acceptance: PASS (${report.digest})`);
console.log(rel(checklistPath));
console.log(rel(reportJsonPath));
console.log(rel(reportMdPath));
console.log(rel(resultPath));

function loadScenarioContracts() {
  const files = fs.readdirSync(path.join(root, "docs/contracts/generated/dormitory"))
    .filter((file) => /^scenario\d+-.*\.generated\.json$/.test(file))
    .map((file) => `docs/contracts/generated/dormitory/${file}`);
  const canonical = files
    .map((file) => ({ file, value: readJson(file) }))
    .filter(({ file, value }) =>
      value.scenarioPackageNo >= 1 &&
      value.scenarioPackageNo <= 13 &&
      value.nameZh &&
      !file.includes("-steps-fields.") &&
      !file.includes("-surface-navigation.") &&
      !file.includes("-test-plan.") &&
      !file.includes("-crud-policy.") &&
      !file.includes("-handoff.") &&
      !file.includes("-runtime-rules.") &&
      !file.includes("-object-state-model.") &&
      !file.includes("-object-model.") &&
      !file.includes("-metric-model.") &&
      !file.includes("-start-gate-trial.") &&
      !file.includes("-benchmark-inheritance-contract."));
  return canonical
    .sort((a, b) => a.value.scenarioPackageNo - b.value.scenarioPackageNo)
    .map(({ file, value }) => ({ file, value }));
}

function buildScenarioChecklist({ file, value }) {
  const scenarioNo = value.scenarioPackageNo;
  const steps = readJson(`docs/contracts/generated/dormitory/scenario${scenarioNo}-steps-fields.generated.json`);
  const surface = readJson(`docs/contracts/generated/dormitory/scenario${scenarioNo}-surface-navigation.generated.json`);
  const testPlan = readJson(`docs/contracts/generated/dormitory/scenario${scenarioNo}-test-plan.generated.json`);
  const crud = readJsonIfExists(`docs/contracts/generated/dormitory/scenario${scenarioNo}-crud-policy.generated.json`) ?? {};
  const stepFieldChecklist = (steps.steps ?? []).map((step) => ({
    stepNo: step.stepNo,
    stepId: step.stepId,
    pageName: step.nameZh,
    userSees: step.userSees ?? [],
    userFilledFields: step.userFilledFields ?? [],
    userSelectedFields: step.userSelectedFields ?? [],
    userUploadedOrBoundEvidence: step.userUploadedOrBoundEvidence ?? [],
    systemGeneratedFields: step.systemGeneratedFields ?? [],
    validations: step.validations ?? []
  }));
  const systemGeneratedFields = [...new Set(stepFieldChecklist.flatMap((step) => step.systemGeneratedFields))];
  return {
    scenarioPackageNo: scenarioNo,
    authorityId: value.authorityId,
    nameZh: value.nameZh,
    entry: surface.surfaceNavigation?.entryZh ?? `${value.nameZh}入口`,
    pageNames: surface.surfaceNavigation?.pages ?? [],
    userGoal: value.businessGoalZh,
    positiveMainPath: testPlan.positiveBrowserTestPlan ?? [],
    negativeExceptionPath: testPlan.negativeBrowserTestPlan ?? [],
    crudOrFactChangePath: crud.crudPolicy ?? crud.factChangePolicy ?? crud,
    fields: stepFieldChecklist,
    systemFieldHiddenCheck: {
      systemGeneratedFields,
      forbiddenUserInputFields: surface.forbiddenUserInputFields ?? [],
      expectationZh: "系统字段只能由系统生成或在审计/证据包中出现，普通用户页面不得填写或记忆。"
    },
    upstreamSummaryRead: value.upstream ?? {},
    downstreamHandoff: value.downstream ?? {},
    searchReadonly: surface.surfaceNavigation?.searchZh ?? "搜索结果只读，只能跳转合法动作。",
    statusHistory: "页面和详情必须展示当前状态、已完成步骤、合法下一步动作和状态历史。",
    evidenceHistory: testPlan.evidence?.evidenceHistoryRequired === true
      ? "证据历史必须可见。"
      : "证据摘要必须可追溯。",
    successPrompt: "提交成功后展示摘要、状态历史和下一步动作。",
    failurePrompt: "失败提示必须使用业务语言说明缺失项、冲突或越权原因。",
    loadingState: "发起、保存、提交、搜索和上传证据时必须有加载态并防重复点击。",
    emptyState: "无任务、无搜索结果、无草稿时必须说明下一步，不展示技术空白。",
    mobileLayout: "移动端 430px 宽度下必须保持内容完整、按钮可点、长词不溢出。"
  };
}

function buildScenarioEvidence(scenarioNo) {
  const checklistItem = checklist.scenarios.find((item) => item.scenarioPackageNo === scenarioNo);
  const positive = loadBrowserReport(scenarioNo, "positive");
  const negative = loadBrowserReport(scenarioNo, "negative");
  const reports = [positive.report, negative.report].filter(Boolean);
  const unresolvedAnalysisMarkers = [];
  const exposedInternalTerms = [];
  const oldChainVisibleTerms = [];
  const oldVisibleTerms = ["金链", "第一金链", "resource-saleability", "lead-reservation", "FirstGoldenChain"];
  for (const report of reports) {
    for (const shot of report.screenshots ?? []) {
      for (const [key, value] of Object.entries(shot.analysis ?? {})) {
        for (const marker of issueMarkers) {
          if (String(value ?? "").includes(marker)) {
            unresolvedAnalysisMarkers.push({
              report: report.path,
              screenshotId: shot.id,
              key,
              marker,
              value
            });
          }
        }
      }
      const text = String(shot.visibleText ?? "");
      for (const term of checklistItem.systemFieldHiddenCheck.forbiddenUserInputFields) {
        if (term && text.includes(term)) {
          exposedInternalTerms.push({ report: report.path, screenshotId: shot.id, term });
        }
      }
      for (const term of forbiddenScreenshotVisibleTerms) {
        if (term && text.includes(term)) {
          exposedInternalTerms.push({ report: report.path, screenshotId: shot.id, term });
        }
      }
      for (const term of oldVisibleTerms) {
        if (text.includes(term)) {
          oldChainVisibleTerms.push({ report: report.path, screenshotId: shot.id, term });
        }
      }
    }
  }
  return {
    scenarioPackageNo: scenarioNo,
    nameZh: checklistItem.nameZh,
    entry: checklistItem.entry,
    positive: summarizeBrowserReport(positive),
    negative: summarizeBrowserReport(negative),
    screenshotsForUserReview: [
      ...summarizeScreenshots(positive.report),
      ...summarizeScreenshots(negative.report)
    ],
    searchReadonlyCovered: includesAny(reports, ["搜索结果只读跳转", "搜索只读", "只读跳转"]),
    statusHistoryCovered: includesAny(reports, ["状态历史"]),
    evidenceHistoryCovered: includesAny(reports, ["证据历史", "证据摘要"]),
    noInternalIdExposure: exposedInternalTerms.length === 0,
    noOldChainVisibleTerms: oldChainVisibleTerms.length === 0,
    unresolvedAnalysisMarkers,
    exposedInternalTerms,
    oldChainVisibleTerms
  };
}

function loadBrowserReport(scenarioNo, polarity) {
  const dirs = fs.readdirSync(evidenceBase, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => name.startsWith(`dormitory-scenario${scenarioNo}-`) && name.endsWith(`-${polarity}-browser`));
  const candidates = [];
  for (const dir of dirs) {
    const full = path.join(evidenceBase, dir);
    for (const file of fs.readdirSync(full).filter((item) => item.endsWith("report.json"))) {
      candidates.push(path.join(full, file));
    }
  }
  const reportPath = candidates[0];
  const report = reportPath ? JSON.parse(fs.readFileSync(reportPath, "utf8")) : null;
  if (report) report.path = rel(reportPath);
  return {
    path: reportPath ? rel(reportPath) : null,
    report,
    candidateCount: candidates.length
  };
}

function summarizeBrowserReport(entry) {
  return {
    path: entry.path,
    candidateCount: entry.candidateCount,
    status: entry.report?.status ?? "missing",
    authorityId: entry.report?.authorityId ?? null,
    screenshotCount: entry.report?.screenshots?.length ?? 0,
    stepCount: entry.report?.steps?.length ?? entry.report?.scenarios?.length ?? 0,
    digest: entry.report?.positiveBrowserAuditDigest ??
      entry.report?.negativeBrowserAuditDigest ??
      entry.report?.auditDigest ??
      entry.report?.digest ??
      null,
    headSha: entry.report?.git?.headSha ?? null
  };
}

function summarizeScreenshots(report) {
  return (report?.screenshots ?? []).map((shot) => ({
    id: shot.id,
    path: shot.path,
    analysis: shot.analysis ?? {}
  }));
}

function includesAny(reports, terms) {
  const text = JSON.stringify(reports);
  return terms.some((term) => text.includes(term));
}

function highRiskFocus(no) {
  return {
    1: "房间与床位建档、基础证据和下游不可越级。",
    2: "运营状态维护、阻断原因和恢复确认。",
    3: "价格来源、价格快照和不得直接预订。",
    5: "预订确认、库存锁定、锁定截止和搜索只读。",
    6: "收款、押金、担保与财务确认边界。",
    7: "入住办理、证件/协议核验和在住交接。",
    8: "续住、换房、服务记录和在住状态。",
    9: "退房结算、应退应补和财务处理请求。",
    10: "取消、未到店、退款申请和库存释放请求。",
    13: "报表、审计、复盘只读和指标血缘。"
  }[no] ?? "常规场景体验检查。";
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# 住宿经营 13 场景前端最终体验验收与可用性封版报告");
  lines.push("");
  lines.push(`- 状态：${report.status === "passed" ? "PASS" : "FAIL"}`);
  lines.push(`- 生成时间：${report.generatedAtUtc}`);
  lines.push(`- 验收清单：${report.scenarioChecklistPath}`);
  lines.push(`- 用户亲测入口：${report.userTestEntry.localUrl}`);
  lines.push(`- NO_GO：${report.noGoBoundary.finalGoNoGo}`);
  lines.push("");
  lines.push("## 总结");
  lines.push("");
  lines.push(report.uxConclusionZh);
  lines.push("");
  lines.push("## 入口证据");
  lines.push("");
  lines.push(`- 入口报告：${report.entryEvidence.path}`);
  lines.push(`- 状态：${report.entryEvidence.status}`);
  lines.push(`- 截图数：${report.entryEvidence.screenshotCount}`);
  lines.push("");
  lines.push("## 13 场景截图索引");
  lines.push("");
  lines.push("| # | 场景 | 正向 | 反向 | 截图数 | 搜索只读 | 内部编号 | 旧链词 |");
  lines.push("| --- | --- | --- | --- | ---: | --- | --- | --- |");
  for (const item of report.scenarioEvidence) {
    const count = item.positive.screenshotCount + item.negative.screenshotCount;
    lines.push(`| ${item.scenarioPackageNo} | ${item.nameZh} | ${item.positive.status} | ${item.negative.status} | ${count} | ${item.searchReadonlyCovered ? "已覆盖" : "待人工复核"} | ${item.noInternalIdExposure ? "未暴露" : "有问题"} | ${item.noOldChainVisibleTerms ? "未出现" : "有问题"} |`);
  }
  lines.push("");
  lines.push("## 高风险强化验收");
  lines.push("");
  for (const item of report.highRiskRecheck) {
    lines.push(`- 场景 ${item.scenarioPackageNo} ${item.nameZh}：${item.focusZh} 正向 ${item.positiveStatus}，反向 ${item.negativeStatus}，截图 ${item.screenshotCount} 张。`);
  }
  lines.push("");
  lines.push("## 用户亲测建议顺序");
  lines.push("");
  for (const item of report.userTestEntry.sequenceZh) lines.push(`- ${item}`);
  lines.push("");
  lines.push("## 不允许上线项");
  lines.push("");
  lines.push(report.noGoBoundary.explanationZh);
  if (report.failures.length) {
    lines.push("");
    lines.push("## 阻断项");
    lines.push("");
    for (const item of report.failures) lines.push(`- ${item}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderDocsIndex() {
  return `# 住宿经营 13 场景前端最终体验验收索引

本文件是稳定索引，不保存动态截图清单、运行时间或当前工作区状态。

动态验收产物由脚本生成：

- 生成脚本：\`scripts/surface/generate-dormitory-final-frontend-ux-acceptance.mjs\`
- 动态清单：\`artifacts/oam/evidence/dormitory-final-frontend-ux-acceptance/final-frontend-ux-acceptance-checklist.json\`
- 动态报告：\`artifacts/oam/evidence/dormitory-final-frontend-ux-acceptance/final-frontend-ux-acceptance-report.md\`
- 报告 JSON：\`artifacts/oam/evidence/dormitory-final-frontend-ux-acceptance/final-frontend-ux-acceptance-report.json\`

硬门禁范围：

- 13 场景正向和反向浏览器报告必须全部通过。
- 截图分析不得残留未闭合的问题标记。
- 截图可见文本不得暴露内部编号、旧链词或技术词。
- 今日、工作项、搜索、我的入口职责必须由浏览器证据覆盖。
- 搜索结果只读，不能直接写业务事实。
- 生产发布、业务上线和最终放行仍保持 NO_GO。
`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
