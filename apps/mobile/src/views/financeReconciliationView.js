export function financeReconciliationView(ctx) {
  const state = ctx.state.bankStatementImport || {};
  const preview = state.preview;
  const result = state.result;
  const importHistory = state.importHistory?.length ? state.importHistory : (result ? [result] : []);
  const bankTransactions = state.bankTransactions?.length ? state.bankTransactions : (result?.transactions || []);
  return ctx.shell(`
    <section class="finance-reconciliation" data-finance-reconciliation>
      <header>
        <span>PC 财务工作区</span>
        <h1>财务对账与修正工作区</h1>
        <p>只读取银行流水、FinanceCase、CorrectionWorkItem 和审计轨迹；所有修正仍必须通过 Operations Runtime。</p>
      </header>
      <section class="finance-import-panel">
        <h2>银行流水导入</h2>
        <div class="finance-import-grid">
          ${input("bankImportTenant", "租户", "tenant-1", ctx)}
          ${selectSource(ctx)}
          ${input("bankImportEvidenceId", "原始文件证据", "", ctx)}
        </div>
        <label for="bankCsvFile">CSV 文件</label>
        <input id="bankCsvFile" type="file" accept=".csv,text/csv" data-bank-csv-file>
        <label for="bankCsvContent">CSV 内容</label>
        <textarea id="bankCsvContent" data-bank-csv-content>${ctx.escapeHtml(sampleCsv())}</textarea>
        ${mappingControls(ctx)}
        <div class="finance-import-actions">
          <button type="button" id="bankPreviewImport" data-bank-preview>预览流水</button>
          <button type="button" id="bankConfirmImport" data-operations-confirm="true" data-bank-confirm>通过运行时确认导入</button>
        </div>
      </section>
      ${previewPanel(preview, ctx)}
      ${resultPanel(result, ctx)}
      ${importHistoryPanel(importHistory, ctx)}
      ${bankTransactionListPanel(bankTransactions, ctx)}
      ${candidatePanel(state.candidates, state.decision, result, ctx)}
      ${mismatchQueuePanel(state.mismatchCases, ctx)}
      ${reconciliationCaseTimelinePanel(state.mismatchCases, ctx)}
      ${correctionRequestPanel(state, ctx)}
      ${correctionApprovalPanel(state, ctx)}
      ${ledgerBeforeAfterPanel(state, ctx)}
      ${correctionAuditPanel(state, ctx)}
    </section>
  `);
}

function selectSource(ctx) {
  const values = ["manual_csv", "mbank_export", "bank_statement", "admin_upload", "other"];
  return `
    <label for="bankImportSourceType">来源类型</label>
    <select id="bankImportSourceType">
      ${values.map((value) => `<option value="${ctx.escapeAttr(value)}">${ctx.escapeHtml(value)}</option>`).join("")}
    </select>
  `;
}

function mappingControls(ctx) {
  const mappings = [
    ["bankMapOccurredAt", "occurredAt"],
    ["bankMapAmount", "amount"],
    ["bankMapCurrency", "currency"],
    ["bankMapDirection", "direction"],
    ["bankMapExternalRef", "externalRef"],
    ["bankMapDescription", "description"]
  ];
  return `
    <section class="column-mapping" data-column-mapping>
      <h3>字段映射配置</h3>
      ${mappings.map(([id, value]) => input(id, value, value, ctx)).join("")}
    </section>
  `;
}

