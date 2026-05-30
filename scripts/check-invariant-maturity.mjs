import fs from "node:fs";

const file = "docs/rules/v5.5/invariant-maturity.yml";
const requiredInvariants = [
  "payment.non_cash_confirmed_must_have_evidence",
  "payment.allocation_not_exceed_confirmed_available",
  "deposit.refund_not_exceed_available_refund",
  "deposit.held_amount_not_negative",
  "resource.no_overlapping_active_bed_occupancy",
  "case.closed_has_no_open_blocker",
  "shadow.no_shadow_event_consumed_by_official_projector",
  "bank.import_does_not_create_payment_fact",
  "ledger.no_edit_old_entry",
  "period.finance_snapshot_from_ledgers",
  "pc.export_has_audit"
];

const requiredFields = [
  "owner",
  "severity",
  "mode",
  "maturity",
  "targetMaturity",
  "deadlineMr",
  "evidenceType",
  "evidenceRef",
  "blockerPolicy"
];

function fail(message, details = []) {
  for (const detail of details) console.error(detail);
  throw new Error(message);
}

const source = fs.readFileSync(file, "utf8");
const invariantMatches = [...source.matchAll(/^\s*-\s+key:\s*([A-Za-z0-9_.-]+)\s*$/gm)];
const blocks = new Map();
for (let index = 0; index < invariantMatches.length; index += 1) {
  const match = invariantMatches[index];
  blocks.set(match[1], source.slice(match.index, invariantMatches[index + 1]?.index ?? source.length));
}

const violations = [];
for (const key of requiredInvariants) {
  const block = blocks.get(key);
  if (!block) {
    violations.push(`Missing invariant maturity entry: ${key}`);
    continue;
  }
  for (const field of requiredFields) {
    if (!new RegExp(`^\\s*${field}:`, "m").test(block)) {
      violations.push(`${key} missing ${field}`);
    }
  }
  if (/severity:\s*P0/.test(block) && /maturity:\s*L1_skeleton/.test(block)) {
    for (const required of ["targetMaturity", "deadlineMr", "blockerPolicy"]) {
      if (!new RegExp(`^\\s*${required}:\\s*\\S+`, "m").test(block)) {
        violations.push(`${key} P0 L1 skeleton must declare ${required}`);
      }
    }
  }
}

const doc = fs.readFileSync("docs/engineering/14-testing-ci-rules.md", "utf8");
for (const level of ["L0 declared", "L1 skeleton", "L2 sql_or_service", "L3 acceptance_linked", "L4 release_blocking"]) {
  if (!doc.includes(level)) {
    violations.push(`Testing CI rules doc missing maturity level: ${level}`);
  }
}

if (violations.length > 0) {
  fail("Invariant maturity check failed.", violations);
}

console.log("Invariant maturity check: PASS");
