import {
  canEditRoleCapability,
  canRevokeDevice,
  deviceCanPerformHighRiskAction,
  governanceExportDefinitions,
  pcGovernanceNavItems,
  validateGovernanceExportRequest
} from "../pcGovernancePolicies.js";

export function pcGovernanceView(ctx) {
  const governance = ctx.state.pcGovernance || {};
  const release = ctx.state.releaseControl?.selectedRelease || {};
  return ctx.shell(`
    <section class="pc-governance-full" data-pc-governance-full>
      <header class="governance-hero">
        <span>PC Governance Full</span>
        <h1>Governance Command Center</h1>
        <p>Read-first governance for work, facts, evidence, release gates, risk, audit, and controlled export.</p>
      </header>
      ${navigation(ctx)}
      <section class="governance-grid">
        ${dashboardPanel(governance, release, ctx)}
        ${productionObservabilityPanel(governance.productionObservability, ctx)}
        ${workManagementPanel(ctx)}
        ${objectsPanel(ctx)}
        ${casesPanel(ctx)}
        ${ledgersPanel(governance, ctx)}
        ${evidenceReviewPanel(governance, ctx)}
        ${reconciliationPanel(ctx)}
        ${correctionCenterPanel(ctx)}
        ${periodReviewPanel(governance, ctx)}
        ${riskCommandPanel(ctx)}
        ${adminPanel(governance, ctx)}
        ${auditPanel(governance, ctx)}
        ${exportPanel(governance, ctx)}
        ${releaseControlPanel(release, ctx)}
      </section>
    </section>
  `);
}

function navigation(ctx) {
  return `
    <nav class="pc-governance-nav" data-pc-governance-nav aria-label="PC Governance navigation">
      ${pcGovernanceNavItems.map((label) => `
        <a href="#${slug(label)}" data-governance-nav="${escapeAttr(ctx, label)}">${escapeHtml(ctx, label)}</a>
      `).join("")}
    </nav>
  `;
}

function dashboardPanel(governance, release, ctx) {
  const workQueue = workItems(ctx);
  const risks = riskItems(ctx);
  const blockers = blockersFromState(ctx);
  const production = productionMetrics(governance.productionObservability);
  return panel("Dashboard", "dashboard", `
    <div class="governance-metrics">
      ${metric("Open WorkItems", workQueue.length, ctx)}
      ${metric("RiskCommand items", risks.length, ctx)}
      ${metric("Open blockers", blockers.length, ctx)}
      ${metric("GateResult", production.controlPlane?.gateResultStatus || release.gateResult?.status || release.overview?.gateResultStatus || "not_run", ctx)}
    </div>
    <p data-governance-source-note>Dashboard reads lenses, events, release control data, and WorkItems; it does not write business facts.</p>
  `);
}

function productionObservabilityPanel(observability, ctx) {
  const metrics = productionMetrics(observability);
  return panel("Production Observability", "production-observability", `
    <div class="governance-metrics" data-production-observability>
      ${metric("confirm latency p95", `${value(metrics.runtime?.confirmLatencyP95Ms)} ms`, ctx)}
      ${metric("confirm failure count", value(metrics.runtime?.confirmFailureCount), ctx)}
      ${metric("403 / 409 / 422 count", `${value(metrics.runtime?.forbiddenCount403)} / ${value(metrics.runtime?.conflictCount409)} / ${value(metrics.runtime?.validationCount422)}`, ctx)}
      ${metric("outbox lag", `${value(metrics.outbox?.outboxLagSeconds)} s`, ctx)}
      ${metric("dead-letter count", value(metrics.outbox?.deadLetterCount), ctx)}
      ${metric("projection lag", `${value(metrics.projection?.projectionLagSeconds)} s`, ctx)}
      ${metric("WorkItemBundle p95", `${value(metrics.mobile?.workItemBundleP95Ms)} ms`, ctx)}
      ${metric("GateResult status", metrics.controlPlane?.gateResultStatus || "not_run", ctx)}
    </div>
    <div class="observability-domain-grid">
      ${metricTable("Runtime", metrics.runtime, ctx)}
      ${metricTable("Outbox", metrics.outbox, ctx)}
      ${metricTable("Projection", metrics.projection, ctx)}
      ${metricTable("Mobile", metrics.mobile, ctx)}
      ${metricTable("Money", metrics.money, ctx)}
      ${metricTable("Deposit", metrics.deposit, ctx)}
      ${metricTable("Checkout", metrics.checkout, ctx)}
      ${metricTable("Control Plane", metrics.controlPlane, ctx)}
    </div>
    <p data-observability-generated>generatedAtUtc ${escapeHtml(ctx, observability?.productionMetrics?.generatedAtUtc || metrics.generatedAtUtc || "not_loaded")}</p>
  `);
}

