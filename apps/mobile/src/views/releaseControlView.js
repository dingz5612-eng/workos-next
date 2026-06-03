export function releaseControlView(ctx) {
  const { state, shell, escapeHtml } = ctx;
  const control = state.releaseControl || { releases: [], selectedRelease: null };
  const releases = control.releases || [];
  const detail = control.selectedRelease;
  const overview = detail?.overview || releases[0];
  if (!overview) {
    return shell(`
      <section class="release-control">
        <header>
          <span>发布工作区</span>
          <h1>发布总览</h1>
        </header>
        <section class="release-panel">
          <h2>发布总览</h2>
          <p>暂无发布清单。</p>
        </section>
      </section>
    `);
  }

  const manifest = detail?.manifest || {};
  const gate = detail?.gateResult;
  const shadowReports = detail?.shadowReports || [];
  const invariants = detail?.invariantChecks || [];
  const rollback = detail?.rollbackInstruction;
  const flags = detail?.featureFlags || [];
  const cutovers = detail?.sliceCutoverStates || [];
  const admission = detail?.admission || computeAdmission(gate, shadowReports, invariants, rollback);
  return shell(`
    <section class="release-control">
      <header>
        <span>发布工作区</span>
        <h1>${escapeHtml(overview.mrId || manifest.mrId || "MR")}</h1>
      </header>
      ${mrList(releases, overview.releaseId, escapeHtml)}
      <section class="release-grid">
        ${launchControlPanel(overview, gate, shadowReports, invariants, rollback, admission, escapeHtml)}
        ${mrOverview(overview, manifest, flags, cutovers, escapeHtml)}
        ${gateDetail(gate, overview, escapeHtml)}
        ${shadowReport(overview, shadowReports, escapeHtml)}
        ${invariantMonitor(overview, invariants, escapeHtml)}
        ${rollbackPanel(overview, rollback, escapeHtml)}
        ${featureFlagPanel(flags, escapeHtml)}
        ${sliceCutoverPanel(cutovers, escapeHtml)}
        ${releaseManifestPanel(manifest, overview, escapeHtml)}
        ${ciRunPanel(manifest, gate, escapeHtml)}
        ${businessSignoffPanel(gate, admission, escapeHtml)}
        ${admissionPanel(admission, escapeHtml)}
      </section>
    </section>
  `);
}

function launchControlPanel(overview, gate, shadowReports, invariants, rollback, admission, escapeHtml) {
  const latestShadowGrade = shadowReports[0]?.grade || overview.shadowGrade || "none";
  const p0BlockingFailures = invariants.filter((item) =>
    item.mode === "blocking" &&
    item.severity === "P0" &&
    (item.status === "failed" || item.status === "blocked" || Number(item.violationCount || 0) > 0)).length;
  return `
    <section class="release-panel release-wide" data-launch-control-console="true">
      <h2>发布准入控制</h2>
      ${field("active readiness", admission.canActivate ? "go" : "no-go", escapeHtml, admission.canActivate ? "status-passed" : "status-blocked")}
      ${field("locked readiness", admission.canLock ? "go" : "no-go", escapeHtml, admission.canLock ? "status-passed" : "status-blocked")}
      ${field("GateResult", gate?.status || overview.gateResultStatus || "not_run", escapeHtml)}
      ${field("Shadow", latestShadowGrade, escapeHtml, `grade-${latestShadowGrade}`)}
      ${field("P0 blocking failures", p0BlockingFailures, escapeHtml, p0BlockingFailures === 0 ? "status-passed" : "status-blocked")}
      ${field("RollbackInstruction", rollback?.rollbackInstructionId || overview.rollbackInstructionId || "missing", escapeHtml, rollback ? "status-passed" : "status-blocked")}
      ${field("Business Signoff", join(gate?.businessSignoffRefs), escapeHtml, gate?.businessSignoffRefs?.length ? "status-passed" : "status-blocked")}
      ${field("No-Go blockers", join(admission.lockedBlockers), escapeHtml)}
    </section>
  `;
}

function mrList(releases, selectedReleaseId, escapeHtml) {
  return `
    <section class="release-panel release-wide">
      <h2>全部 MR</h2>
      ${table(releases, ["mrId", "releaseStatus", "gateResultStatus", "shadowGrade"], escapeHtml, "No MRs loaded.", selectedReleaseId)}
    </section>
  `;
}

