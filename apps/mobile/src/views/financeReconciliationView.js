export function financeReconciliationView(ctx) {
  const state = ctx.state.bankStatementImport || {};
  const preview = state.preview;
  const result = state.result;
  const importHistory = state.importHistory?.length ? state.importHistory : (result ? [result] : []);
  const bankTransactions = state.bankTransactions?.length ? state.bankTransactions : (result?.transactions || []);
  return ctx.shell(`
    <section class="finance-reconciliation" data-finance-reconciliation>
      <header>
        <span>PC Finance</span>
        <h1>Reconciliation + Correction Center</h1>
      </header>
      <section class="finance-import-panel">
        <h2>Bank Statement Import</h2>
        <div class="finance-import-grid">
          ${input("bankImportTenant", "tenant_id", "tenant-1", ctx)}
          ${selectSource(ctx)}
          ${input("bankImportEvidenceId", "original_file_id", "", ctx)}
        </div>
        <label for="bankCsvFile">CSV / file</label>
        <input id="bankCsvFile" type="file" accept=".csv,text/csv" data-bank-csv-file>
        <label for="bankCsvContent">CSV content</label>
        <textarea id="bankCsvContent" data-bank-csv-content>${ctx.escapeHtml(sampleCsv())}</textarea>
        ${mappingControls(ctx)}
        <div class="finance-import-actions">
          <button type="button" id="bankPreviewImport" data-bank-preview>Preview rows</button>
          <button type="button" id="bankConfirmImport" data-operations-confirm="true" data-bank-confirm>Confirm import</button>
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
    <label for="bankImportSourceType">source_type</label>
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
      <h3>Column mapping config</h3>
      ${mappings.map(([id, value]) => input(id, value, value, ctx)).join("")}
    </section>
  `;
}

function previewPanel(preview, ctx) {
  if (!preview) {
    return `<section class="finance-import-panel" data-preview-empty><h2>Preview rows</h2><p>No preview yet.</p></section>`;
  }

  return `
    <section class="finance-import-panel" data-bank-preview-result>
      <h2>Preview rows</h2>
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
      <h2>Import Result</h2>
      <dl><dt>import_id</dt><dd>${ctx.escapeHtml(result.importId || "")}</dd></dl>
      <dl><dt>status</dt><dd>${ctx.escapeHtml(result.status || "")}</dd></dl>
      <dl><dt>bank_transactions</dt><dd>${Number(result.transactions?.length || 0)}</dd></dl>
      <p>Import creates bank_statement_imports and bank_transactions only.</p>
      ${transactionActions(result.transactions || [], ctx)}
    </section>
  `;
}

function importHistoryPanel(importHistory, ctx) {
  return `
    <section class="finance-import-panel" data-import-history>
      <h2>Import history</h2>
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
      ` : `<p>No import history.</p>`}
    </section>
  `;
}

function bankTransactionListPanel(transactions, ctx) {
  return `
    <section class="finance-import-panel" data-bank-transaction-list>
      <h2>Bank Transaction List</h2>
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
      ` : `<p>No bank transactions imported.</p>`}
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
              <button type="button" data-operations-confirm="true" data-bank-mismatch="${ctx.escapeAttr(transaction.bankTransactionId || "")}">Mark mismatch</button>
              <button type="button" data-operations-confirm="true" data-bank-ignore="${ctx.escapeAttr(transaction.bankTransactionId || "")}">Ignore transaction</button>
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
      <h2>Payment match candidates</h2>
      <label for="bankCandidateWindowDays">time window days</label>
      <input id="bankCandidateWindowDays" type="number" min="1" max="30" value="3">
      <label for="bankPaymentThresholdDays">confirmed payment threshold days</label>
      <input id="bankPaymentThresholdDays" type="number" min="1" max="60" value="3">
      <label for="bankRefundThresholdDays">refund threshold days</label>
      <input id="bankRefundThresholdDays" type="number" min="1" max="60" value="3">
      <button type="button" data-operations-confirm="true" data-bank-generate-candidates ${result ? "" : "disabled"}>Generate candidates</button>
      <button type="button" data-operations-confirm="true" data-bank-detect-mismatches ${result ? "" : "disabled"}>Detect mismatch cases</button>
      <p data-operations-confirm-note>Manual match marks bank evidence against an existing fact only; it does not change confirmed amount, held amount, or StayBalance.</p>
      ${decision ? `<p class="match-decision">Last decision: ${ctx.escapeHtml(decision.status || decision.reason || "")}</p>` : ""}
      ${items.length ? candidateTable(items, ctx) : `<p>No open candidates.</p>`}
    </section>
  `;
}

