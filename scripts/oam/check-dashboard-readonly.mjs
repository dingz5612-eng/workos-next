import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const selfTest = process.argv.includes("--self-test");

const dashboardPath = "docs/contracts/bi-kpi/dashboard-contract.json";
const biKpiPath = "docs/contracts/bi-kpi/bi-kpi-contract.json";
const readKernelPath = "docs/read-intelligence/read-intelligence-kernel.json";
const truthOwnerPath = "docs/business/truth-owner-registry.yml";
const financeKernelPath = "docs/finance/finance-ledger-kernel.json";

if (selfTest) {
  const good = validate(loadDocuments());
  assert(good.length === 0, `positive Dashboard readonly fixture must pass: ${good.map((item) => item.message).join("; ")}`);

  const badBusiness = loadDocuments();
  badBusiness.dashboard.dashboards[0].writeFactsAllowed = true;
  assert(validate(badBusiness).some((item) => item.id === "dashboard.business_fact_write"), "Dashboard business fact write must fail.");

  const badLedger = loadDocuments();
  badLedger.dashboard.dashboards[0].writeLedgerEntryAllowed = true;
  assert(validate(badLedger).some((item) => item.id === "dashboard.ledger_write"), "Dashboard LedgerEntry write must fail.");

  const badAction = loadDocuments();
  badAction.dashboard.dashboards[0].pageActions[0].kind = "confirmInline";
  assert(validate(badAction).some((item) => item.id === "dashboard.action_not_navigation"), "Dashboard inline confirm must fail.");

  console.log("Dashboard readonly self-test: PASS");
  process.exit(0);
}

const failures = validate(loadDocuments());
writeReport(failures);
if (failures.length > 0) {
  for (const failure of failures) console.error(`${failure.id}: ${failure.message}`);
  process.exit(1);
}

console.log("Dashboard readonly check: PASS");

