import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));

const requiredSections = [
  "Summary",
  "Rule Authority",
  "MR Contract",
  "Fact Ownership",
  "API Boundary",
  "Idempotency",
  "Evidence",
  "Ledger",
  "Process / Blocker",
  "Projection / Lens",
  "Mobile",
  "PC",
  "Migration / Release",
  "Tests",
  "No-Go"
];

const requiredMrFields = [
  "MR",
  "Slice",
  "Runtime Layer",
  "Owner",
  "Contract file",
  "GateResult required",
  "Rollback / compensation instruction"
];

const requiredTestFields = [
  "Relevant backend tests",
  "Relevant frontend tests",
  "Relevant migration or runtime contract tests"
];

const requiredRiskFields = ["P0 risks", "P1 risks", "P2 risks"];

const templateOnlyValues = new Set(["", "-", "_", "todo", "tbd", "none"]);

function parseArgs(argv) {
  const parsed = new Map();
  for (const arg of argv) {
    if (arg.startsWith("--") && arg.includes("=")) {
      const [key, ...value] = arg.slice(2).split("=");
      parsed.set(key, value.join("="));
    } else if (arg.startsWith("--")) {
      parsed.set(arg.slice(2), true);
    }
  }
  return parsed;
}

function fail(message, violations) {
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  throw new Error(message);
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function parseSections(body) {
  const sections = new Map();
  let current = null;
  let buffer = [];
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      if (current) sections.set(current.toLowerCase(), buffer.join("\n").trim());
      current = match[1].trim();
      buffer = [];
    } else if (current) {
      buffer.push(line);
    }
  }
  if (current) sections.set(current.toLowerCase(), buffer.join("\n").trim());
  return sections;
}

function section(sections, name) {
  return sections.get(name.toLowerCase()) ?? "";
}

