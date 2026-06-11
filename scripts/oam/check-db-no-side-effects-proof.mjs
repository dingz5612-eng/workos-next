import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const proof = readJson("docs/oam/db-no-side-effects-proof.json");
const canonical = readText("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs");
const tests = readText("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs");
const requiredRejectedPaths = [
  "unresolved definition",
  "unknown field",
  "forbidden field",
  "systemGenerated submitted",
  "derived submitted",
  "contextReadonly submitted",
  "cardId business identity",
  "missing evidence",
  "invalid selectedStableRef",
  "finance_kernel without admission"
];
const requiredNoSideEffects = [
  "no UnitOfWork commit",
  "no CommandSubmission",
  "no DomainEvent",
  "no LedgerEntry",
  "no Outbox",
  "no confirmed transition",
  "no next WorkItem dispatch",
  "no Projection mutation",
  "no Lens mutation",
  "no Search read model mutation"
];

for (const item of requiredRejectedPaths) {
  if (!(proof.rejectedPaths ?? []).includes(item)) fail(`missing rejected path proof: ${item}`);
}
for (const item of requiredNoSideEffects) {
  if (!(proof.noSideEffects ?? []).includes(item)) fail(`missing no-side-effect proof: ${item}`);
}

const resolveIndex = canonical.indexOf("var definition = definitions.Resolve(workItem);");
const unresolvedGateIndex = canonical.indexOf("if (!definition.Resolved)");
const admissionIndex = canonical.indexOf("admission.EvaluateConfirm");
const commitIndex = canonical.indexOf("unitOfWork.Commit(command)");
const transitionIndex = canonical.indexOf("RecordWorkItemTransition");
const dispatchIndex = canonical.indexOf("DispatchNextOperationWorkItem");
if (!(resolveIndex >= 0 && resolveIndex < unresolvedGateIndex && unresolvedGateIndex < admissionIndex && admissionIndex < commitIndex && commitIndex < transitionIndex && transitionIndex < dispatchIndex)) {
  fail("unresolved definition hard gate must precede admission, commit, transition, and dispatch.");
}
if (canonical.includes("definitions.Resolve(workItem, normalized.CardId)")) {
  fail("cardId business identity path must be rejected by implementation.");
}
if (canonical.includes("FirstNonEmpty(definition.DefinitionId")) {
  fail("command definition fallback would allow unresolved identity side effects.");
}
for (const marker of [
  "operations_confirm_blocks_unresolved_definition_before_unit_of_work",
  "operations_confirm_does_not_resolve_definition_from_card_id_fallback",
  "operations_confirm_without_idempotency_key_returns_422_without_writing_domain_event",
  "operations_confirm_blocks_production_mode_before_unit_of_work",
  "high_risk_confirm_requires_verified_device_reason_and_evidence_before_unit_of_work",
  "high_risk_confirm_ignores_self_reported_trusted_device_before_unit_of_work",
  "high_risk_confirm_blocks_untrusted_and_revoked_server_devices",
  "operations_confirm_does_not_dispatch_next_work_item_from_shared_workspace_seed"
]) {
  if (!tests.includes(marker)) fail(`missing negative test marker: ${marker}`);
}
for (const marker of ["Assert.IsEmpty(store.Submissions)", "Assert.IsEmpty(store.DomainEvents)"]) {
  if (!tests.includes(marker)) fail(`negative tests must assert ${marker}.`);
}

if (failures.length > 0) {
  console.error("DB no-side-effects proof check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("DB no-side-effects proof check: PASS");

function readJson(file) {
  return JSON.parse(readText(file));
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function fail(message) {
  failures.push(message);
}