function validate(ctx) {
  const failures = [];
  const { dashboard, biKpi, readKernel, truthOwner, financeKernel } = ctx;
  requireFalse(dashboard.businessFactWriteAllowed, "dashboard.business_fact_write", "Dashboard contract must not write business facts.", failures);
  requireFalse(dashboard.financeFactWriteAllowed, "dashboard.finance_fact_write", "Dashboard contract must not write finance facts.", failures);
  requireFalse(dashboard.ledgerEntryWriteAllowed, "dashboard.ledger_write", "Dashboard contract must not write LedgerEntry.", failures);
  requireFalse(dashboard.workItemDefinitionMutationAllowed, "dashboard.workitem_definition_mutation", "Dashboard contract must not mutate WorkItem Definition.", failures);
  requireFalse(dashboard.truthOwnerAllowed, "dashboard.truth_owner", "Dashboard contract must not be a truth owner.", failures);
  requireTrue(dashboard.readOnly, "dashboard.readonly", "Dashboard contract must be read-only.", failures);
  requireTrue(biKpi.readOnly, "bi_kpi.readonly", "BI/KPI contract must be read-only.", failures);
  requireFalse(biKpi.businessFactWriteAllowed, "bi_kpi.business_fact_write", "BI/KPI contract must not write business facts.", failures);
  requireFalse(readKernel.writeFactsAllowed, "read_kernel.write_facts", "Read Intelligence kernel must not write facts.", failures);
  requireTrue(readKernel.readProof?.searchLensProjectionWriteFactsAllowed === false, "read_kernel.search_lens_projection_readonly", "Search/Lens/Projection must be read-only.", failures);

  const allowedInputs = new Set(["generatedReadModel", "readModel", "projection", "metric"]);
  for (const kind of dashboard.allowedInputKinds ?? []) {
    if (!allowedInputs.has(kind)) {
      failures.push(v("dashboard.input_kind_forbidden", `Dashboard allowedInputKinds includes forbidden kind: ${kind}.`));
    }
  }
  for (const required of allowedInputs) {
    if (!(dashboard.allowedInputKinds ?? []).includes(required)) {
      failures.push(v("dashboard.input_kind_missing", `Dashboard allowedInputKinds missing ${required}.`));
    }
  }

  const forbiddenWrites = new Set(dashboard.forbiddenWrites ?? []);
  for (const required of ["businessFact", "financeFact", "LedgerEntry", "WorkItemDefinition", "truthOwner"]) {
    if (!forbiddenWrites.has(required)) {
      failures.push(v("dashboard.forbidden_write_missing", `Dashboard forbiddenWrites missing ${required}.`));
    }
  }

  const actionPolicy = dashboard.actionPolicy ?? {};
  requireTrue(actionPolicy.onlyNavigationToWorkItemConfirmPath, "dashboard.action_navigation_only", "Dashboard actions may only navigate to WorkItem confirm path.", failures);
  requireFalse(actionPolicy.directFactWriteAllowed, "dashboard.action_direct_fact_write", "Dashboard actions must not write facts directly.", failures);
  requireFalse(actionPolicy.directLedgerWriteAllowed, "dashboard.action_direct_ledger_write", "Dashboard actions must not write LedgerEntry directly.", failures);
  requireFalse(actionPolicy.directWorkItemDefinitionMutationAllowed, "dashboard.action_definition_mutation", "Dashboard actions must not mutate WorkItem Definition.", failures);

  for (const item of dashboard.dashboards ?? []) {
    requireFalse(item.writeFactsAllowed, "dashboard.business_fact_write", `${item.dashboardId} must not write business facts.`, failures);
    requireFalse(item.writeFinancialFactsAllowed, "dashboard.finance_fact_write", `${item.dashboardId} must not write finance facts.`, failures);
    requireFalse(item.writeLedgerEntryAllowed, "dashboard.ledger_write", `${item.dashboardId} must not write LedgerEntry.`, failures);
    requireFalse(item.modifyWorkItemDefinitionAllowed, "dashboard.workitem_definition_mutation", `${item.dashboardId} must not mutate WorkItem Definition.`, failures);
    requireFalse(item.truthOwnerAllowed, "dashboard.truth_owner", `${item.dashboardId} must not be a truth owner.`, failures);

    if (!Array.isArray(item.consumes) || item.consumes.length === 0) {
      failures.push(v("dashboard.consumes_missing", `${item.dashboardId} must declare read-only consumption refs.`));
    }
    for (const input of item.consumes ?? []) {
      if (!allowedInputs.has(input.kind)) {
        failures.push(v("dashboard.consumes_forbidden_kind", `${item.dashboardId} consumes forbidden kind ${input.kind}.`));
      }
      if (!input.ref || !exists(input.ref)) {
        failures.push(v("dashboard.consumes_ref_missing", `${item.dashboardId} consumes missing ref ${input.ref || "(empty)"}.`));
      }
    }
    if (!Array.isArray(item.pageActions) || item.pageActions.length === 0) {
      failures.push(v("dashboard.page_actions_missing", `${item.dashboardId} must declare page actions.`));
    }
    for (const action of item.pageActions ?? []) {
      if (action.kind !== "navigateToWorkItemConfirmPath") {
        failures.push(v("dashboard.action_not_navigation", `${item.dashboardId} action ${action.actionId || "(unknown)"} must only navigate to WorkItem confirm path.`));
      }
      requireFalse(action.directWriteAllowed, "dashboard.action_direct_write", `${item.dashboardId} action ${action.actionId || "(unknown)"} must not write directly.`, failures);
    }
  }

  const dashboardSummary = (truthOwner.truthOwners ?? []).find((item) => item.factId === "DashboardSummary");
  if (!dashboardSummary) {
    failures.push(v("truth_owner.dashboard_summary_missing", "Truth owner registry must declare DashboardSummary boundary."));
  } else {
    if (dashboardSummary.owner === "dashboard") {
      failures.push(v("truth_owner.dashboard_is_owner", "Dashboard must not own DashboardSummary truth."));
    }
    if (!(dashboardSummary.forbiddenOwners ?? []).includes("dashboard")) {
      failures.push(v("truth_owner.dashboard_not_forbidden", "Truth owner registry must forbid dashboard as owner."));
    }
  }

  if (financeKernel.statements?.dashboardSummaryIsNotFinanceTruth !== true) {
    failures.push(v("finance.dashboard_summary_truth", "Finance kernel must state DashboardSummary is not finance truth."));
  }
  if (!(financeKernel.forbiddenFinanceTruthOwners ?? []).includes("DashboardSummary")) {
    failures.push(v("finance.dashboard_forbidden_owner", "Finance kernel must forbid DashboardSummary as finance truth owner."));
  }
  if (!(financeKernel.semanticDistinctions?.nonFinanceTruth ?? []).includes("DashboardSummary")) {
    failures.push(v("finance.dashboard_non_finance_truth", "Finance kernel must classify DashboardSummary as non-finance truth."));
  }

  return failures;
}

function loadDocuments() {
  return {
    dashboard: readJson(dashboardPath),
    biKpi: readJson(biKpiPath),
    readKernel: readJson(readKernelPath),
    truthOwner: readJson(truthOwnerPath),
    financeKernel: readJson(financeKernelPath)
  };
}

function requireTrue(value, id, message, failures) {
  if (value !== true) failures.push(v(id, message));
}

function requireFalse(value, id, message, failures) {
  if (value !== false) failures.push(v(id, message));
}

function writeReport(failures) {
  const reportPath = "artifacts/oam/checks/dashboard-readonly-report.json";
  const report = {
    version: "oam.dashboard-readonly-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: failures.length === 0 ? "passed" : "failed",
    checkedFiles: [dashboardPath, biKpiPath, readKernelPath, truthOwnerPath, financeKernelPath],
    failures
  };
  const full = abs(reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), "utf8"));
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function abs(file) {
  return path.join(root, file);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function v(id, message) {
  return { id, message };
}
