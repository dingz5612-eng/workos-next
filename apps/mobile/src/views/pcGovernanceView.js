import {
  canEditRoleCapability,
  canRevokeDevice,
  deviceCanPerformHighRiskAction,
  governanceExportDefinitions,
  pcGovernanceNavItems,
  validateGovernanceExportRequest
} from "../pcGovernancePolicies.js";
import {
  accountCapabilityOptions,
  accountRoleOptions,
  capabilitiesForAccountRole
} from "../accountGovernanceCatalog.js";

export function pcGovernanceView(ctx) {
  const governance = ctx.state.pcGovernance || {};
  const release = ctx.state.releaseControl?.selectedRelease || {};
  return ctx.shell(`
    <section class="pc-governance-full" data-pc-governance-full>
      <header class="governance-hero">
        <span>PC 治理控制平面</span>
        <h1>治理中心</h1>
        <p>只读汇总 WorkItem、事实、证据、发布门禁、风险、审计和受控导出；业务事实仍必须由 Operations Runtime 写入。</p>
      </header>
      ${navigation(ctx)}
      <section class="governance-grid">
        ${dashboardPanel(governance, release, ctx)}
        ${productionObservabilityPanel(governance.productionObservability, ctx)}
        ${lensHealthPanel(ctx)}
        ${workManagementPanel(ctx)}
        ${objectsPanel(ctx)}
        ${casesPanel(ctx)}
        ${ledgersPanel(governance, ctx)}
        ${evidenceReviewPanel(governance, ctx)}
        ${reconciliationPanel(ctx)}
        ${correctionCenterPanel(ctx)}
        ${periodReviewPanel(governance, ctx)}
        ${riskCommandPanel(ctx)}
        ${accountUsersPanel(governance, ctx)}
        ${adminPanel(governance, ctx)}
        ${auditPanel(governance, ctx)}
        ${exportPanel(governance, ctx)}
        ${releaseControlPanel(release, ctx)}
      </section>
    </section>
  `);
}

export function managerControlTowerView(ctx) {
  const risks = riskItems(ctx);
  const blockers = blockersFromState(ctx);
  const workQueue = workItems(ctx);
  const financeCases = asArray(ctx.state.bankStatementImport?.mismatchCases?.cases || ctx.state.bankStatementImport?.mismatchCases);
  return ctx.shell(`
    <section class="pc-governance-full manager-control-tower" data-pc-manager-control-tower>
      <header class="governance-hero">
        <span>经理控制塔</span>
        <h1>经理控制塔</h1>
        <p data-boundary-rule="does not write business facts">经理首屏只读取并路由风险、超时、证据、财务和同步异常，不写入业务事实；治理导出与发布控制留在 PC Governance / Release plane。</p>
      </header>
      <section class="governance-grid">
        ${panel("Risk overview", "manager-risk-overview", tableOrEmpty(risks, ["riskId", "riskType", "severity", "ownerRole", "resolveAction"], ctx, "No source-backed risk items loaded."))}
        ${panel("SLA and blockers", "manager-sla-blockers", tableOrEmpty(blockers, ["caseId", "status", "ownerRole", "resolveAction"], ctx, "No blockers loaded."))}
        ${panel("WorkItem follow-up", "manager-workitems", tableOrEmpty(workQueue, ["workItemId", "title", "status", "assignedRole", "dueAtUtc"], ctx, "No WorkItems visible."))}
        ${panel("Finance exception focus", "manager-finance", tableOrEmpty(financeCases, ["caseId", "mismatchType", "ownerRole", "blockerSeverity"], ctx, "No finance exception cases loaded."))}
      </section>
    </section>
  `);
}

