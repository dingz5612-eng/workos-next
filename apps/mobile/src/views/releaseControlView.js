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
          <span>Release Control Center</span>
          <h1>MR Overview</h1>
        </header>
        <section class="release-panel">
          <h2>MR Overview</h2>
          <p>No release manifest</p>
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
        <span>Release Control Center</span>
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
      <h2>Launch Control</h2>
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
      <h2>All MRs</h2>
      ${table(releases, ["mrId", "releaseStatus", "gateResultStatus", "shadowGrade"], escapeHtml, "No MRs loaded.", selectedReleaseId)}
    </section>
  `;
}

function mrOverview(overview, manifest, flags, cutovers, escapeHtml) {
  const acceptance = overview.acceptanceProgress || { completed: 0, total: 0, percent: 0 };
  return `
    <section class="release-panel">
      <h2>MR Overview</h2>
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
      <h2>GateResult Detail</h2>
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
      <h2>Shadow Report</h2>
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
      <h2>Invariant Monitor</h2>
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
      <h2>Rollback / Compensation</h2>
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
      <h2>Business Signoff</h2>
      ${field("businessSignoff refs", join(refs), escapeHtml)}
      ${field("locked admission", admission.canLock ? "allowed" : "blocked", escapeHtml, admission.canLock ? "status-passed" : "status-blocked")}
      ${field("locked blockers", join(admission.lockedBlockers), escapeHtml)}
    </section>
  `;
}

function admissionPanel(admission, escapeHtml) {
  return `
    <section class="release-panel release-wide">
      <h2>Active / Locked Admission</h2>
      ${field("active transition", admission.canActivate ? "allowed" : "blocked", escapeHtml, admission.canActivate ? "status-passed" : "status-blocked")}
      ${field("active blockers", join(admission.activeBlockers), escapeHtml)}
      ${field("locked transition", admission.canLock ? "allowed" : "blocked", escapeHtml, admission.canLock ? "status-passed" : "status-blocked")}
      ${field("locked blockers", join(admission.lockedBlockers), escapeHtml)}
    </section>
  `;
}

function table(rows, columns, escapeHtml, emptyText, selectedReleaseId) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) return `<p>${escapeHtml(emptyText)}</p>`;
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
  return `<dl class="${className}"><dt>${escapeHtml(labelText)}</dt><dd>${escapeHtml(value ?? "")}</dd></dl>`;
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
  return value.replace(/[A-Z]/g, (match) => ` ${match}`).trim();
}