function mrOverview(overview, manifest, flags, cutovers, escapeHtml) {
  const acceptance = overview.acceptanceProgress || { completed: 0, total: 0, percent: 0 };
  return `
    <section class="release-panel">
      <h2>发布总览</h2>
      ${field("MR ID", overview.mrId || manifest.mrId, escapeHtml)}
      ${field("release status", overview.releaseStatus || manifest.status, escapeHtml)}
      ${field("owner", overview.owner || first(manifest.owners) || "unassigned", escapeHtml)}
      ${field("feature flag status", overview.featureFlagStatus || flags[0]?.status || "none", escapeHtml)}
      ${field("slice runtime_mode", overview.sliceRuntimeMode || cutovers[0]?.runtimeMode || "legacy", escapeHtml)}
      ${field("acceptance progress", `${acceptance.completed || 0}/${acceptance.total || 0} (${acceptance.percent || 0}%)`, escapeHtml)}
    </section>
  `;
}

function gateDetail(gate, overview, escapeHtml) {
  const status = gate?.status || overview.gateResultStatus || "not_run";
  return `
    <section class="release-panel" data-gate-result-readonly="true" aria-readonly="true">
      <h2>GateResult 明细</h2>
      ${field("GateResult status", status, escapeHtml, `status-${status}`)}
      ${field("GateResult ID", gate?.gateResultId || overview.gateResultId || "not_run", escapeHtml)}
      ${field("generated by", gate?.generatedBy || "gate-runner", escapeHtml)}
      ${field("gate type", gate?.gateType || "release", escapeHtml)}
      ${field("severity", gate?.severity || "P0", escapeHtml)}
      ${field("automated tests", join(gate?.automatedTestRefs), escapeHtml)}
      ${field("invariant refs", join(gate?.invariantCheckRefs), escapeHtml)}
      ${field("shadow refs", join(gate?.shadowCompareReportRefs), escapeHtml)}
      ${field("result hash", gate?.resultHash || "none", escapeHtml)}
    </section>
  `;
}

function shadowReport(overview, reports, escapeHtml) {
  const grades = reports.length ? reports.map((report) => report.grade) : [overview.shadowGrade || "green"];
  return `
    <section class="release-panel">
      <h2>影子对比报告</h2>
      ${field("Shadow grade", overview.shadowGrade || grades[0], escapeHtml, `grade-${overview.shadowGrade || grades[0]}`)}
      <div class="release-badges">${grades.map((grade) => `<span class="grade-${escapeHtml(grade)}">${escapeHtml(grade)}</span>`).join("")}</div>
      ${table(reports, ["shadowCompareReportId", "grade", "mismatchCount", "ciRunId"], escapeHtml, "No ShadowCompareReport loaded.")}
    </section>
  `;
}

function invariantMonitor(overview, invariants, escapeHtml) {
  const counts = overview.invariantCounts || { p0: 0, p1: 0, p2: 0 };
  return `
    <section class="release-panel">
      <h2>不变量监控</h2>
      <div class="release-counts">
        <span>P0 ${Number(counts.p0 || counts.P0 || 0)}</span>
        <span>P1 ${Number(counts.p1 || counts.P1 || 0)}</span>
        <span>P2 ${Number(counts.p2 || counts.P2 || 0)}</span>
      </div>
      ${table(invariants, ["invariantKey", "mode", "severity", "status", "violationCount"], escapeHtml, "No invariant checks loaded.")}
    </section>
  `;
}

function rollbackPanel(overview, rollback, escapeHtml) {
  return `
    <section class="release-panel">
      <h2>回滚 / 补偿</h2>
      ${field("rollbackInstruction link", rollback?.rollbackInstructionId || overview.rollbackInstructionId || "none", escapeHtml)}
      ${field("instruction_type", rollback?.instructionType || "missing", escapeHtml)}
      ${field("rollback_kind", rollback?.rollbackKind || "missing", escapeHtml)}
      ${field("owner", rollback?.owner || overview.owner || "platform", escapeHtml)}
      ${field("risk level", rollback?.riskLevel || "unknown", escapeHtml)}
      ${field("steps", join(rollback?.steps), escapeHtml)}
      ${field("validation steps", join(rollback?.validationSteps), escapeHtml)}
    </section>
  `;
}

function featureFlagPanel(flags, escapeHtml) {
  return `
    <section class="release-panel">
      <h2>FeatureFlag</h2>
      ${table(flags, ["flagKey", "status", "createdBy", "expiresAtUtc"], escapeHtml, "No FeatureFlags loaded.")}
    </section>
  `;
}

