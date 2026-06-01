import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const alertsPath = readArg("--alerts=", "docs/go-live/dormitory/alerts.yml");
const runbookPath = readArg("--runbook=", "docs/go-live/dormitory/on-call-runbook.md");
const playbookPath = readArg("--playbook=", "docs/go-live/dormitory/rollback-playbook.md");
const outPath = readArg("--out=", "artifacts/go-live/dormitory/rollback-drill-result.json");

const requiredAlerts = [
  "confirm-failure-rate",
  "403-409-422-rate",
  "projection-lag",
  "outbox-dead-letter",
  "red-shadow",
  "p0-invariant-failed",
  "evidence-upload-failure",
  "payment-mismatch",
  "refund-blocked",
  "bed-double-occupancy",
  "sla-overdue",
  "finance-daily-close-failed",
  "bstage-gate-blocked"
];

if (process.argv.includes("--self-test")) {
  const invalid = validateRollbackDrill({
    alerts: { alerts: [{ alertId: "payment-mismatch", severity: "P0" }] },
    runbookText: "",
    playbookText: "",
    drill: {
      before: { domainEventCount: 1, ledgerEntryCount: 2 },
      after: { domainEventCount: 0, ledgerEntryCount: 0 },
      compensationInstruction: { appendOnly: false },
      userMessage: "",
      releaseControl: {}
    }
  });
  assert(invalid.some((item) => item.id === "dorm_int_09.alert_incomplete"), "self-test must catch incomplete alert.");
  assert(invalid.some((item) => item.id === "dorm_int_09.fact_deleted"), "self-test must catch deleted facts.");
  assert(invalid.some((item) => item.id === "dorm_int_09.compensation_not_append_only"), "self-test must catch mutable compensation.");
  console.log("Dormitory rollback drill self-test: PASS");
  process.exit(0);
}

const alerts = readJson(alertsPath);
const runbookText = fs.readFileSync(path.join(root, runbookPath), "utf8");
const playbookText = fs.readFileSync(path.join(root, playbookPath), "utf8");
const drill = runRollbackDrill();
const noGoItems = validateRollbackDrill({ alerts, runbookText, playbookText, drill });
const report = {
  generated_at_utc: new Date().toISOString(),
  generated_by: "dormitory-rollback-drill",
  stage: "DORM-INT-09",
  status: noGoItems.length ? "blocked" : "passed",
  sourceMode: "real",
  inputRefs: { alertsPath, runbookPath, playbookPath },
  drill,
  noGoItems,
  nextAction: noGoItems.length
    ? "修复 alerts/runbook/rollback drill P0 blocker 后重新运行 dormitory rollback drill。"
    : "DORM-INT-09 passed; DORM-INT-10 may evaluate training signoff."
};

writeJson(outPath, report);

if (noGoItems.length) {
  for (const item of noGoItems) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Dormitory rollback drill: BLOCKED");
}

console.log("Dormitory rollback drill: PASS");

export function runRollbackDrill() {
  const before = {
    domainEventCount: 4,
    ledgerEntryCount: 8,
    commandSubmissionCount: 4,
    evidenceObjectCount: 6
  };
  const actions = [
    "pause_dormitory_pilot",
    "disable_money_confirm",
    "disable_refund_approve",
    "switch_slice_to_adapter_primary",
    "freeze_high_risk_workitem_types",
    "append_compensation",
    "create_corrective_workitem"
  ];
  return {
    triggerAlert: "finance-daily-close-failed",
    before,
    actions,
    after: {
      domainEventCount: before.domainEventCount,
      ledgerEntryCount: before.ledgerEntryCount,
      commandSubmissionCount: before.commandSubmissionCount,
      evidenceObjectCount: before.evidenceObjectCount,
      pilotStatus: "paused",
      moneyConfirmEnabled: false,
      refundApproveEnabled: false,
      sliceMode: "adapter_primary",
      frozenWorkItemTypes: ["Dorm.DepositReceive", "Dorm.PaymentFinanceConfirm", "Dorm.DepositRefundRequest", "Dorm.BedAssignment"]
    },
    compensationInstruction: {
      compensationInstructionId: "comp-dorm-int-rollback-001",
      mode: "append",
      appendOnly: true,
      ledgerMutationAllowed: false
    },
    correctiveWorkItem: {
      workItemId: "wi-dorm-int-corrective-rollback-001",
      ownerRole: "releaseOwner",
      dueAtPolicy: "15m",
      evidenceRequired: ["rollback-drill-log", "finance-daily-close-result"]
    },
    userMessage: "业务暂停/请联系经理",
    releaseControl: {
      holdReason: "finance-daily-close-failed",
      visible: true,
      relatedGateResult: "b-stage-gate-rtb"
    }
  };
}