function workManagementPanel(ctx) {
  const rows = workItems(ctx);
  return panel("Work Management", "work-management", tableOrEmpty(rows, ["workItemId", "title", "status", "assignedRole", "dueAtUtc"], ctx, "No WorkItems visible."));
}

function objectsPanel(ctx) {
  const lenses = ctx.state.accommodationLenses || ctx.state.runtimeStore?.accommodationLenses || {};
  const rows = [
    ...asArray(lenses["bed-inventory"]).map((item) => ({ objectType: "BedInventoryLens", objectId: item.lensId || "bed-inventory", status: item.stale ? "stale" : "projected", summary: item.totalBeds ?? item.body?.totalBeds })),
    ...asArray(lenses["room-readiness"]).map((item) => ({ objectType: "RoomReadinessLens", objectId: item.roomId || item.roomNo || item.lensId, status: item.blockStatus || item.status, summary: item.configuredBeds ?? item.body?.configuredBeds })),
    ...asArray(lenses["stay-balance"]).map((item) => ({ objectType: "StayBalanceLens", objectId: item.stayId || item.lensId, status: item.status || "projected", summary: item.outstandingBalance ?? item.body?.outstandingBalance }))
  ];
  return panel("Objects", "objects", tableOrEmpty(rows, ["objectType", "objectId", "status", "summary"], ctx, "No object lenses loaded."));
}

function casesPanel(ctx) {
  const rows = [
    ...asArray(ctx.state.pcManager?.cases),
    ...asArray(ctx.state.checkoutManager?.cases),
    ...blockersFromState(ctx).map((item) => ({
      caseId: item.caseId || item.relatedCaseId || item.relatedObjectId || "case",
      status: item.status || "blocked",
      ownerRole: item.ownerRole,
      resolveAction: item.resolveAction
    }))
  ];
  return panel("Cases", "cases", tableOrEmpty(rows, ["caseId", "status", "ownerRole", "resolveAction"], ctx, "No cases or blockers loaded."));
}

function ledgersPanel(governance, ctx) {
  const rows = asArray(governance.ledgers || governance.ledgerSummaries);
  const fallback = [
    ...riskItems(ctx).filter((item) => (item.relatedLedgerRefs || []).length).map((item) => ({
      ledger: item.riskType,
      status: item.severity,
      refs: (item.relatedLedgerRefs || []).join(", "),
      amount: item.amount ?? item.count ?? ""
    }))
  ];
  return panel("Ledgers", "ledgers", tableOrEmpty(rows.length ? rows : fallback, ["ledger", "status", "refs", "amount"], ctx, "No ledger summaries loaded."));
}

function evidenceReviewPanel(governance, ctx) {
  const evidence = asArray(governance.evidenceObjects || ctx.state.evidenceObjects);
  const audits = asArray(governance.evidenceAccessAudits);
  return panel("Evidence Review", "evidence-review", `
    ${tableOrEmpty(evidence, ["evidenceId", "status", "contentSha256", "tenantId"], ctx, "No evidence review items loaded.")}
    <h3>Evidence access audit view</h3>
    ${tableOrEmpty(audits, ["auditEventId", "eventType", "actorId", "deviceId", "occurredAtUtc"], ctx, "No evidence access audit records loaded.")}
  `);
}