function sliceCutoverPanel(cutovers, escapeHtml) {
  return `
    <section class="release-panel">
      <h2>SliceCutoverState</h2>
      ${table(cutovers, ["sliceId", "tenantId", "runtimeMode", "lastGateResultId", "rollbackInstructionId"], escapeHtml, "No SliceCutoverState loaded.")}
    </section>
  `;
}

function releaseManifestPanel(manifest, overview, escapeHtml) {
  return `
    <section class="release-panel">
      <h2>ReleaseManifest</h2>
      ${field("release_id", manifest.releaseId || overview.releaseId, escapeHtml)}
      ${field("release_name", manifest.releaseName || "unknown", escapeHtml)}
      ${field("status", manifest.status || overview.releaseStatus, escapeHtml)}
      ${field("owners", join(manifest.owners || [overview.owner]), escapeHtml)}
      ${field("commit_sha", manifest.commitSha || "none", escapeHtml)}
      ${field("migration_version", manifest.migrationVersion || "none", escapeHtml)}
      ${field("definition_version", manifest.definitionVersion || "none", escapeHtml)}
      ${field("api_schema_hash", manifest.apiSchemaHash || "none", escapeHtml)}
      ${field("created_at_utc", manifest.createdAtUtc || "unknown", escapeHtml)}
      ${field("updated_at_utc", manifest.updatedAtUtc || "unknown", escapeHtml)}
      ${field("locked_at_utc", manifest.lockedAtUtc || "not_locked", escapeHtml)}
    </section>
  `;
}

function ciRunPanel(manifest, gate, escapeHtml) {
  return `
    <section class="release-panel">
      <h2>CI run id</h2>
      ${field("ReleaseManifest ci_run_id", manifest.ciRunId || "none", escapeHtml)}
      ${field("GateResult ci_run_id", gate?.ciRunId || "none", escapeHtml)}
      ${field("input_hash", gate?.inputHash || "none", escapeHtml)}
      ${field("result_hash", gate?.resultHash || "none", escapeHtml)}
    </section>
  `;
}

function businessSignoffPanel(gate, admission, escapeHtml) {
  const refs = gate?.businessSignoffRefs || [];
  return `
    <section class="release-panel">
      <h2>业务签收</h2>
      ${field("businessSignoff refs", join(refs), escapeHtml)}
      ${field("locked admission", admission.canLock ? "allowed" : "blocked", escapeHtml, admission.canLock ? "status-passed" : "status-blocked")}
      ${field("locked blockers", join(admission.lockedBlockers), escapeHtml)}
    </section>
  `;
}

function admissionPanel(admission, escapeHtml) {
  return `
    <section class="release-panel release-wide">
      <h2>Active / Locked 准入</h2>
      ${field("active transition", admission.canActivate ? "allowed" : "blocked", escapeHtml, admission.canActivate ? "status-passed" : "status-blocked")}
      ${field("active blockers", join(admission.activeBlockers), escapeHtml)}
      ${field("locked transition", admission.canLock ? "allowed" : "blocked", escapeHtml, admission.canLock ? "status-passed" : "status-blocked")}
      ${field("locked blockers", join(admission.lockedBlockers), escapeHtml)}
    </section>
  `;
}

