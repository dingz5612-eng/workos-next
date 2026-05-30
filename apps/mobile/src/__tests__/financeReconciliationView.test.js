import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { financeReconciliationView } from "../views/financeReconciliationView.js";

describe("PC finance reconciliation bank import", () => {
  it("renders manual CSV upload, mapping config, preview rows, and confirm import", () => {
    const html = financeReconciliationView(ctx({
      preview: {
        rowCount: 2,
        parsedCount: 1,
        rejectedCount: 1,
        rows: [
          row(true, "MB-001", []),
          row(false, "MB-002", ["invalid_amount"])
        ]
      },
      result: {
        importId: "bank-import-1",
        status: "partially_rejected",
        transactions: [{ bankTransactionId: "bank-tx-1", externalRef: "MB-001", amount: 1200, currency: "KGS" }]
      },
      candidates: {
        candidateCount: 1,
        candidates: [{
          candidateId: "cand-1",
          candidateType: "payment",
          paymentId: "PAY-001",
          bankTransactionId: "bank-tx-1",
          externalRef: "MB-001",
          score: 0.95,
          reason: "amount_currency_time_window_reference_hint"
        }]
      },
      mismatchCases: {
        mismatchCount: 1,
        cases: [{
          reconciliationCaseId: "rcase-1",
          caseId: "reconciliation-case-1",
          mismatchType: "amount_mismatch",
          bankTransactionId: "bank-tx-1",
          ownerRole: "finance",
          blockerSeverity: "P0",
          dueAtUtc: "2026-05-03T10:00:00Z",
          resolveActions: ["requestPaymentCorrection", "createCorrectionRequest"]
        }]
      }
    }));

    expect(html).toContain("Bank Statement Import");
    expect(html).toContain("type=\"file\"");
    expect(html).toContain("data-column-mapping");
    expect(html).toContain("Preview rows");
    expect(html).toContain("Confirm import");
    expect(html).toContain("invalid_amount");
    expect(html).toContain("bank-import-1");
    expect(html).toContain("Generate candidates");
    expect(html).toContain("Detect mismatch cases");
    expect(html).toContain("Accept candidate");
    expect(html).toContain("Reject candidate");
    expect(html).toContain("Mismatch");
    expect(html).toContain("Ignore");
    expect(html).toContain("Mark mismatch");
    expect(html).toContain("Ignore transaction");
    expect(html).toContain("Bank Transaction List");
    expect(html).toContain("Import history");
    expect(html).toContain("Mismatch Queue");
    expect(html).toContain("Reconciliation Cases");
    expect(html).toContain("amount_mismatch");
    expect(html).toContain("createCorrectionRequest");
    expect(html).toContain("PAY-001");
    expect(html).toContain("Correction Request List");
    expect(html).toContain("Correction Approval");
    expect(html).toContain("Ledger Before / After View");
    expect(html).toContain("Correction Audit");
  });

  it("does not expose PaymentConfirmed or payment fact write affordances", () => {
    const html = financeReconciliationView(ctx());
    expect(html).not.toContain("PaymentConfirmed");
    expect(html).not.toContain("/api/payment/confirm");
    expect(html).not.toContain("data-submit-card");
  });

  it("api client exposes preview and confirm import paths without payment confirm", () => {
    const root = repoRoot();
    const apiClient = readFileSync(resolve(root, "apps/mobile/src/apiClient.js"), "utf8");
    const generatedPaths = readFileSync(resolve(root, "apps/mobile/src/generated/runtimeApiPaths.js"), "utf8");

    expect(apiClient).toContain("previewBankStatementImport");
    expect(apiClient).toContain("confirmBankStatementImport");
    expect(apiClient).toContain("generateReconciliationCandidates");
    expect(apiClient).toContain("detectReconciliationMismatches");
    expect(apiClient).toContain("acceptReconciliationCandidate");
    expect(apiClient).toContain("requestLedgerCorrection");
    expect(apiClient).toContain("approveLedgerCorrection");
    expect(apiClient).toContain("applyLedgerCorrection");
    expect(apiClient).toContain("postPcOperationsConfirm");
    expect(generatedPaths).toContain("/api/reconciliation/bank-statement-imports/preview");
    expect(generatedPaths).toContain("/api/reconciliation/bank-statement-imports");
    expect(generatedPaths).toContain("/api/reconciliation/match-candidates/generate");
    expect(generatedPaths).toContain("/api/reconciliation/mismatches/detect");
    expect(generatedPaths).toContain("/api/reconciliation/bank-transactions/");
    expect(generatedPaths).toContain("/api/correction-center/ledger-correction-requests");
    expect(apiClient).not.toContain("/api/payment/confirm");
  });

  it("pc_import_bank_statement", () => {
    const html = financeReconciliationView(ctx({
      preview: { rowCount: 1, parsedCount: 1, rejectedCount: 0, rows: [row(true, "MB-001", [])] },
      result: {
        importId: "bank-import-1",
        sourceType: "manual_csv",
        status: "imported",
        parsedCount: 1,
        rejectedCount: 0,
        transactions: [{ bankTransactionId: "bank-tx-1", importId: "bank-import-1", externalRef: "MB-001", amount: 1200, currency: "KGS", status: "imported" }]
      }
    }));

    expect(html).toContain("data-bank-csv-file");
    expect(html).toContain("Preview rows");
    expect(html).toContain("parsed_count 1");
    expect(html).toContain("Confirm import");
    expect(html).toContain("data-import-history");
    expect(html).toContain("bank-import-1");
  });

  it("pc_accept_match_does_not_confirm_payment", () => {
    const html = financeReconciliationView(ctx({
      result: { importId: "bank-import-1", transactions: [] },
      candidates: {
        candidates: [{
          candidateId: "cand-1",
          candidateType: "payment",
          paymentId: "payment-1",
          bankTransactionId: "bank-tx-1",
          externalRef: "MB-001",
          amount: 1200,
          currency: "KGS",
          score: 0.95,
          reason: "amount_currency_time_window"
        }]
      }
    }));

    expect(html).toContain("Accept candidate");
    expect(html).toContain("data-operations-confirm=\"true\"");
    expect(html).toContain("does not change confirmed amount");
    expect(html).not.toContain("PaymentConfirmed");
  });

  it("pc_create_correction_request", () => {
    const html = financeReconciliationView(ctx({
      correctionRequests: [{
        correctionRequestId: "corr-1",
        tenantId: "tenant-1",
        targetLedgerType: "payment",
        targetEntryId: "alloc-1",
        correctionType: "allocation_reversal",
        riskLevel: "high",
        status: "pending_approval",
        workItemIntent: { workItemId: "wi-correction-1" }
      }]
    }));

    expect(html).toContain("Correction Request List");
    expect(html).toContain("data-correction-request");
    expect(html).toContain("allocation_reversal");
    expect(html).toContain("wi-correction-1");
  });

  it("pc_approve_correction", () => {
    const html = financeReconciliationView(ctx({
      selectedCorrectionRequestId: "corr-1",
      correctionRequests: [{
        correctionRequestId: "corr-1",
        tenantId: "tenant-1",
        riskLevel: "high",
        status: "pending_approval"
      }]
    }));

    expect(html).toContain("Correction Approval");
    expect(html).toContain("data-correction-approve");
    expect(html).toContain("finance.correction.approve.highRisk");
    expect(html).not.toContain("data-correction-approve disabled");
  });

  it("pc_apply_correction_appends_reversal", () => {
    const root = repoRoot();
    const apiClient = readFileSync(resolve(root, "apps/mobile/src/apiClient.js"), "utf8");
    const storage = readFileSync(resolve(root, "services/core-api/WorkOS.Api/Runtime/RuntimeCorrectionCenterStorage.cs"), "utf8");

    expect(apiClient).toContain("applyLedgerCorrection");
    expect(apiClient).toContain("correction.apply");
    expect(storage).toContain("InsertReversalEntry");
    expect(storage).toContain("InsertCorrectionEntry");
    expect(storage).not.toContain("delete from audit_events");
  });

  it("pc_before_after_view_displays_snapshots", () => {
    const html = financeReconciliationView(ctx({
      correctionEntries: [{
        correctionEntryId: "centry-1",
        beforeSnapshot: { amount: 1200, currency: "KGS" },
        afterSnapshot: { amount: 0, currency: "KGS", status: "corrected" }
      }]
    }));

    expect(html).toContain("Ledger Before / After View");
    expect(html).toContain("centry-1");
    expect(html).toContain("&quot;amount&quot;: 1200");
    expect(html).toContain("&quot;status&quot;: &quot;corrected&quot;");
  });

  it("pc_cannot_directly_update_ledger", () => {
    const root = repoRoot();
    const view = readFileSync(resolve(root, "apps/mobile/src/views/financeReconciliationView.js"), "utf8");
    const controller = readFileSync(resolve(root, "apps/mobile/src/financeReconciliationController.js"), "utf8");
    const apiClient = readFileSync(resolve(root, "apps/mobile/src/apiClient.js"), "utf8");

    expect(view).not.toContain("data-direct-ledger-update");
    expect(controller).not.toContain("update ledger");
    expect(apiClient).not.toContain("method: \"PUT\"");
    expect(apiClient).not.toContain("method: \"PATCH\"");
    expect(apiClient).not.toContain("/api/payment/confirm");
  });
});

function ctx(bankStatementImport = {}) {
  return {
    state: {
      bankStatementImport,
      currentActor: { userId: "finance-1", role: "finance" }
    },
    shell: (content) => content,
    escapeHtml: escape,
    escapeAttr: escape
  };
}

function row(valid, externalRef, errors) {
  return {
    rowNumber: valid ? 1 : 2,
    valid,
    externalRef,
    amount: valid ? 1200 : null,
    currency: "KGS",
    direction: "credit",
    description: "Rent payment",
    errors
  };
}

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function repoRoot() {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (readFileExists(resolve(current, "WorkOSNext.sln"))) return current;
    current = resolve(current, "..");
  }
  throw new Error("Could not locate repo root");
}

function readFileExists(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}