function reconciliationPanel(ctx) {
  const state = ctx.state.bankStatementImport || {};
  const candidates = asArray(state.candidates?.candidates || state.candidates);
  const mismatches = asArray(state.mismatchCases?.cases || state.mismatchCases);
  return panel("Reconciliation", "reconciliation", `
    ${tableOrEmpty(candidates, ["candidateId", "candidateType", "paymentId", "score", "reason"], ctx, "No match candidates loaded.")}
    <h3>Mismatch Queue</h3>
    ${tableOrEmpty(mismatches, ["caseId", "mismatchType", "ownerRole", "blockerSeverity"], ctx, "No reconciliation mismatches loaded.")}
  `);
}

function correctionCenterPanel(ctx) {
  const state = ctx.state.bankStatementImport || {};
  return panel("Correction Center", "correction-center", `
    ${tableOrEmpty(asArray(state.correctionRequests), ["correctionRequestId", "targetLedgerType", "correctionType", "riskLevel", "status"], ctx, "No correction requests loaded.")}
    <h3>Correction audit</h3>
    ${tableOrEmpty(asArray(state.correctionAudit || state.operationAudit), ["auditEventId", "operationName", "status", "recordedAtUtc"], ctx, "No correction audit records loaded.")}
  `);
}

function periodReviewPanel(governance, ctx) {
  const rows = asArray(governance.periodReviews || governance.periodSnapshots);
  return panel("Period Review", "period-review", tableOrEmpty(rows, ["periodReviewId", "periodKey", "status", "sourceHighWatermark"], ctx, "No period reviews loaded."));
}

function riskCommandPanel(ctx) {
  const rows = riskItems(ctx);
  return panel("RiskCommand", "riskcommand", tableOrEmpty(rows, ["riskId", "riskType", "severity", "ownerRole", "resolveAction", "drilldownUrl"], ctx, "No source-backed risk items loaded."));
}

function adminPanel(governance, ctx) {
  const roleEditAllowed = canEditRoleCapability(ctx.state);
  const deviceRevokeAllowed = canRevokeDevice(ctx.state);
  return panel("Admin", "admin", `
    <section data-role-capability-admin>
      <h3>RoleCapability view/edit</h3>
      <p data-capability-required="admin.role_capability.edit">Edit requires admin.role_capability.edit.</p>
      ${tableOrEmpty(asArray(governance.roleCapabilities), ["role", "capability", "effect", "source"], ctx, "No RoleCapability rules loaded.")}
      <button type="button" data-role-capability-edit ${roleEditAllowed ? "" : "disabled"}>Edit RoleCapability</button>
    </section>
    <section>
      <h3>FeatureFlag view</h3>
      ${tableOrEmpty(asArray(governance.featureFlags || featureFlagsFromRelease(ctx)), ["flagKey", "status", "scope"], ctx, "No FeatureFlags loaded.")}
    </section>
    <section>
      <h3>SliceCutoverState view</h3>
      ${tableOrEmpty(asArray(governance.sliceCutoverStates || sliceCutoversFromRelease(ctx)), ["sliceId", "runtimeMode", "tenantId", "dependencyStatus"], ctx, "No SliceCutoverState loaded.")}
    </section>
    <section>
      <h3>DefinitionVersion view</h3>
      ${tableOrEmpty(asArray(governance.definitionVersions), ["definitionVersion", "contractHash", "status", "activatedAtUtc"], ctx, "No DefinitionVersion records loaded.")}
    </section>
    <section>
      <h3>DeviceSession view/revoke</h3>
      ${deviceSessionTable(governance, deviceRevokeAllowed, ctx)}
    </section>
    <section>
      <h3>Evidence access audit view</h3>
      ${tableOrEmpty(asArray(governance.evidenceAccessAudits), ["auditEventId", "eventType", "actorId", "deviceId", "occurredAtUtc"], ctx, "No evidence access audit records loaded.")}
    </section>
  `);
}