function fieldValue(sectionText, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^[ \\t]*-[ \\t]+${escaped}:[ \\t]*(.*)$`, "im");
  return regex.exec(sectionText)?.[1]?.trim() ?? "";
}

function checkboxes(sectionText) {
  const matches = [...sectionText.matchAll(/^[ \t]*-[ \t]+\[([ xX])\][ \t]+(.+)$/gm)];
  return matches.map((match) => ({
    checked: match[1].toLowerCase() === "x",
    label: match[2].trim()
  }));
}

function stripHtmlComments(value) {
  return value.replace(/<!--[\s\S]*?-->/g, "").trim();
}

function hasMeaningfulNaReason(value) {
  return /^(n\/a|na|not applicable)\s*[-:—,]\s*\S.{2,}/i.test(value);
}

function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  if (templateOnlyValues.has(normalized)) return true;
  if (/^(n\/a|na|not applicable)$/i.test(value.trim())) return true;
  return false;
}

function validateField(violations, sectionName, sectionText, field) {
  const value = fieldValue(sectionText, field);
  if (isPlaceholder(value)) {
    violations.push(`${sectionName}: ${field} must be filled and cannot be a template placeholder.`);
    return "";
  }
  if (/^(n\/a|na|not applicable)/i.test(value) && !hasMeaningfulNaReason(value)) {
    violations.push(`${sectionName}: ${field} uses N/A without a reason.`);
  }
  return value;
}

function isFrontendFile(file) {
  return file.startsWith("apps/mobile/");
}

function isMigrationFile(file) {
  return file.startsWith("infra/db/migrations/");
}

function isBackendRuntimeFile(file) {
  return file.startsWith("services/core-api/WorkOS.Api/");
}

function isApiBoundarySensitiveFile(file) {
  return (
    file === "services/core-api/WorkOS.Api/Program.cs" ||
    /Endpoints\.cs$/i.test(file) ||
    file === "docs/contracts/workos-runtime.openapi.json" ||
    file === "apps/mobile/src/generated/runtimeApiPaths.js" ||
    file === "docs/rules/v5.5/api-boundary.yml"
  );
}

function isFactWriteSensitiveFile(file) {
  return (
    file.startsWith("services/core-api/WorkOS.Api/Runtime/") ||
    file.startsWith("services/core-api/WorkOS.Api/Slices/") ||
    file.startsWith("infra/db/migrations/") ||
    file === "docs/rules/v5.5/fact-ownership.yml"
  );
}

function hasCheckedItem(sectionText) {
  return checkboxes(sectionText).some((item) => item.checked);
}

function validateContract(body, changedFiles) {
  const violations = [];
  const sections = parseSections(body);

  for (const name of requiredSections) {
    if (!sections.has(name.toLowerCase())) {
      violations.push(`Missing required section: ${name}`);
    }
  }

  const summary = stripHtmlComments(section(sections, "Summary"));
  if (isPlaceholder(summary.replace(/\n/g, " ").trim())) {
    violations.push("Summary must describe the change and cannot be empty or '-'.");
  }

  const allCheckboxes = [...sections.values()].flatMap(checkboxes);
  if (allCheckboxes.length === 0) {
    violations.push("PR body must include contract checklist items.");
  } else if (allCheckboxes.every((item) => !item.checked)) {
    violations.push("At least one contract checkbox must be checked; all unchecked template bodies are not allowed.");
  }

  const mrContract = section(sections, "MR Contract");
  for (const field of requiredMrFields) {
    validateField(violations, "MR Contract", mrContract, field);
  }

  const tests = section(sections, "Tests");
  const testValues = new Map();
  for (const field of requiredTestFields) {
    testValues.set(field, validateField(violations, "Tests", tests, field));
  }

  const noGo = section(sections, "No-Go");
  for (const field of requiredRiskFields) {
    validateField(violations, "No-Go", noGo, field);
  }
  const noP0Checkbox = checkboxes(noGo).find((item) =>
    item.label.toLowerCase().includes("no p0 blocker")
  );
  if (!noP0Checkbox?.checked) {
    violations.push("No-Go: 'No P0 blocker is hidden, skipped, renamed, or downgraded.' must be checked.");
  }

  const changed = changedFiles.map((file) => file.replace(/\\/g, "/")).filter(Boolean);
  const changedFrontend = changed.some(isFrontendFile);
  const changedMigration = changed.some(isMigrationFile);
  const changedRuntime = changed.some(isBackendRuntimeFile);
  const changedApi = changed.some(isApiBoundarySensitiveFile);
  const changedFactWrite = changed.some(isFactWriteSensitiveFile);

  if (changedRuntime && isPlaceholder(fieldValue(mrContract, "Runtime Layer"))) {
    violations.push("Runtime Layer must be filled when backend runtime files changed.");
  }

  if (changedFrontend && isPlaceholder(testValues.get("Relevant frontend tests") ?? "")) {
    violations.push("Relevant frontend tests must be filled when apps/mobile files changed.");
  }

  if (changedMigration && isPlaceholder(testValues.get("Relevant migration or runtime contract tests") ?? "")) {
    violations.push("Relevant migration or runtime contract tests must be filled when infra/db/migrations changed.");
  }

  if (changedApi && !hasCheckedItem(section(sections, "API Boundary"))) {
    violations.push("API Boundary checklist must be checked when API route, OpenAPI, or generated runtime path files changed.");
  }

  if (changedFactWrite && !hasCheckedItem(section(sections, "Fact Ownership"))) {
    violations.push("Fact Ownership checklist must be checked when runtime, slice, migration, or fact ownership files changed.");
  }

  if (changedApi && isPlaceholder(fieldValue(mrContract, "Contract file"))) {
    violations.push("Contract file must be filled when API contract files changed.");
  }

  return violations;
}

async function changedFilesFromGitHubEvent(event) {
  const token = process.env.GITHUB_TOKEN;
  const repository = event.repository?.full_name;
  const number = event.pull_request?.number;
  if (!token || !repository || !number) {
    throw new Error("GitHub event mode requires GITHUB_TOKEN, repository.full_name, and pull_request.number to read changed files.");
  }

  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const files = [];
  for (let page = 1; page <= 30; page += 1) {
    const response = await fetch(`${apiUrl}/repos/${repository}/pulls/${number}/files?per_page=100&page=${page}`, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "User-Agent": "workos-pr-contract-check"
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to read PR changed files: HTTP ${response.status}`);
    }
    const batch = await response.json();
    files.push(...batch.map((file) => file.filename));
    if (batch.length < 100) break;
  }
  return files;
}

async function loadInput() {
  if (args.has("self-test")) return null;

  if (args.has("github-event")) {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) throw new Error("--github-event requires GITHUB_EVENT_PATH.");
    const event = JSON.parse(readText(eventPath));
    if (!event.pull_request) {
      return { body: "", changedFiles: [], skipped: "not a pull_request event" };
    }
    return {
      body: event.pull_request.body ?? "",
      changedFiles: await changedFilesFromGitHubEvent(event)
    };
  }

  const bodyFile = args.get("body-file");
  const body = bodyFile ? readText(bodyFile) : (args.get("body") ?? "");
  const changedFileInput = args.get("changed-files");
  const changedFiles = changedFileInput
    ? readText(changedFileInput).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : (args.get("changed-files-list") ?? "").split(",").map((line) => line.trim()).filter(Boolean);

  if (!body) {
    throw new Error("Provide --body-file, --body, --github-event, or --self-test.");
  }
  return { body, changedFiles };
}