function table(rows, columns, escapeHtml, emptyText, selectedReleaseId) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) return `<p>${escapeHtml(releaseText(emptyText))}</p>`;
  return `
    <table>
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(label(column))}</th>`).join("")}</tr></thead>
      <tbody>
        ${safeRows.map((row) => `
          <tr${selectedReleaseId && row.releaseId === selectedReleaseId ? " data-selected-release=\"true\"" : ""}>
            ${columns.map((column) => `<td>${escapeHtml(valueFor(row, column))}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function field(labelText, value, escapeHtml, className = "") {
  return `<dl class="${className}"><dt>${escapeHtml(label(labelText))}</dt><dd>${escapeHtml(releaseValue(value))}</dd></dl>`;
}

function computeAdmission(gate, shadowReports, invariants, rollback) {
  const activeBlockers = [];
  if ((gate?.status || "not_run") !== "passed") activeBlockers.push("gate_result_not_passed");
  if ((shadowReports || []).some((report) => report.grade === "red")) activeBlockers.push("red_shadow_report");
  if ((invariants || []).some((item) => item.mode === "blocking" && item.severity === "P0" && (item.status === "failed" || item.status === "blocked" || Number(item.violationCount || 0) > 0))) {
    activeBlockers.push("p0_blocking_invariant_failed");
  }
  if (!rollback) activeBlockers.push("rollback_instruction_missing");
  const lockedBlockers = [...activeBlockers];
  if (!gate?.businessSignoffRefs?.length) lockedBlockers.push("business_signoff_missing");
  return {
    canActivate: activeBlockers.length === 0,
    canLock: lockedBlockers.length === 0,
    activeBlockers,
    lockedBlockers
  };
}

function valueFor(row, column) {
  const value = row?.[column];
  if (Array.isArray(value)) return join(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? "";
}

function join(value) {
  return Array.isArray(value) && value.length > 0 ? value.join(", ") : "none";
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function label(value) {
  const technicalLabels = {
    releaseStatus: "发布状态",
    shadowGrade: "Shadow 等级",
    shadowCompareReportId: "ShadowCompareReport ID",
    gateResultStatus: "GateResult 状态",
    gateResultId: "GateResult ID",
    rollbackInstructionId: "RollbackInstruction ID",
    lastGateResultId: "last GateResult ID",
    invariantKey: "Invariant key",
    runtimeMode: "runtime_mode",
    sliceId: "slice_id",
    tenantId: "tenant_id",
    mrId: "MR ID",
    ciRunId: "CI run id",
    "active readiness": "当前准入",
    "locked readiness": "锁定准入",
    Shadow: "Shadow",
    "P0 blocking failures": "P0 阻断失败",
    RollbackInstruction: "RollbackInstruction",
    "Business Signoff": "业务签收",
    "No-Go blockers": "No-Go 阻断",
    "release status": "发布状态",
    owner: "负责人",
    "feature flag status": "FeatureFlag 状态",
    "slice runtime_mode": "Slice runtime_mode",
    "acceptance progress": "验收进度",
    "GateResult status": "GateResult 状态",
    "generated by": "生成方",
    "gate type": "门禁类型",
    severity: "等级",
    "automated tests": "自动化验收",
    "invariant refs": "Invariant 引用",
    "shadow refs": "ShadowCompare 引用",
    "result hash": "结果哈希",
    "Shadow grade": "Shadow 等级",
    grade: "等级",
    mismatchCount: "差异数",
    mode: "模式",
    status: "状态",
    violationCount: "违规数",
    "rollbackInstruction link": "RollbackInstruction 编号",
    instruction_type: "指令类型",
    rollback_kind: "回滚类型",
    "risk level": "风险等级",
    steps: "执行步骤",
    "validation steps": "验证步骤",
    flagKey: "FeatureFlag",
    createdBy: "创建人",
    expiresAtUtc: "过期时间",
    "release_id": "发布编号",
    "release_name": "发布名称",
    owners: "负责人",
    "commit_sha": "提交 SHA",
    "migration_version": "迁移版本",
    "definition_version": "Definition 版本",
    "api_schema_hash": "API schema hash",
    "created_at_utc": "创建时间",
    "updated_at_utc": "更新时间",
    "locked_at_utc": "锁定时间",
    "ReleaseManifest ci_run_id": "ReleaseManifest CI run id",
    "GateResult ci_run_id": "GateResult CI run id",
    "input_hash": "输入哈希",
    "result_hash": "结果哈希",
    "businessSignoff refs": "业务签收引用",
    "locked admission": "锁定准入",
    "locked blockers": "锁定阻断",
    "active transition": "当前阶段切换",
    "active blockers": "当前阻断",
    "locked transition": "锁定阶段切换"
  };
  if (technicalLabels[value]) return technicalLabels[value];
  return value.replace(/[A-Z]/g, (match) => ` ${match}`).trim();
}

function releaseText(value) {
  const labels = {
    "No MRs loaded.": "没有 MR 记录。",
    "No ShadowCompareReport loaded.": "没有 ShadowCompareReport。",
    "No invariant checks loaded.": "没有 Invariant 检查。",
    "No FeatureFlags loaded.": "没有 FeatureFlag。",
    "No SliceCutoverState loaded.": "没有 SliceCutoverState。"
  };
  return labels[value] || value;
}

function releaseValue(value) {
  const text = String(value ?? "");
  const labels = {
    none: "无",
    missing: "缺失",
    unknown: "未知",
    unassigned: "未分配",
    allowed: "允许",
    blocked: "阻断",
    not_locked: "未锁定",
    not_run: "未运行"
  };
  return labels[text] || (value ?? "");
}