function mismatchQueuePanel(mismatchCases, ctx) {
  const cases = mismatchCases?.cases || [];
  return `
    <section class="finance-import-panel" data-mismatch-queue>
      <h2>Mismatch Queue</h2>
      <p>Mismatch cases create finance-owned WorkItems and do not mutate payment, deposit, refund, or StayBalance facts.</p>
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
      ` : `<p>No open mismatch cases from the latest detection.</p>`}
    </section>
  `;
}

function reconciliationCaseTimelinePanel(mismatchCases, ctx) {
  const cases = mismatchCases?.cases || [];
  return `
    <section class="finance-import-panel" data-reconciliation-cases data-reconciliation-case-timeline>
      <h2>Reconciliation Cases Timeline</h2>
      ${cases.length ? cases.map((item) => `
        <article class="timeline-row">
          <h3>${ctx.escapeHtml(item.caseId || item.reconciliationCaseId || "")}</h3>
          <ol>
            <li>PaymentMismatchDetected · ${ctx.escapeHtml(item.openedEventId || "")}</li>
            <li>Owner ${ctx.escapeHtml(item.ownerRole || "finance")} · due ${ctx.escapeHtml(item.dueAtUtc || "")}</li>
            <li>Resolve ${ctx.escapeHtml((item.resolveActions || []).join(", "))}</li>
          </ol>
        </article>
      `).join("") : `<p>No Reconciliation Cases in the current queue.</p>`}
    </section>
  `;
}

function correctionRequestPanel(state, ctx) {
  const requests = state.correctionRequests || [];
  return `
    <section class="finance-import-panel" data-correction-center data-correction-request-list>
      <h2>Correction Request List</h2>
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
      <label for="correctionReason">reason</label>
      <textarea id="correctionReason">manual reconciliation correction</textarea>
      <button type="button" data-operations-confirm="true" data-correction-request>Create correction request</button>
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
      ` : `<p>No correction requests.</p>`}
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
      <h2>Correction Approval</h2>
      <div class="finance-import-grid">
        ${input("correctionRequestId", "correction_request_id", state.selectedCorrectionRequestId || selected?.correctionRequestId || "", ctx)}
        ${input("correctionDecisionTenant", "tenant_id", state.request?.tenantId || selected?.tenantId || "tenant-1", ctx)}
        ${input("correctionApproverId", "approver_id", ctx.state.currentActor?.userId || "runtime", ctx)}
        ${input("correctionApplyActorId", "apply_actor_id", ctx.state.currentActor?.userId || "runtime", ctx)}
        ${input("correctionApplyWorkItemId", "apply_work_item_id", "pc-correction-apply", ctx)}
        ${input("correctionAdjustmentAmount", "adjustment_amount", "", ctx)}
      </div>
      <label for="correctionApprovalNote">approval note</label>
      <textarea id="correctionApprovalNote">approved from PC Correction Center</textarea>
      <label for="correctionApplyReason">apply reason</label>
      <textarea id="correctionApplyReason">append-only correction applied</textarea>
      ${highRisk ? `<p data-capability-required="finance.correction.approve.highRisk">high-risk correction requires finance/admin capability.</p>` : ""}
      <div class="finance-import-actions">
        <button type="button" data-operations-confirm="true" data-correction-approve ${disabled}>Approve correction</button>
        <button type="button" data-operations-confirm="true" data-correction-reject>Reject correction</button>
        <button type="button" data-operations-confirm="true" data-correction-apply ${disabled}>Apply correction</button>
      </div>
      ${state.correctionDecision ? `<p class="match-decision">Last correction decision: ${ctx.escapeHtml(state.correctionDecision.status || "")}</p>` : ""}
    </section>
  `;
}

function ledgerBeforeAfterPanel(state, ctx) {
  const entries = state.ledgerCorrectionEntries || state.correctionEntries || [];
  return `
    <section class="finance-import-panel" data-ledger-before-after>
      <h2>Ledger Before / After View</h2>
      ${entries.length ? entries.map((entry) => `
        <article class="ledger-snapshot-row">
          <h3>${ctx.escapeHtml(entry.correctionEntryId || entry.correctionRequestId || "")}</h3>
          <div class="snapshot-grid">
            <pre>${ctx.escapeHtml(formatJson(entry.beforeSnapshot))}</pre>
            <pre>${ctx.escapeHtml(formatJson(entry.afterSnapshot))}</pre>
          </div>
        </article>
      `).join("") : `<p>No before / after snapshots yet.</p>`}
    </section>
  `;
}

function correctionAuditPanel(state, ctx) {
  const audit = state.correctionAudit?.length ? state.correctionAudit : (state.operationAudit || []);
  return `
    <section class="finance-import-panel" data-correction-audit data-gate-result-audit>
      <h2>Correction Audit</h2>
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
      ` : `<p>No correction audit records.</p>`}
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
              <button type="button" data-operations-confirm="true" data-candidate-accept="${ctx.escapeAttr(candidate.candidateId || "")}">Accept candidate</button>
              <button type="button" data-operations-confirm="true" data-candidate-reject="${ctx.escapeAttr(candidate.candidateId || "")}">Reject candidate</button>
              <button type="button" data-operations-confirm="true" data-bank-mismatch="${ctx.escapeAttr(candidate.bankTransactionId || "")}">Mismatch</button>
              <button type="button" data-operations-confirm="true" data-bank-ignore="${ctx.escapeAttr(candidate.bankTransactionId || "")}">Ignore</button>
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