function auditPanel(governance, ctx) {
  const domainEvents = asArray(governance.domainEvents || ctx.state.projectionEvents || ctx.state.runtimeStore?.events);
  const commandSubmissions = asArray(governance.commandSubmissions || ctx.state.runtimeStore?.commandSubmissions);
  const releaseAudit = asArray(governance.releaseControlAudits || releaseAuditFromState(ctx));
  const correctionAudit = asArray(governance.correctionAudit || ctx.state.bankStatementImport?.correctionAudit || ctx.state.bankStatementImport?.operationAudit);
  return panel("Audit", "audit", `
    <label for="domainEventSearch">DomainEvent search</label>
    <input id="domainEventSearch" data-domain-event-search placeholder="eventType / aggregate / actor">
    ${tableOrEmpty(domainEvents, ["eventId", "eventType", "actorId", "occurredAtUtc"], ctx, "No DomainEvents loaded.")}
    <label for="commandSubmissionSearch">CommandSubmission search</label>
    <input id="commandSubmissionSearch" data-command-submission-search placeholder="submissionId / idempotencyKey">
    ${tableOrEmpty(commandSubmissions, ["submissionId", "workItemId", "status", "idempotencyKey"], ctx, "No CommandSubmissions loaded.")}
    <h3>Release control audit</h3>
    ${tableOrEmpty(releaseAudit, ["auditEventId", "eventType", "releaseId", "occurredAtUtc"], ctx, "No release control audit loaded.")}
    <h3>Correction audit</h3>
    ${tableOrEmpty(correctionAudit, ["auditEventId", "operationName", "status", "recordedAtUtc"], ctx, "No correction audit loaded.")}
  `);
}

