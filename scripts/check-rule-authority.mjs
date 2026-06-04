import fs from "node:fs";

const requiredFiles = [
  "docs/rules/v5.5/rule-authority.yml",
  "docs/engineering/00-index.md",
  "docs/engineering/00-rule-authority.md",
  "docs/engineering/03-api-boundary-rules.md",
  "docs/engineering/13-release-control-plane-rules.md",
  "docs/engineering/15-no-go-rules.md",
  "docs/engineering/16-v5.5-engineering-rules-os.md",
  "docs/acceptance/00-index.md",
  "docs/acceptance/12-release-go-no-go.md",
  "docs/acceptance/13-v5.5-rules-os-go-no-go.md",
  "docs/architecture/README.md",
  "docs/architecture/rules/index.json",
  ".github/pull_request_template.md"
];

const requiredAuthorityTerms = [
  "Rule Precedence",
  "docs/engineering/*",
  "docs/acceptance/*",
  "docs/architecture/*",
  "compatibility references",
  "Definition",
  "OperationCase",
  "WorkItem",
  "CommandSubmission",
  "SliceCommandHandler",
  "DomainEvent / LedgerEntry",
  "ProcessManager",
  "Projection / Lens",
  "Mobile / PC Surface",
  "Unified Surface Architecture Rule",
  "All user-visible pages must use the active OAM-ACF v8 / Operations Runtime surface architecture",
  "Non-current architecture is a P0 defect",
  "obsolete implementation must be deleted",
  "Frontend Experience System",
  "shared components, Surface contract, multilingual dictionary, state/action contract, and real browser screenshot evidence",
  "Pages may specialize business content, but not architecture",
  "Step-page experience parity",
  "OperationCardShell",
  "page-private outer `intent-card` wrapper",
  "`workspace-control` visual wrapper",
  "Post-submit navigation",
  "auto-advance",
  "returnCurrentWorkItem",
  "users must not have to enumerate every page one by one",
  "Step status color is semantic language",
  "OperationStepRail",
  "Append-only correction WorkItems must use an explicit correction visual state",
  "Terminal completed records remain completed as the primary state",
  "Resource setup bed cardinality",
  "`bedSetup` must confirm the room's bed list",
  "Service task resource availability scope",
  "`serviceTaskCreate` with `resourceScope`",
  "`roomReleaseAfterService` with `taskId`",
  "backend-approved `ServiceTaskVerified` event",
  "client-provided `serviceTaskVerified` field is not proof",
  "ResourceSetup remains the only BedStatus/RoomStatus fact owner",
  "P0 WON-18 gate evidence must be green",
  "Workspace/Card prepare and confirm write endpoints are retired",
  "ProjectionRuntime may remain a projection/Lens compatibility facade",
  "Issue Repair Protocol",
  "Observe the real behavior",
  "Classify the impact",
  "Locate the broken layer",
  "Update contract/model/rule first",
  "Page-level hard-adds"
];

const requiredYamlTerms = [
  "precedenceOrder:",
  "- hardRules",
  "- releaseRules",
  "- engineeringRules",
  "- acceptanceRules",
  "- compatibilityRules",
  "- deprecatedRules",
  "docs/engineering/00-rule-authority.md",
  "docs/acceptance/00-index.md",
  "docs/architecture",
  "docs/v5.4",
  "hard.issue_repair_protocol",
  "hard.unified_surface_architecture",
  "hard.frontend_experience_system",
  "hard.step_page_experience_parity",
  "hard.post_submit_navigation",
  "hard.step_state_visual_language",
  "hard.resource_setup_bed_cardinality",
  "hard.service_task_resource_availability_scope",
  "roomId, bedCount, and bedLabels",
  "serviceTaskCreate with resourceScope",
  "roomReleaseAfterService with taskId",
  "client-provided serviceTaskVerified is not proof",
  "ResourceSetup remains the only BedStatus/RoomStatus fact owner",
  "return-current-work must not be the ordinary continuation path after submit",
  "terminal completed records remain completed as the primary state",
  "direct OperationCardShell",
  "outer intent-card operation wrapper",
  "readonly workspace-control visual wrappers",
  "engineering.frontend_experience_layers",
  "deprecated.page_private_legacy_surface_shell",
  "Workspace/Card prepare and confirm write endpoints are retired",
  "scripts/check-api-boundaries.mjs",
  "scripts/check-experience-contract.mjs",
  "scripts/check-surface-contract.mjs",
  "scripts/check-frontend-experience-system.mjs",
  "scripts/check-rule-drift.mjs"
];

