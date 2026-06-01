import {
  assertSelfTest,
  failIfViolations,
  listDocuments,
  negativeFixtureRoot,
  parseArgs,
  positiveFixtureRoot,
  readDocument,
  validateRequiredObject,
  violation,
  writeReport
} from "./btos-compiler-lib.mjs";

const cli = parseArgs(process.argv.slice(2));
const checkName = "check-management-cockpit-boundary";
const out = cli.value("out", ".tmp/rt2/management-cockpit-boundary-report.json");

function main() {
  if (cli.has("self-test")) {
    runSelfTest();
    return;
  }

  const files = listDocuments(`${positiveFixtureRoot}/management-cockpit`);
  const violations = validateCockpitFiles(files);
  writeReport(out, checkName, violations, files);
  failIfViolations("ManagementCockpit boundary check", violations);
  console.log(`ManagementCockpit boundary check: PASS (${files.length} files)`);
}

function validateCockpitFiles(files) {
  const violations = [];
  for (const file of files) {
    const cockpit = readDocument(file);
    violations.push(...validateRequiredObject(cockpit, ["version", "cockpitId", "allowedActions", "actions"], file));
    if (cockpit.allowedActions?.includes("process")) {
      violations.push(violation("management_cockpit.process_capability", file, `${cockpit.cockpitId} must not allow process actions.`));
    }
    for (const action of cockpit.actions ?? []) {
      if (action.kind === "process" || action.domainExceptionProcessing === true) {
        violations.push(violation("management_cockpit.processes_domain_exception", file, `ManagementCockpit action ${action.id} must route domain exceptions instead of processing them.`));
      }
    }
  }
  return violations;
}

function runSelfTest() {
  const good = validateCockpitFiles(listDocuments(`${positiveFixtureRoot}/management-cockpit`));
  assertSelfTest(good.length === 0, `positive ManagementCockpit fixture must pass: ${good.map((item) => item.message).join("; ")}`);
  const bad = validateCockpitFiles(listDocuments(`${negativeFixtureRoot}/management-cockpit`));
  assertSelfTest(bad.some((item) => item.id === "management_cockpit.processes_domain_exception"), "ManagementCockpit processing a domain exception must fail.");
  console.log("ManagementCockpit boundary self-test: PASS");
}

main();