function validBody(overrides = "") {
  return `## Summary

- Adds machine-enforced PR contract validation for governance closure.

## Rule Authority

- [x] I read docs/engineering/00-rule-authority.md.
- [x] I checked docs/rules/v5.5/rule-authority.yml for precedence.

## MR Contract

- MR: RF1
- Slice: Governance
- Runtime Layer: Rules OS / CI gate
- Owner: Platform Governance
- Contract file: docs/engineering/pr-contract-rules.md
- GateResult required: N/A - PR contract check does not generate release GateResult.
- Rollback / compensation instruction: Revert checker and workflow wiring if it blocks valid PRs.

## Fact Ownership

- [x] No business fact ownership changed.

## API Boundary

- [x] No API route changed.

## Idempotency

- [x] No runtime idempotency path changed.

## Evidence

- [x] Checker self-test is the RF1 evidence.

## Ledger

- [x] No ledger behavior changed.

## Process / Blocker

- [x] Empty PR bodies are blocked.

## Projection / Lens

- [x] No projection or lens behavior changed.

## Mobile

- [x] No mobile behavior changed.

## PC

- [x] No PC behavior changed.

## Migration / Release

- [x] No DB migration changed.

## Tests

- [x] node scripts/check-pr-contract.mjs --self-test
- Relevant backend tests: node scripts/check-pr-contract.mjs --self-test
- Relevant frontend tests: N/A - no frontend files changed.
- Relevant migration or runtime contract tests: N/A - no migration files changed.

## No-Go

- P0 risks: None - checker only tightens PR contract enforcement.
- P1 risks: False positives are possible and should be corrected in checker logic.
- P2 risks: Existing merged PRs are evidence for RF1 but are not rewritten.
- [x] No P0 blocker is hidden, skipped, renamed, or downgraded.
${overrides}`;
}

function runSelfTest() {
  const cases = [
    {
      name: "rejects empty template",
      body: readText(path.join(".github", "pull_request_template.md")),
      files: ["services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs"],
      shouldFail: true,
      includes: "Summary"
    },
    {
      name: "accepts filled docs-only contract",
      body: validBody(),
      files: ["docs/engineering/pr-contract-rules.md"],
      shouldFail: false
    },
    {
      name: "rejects frontend change without frontend tests",
      body: validBody(`
## Tests

- [x] node scripts/check-pr-contract.mjs --self-test
- Relevant backend tests: node scripts/check-pr-contract.mjs --self-test
- Relevant frontend tests:
- Relevant migration or runtime contract tests: N/A - no migration files changed.
`),
      files: ["apps/mobile/src/apiClient.js"],
      shouldFail: true,
      includes: "frontend tests"
    },
    {
      name: "rejects migration change without migration tests",
      body: validBody(`
## Tests

- [x] node scripts/check-pr-contract.mjs --self-test
- Relevant backend tests: node scripts/check-pr-contract.mjs --self-test
- Relevant frontend tests: N/A - no frontend files changed.
- Relevant migration or runtime contract tests:
`),
      files: ["infra/db/migrations/032_rule_fix.sql"],
      shouldFail: true,
      includes: "migration"
    },
    {
      name: "rejects API change without checked boundary",
      body: validBody().replace("- [x] No API route changed.", "- [ ] No API route changed."),
      files: ["services/core-api/WorkOS.Api/Program.cs"],
      shouldFail: true,
      includes: "API Boundary"
    },
    {
      name: "rejects fact write change without checked ownership",
      body: validBody().replace("- [x] No business fact ownership changed.", "- [ ] No business fact ownership changed."),
      files: ["services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs"],
      shouldFail: true,
      includes: "Fact Ownership"
    },
    {
      name: "rejects N/A without reason",
      body: validBody().replace("GateResult required: N/A - PR contract check does not generate release GateResult.", "GateResult required: N/A"),
      files: ["docs/engineering/pr-contract-rules.md"],
      shouldFail: true,
      includes: "GateResult required"
    }
  ];

  for (const testCase of cases) {
    const violations = validateContract(testCase.body, testCase.files);
    const failed = violations.length > 0;
    if (failed !== testCase.shouldFail) {
      fail(`PR contract self-test failed: ${testCase.name}`, violations.length > 0 ? violations : ["Expected failure but validation passed."]);
    }
    if (testCase.includes && !violations.some((violation) => violation.includes(testCase.includes))) {
      fail(`PR contract self-test did not produce expected violation: ${testCase.name}`, violations);
    }
  }

  console.log("PR contract self-test: PASS");
}

if (args.has("self-test")) {
  runSelfTest();
} else {
  const input = await loadInput();
  if (input?.skipped) {
    console.log(`PR contract check: SKIPPED (${input.skipped})`);
  } else {
    const violations = validateContract(input.body, input.changedFiles);
    if (violations.length > 0) {
      fail("PR contract check failed.", violations);
    }
    console.log("PR contract check: PASS");
  }
}