const staleAuthorityTerms = [
  "Workspace/Card prepare and confirm remain compatibility wrappers only",
  "Workspace/Card remains a compatibility wrapper",
  "The current runtime still exposes the older Workspace/Card endpoints as a compatibility layer"
];

function fail(message, details = []) {
  for (const detail of details) console.error(detail);
  throw new Error(message);
}

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    fail(`Rule authority required file missing: ${file}`);
  }
}

const authority = fs.readFileSync("docs/engineering/00-rule-authority.md", "utf8");
const normalizedAuthority = authority.replace(/\s+/g, " ");
const missingAuthorityTerms = requiredAuthorityTerms.filter((term) => !normalizedAuthority.includes(term));
if (missingAuthorityTerms.length > 0) {
  fail("Rule authority is missing required terms.", missingAuthorityTerms);
}
const staleAuthorityMatches = staleAuthorityTerms.filter((term) => authority.includes(term));
if (staleAuthorityMatches.length > 0) {
  fail("Rule authority still contains retired compatibility wording.", staleAuthorityMatches);
}

const machineAuthority = fs.readFileSync("docs/rules/v5.5/rule-authority.yml", "utf8");
const normalizedMachineAuthority = machineAuthority.replace(/\s+/g, " ");
const missingYamlTerms = requiredYamlTerms.filter((term) => !normalizedMachineAuthority.includes(term));
if (missingYamlTerms.length > 0) {
  fail("Machine rule authority is missing required terms.", missingYamlTerms);
}
const staleMachineMatches = staleAuthorityTerms.filter((term) => machineAuthority.includes(term));
if (staleMachineMatches.length > 0) {
  fail("Machine rule authority still contains retired compatibility wording.", staleMachineMatches);
}

const precedence = [...machineAuthority.matchAll(/^\s+-\s+(hardRules|releaseRules|engineeringRules|acceptanceRules|compatibilityRules|deprecatedRules)\s*$/gm)]
  .map((match) => match[1])
  .slice(0, 6);
const expectedPrecedence = ["hardRules", "releaseRules", "engineeringRules", "acceptanceRules", "compatibilityRules", "deprecatedRules"];
if (precedence.join("|") !== expectedPrecedence.join("|")) {
  fail("Machine rule authority precedence order is incorrect.", [`Expected: ${expectedPrecedence.join(" > ")}`, `Actual: ${precedence.join(" > ")}`]);
}

const architectureReadme = fs.readFileSync("docs/architecture/README.md", "utf8").replace(/\s+/g, " ");
for (const term of ["compatibility reference", "engineering and acceptance rule files win"]) {
  if (!architectureReadme.includes(term)) {
    fail(`docs/architecture/README.md must mark architecture docs as compatibility references: ${term}`);
  }
}

const rulesIndex = JSON.parse(fs.readFileSync("docs/architecture/rules/index.json", "utf8"));
const rules = Array.isArray(rulesIndex.rules) ? rulesIndex.rules : [];
for (const ruleId of ["WON55-RULES-001", "WON55-RULES-002", "WON55-RULES-003", "WON55-RULES-004"]) {
  const rule = rules.find((item) => item.id === ruleId);
  if (!rule) {
    fail(`Rule index missing ${ruleId}`);
  }
  if (!String(rule.ruleFile || "").startsWith("docs/engineering/") &&
      !String(rule.ruleFile || "").startsWith("docs/acceptance/")) {
    fail(`${ruleId} must be anchored in engineering or acceptance docs.`);
  }
}

const legacyRuleFiles = rules
  .map((rule) => String(rule.ruleFile || ""))
  .filter((ruleFile) => ruleFile.startsWith("docs/architecture/"));
if (legacyRuleFiles.length > 0 && !architectureReadme.includes("compatibility reference")) {
  fail("Legacy architecture rule files require docs/architecture/README.md compatibility marker.", legacyRuleFiles);
}

const prTemplate = fs.readFileSync(".github/pull_request_template.md", "utf8");
for (const term of ["Rule Authority", "V5.5 batch dependency", "Operations Runtime axis", "WON-18"]) {
  if (!prTemplate.includes(term)) {
    fail(`PR template missing V5.5 rule authority prompt: ${term}`);
  }
}

console.log("Rule authority check: PASS");