function previewPanel(preview, ctx) {
  if (!preview) {
    return `<section class="finance-import-panel" data-preview-empty><h2>预览结果</h2><p>尚未预览导入内容。</p></section>`;
  }

  return `
    <section class="finance-import-panel" data-bank-preview-result>
      <h2>预览结果</h2>
      <p>row_count ${Number(preview.rowCount || 0)} · parsed_count ${Number(preview.parsedCount || 0)} · rejected_count ${Number(preview.rejectedCount || 0)}</p>
      <table>
        <thead><tr><th>row</th><th>externalRef</th><th>amount</th><th>direction</th><th>description</th><th>errors</th></tr></thead>
        <tbody>
          ${(preview.rows || []).map((row) => `
            <tr class="${row.valid ? "valid" : "invalid"}">
              <td>${Number(row.rowNumber || 0)}</td>
              <td>${ctx.escapeHtml(row.externalRef || "")}</td>
              <td>${ctx.escapeHtml(row.amount ?? "")} ${ctx.escapeHtml(row.currency || "")}</td>
              <td>${ctx.escapeHtml(row.direction || "")}</td>
              <td>${ctx.escapeHtml(row.description || "")}</td>
              <td>${ctx.escapeHtml((row.errors || []).join(", "))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function resultPanel(result, ctx) {
  if (!result) return "";
  return `
    <section class="finance-import-panel" data-bank-import-result>
      <h2>导入结果</h2>
      <dl><dt>import_id</dt><dd>${ctx.escapeHtml(result.importId || "")}</dd></dl>
      <dl><dt>status</dt><dd>${ctx.escapeHtml(result.status || "")}</dd></dl>
      <dl><dt>bank_transactions</dt><dd>${Number(result.transactions?.length || 0)}</dd></dl>
      <p>导入只创建银行流水导入记录和银行交易记录，不直接改变收款、押金或账务事实。</p>
      ${transactionActions(result.transactions || [], ctx)}
    </section>
  `;
}

function importHistoryPanel(importHistory, ctx) {
  return `
    <section class="finance-import-panel" data-import-history>
      <h2>导入历史</h2>
      ${importHistory.length ? `
        <table>
          <thead><tr><th>import</th><th>source</th><th>status</th><th>parsed</th><th>rejected</th></tr></thead>
          <tbody>
            ${importHistory.map((item) => `
              <tr>
                <td>${ctx.escapeHtml(item.importId || "")}</td>
                <td>${ctx.escapeHtml(item.sourceType || "")}</td>
                <td>${ctx.escapeHtml(item.status || "")}</td>
                <td>${Number(item.parsedCount || 0)}</td>
                <td>${Number(item.rejectedCount || 0)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<p>暂无导入历史。</p>`}
    </section>
  `;
}

function bankTransactionListPanel(transactions, ctx) {
  return `
    <section class="finance-import-panel" data-bank-transaction-list>
      <h2>银行交易列表</h2>
      ${transactions.length ? `
        <table>
          <thead><tr><th>bank transaction</th><th>externalRef</th><th>occurred</th><th>amount</th><th>direction</th><th>status</th><th>description</th></tr></thead>
          <tbody>
            ${transactions.map((transaction) => `
              <tr>
                <td>${ctx.escapeHtml(transaction.bankTransactionId || "")}</td>
                <td>${ctx.escapeHtml(transaction.externalRef || "")}</td>
                <td>${ctx.escapeHtml(transaction.occurredAtUtc || "")}</td>
                <td>${ctx.escapeHtml(transaction.amount ?? "")} ${ctx.escapeHtml(transaction.currency || "")}</td>
                <td>${ctx.escapeHtml(transaction.direction || "")}</td>
                <td>${ctx.escapeHtml(transaction.status || "")}</td>
                <td>${ctx.escapeHtml(transaction.description || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<p>暂无已导入银行交易。</p>`}
    </section>
  `;
}

function transactionActions(transactions, ctx) {
  if (!transactions.length) return "";
  return `
    <table class="bank-transaction-actions">
      <thead><tr><th>bank_transaction</th><th>externalRef</th><th>amount</th><th>actions</th></tr></thead>
      <tbody>
        ${transactions.map((transaction) => `
          <tr>
            <td>${ctx.escapeHtml(transaction.bankTransactionId || "")}</td>
            <td>${ctx.escapeHtml(transaction.externalRef || "")}</td>
            <td>${ctx.escapeHtml(transaction.amount ?? "")} ${ctx.escapeHtml(transaction.currency || "")}</td>
            <td>
              <button type="button" data-operations-confirm="true" data-bank-mismatch="${ctx.escapeAttr(transaction.bankTransactionId || "")}">标记异常</button>
              <button type="button" data-operations-confirm="true" data-bank-ignore="${ctx.escapeAttr(transaction.bankTransactionId || "")}">忽略交易</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function candidatePanel(candidates, decision, result, ctx) {
  const items = candidates?.candidates || candidates || [];
  return `
    <section class="finance-import-panel" data-match-candidates>
      <h2>收款匹配候选</h2>
      <label for="bankCandidateWindowDays">匹配时间窗口</label>
      <input id="bankCandidateWindowDays" type="number" min="1" max="30" value="3">
      <label for="bankPaymentThresholdDays">已确认收款阈值</label>
      <input id="bankPaymentThresholdDays" type="number" min="1" max="60" value="3">
      <label for="bankRefundThresholdDays">退款阈值</label>
      <input id="bankRefundThresholdDays" type="number" min="1" max="60" value="3">
      <button type="button" data-operations-confirm="true" data-bank-generate-candidates ${result ? "" : "disabled"}>生成候选</button>
      <button type="button" data-operations-confirm="true" data-bank-detect-mismatches ${result ? "" : "disabled"}>检测异常</button>
      <p data-operations-confirm-note>人工匹配只把银行证据绑定到既有事实，不改变已确认金额、押金留存或 StayBalance。</p>
      ${decision ? `<p class="match-decision">最近判断：${ctx.escapeHtml(decision.status || decision.reason || "")}</p>` : ""}
      ${items.length ? candidateTable(items, ctx) : `<p>暂无待处理候选。</p>`}
    </section>
  `;
}

function mismatchQueuePanel(mismatchCases, ctx) {
  const cases = mismatchCases?.cases || [];
  return `
    <section class="finance-import-panel" data-mismatch-queue>
      <h2>异常队列</h2>
      <p>异常会创建财务负责的 WorkItem，不直接修改收款、押金、退款或 StayBalance 事实。</p>
      ${cases.length ? `
        <table>
          <thead><tr><th>case</th><th>type</th><th>related</th><th>owner</th><th>severity</th><th>due</th><th>resolveActions</th></tr></thead>
          <tbody>
            ${cases.map((item) => `
              <tr>
                <td>${ctx.escapeHtml(item.caseId || item.reconciliationCaseId || "")}</td>
                <td>${ctx.escapeHtml(item.mismatchType || "")}</td>
                <td>${ctx.escapeHtml(item.bankTransactionId || item.relatedObjectId || "")}</td>
                <td>${ctx.escapeHtml(item.ownerRole || "finance")}</td>
                <td>${ctx.escapeHtml(item.blockerSeverity || "")}</td>
                <td>${ctx.escapeHtml(item.dueAtUtc || "")}</td>
                <td>${ctx.escapeHtml((item.resolveActions || []).join(", "))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<p>最近检测没有打开的异常案例。</p>`}
    </section>
  `;
}

function reconciliationCaseTimelinePanel(mismatchCases, ctx) {
  const cases = mismatchCases?.cases || [];
  return `
    <section class="finance-import-panel" data-reconciliation-cases data-reconciliation-case-timeline>
      <h2>对账案例时间线</h2>
      ${cases.length ? cases.map((item) => `
        <article class="timeline-row">
          <h3>${ctx.escapeHtml(item.caseId || item.reconciliationCaseId || "")}</h3>
          <ol>
            <li>PaymentMismatchDetected · ${ctx.escapeHtml(item.openedEventId || "")}</li>
            <li>Owner ${ctx.escapeHtml(item.ownerRole || "finance")} · due ${ctx.escapeHtml(item.dueAtUtc || "")}</li>
            <li>Resolve ${ctx.escapeHtml((item.resolveActions || []).join(", "))}</li>
          </ol>
        </article>
      `).join("") : `<p>当前队列没有对账案例。</p>`}
    </section>
  `;
}

function correctionRequestPanel(state, ctx) {
  const requests = state.correctionRequests || [];
  return `
    <section class="finance-import-panel" data-correction-center data-correction-request-list>
      <h2>修正请求列表</h2>
      <div class="finance-import-grid">
        ${input("correctionTenant", "tenant_id", state.request?.tenantId || "tenant-1", ctx)}
        ${input("correctionWorkItemId", "work_item_id", "pc-correction-request", ctx)}
        ${input("correctionCaseId", "case_id", "", ctx)}
        ${correctionSelect("correctionTargetLedgerType", "target_ledger_type", ["payment", "deposit", "charge", "cash", "refund"], "payment", ctx)}
        ${input("correctionTargetEntryId", "target_entry_id", "", ctx)}
        ${input("correctionTargetObjectType", "target_object_type", "payment", ctx)}
        ${input("correctionTargetObjectId", "target_object_id", "", ctx)}
        ${correctionSelect("correctionType", "correction_type", ["reversal", "amount_adjustment", "classification_adjustment", "evidence_correction", "allocation_reversal", "refund_correction", "charge_adjustment"], "allocation_reversal", ctx)}
        ${correctionSelect("correctionRiskLevel", "risk_level", ["low", "medium", "high", "critical"], "high", ctx)}
      </div>
      <label for="correctionReason">修正原因</label>
      <textarea id="correctionReason">manual reconciliation correction</textarea>
      <button type="button" data-operations-confirm="true" data-correction-request>创建修正 WorkItem</button>
      ${requests.length ? `
        <table>
          <thead><tr><th>request</th><th>ledger</th><th>target</th><th>type</th><th>risk</th><th>status</th><th>work item</th></tr></thead>
          <tbody>
            ${requests.map((request) => `
              <tr>
                <td>${ctx.escapeHtml(request.correctionRequestId || "")}</td>
                <td>${ctx.escapeHtml(request.targetLedgerType || "")}</td>
                <td>${ctx.escapeHtml(request.targetEntryId || "")}</td>
                <td>${ctx.escapeHtml(request.correctionType || "")}</td>
                <td>${ctx.escapeHtml(request.riskLevel || "")}</td>
                <td>${ctx.escapeHtml(request.status || "")}</td>
                <td>${ctx.escapeHtml(request.workItemIntent?.workItemId || request.workItemId || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<p>暂无修正请求。</p>`}
    </section>
  `;
}

function correctionApprovalPanel(state, ctx) {
  const selected = selectedCorrectionRequest(state);
  const highRisk = selected && ["high", "critical"].includes(String(selected.riskLevel || "").toLowerCase());
  const canApproveHighRisk = hasHighRiskCapability(ctx);
  const disabled = highRisk && !canApproveHighRisk ? "disabled" : "";
  return `
    <section class="finance-import-panel" data-correction-approval>
      <h2>修正审批</h2>
      <div class="finance-import-grid">
        ${input("correctionRequestId", "correction_request_id", state.selectedCorrectionRequestId || selected?.correctionRequestId || "", ctx)}
        ${input("correctionDecisionTenant", "tenant_id", state.request?.tenantId || selected?.tenantId || "tenant-1", ctx)}
        ${input("correctionApproverId", "approver_id", ctx.state.currentActor?.userId || "runtime", ctx)}
        ${input("correctionApplyActorId", "apply_actor_id", ctx.state.currentActor?.userId || "runtime", ctx)}
        ${input("correctionApplyWorkItemId", "apply_work_item_id", "pc-correction-apply", ctx)}
        ${input("correctionAdjustmentAmount", "adjustment_amount", "", ctx)}
      </div>
      <label for="correctionApprovalNote">审批说明</label>
      <textarea id="correctionApprovalNote">approved from PC Correction Center</textarea>
      <label for="correctionApplyReason">应用原因</label>
      <textarea id="correctionApplyReason">append-only correction applied</textarea>
      ${highRisk ? `<p data-capability-required="finance.correction.approve.highRisk">高风险修正需要财务或管理员权限。</p>` : ""}
      <div class="finance-import-actions">
        <button type="button" data-operations-confirm="true" data-correction-approve ${disabled}>批准修正</button>
        <button type="button" data-operations-confirm="true" data-correction-reject>驳回修正</button>
        <button type="button" data-operations-confirm="true" data-correction-apply ${disabled}>追加补偿</button>
      </div>
      ${state.correctionDecision ? `<p class="match-decision">最近修正判断：${ctx.escapeHtml(state.correctionDecision.status || "")}</p>` : ""}
    </section>
  `;
}

function ledgerBeforeAfterPanel(state, ctx) {
  const entries = state.ledgerCorrectionEntries || state.correctionEntries || [];
  return `
    <section class="finance-import-panel" data-ledger-before-after>
      <h2>账务前后视图</h2>
      ${entries.length ? entries.map((entry) => `
        <article class="ledger-snapshot-row">
          <h3>${ctx.escapeHtml(entry.correctionEntryId || entry.correctionRequestId || "")}</h3>
          <div class="snapshot-grid">
            <pre>${ctx.escapeHtml(formatJson(entry.beforeSnapshot))}</pre>
            <pre>${ctx.escapeHtml(formatJson(entry.afterSnapshot))}</pre>
          </div>
        </article>
      `).join("") : `<p>暂无修正前后快照。</p>`}
    </section>
  `;
}

function correctionAuditPanel(state, ctx) {
  const audit = state.correctionAudit?.length ? state.correctionAudit : (state.operationAudit || []);
  return `
    <section class="finance-import-panel" data-correction-audit data-gate-result-audit>
      <h2>修正审计</h2>
      ${audit.length ? `
        <table>
          <thead><tr><th>operation</th><th>status</th><th>GateResult / Audit</th><th>recorded</th></tr></thead>
          <tbody>
            ${audit.map((entry) => `
              <tr>
                <td>${ctx.escapeHtml(entry.operationName || entry.action || "")}</td>
                <td>${ctx.escapeHtml(entry.status || "")}</td>
                <td>${ctx.escapeHtml(entry.gateResultRef || entry.auditRef || entry.eventId || "")}</td>
                <td>${ctx.escapeHtml(entry.recordedAtUtc || entry.occurredAtUtc || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<p>暂无修正审计记录。</p>`}
    </section>
  `;
}

function candidateTable(items, ctx) {
  return `
    <table>
      <thead><tr><th>candidate</th><th>type</th><th>target</th><th>bank transaction</th><th>amount</th><th>score</th><th>reason</th><th>actions</th></tr></thead>
      <tbody>
        ${items.map((candidate) => `
          <tr>
            <td>${ctx.escapeHtml(candidate.candidateId || "")}</td>
            <td>${ctx.escapeHtml(candidate.candidateType || "")}</td>
            <td>${ctx.escapeHtml(candidate.paymentId || candidate.depositId || candidate.refundPaymentId || "")}</td>
            <td>${ctx.escapeHtml(candidate.externalRef || candidate.bankTransactionId || "")}</td>
            <td>${ctx.escapeHtml(candidate.amount ?? "")} ${ctx.escapeHtml(candidate.currency || "")}</td>
            <td>${ctx.escapeHtml(candidate.score ?? "")}</td>
            <td>${ctx.escapeHtml(candidate.reason || "")}</td>
            <td>
              <button type="button" data-operations-confirm="true" data-candidate-accept="${ctx.escapeAttr(candidate.candidateId || "")}">接受候选</button>
              <button type="button" data-operations-confirm="true" data-candidate-reject="${ctx.escapeAttr(candidate.candidateId || "")}">驳回候选</button>
              <button type="button" data-operations-confirm="true" data-bank-mismatch="${ctx.escapeAttr(candidate.bankTransactionId || "")}">异常</button>
              <button type="button" data-operations-confirm="true" data-bank-ignore="${ctx.escapeAttr(candidate.bankTransactionId || "")}">忽略</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function input(id, label, value, ctx) {
  return `
    <label for="${ctx.escapeAttr(id)}">${ctx.escapeHtml(label)}</label>
    <input id="${ctx.escapeAttr(id)}" value="${ctx.escapeAttr(value)}">
  `;
}

function correctionSelect(id, label, values, selected, ctx) {
  return `
    <label for="${ctx.escapeAttr(id)}">${ctx.escapeHtml(label)}</label>
    <select id="${ctx.escapeAttr(id)}">
      ${values.map((value) => `<option value="${ctx.escapeAttr(value)}" ${value === selected ? "selected" : ""}>${ctx.escapeHtml(value)}</option>`).join("")}
    </select>
  `;
}

function selectedCorrectionRequest(state) {
  const selectedId = state.selectedCorrectionRequestId;
  return (state.correctionRequests || []).find((item) => item.correctionRequestId === selectedId) || state.correctionRequests?.[0] || null;
}

function hasHighRiskCapability(ctx) {
  const role = String(ctx.state.currentActor?.role || "").toLowerCase();
  return ["finance", "admin", "manager", "release"].includes(role);
}

function formatJson(value) {
  if (!value) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function sampleCsv() {
  return `occurredAt,amount,currency,direction,externalRef,description
2026-05-01T10:00:00Z,1200,KGS,credit,MB-001,Rent payment`;
}