function exportPanel(governance, ctx) {
  const device = governance.currentDevice || asArray(governance.deviceSessions)[0] || { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" };
  const exports = governanceExportDefinitions.map((definition) => exportControl(definition, device, ctx)).join("");
  const audits = asArray(governance.exportAudits || governance.exports);
  return panel("Export", "export", `
    <p data-export-rules>Exports require capability, reason, audit, expiring download URL, and trusted PC device for high-risk export.</p>
    <div class="export-control-grid">${exports}</div>
    <h3>Export audit</h3>
    ${tableOrEmpty(audits, ["auditEventId", "eventType", "exportType", "status", "reason", "expiresAtUtc"], ctx, "No export audit records loaded.")}
  `);
}

function releaseControlPanel(release, ctx) {
  const overview = release.overview || release.manifest || {};
  return panel("Release Control Center", "release-control-center", `
    <dl class="governance-kv"><dt>MR ID</dt><dd>${escapeHtml(ctx, overview.mrId || overview.mr_id || "MR")}</dd></dl>
    <dl class="governance-kv"><dt>GateResult status</dt><dd>${escapeHtml(ctx, release.gateResult?.status || overview.gateResultStatus || "not_run")}</dd></dl>
    <dl class="governance-kv"><dt>Shadow grade</dt><dd>${escapeHtml(ctx, overview.shadowGrade || release.shadowReports?.[0]?.grade || "unknown")}</dd></dl>
    <button type="button" data-view="releaseControl">Open Release Control Center</button>
  `);
}

function exportControl(definition, device, ctx) {
  const validation = validateGovernanceExportRequest({
    exportType: definition.key,
    reason: "",
    actor: ctx.state.currentActor,
    device,
    state: ctx.state,
    now: new Date("2026-05-30T00:00:00Z")
  });
  const blocked = validation.errors.includes("EXPORT_CAPABILITY_REQUIRED") || (definition.highRisk && !deviceCanPerformHighRiskAction(device));
  return `
    <article class="export-control" data-export-control="${escapeAttr(ctx, definition.key)}">
      <h3>${escapeHtml(ctx, definition.label)}</h3>
      <p>capability ${escapeHtml(ctx, definition.capability)}${definition.highRisk ? " · high-risk trusted PC only" : ""}</p>
      <label for="exportReason-${escapeAttr(ctx, definition.key)}">reason</label>
      <textarea id="exportReason-${escapeAttr(ctx, definition.key)}" data-export-reason="${escapeAttr(ctx, definition.key)}" required></textarea>
      <button type="button" data-governance-export="${escapeAttr(ctx, definition.key)}" ${blocked ? "disabled" : ""}>Request audited export</button>
      <small>download URL expires in 15 minutes · errors if no reason: ${escapeHtml(ctx, validation.errors.join(", ") || "none after reason")}</small>
    </article>
  `;
}

function deviceSessionTable(governance, revokeAllowed, ctx) {
  const sessions = asArray(governance.deviceSessions);
  if (!sessions.length) return `<p>No DeviceSession records loaded.</p>`;
  return `
    <table>
      <thead><tr><th>deviceId</th><th>actorId</th><th>trust</th><th>surface</th><th>highRisk</th><th>action</th></tr></thead>
      <tbody>
        ${sessions.map((session) => `
          <tr>
            <td>${escapeHtml(ctx, session.deviceId)}</td>
            <td>${escapeHtml(ctx, session.actorId)}</td>
            <td>${escapeHtml(ctx, session.deviceTrustStatus || session.trustStatus)}</td>
            <td>${escapeHtml(ctx, session.surface || session.deviceType || "pc")}</td>
            <td>${deviceCanPerformHighRiskAction(session) ? "allowed" : "blocked"}</td>
            <td><button type="button" data-device-revoke="${escapeAttr(ctx, session.deviceId)}" ${revokeAllowed ? "" : "disabled"}>Revoke</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function panel(title, id, body) {
  return `
    <section id="${id}" class="governance-panel" data-pc-section="${id}">
      <h2>${title}</h2>
      ${body}
    </section>
  `;
}

function tableOrEmpty(rows, columns, ctx, emptyText) {
  const items = asArray(rows);
  if (!items.length) return `<p>${escapeHtml(ctx, emptyText)}</p>`;
  return `
    <table>
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(ctx, column)}</th>`).join("")}</tr></thead>
      <tbody>
        ${items.map((row) => `
          <tr>${columns.map((column) => `<td>${escapeHtml(ctx, displayValue(row, column))}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function metric(label, value, ctx) {
  return `<div class="governance-metric"><span>${escapeHtml(ctx, label)}</span><strong>${escapeHtml(ctx, value)}</strong></div>`;
}

function metricTable(title, values, ctx) {
  const rows = Object.entries(values || {}).map(([key, itemValue]) => ({
    metric: key,
    value: itemValue
  }));
  return `
    <section class="observability-domain">
      <h3>${escapeHtml(ctx, title)}</h3>
      ${tableOrEmpty(rows, ["metric", "value"], ctx, `No ${title} metrics loaded.`)}
    </section>
  `;
}

function workItems(ctx) {
  return asArray(ctx.state.runtimeStore?.workQueue || ctx.state.workQueue || ctx.state.pcGovernance?.workItems);
}

function riskItems(ctx) {
  const lenses = ctx.state.accommodationLenses || ctx.state.runtimeStore?.accommodationLenses || {};
  return asArray(ctx.state.pcGovernance?.riskItems || lenses["risk-command"] || ctx.state.runtimeStore?.riskCommand);
}

function blockersFromState(ctx) {
  return asArray(ctx.state.pcManager?.blockers || ctx.state.checkoutManager?.blockers || ctx.state.pcGovernance?.blockers);
}

function featureFlagsFromRelease(ctx) {
  return ctx.state.releaseControl?.selectedRelease?.featureFlags || [];
}

function sliceCutoversFromRelease(ctx) {
  return ctx.state.releaseControl?.selectedRelease?.sliceCutoverStates || [];
}

function releaseAuditFromState(ctx) {
  const release = ctx.state.releaseControl?.selectedRelease;
  if (!release) return [];
  return [
    release.gateResult && { auditEventId: release.gateResult.gateResultId, eventType: "GateResultGenerated", releaseId: release.overview?.releaseId, occurredAtUtc: release.gateResult.generatedAtUtc },
    release.rollbackInstruction && { auditEventId: release.rollbackInstruction.rollbackInstructionId, eventType: "RollbackInstructionWritten", releaseId: release.overview?.releaseId, occurredAtUtc: release.rollbackInstruction.createdAtUtc }
  ].filter(Boolean);
}

function productionMetrics(observability) {
  return observability?.productionMetrics || observability || {};
}

function displayValue(row, key) {
  if (!row) return "";
  const value = row[key] ?? row[toCamel(key)] ?? row[toSnake(key)];
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? "";
}

function value(input) {
  return input ?? 0;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toCamel(value) {
  return String(value).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toSnake(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(ctx, value) {
  return (ctx.escapeHtml || String)(String(value ?? ""));
}

function escapeAttr(ctx, value) {
  return (ctx.escapeAttr || ctx.escapeHtml || String)(String(value ?? ""));
}