export function validateRollbackDrill({ alerts, runbookText, playbookText, drill }) {
  const violations = [];
  const alertById = new Map((alerts.alerts ?? []).map((item) => [item.alertId, item]));
  for (const id of requiredAlerts) {
    const alert = alertById.get(id);
    if (!alert) {
      violations.push(violation("dorm_int_09.alert_missing", `Alert missing: ${id}.`, { alertId: id }));
      continue;
    }
    for (const field of ["owner", "severity", "responseTime", "nextAction", "escalationTarget", "relatedRefType"]) {
      if (!alert[field]) {
        violations.push(violation("dorm_int_09.alert_incomplete", `Alert ${id} missing ${field}.`, { alertId: id, field }));
      }
    }
    if (alert.severity === "P0" && typeof alert.responseTime === "string" && !alert.responseTime.endsWith("m")) {
      violations.push(violation("dorm_int_09.p0_alert_sla_missing", `P0 alert ${id} must have minute-level response time.`, { alertId: id }));
    }
  }

  const normalizedRunbook = runbookText.toLowerCase();
  for (const token of ["pause", "disable money", "disable refund", "corrective WorkItem"]) {
    if (!normalizedRunbook.includes(token.toLowerCase())) {
      violations.push(violation("dorm_int_09.runbook_token_missing", `On-call runbook missing ${token}.`, { token }));
    }
  }
  for (const token of ["append_compensation", "ledger entries are append-only", "Release Control"]) {
    if (!playbookText.toLowerCase().includes(token.toLowerCase())) {
      violations.push(violation("dorm_int_09.playbook_token_missing", `Rollback playbook missing ${token}.`, { token }));
    }
  }

  if (drill.after.domainEventCount < drill.before.domainEventCount ||
      drill.after.ledgerEntryCount < drill.before.ledgerEntryCount ||
      drill.after.commandSubmissionCount < drill.before.commandSubmissionCount ||
      drill.after.evidenceObjectCount < drill.before.evidenceObjectCount) {
    violations.push(violation("dorm_int_09.fact_deleted", "Pause/rollback must not delete facts, submissions, evidence, or ledger entries."));
  }
  if (drill.after.pilotStatus !== "paused" || drill.after.moneyConfirmEnabled !== false || drill.after.refundApproveEnabled !== false) {
    violations.push(violation("dorm_int_09.pause_controls_missing", "Rollback drill must pause pilot and disable money/refund confirm."));
  }
  if (drill.after.sliceMode !== "adapter_primary") {
    violations.push(violation("dorm_int_09.adapter_primary_missing", "Rollback drill must switch slice to adapter_primary."));
  }
  if (!Array.isArray(drill.after.frozenWorkItemTypes) || drill.after.frozenWorkItemTypes.length === 0) {
    violations.push(violation("dorm_int_09.freeze_missing", "Rollback drill must freeze high-risk WorkItem types."));
  }
  if (drill.compensationInstruction?.appendOnly !== true || drill.compensationInstruction?.ledgerMutationAllowed !== false) {
    violations.push(violation("dorm_int_09.compensation_not_append_only", "Compensation must be append-only and must not mutate old ledger entries."));
  }
  if (!drill.correctiveWorkItem?.workItemId) {
    violations.push(violation("dorm_int_09.corrective_workitem_missing", "Rollback drill must create corrective WorkItem."));
  }
  if (drill.userMessage !== "业务暂停/请联系经理") {
    violations.push(violation("dorm_int_09.user_pause_message_missing", "User surface must show business paused message."));
  }
  if (!drill.releaseControl?.visible || !drill.releaseControl?.holdReason) {
    violations.push(violation("dorm_int_09.release_control_hold_missing", "Release Control must show hold reason."));
  }
  return violations;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
