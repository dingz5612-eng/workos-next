import fs from "node:fs";

const requiredFiles = [
  "docs/engineering/00-rule-authority.md",
  "docs/engineering/03-api-boundary-rules.md",
  "docs/engineering/13-release-control-plane-rules.md",
  "docs/engineering/15-no-go-rules.md",
  "docs/engineering/16-v5.5-engineering-rules-os.md",
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
  "P0 WON-18 gate evidence must be green"
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
const missingAuthorityTerms = requiredAuthorityTerms.filter((term) => !authority.includes(term));
if (missingAuthorityTerms.length > 0) {
  fail("Rule authority is missing required terms.", missingAuthorityTerms);
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