function navigation(ctx) {
  return `
    <nav class="pc-governance-nav" data-pc-governance-nav aria-label="PC Governance navigation">
      ${pcGovernanceNavItems.map((label) => `
        <a href="#${slug(label)}" data-governance-nav="${escapeAttr(ctx, label)}">${escapeHtml(ctx, panelTitle(label))}</a>
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
    <p data-governance-source-note data-boundary-rule="does not write business facts">本页只读取 Lens、事件、发布控制数据和 WorkItem，不写入业务事实。</p>
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

function lensHealthPanel(ctx) {
  return panel("Lens Health", "lens-health", tableOrEmpty(
    lensHealthRows(ctx),
    ["lens", "sourceNamespace", "projectionLagSeconds", "lastEventId", "degradedReason"],
    ctx,
    "No Lens metadata loaded."));
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
    <h3>证据访问审计</h3>
    ${tableOrEmpty(audits, ["auditEventId", "eventType", "actorId", "deviceId", "occurredAtUtc"], ctx, "No evidence access audit records loaded.")}
  `);
}

function reconciliationPanel(ctx) {
  const state = ctx.state.bankStatementImport || {};
  const candidates = asArray(state.candidates?.candidates || state.candidates);
  const mismatches = asArray(state.mismatchCases?.cases || state.mismatchCases);
  return panel("Reconciliation", "reconciliation", `
    ${tableOrEmpty(candidates, ["candidateId", "candidateType", "paymentId", "score", "reason"], ctx, "No match candidates loaded.")}
    <h3>差异队列</h3>
    ${tableOrEmpty(mismatches, ["caseId", "mismatchType", "ownerRole", "blockerSeverity"], ctx, "No reconciliation mismatches loaded.")}
  `);
}

function correctionCenterPanel(ctx) {
  const state = ctx.state.bankStatementImport || {};
  return panel("Correction Center", "correction-center", `
    ${tableOrEmpty(asArray(state.correctionRequests), ["correctionRequestId", "targetLedgerType", "correctionType", "riskLevel", "status"], ctx, "No correction requests loaded.")}
    <h3>修正审计</h3>
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

function accountUsersPanel(governance, ctx) {
  const canManage = canManageAccountUsers(ctx.state);
  const users = asArray(governance.accountUsers);
  const audits = asArray(governance.accountAudit);
  const defaultCapabilities = new Set(capabilitiesForAccountRole("operator"));
  return panel("Account Users", "account-users", `
    <section data-account-user-management>
      <h3>用户与权限管理</h3>
      <p data-capability-required="account.user.manage">账号由管理员或主管创建；部门、业务线、角色和能力只能在这里分配。</p>
      <div class="account-user-form">
        ${accountTextField("accountUsername", "用户名", "", canManage, "off")}
        ${accountTextField("accountDisplayName", "昵称", "", canManage, "off")}
        ${accountTextField("accountPassword", "初始密码", "", canManage, "new-password", "password")}
        ${accountTextField("accountDepartment", "部门", "住宿运营部", canManage)}
        ${accountTextField("accountBusinessLine", "业务线", "stay", canManage)}
        <div class="account-form-field">
          <label for="accountRoles">角色</label>
          <select id="accountRoles" data-account-role-select ${canManage ? "" : "disabled"}>
            ${accountRoleOptions.map((option) => `
              <option value="${escapeAttr(ctx, option.value)}" ${option.value === "operator" ? "selected" : ""}>${escapeHtml(ctx, option.label)}</option>
            `).join("")}
          </select>
        </div>
        <fieldset class="account-capability-fieldset">
          <legend>能力</legend>
          <div class="account-capability-grid" data-account-capabilities>
            ${accountCapabilityOptions.map((option) => `
              <label class="account-capability-choice">
                <input type="checkbox" data-account-capability value="${escapeAttr(ctx, option.value)}" ${defaultCapabilities.has(option.value) ? "checked" : ""} ${canManage ? "" : "disabled"}>
                <span>${escapeHtml(ctx, option.label)}</span>
                <small>${escapeHtml(ctx, option.value)}</small>
              </label>
            `).join("")}
          </div>
        </fieldset>
        <button type="button" data-account-user-create ${canManage ? "" : "disabled"}>创建用户</button>
      </div>
      ${accountUserTable(users, canManage, ctx)}
      <h3>账号审计</h3>
      ${tableOrEmpty(audits, ["auditEventId", "eventType", "actorId", "targetUserId", "occurredAtUtc"], ctx, "No account audit records loaded.")}
    </section>
  `);
}

function accountTextField(id, label, defaultValue, canManage, autocomplete = "", type = "text") {
  return `
    <div class="account-form-field">
      <label for="${id}">${label}</label>
      <input id="${id}" type="${type}" value="${defaultValue}" ${autocomplete ? `autocomplete="${autocomplete}"` : ""} ${canManage ? "" : "disabled"}>
    </div>
  `;
}

function adminPanel(governance, ctx) {
  const roleEditAllowed = canEditRoleCapability(ctx.state);
  const deviceRevokeAllowed = canRevokeDevice(ctx.state);
  return panel("Admin", "admin", `
    <section data-role-capability-admin>
      <h3>RoleCapability 查看 / 编辑</h3>
      <p data-capability-required="admin.role_capability.edit">编辑需要 admin.role_capability.edit 权限。</p>
      ${tableOrEmpty(asArray(governance.roleCapabilities), ["role", "capability", "effect", "source"], ctx, "No RoleCapability rules loaded.")}
      <button type="button" data-role-capability-edit ${roleEditAllowed ? "" : "disabled"}>编辑 RoleCapability</button>
    </section>
    <section>
      <h3>FeatureFlag 查看</h3>
      ${tableOrEmpty(asArray(governance.featureFlags || featureFlagsFromRelease(ctx)), ["flagKey", "status", "scope"], ctx, "No FeatureFlags loaded.")}
    </section>
    <section>
      <h3>SliceCutoverState 查看</h3>
      ${tableOrEmpty(asArray(governance.sliceCutoverStates || sliceCutoversFromRelease(ctx)), ["sliceId", "runtimeMode", "tenantId", "dependencyStatus"], ctx, "No SliceCutoverState loaded.")}
    </section>
    <section>
      <h3>DefinitionVersion 查看</h3>
      ${tableOrEmpty(asArray(governance.definitionVersions), ["definitionVersion", "contractHash", "status", "activatedAtUtc"], ctx, "No DefinitionVersion records loaded.")}
    </section>
    <section>
      <h3>DeviceSession 查看 / 撤销</h3>
      ${deviceSessionTable(governance, deviceRevokeAllowed, ctx)}
    </section>
    <section>
      <h3>证据访问审计</h3>
      ${tableOrEmpty(asArray(governance.evidenceAccessAudits), ["auditEventId", "eventType", "actorId", "deviceId", "occurredAtUtc"], ctx, "No evidence access audit records loaded.")}
    </section>
  `);
}

function accountUserTable(users, canManage, ctx) {
  if (!users.length) return `<p>${escapeHtml(ctx, governanceText("No account users loaded."))}</p>`;
  return `
    <table>
      <thead><tr>
        <th>用户名</th><th>昵称</th><th>部门</th><th>业务线</th><th>角色</th><th>能力</th><th>状态</th><th>操作</th>
      </tr></thead>
      <tbody>
        ${users.map((user) => `
          <tr>
            <td>${escapeHtml(ctx, user.username)}</td>
            <td>${escapeHtml(ctx, user.displayName)}</td>
            <td>${escapeHtml(ctx, user.department)}</td>
            <td>${escapeHtml(ctx, user.businessLine)}</td>
            <td>${escapeHtml(ctx, asArray(user.roles).join(", ") || user.role)}</td>
            <td>${escapeHtml(ctx, asArray(user.capabilities).slice(0, 6).join(", "))}</td>
            <td>${escapeHtml(ctx, user.status || (user.enabled ? "active" : "disabled"))}</td>
            <td>
              <input type="password" data-account-reset-password="${escapeAttr(ctx, user.userId)}" placeholder="新密码" ${canManage ? "" : "disabled"}>
              <button type="button" data-account-password-reset="${escapeAttr(ctx, user.userId)}" ${canManage ? "" : "disabled"}>重置</button>
              <button type="button" data-account-user-disable="${escapeAttr(ctx, user.userId)}" ${(canManage && user.status !== "disabled") ? "" : "disabled"}>禁用</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function auditPanel(governance, ctx) {
  const domainEvents = asArray(governance.domainEvents || ctx.state.projectionEvents || ctx.state.runtimeStore?.events);
  const commandSubmissions = asArray(governance.commandSubmissions || ctx.state.runtimeStore?.commandSubmissions);
  const releaseAudit = asArray(governance.releaseControlAudits || releaseAuditFromState(ctx));
  const correctionAudit = asArray(governance.correctionAudit || ctx.state.bankStatementImport?.correctionAudit || ctx.state.bankStatementImport?.operationAudit);
  return panel("Audit", "audit", `
    <label for="domainEventSearch">DomainEvent 搜索</label>
    <input id="domainEventSearch" data-domain-event-search placeholder="事件类型 / 聚合对象 / 操作人">
    ${tableOrEmpty(domainEvents, ["eventId", "eventType", "actorId", "occurredAtUtc"], ctx, "No DomainEvents loaded.")}
    <label for="commandSubmissionSearch">CommandSubmission 搜索</label>
    <input id="commandSubmissionSearch" data-command-submission-search placeholder="提交编号 / 幂等键">
    ${tableOrEmpty(commandSubmissions, ["submissionId", "workItemId", "status", "idempotencyKey"], ctx, "No CommandSubmissions loaded.")}
    <h3>发布控制审计</h3>
    ${tableOrEmpty(releaseAudit, ["auditEventId", "eventType", "releaseId", "occurredAtUtc"], ctx, "No release control audit loaded.")}
    <h3>修正审计</h3>
    ${tableOrEmpty(correctionAudit, ["auditEventId", "operationName", "status", "recordedAtUtc"], ctx, "No correction audit loaded.")}
  `);
}

function exportPanel(governance, ctx) {
  const device = governance.currentDevice || asArray(governance.deviceSessions)[0] || { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" };
  const exports = governanceExportDefinitions.map((definition) => exportControl(definition, device, ctx)).join("");
  const audits = asArray(governance.exportAudits || governance.exports);
  return panel("Export", "export", `
    <p data-export-rules>导出必须具备权限、填写原因、生成审计记录；高风险导出还要求可信 PC 设备，下载链接会自动过期。</p>
    <div class="export-control-grid">${exports}</div>
    <h3>导出审计</h3>
    ${tableOrEmpty(audits, ["auditEventId", "eventType", "exportType", "status", "reason", "expiresAtUtc"], ctx, "No export audit records loaded.")}
  `);
}

function releaseControlPanel(release, ctx) {
  const overview = release.overview || release.manifest || {};
  const chain = releaseChainRows(release, overview);
  return panel("Release Control Center", "release-control-center", `
    <dl class="governance-kv"><dt>MR ID</dt><dd>${escapeHtml(ctx, overview.mrId || overview.mr_id || "MR")}</dd></dl>
    <dl class="governance-kv"><dt>GateResult 状态</dt><dd>${escapeHtml(ctx, release.gateResult?.status || overview.gateResultStatus || "not_run")}</dd></dl>
    <dl class="governance-kv"><dt>Shadow 等级</dt><dd>${escapeHtml(ctx, overview.shadowGrade || release.shadowReports?.[0]?.grade || "unknown")}</dd></dl>
    <h3>发布证据链</h3>
    ${tableOrEmpty(chain, ["chainStep", "recordId", "status", "severity", "refs"], ctx, "No release evidence chain loaded.")}
    <button type="button" data-view="releaseControl">打开发布工作区</button>
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
      <p>所需权限 ${escapeHtml(ctx, definition.capability)}${definition.highRisk ? " · 高风险导出仅允许可信 PC 设备" : ""}</p>
      <label for="exportReason-${escapeAttr(ctx, definition.key)}">导出原因</label>
      <textarea id="exportReason-${escapeAttr(ctx, definition.key)}" data-export-reason="${escapeAttr(ctx, definition.key)}" required></textarea>
      <button type="button" data-governance-export="${escapeAttr(ctx, definition.key)}" ${blocked ? "disabled" : ""}>申请审计导出</button>
      <small>下载链接 15 分钟后过期；未填写原因会被阻断：${escapeHtml(ctx, validation.errors.join(", ") || "填写后可继续")}</small>
    </article>
  `;
}

function deviceSessionTable(governance, revokeAllowed, ctx) {
  const sessions = asArray(governance.deviceSessions);
  if (!sessions.length) return `<p>${escapeHtml(ctx, governanceText("No DeviceSession records loaded."))}</p>`;
  return `
    <table>
      <thead><tr><th>设备</th><th>账号</th><th>可信状态</th><th>端</th><th>高风险动作</th><th>操作</th></tr></thead>
      <tbody>
        ${sessions.map((session) => `
          <tr>
            <td>${escapeHtml(ctx, session.deviceId)}</td>
            <td>${escapeHtml(ctx, session.actorId)}</td>
            <td>${escapeHtml(ctx, session.deviceTrustStatus || session.trustStatus)}</td>
            <td>${escapeHtml(ctx, session.surface || session.deviceType || "pc")}</td>
            <td>${deviceCanPerformHighRiskAction(session) ? "允许" : "阻断"}</td>
            <td><button type="button" data-device-revoke="${escapeAttr(ctx, session.deviceId)}" ${revokeAllowed ? "" : "disabled"}>撤销</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function panel(title, id, body) {
  return `
    <section id="${id}" class="governance-panel" data-pc-section="${id}">
      <h2>${panelTitle(title)}</h2>
      ${body}
    </section>
  `;
}

function panelTitle(title) {
  const titles = {
    Dashboard: "总览",
    "Production Observability": "生产观测",
    "Lens Health": "Lens 健康",
    "Work Management": "办理管理",
    Objects: "对象视图",
    Cases: "案例与阻断",
    Ledgers: "账务摘要",
    "Evidence Review": "证据复核",
    Reconciliation: "对账",
    "Correction Center": "修正中心",
    "Period Review": "周期复盘",
    RiskCommand: "风险作战室",
    "Account Users": "用户与权限",
    Admin: "治理配置",
    Audit: "审计",
    Export: "受控导出",
    "Release Control Center": "发布工作区",
    "Risk overview": "风险总览",
    "SLA and blockers": "SLA 与阻断",
    "WorkItem follow-up": "办理项跟进",
    "Finance exception focus": "财务异常焦点"
  };
  return titles[title] || title;
}

function tableOrEmpty(rows, columns, ctx, emptyText) {
  const items = asArray(rows);
  if (!items.length) return `<p>${escapeHtml(ctx, governanceText(emptyText))}</p>`;
  return `
    <table>
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(ctx, governanceText(column))}</th>`).join("")}</tr></thead>
      <tbody>
        ${items.map((row) => `
          <tr>${columns.map((column) => `<td>${escapeHtml(ctx, displayValue(row, column))}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function metric(label, value, ctx) {
  return `<div class="governance-metric"><span>${escapeHtml(ctx, governanceText(label))}</span><strong>${escapeHtml(ctx, value)}</strong></div>`;
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

function governanceText(value) {
  const text = String(value || "");
  const labels = {
    "Open WorkItems": "打开的办理项",
    "RiskCommand items": "风险项",
    "Open blockers": "打开的阻断",
    "GateResult": "GateResult",
    "confirm latency p95": "确认延迟 p95",
    "confirm failure count": "确认失败数",
    "403 / 409 / 422 count": "403 / 409 / 422 次数",
    "outbox lag": "Outbox 延迟",
    "dead-letter count": "死信数量",
    "projection lag": "Projection 延迟",
    "WorkItemBundle p95": "WorkItemBundle p95",
    "GateResult status": "GateResult 状态",
    "No Lens metadata loaded.": "没有 Lens 元数据。",
    "No WorkItems visible.": "没有可见办理项。",
    "No object lenses loaded.": "没有对象 Lens。",
    "No cases or blockers loaded.": "没有案例或阻断。",
    "No ledger summaries loaded.": "没有账务摘要。",
    "No evidence review items loaded.": "没有证据复核项。",
    "No evidence access audit records loaded.": "没有证据访问审计记录。",
    "No match candidates loaded.": "没有对账候选项。",
    "No reconciliation mismatches loaded.": "没有对账差异。",
    "No correction requests loaded.": "没有修正请求。",
    "No correction audit records loaded.": "没有修正审计记录。",
    "No period reviews loaded.": "没有周期复盘记录。",
    "No source-backed risk items loaded.": "没有来源支撑的风险项。",
    "No account users loaded.": "没有用户记录。",
    "No account audit records loaded.": "没有账号审计记录。",
    "No RoleCapability rules loaded.": "没有 RoleCapability 规则。",
    "No FeatureFlags loaded.": "没有 FeatureFlag。",
    "No SliceCutoverState loaded.": "没有 SliceCutoverState。",
    "No DefinitionVersion records loaded.": "没有 DefinitionVersion 记录。",
    "No DeviceSession records loaded.": "没有 DeviceSession 记录。",
    "No DomainEvents loaded.": "没有 DomainEvent。",
    "No CommandSubmissions loaded.": "没有 CommandSubmission。",
    "No release control audit loaded.": "没有发布控制审计。",
    "No correction audit loaded.": "没有修正审计。",
    "No export audit records loaded.": "没有导出审计记录。",
    "No release evidence chain loaded.": "没有发布证据链。",
    metric: "指标",
    value: "值",
    lens: "Lens",
    sourceNamespace: "来源命名空间",
    projectionLagSeconds: "投影延迟秒数",
    lastEventId: "最后事件",
    degradedReason: "降级原因",
    workItemId: "办理项",
    title: "标题",
    status: "状态",
    assignedRole: "负责人角色",
    dueAtUtc: "到期时间",
    objectType: "对象类型",
    objectId: "对象编号",
    summary: "摘要",
    caseId: "案件编号",
    ownerRole: "责任角色",
    resolveAction: "处理动作",
    ledger: "账本",
    refs: "引用",
    amount: "金额",
    evidenceId: "证据编号",
    contentSha256: "内容哈希",
    tenantId: "租户",
    auditEventId: "审计事件",
    eventType: "事件类型",
    actorId: "操作人",
    deviceId: "设备",
    occurredAtUtc: "发生时间",
    candidateId: "候选项",
    candidateType: "候选类型",
    paymentId: "付款编号",
    score: "分数",
    reason: "原因",
    mismatchType: "差异类型",
    blockerSeverity: "阻断等级",
    correctionRequestId: "修正请求",
    targetLedgerType: "目标账本",
    correctionType: "修正类型",
    riskLevel: "风险等级",
    operationName: "操作名称",
    recordedAtUtc: "记录时间",
    periodReviewId: "周期复盘",
    periodKey: "周期",
    sourceHighWatermark: "来源水位",
    riskId: "风险编号",
    riskType: "风险类型",
    severity: "等级",
    drilldownUrl: "详情入口",
    role: "角色",
    targetUserId: "目标用户",
    capability: "权限",
    effect: "结果",
    source: "来源",
    flagKey: "特性开关",
    scope: "范围",
    sliceId: "Slice",
    runtimeMode: "运行模式",
    dependencyStatus: "依赖状态",
    definitionVersion: "Definition 版本",
    contractHash: "合约哈希",
    activatedAtUtc: "启用时间",
    eventId: "事件编号",
    submissionId: "提交编号",
    idempotencyKey: "幂等键",
    releaseId: "发布编号",
    exportType: "导出类型",
    expiresAtUtc: "过期时间",
    chainStep: "链路步骤",
    recordId: "记录编号",
    confirmLatencyP95Ms: "确认延迟 p95",
    confirmLatencySampleCount: "确认延迟样本数",
    confirmFailureCount: "确认失败数",
    idempotencyConflictCount: "幂等冲突数",
    forbiddenCount403: "403 次数",
    conflictCount409: "409 次数",
    validationCount422: "422 次数",
    handlerFailureCount: "处理器失败数",
    outboxLagSeconds: "Outbox 延迟秒数",
    deadLetterCount: "死信数量",
    replayCount: "重放次数",
    rebuildCount: "重建次数",
    staleLensCount: "陈旧 Lens 数",
    workItemBundleP95Ms: "WorkItemBundle p95",
    workItemBundleSampleCount: "WorkItemBundle 样本数",
    uploadFailureCount: "上传失败数",
    submitRetryCount: "提交重试数",
    draftRecoveryCount: "草稿找回数",
    paymentConfirmWithoutEvidenceViolations: "缺证据确认付款违规",
    allocationOverAvailableViolations: "超可用金额分配违规",
    stayBalanceMismatchCount: "住宿余额不一致数",
    availableRefundNegativeCount: "可退金额为负次数",
    refundFailedDoubleCount: "退款重复失败数",
    heldAmountNegativeCount: "冻结金额为负次数",
    openBlockers: "打开的阻断",
    duplicateBlockers: "重复阻断",
    fakeCloseAttempts: "虚假关闭尝试",
    gateResultStatus: "GateResult 状态",
    redShadowReports: "红色 Shadow 报告数",
    blockingInvariantFailures: "阻断不变量失败数",
    releaseState: "发布状态"
  };
  if (labels[text]) return labels[text];
  const metrics = /^No (.+) metrics loaded\.$/.exec(text);
  if (metrics) return `没有 ${metrics[1]} 指标。`;
  return text;
}

function lensHealthRows(ctx) {
  const lenses = ctx.state.accommodationLenses || ctx.state.runtimeStore?.accommodationLenses || {};
  return Object.entries(lenses).flatMap(([lensId, value]) =>
    asArray(value).map((item) => ({
      lens: item.lens || lensId,
      sourceNamespace: item.sourceNamespace || "unknown",
      projectionLagSeconds: item.projectionLagSeconds ?? "",
      lastEventId: item.lastEventId || "",
      degradedReason: item.degradedReason || "none"
    })));
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

function releaseChainRows(release, overview) {
  const gate = release.gateResult;
  const invariants = asArray(release.invariantChecks);
  const shadowReports = asArray(release.shadowReports);
  const rollback = release.rollbackInstruction;
  return [
    gate && {
      chainStep: "GateResult",
      recordId: gate.gateResultId || overview.gateResultId,
      status: gate.status || overview.gateResultStatus,
      severity: gate.severity || "",
      refs: [...asArray(gate.invariantCheckRefs), ...asArray(gate.shadowCompareReportRefs), ...asArray(gate.businessSignoffRefs)].join(", ")
    },
    ...invariants.map((item) => ({
      chainStep: "Invariant",
      recordId: item.invariantCheckId || item.invariantKey,
      status: item.status,
      severity: item.severity || item.mode,
      refs: item.checkRef || item.ciRunId || ""
    })),
    ...shadowReports.map((item) => ({
      chainStep: "ShadowCompare",
      recordId: item.shadowCompareReportId,
      status: item.grade,
      severity: item.mismatchCount ?? "",
      refs: item.ciRunId || ""
    })),
    rollback && {
      chainStep: "RollbackInstruction",
      recordId: rollback.rollbackInstructionId,
      status: rollback.instructionType || rollback.rollbackKind || "available",
      severity: rollback.riskLevel || "",
      refs: [...asArray(rollback.steps), ...asArray(rollback.validationSteps)].join(", ")
    }
  ].filter(Boolean);
}

function canManageAccountUsers(state = {}) {
  const actor = state.currentActor || {};
  const capabilities = new Set([...(actor.capabilities || []), ...(actor.capabilityIds || [])].map((item) => String(item).toLowerCase()));
  return String(actor.role || "").toLowerCase() === "admin" ||
    capabilities.has("account.user.manage") ||
    capabilities.has("pc.governance.admin");
}

function productionMetrics(observability) {
  return observability?.productionMetrics || observability || {};
}

function displayValue(row, key) {
  if (!row) return "";
  const value = row[key] ?? row[toCamel(key)] ?? row[toSnake(key)];
  if (key === "metric") return governanceText(value);
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
