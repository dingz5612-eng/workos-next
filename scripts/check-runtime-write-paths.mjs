import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const cli = parseArgs(process.argv.slice(2));

if (cli.has("self-test")) {
  runSelfTest();
  process.exit(0);
}

const sources = {
  ...readSources({
  "Program.cs": "services/core-api/WorkOS.Api/Program.cs",
  "OperationsRuntimeService.cs": "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "CanonicalOperationsApiService.cs": "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs",
  "WorkspaceCardCompatibilityAdapter.cs": "services/core-api/WorkOS.Api/Runtime/WorkspaceCardCompatibilityAdapter.cs",
  "OperationsRuntimeEndpoints.cs": "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeEndpoints.cs",
  "OperationsUnitOfWork.cs": "services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs"
  }),
  ...readOfficialRuntimeSources()
};

const violations = analyzeSources(sources);
if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`${violation.severity} ${violation.rule}: ${violation.message}`);
    if (violation.file) {
      console.error(`  at ${violation.file}${violation.line ? `:${violation.line}` : ""}`);
    }
  }
  process.exit(1);
}

console.log("Runtime write path guard: PASS");

function analyzeSources(files) {
  const violations = [];
  const add = (rule, message, file, line, severity = "P0") =>
    violations.push({ rule, message, file, line, severity });

  const operationsRuntime = files["OperationsRuntimeService.cs"] ?? "";
  const canonical = files["CanonicalOperationsApiService.cs"] ?? "";
  const adapter = files["WorkspaceCardCompatibilityAdapter.cs"] ?? "";
  const endpoints = files["OperationsRuntimeEndpoints.cs"] ?? "";
  const program = files["Program.cs"] ?? "";
  const unitOfWork = files["OperationsUnitOfWork.cs"] ?? "";
  const operationsRuntimeCore = operationsRuntime.split("public sealed class ProjectionOperationsRuntimeAdapter")[0] ?? operationsRuntime;

  for (const [file, source] of Object.entries(files)) {
    if (!isOfficialRuntimeSource(file)) continue;
    forbidPattern(
      source,
      /\bshadow_runtime\b/i,
      "RT1-NO-SHADOW-RUNTIME-OFFICIAL",
      "Official API runtime source must not reference shadow_runtime; keep shadow reads/writes in shadow runner/tooling.",
      file,
      add);
  }

  forbidPattern(
    operationsRuntimeCore,
    /\bpublic\s+ConfirmWorkItemResult\s+ConfirmWorkItem\s*\(/,
    "RT1-RUNTIME-SERVICE-CONFIRM",
    "OperationsRuntimeService must not expose a formal confirm entry point; use CanonicalOperationsApiService.",
    "OperationsRuntimeService.cs",
    add);
  forbidPattern(
    operationsRuntimeCore,
    /\bpublic\s+CompatibilityApiResult\s+ConfirmWorkspaceCard\s*\(/,
    "RT1-RUNTIME-SERVICE-COMPAT-CONFIRM",
    "OperationsRuntimeService must not own the legacy Workspace/Card confirm path; use WorkspaceCardCompatibilityAdapter.",
    "OperationsRuntimeService.cs",
    add);
  forbidPattern(
    operationsRuntimeCore,
    /\bruntime\.Prepare\s*\(/,
    "RT1-RUNTIME-DIRECT-PREPARE",
    "OperationsRuntimeService must not call runtime.Prepare; compatibility prepare must derive its payload from the resolved Operation target.",
    "OperationsRuntimeService.cs",
    add);
  forbidPattern(
    operationsRuntimeCore,
    /\bruntime\.Confirm\s*\(/,
    "RT1-RUNTIME-DIRECT-CONFIRM",
    "OperationsRuntimeService must not call runtime.Confirm for formal fact commit.",
    "OperationsRuntimeService.cs",
    add);

  requirePattern(
    canonical,
    /private\s+readonly\s+OperationsUnitOfWork\s+unitOfWork;/,
    "RT1-CANONICAL-UOW-FIELD",
    "CanonicalOperationsApiService must own the OperationsUnitOfWork dependency.",
    "CanonicalOperationsApiService.cs",
    add);
  requirePattern(
    canonical,
    /\bunitOfWork\.Commit\s*\(/,
    "RT1-CANONICAL-UOW-COMMIT",
    "CanonicalOperationsApiService.ConfirmWorkItem must commit through OperationsUnitOfWork.",
    "CanonicalOperationsApiService.cs",
    add);
  requirePattern(
    canonical,
    /catalog\.RecordWorkItemTransition\s*\(/,
    "RT1-WORKITEM-LIFECYCLE",
    "Canonical confirm must record WorkItem lifecycle transition after committed UoW result.",
    "CanonicalOperationsApiService.cs",
    add);

  requirePattern(
    adapter,
    /\boperations\.ConfirmWorkItem\s*\(/,
    "RT1-COMPAT-ADAPTER-CANONICAL",
    "WorkspaceCardCompatibilityAdapter must forward old confirm to canonical operations.",
    "WorkspaceCardCompatibilityAdapter.cs",
    add);
  forbidPattern(
    adapter,
    /\bruntime\.Confirm\s*\(/,
    "RT1-COMPAT-ADAPTER-NO-RUNTIME-CONFIRM",
    "WorkspaceCardCompatibilityAdapter must not call legacy runtime.Confirm.",
    "WorkspaceCardCompatibilityAdapter.cs",
    add);

  requirePattern(
    endpoints,
    /MapPost\("\/api\/operations\/work-items\/\{workItemId\}\/confirm"[\s\S]*CanonicalOperationsApiService\s+operations[\s\S]*operations\.ConfirmWorkItem\s*\(/,
    "RT1-OPERATIONS-ENDPOINT-CANONICAL",
    "Operations confirm endpoint must use CanonicalOperationsApiService.",
    "OperationsRuntimeEndpoints.cs",
    add);
  requirePattern(
    program,
    /MapPost\("\/api\/workspaces\/\{workspaceId\}\/cards\/\{cardId\}\/confirm"[\s\S]*WorkspaceCardCompatibilityAdapter\s+operations[\s\S]*operations\.ConfirmWorkspaceCard\s*\(/,
    "RT1-LEGACY-ENDPOINT-ADAPTER",
    "Legacy Workspace/Card confirm route must be a compatibility adapter, not a fact write path.",
    "Program.cs",
    add);

  requirePattern(
    unitOfWork,
    /new\s+OperationsDomainEvent\([\s\S]*request\.WorkItemId/,
    "RT1-DOMAIN-EVENT-WORKITEM-REF",
    "DomainEvent materialization must reference the real WorkItemId.",
    "OperationsUnitOfWork.cs",
    add);
  requirePattern(
    unitOfWork,
    /OperationsCommandSubmission\.Pending\([\s\S]*envelope\)/,
    "RT1-SUBMISSION-WORKITEM-REF",
    "CommandSubmission must be started with the real WorkItemId.",
    "OperationsUnitOfWork.cs",
    add);
  requirePattern(
    unitOfWork,
    /GetFactTraceBySubmission\s*\(/,
    "RT1-TRACE-BY-SUBMISSION",
    "FactTrace store must resolve trace by CommandSubmission.",
    "OperationsUnitOfWork.cs",
    add);
  requirePattern(
    unitOfWork,
    /GetFactTracesByWorkItem\s*\(/,
    "RT1-TRACE-BY-WORKITEM",
    "FactTrace store must resolve traces by WorkItem.",
    "OperationsUnitOfWork.cs",
    add);
  requirePattern(
    unitOfWork,
    /GetFactTracesByCase\s*\(/,
    "RT1-TRACE-BY-CASE",
    "FactTrace store must resolve traces by OperationCase.",
    "OperationsUnitOfWork.cs",
    add);

  return violations;
}

function forbidPattern(source, pattern, rule, message, file, add) {
  const match = pattern.exec(source);
  if (match) {
    add(rule, message, file, lineFor(source, match.index));
  }
}

function requirePattern(source, pattern, rule, message, file, add) {
  const match = pattern.exec(source);
  if (!match) {
    add(rule, message, file);
  }
}

function readSources(entries) {
  const result = {};
  for (const [name, relativePath] of Object.entries(entries)) {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Required runtime write path source is missing: ${relativePath}`);
    }
    result[name] = fs.readFileSync(fullPath, "utf8");
  }
  return result;
}

function readOfficialRuntimeSources() {
  const apiRoot = path.join(repoRoot, "services", "core-api", "WorkOS.Api");
  return Object.fromEntries(listCsFiles(apiRoot).map((file) => [
    path.relative(repoRoot, file).replaceAll("\\", "/"),
    fs.readFileSync(file, "utf8")
  ]));
}

function listCsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === "bin" || item.name === "obj") continue;
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...listCsFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith(".cs")) {
      files.push(fullPath);
    }
  }
  return files;
}

function isOfficialRuntimeSource(file) {
  return file.startsWith("services/core-api/WorkOS.Api/") && file.endsWith(".cs");
}

function lineFor(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function runSelfTest() {
  const valid = {
    "OperationsRuntimeService.cs": "public sealed class OperationsRuntimeService { public PrepareWorkItemResult? PrepareWorkItem() => null; }",
    "CanonicalOperationsApiService.cs": "private readonly OperationsUnitOfWork unitOfWork; void Confirm(){ var commit = unitOfWork.Commit(command); catalog.RecordWorkItemTransition(); }",
    "WorkspaceCardCompatibilityAdapter.cs": "void Confirm(){ operations.ConfirmWorkItem(); }",
    "OperationsRuntimeEndpoints.cs": "app.MapPost(\"/api/operations/work-items/{workItemId}/confirm\", (string workItemId, ConfirmWorkItemRequest request, CanonicalOperationsApiService operations) => { operations.ConfirmWorkItem(workItemId, request, token, requestId); });",
    "Program.cs": "app.MapPost(\"/api/workspaces/{workspaceId}/cards/{cardId}/confirm\", (string workspaceId, string cardId, ConfirmCardRequest request, WorkspaceCardCompatibilityAdapter operations) => { operations.ConfirmWorkspaceCard(workspaceId, cardId, request, token, requestId); });",
    "OperationsUnitOfWork.cs": "void Commit(){ var submission = OperationsCommandSubmission.Pending(\"cmd\", scope, envelope); var e = new OperationsDomainEvent(request.WorkItemId); } FactTrace GetFactTraceBySubmission(){} IReadOnlyList<FactTrace> GetFactTracesByWorkItem(){} IReadOnlyList<FactTrace> GetFactTracesByCase(){}",
    "services/core-api/WorkOS.Api/Runtime/OfficialSource.cs": "public sealed class OfficialSource {}"
  };
  assertNoViolations("valid runtime write path", analyzeSources(valid));

  assertViolation("direct runtime confirm rejected", {
    ...valid,
    "OperationsRuntimeService.cs": "public ConfirmWorkItemResult ConfirmWorkItem(){ runtime.Confirm(); }"
  }, "RT1-RUNTIME-DIRECT-CONFIRM");

  assertViolation("direct runtime prepare rejected", {
    ...valid,
    "OperationsRuntimeService.cs": "public PrepareWorkItemResult PrepareWorkItem(){ runtime.Prepare(); }"
  }, "RT1-RUNTIME-DIRECT-PREPARE");

  assertViolation("official shadow runtime reference rejected", {
    ...valid,
    "services/core-api/WorkOS.Api/Runtime/OfficialSource.cs": "const string Schema = \"shadow_runtime\";"
  }, "RT1-NO-SHADOW-RUNTIME-OFFICIAL");

  assertViolation("compat adapter bypass rejected", {
    ...valid,
    "WorkspaceCardCompatibilityAdapter.cs": "void Confirm(){ runtime.Confirm(); }"
  }, "RT1-COMPAT-ADAPTER-CANONICAL");

  assertViolation("missing work item trace rejected", {
    ...valid,
    "OperationsUnitOfWork.cs": "void Commit(){ var submission = OperationsCommandSubmission.Pending(\"cmd\", scope, envelope); var e = new OperationsDomainEvent(request.WorkItemId); } FactTrace GetFactTraceBySubmission(){} IReadOnlyList<FactTrace> GetFactTracesByCase(){}"
  }, "RT1-TRACE-BY-WORKITEM");

  console.log("Runtime write path guard self-test: PASS");
}

function assertNoViolations(name, violations) {
  if (violations.length > 0) {
    throw new Error(`${name} should pass, got ${violations.map((item) => item.rule).join(", ")}`);
  }
}

function assertViolation(name, sources, expectedRule) {
  const violations = analyzeSources(sources);
  if (!violations.some((item) => item.rule === expectedRule)) {
    throw new Error(`${name} should fail with ${expectedRule}, got ${violations.map((item) => item.rule).join(", ") || "none"}`);
  }
}

function parseArgs(argv) {
  const flags = new Set();
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      flags.add(arg.slice(2));
    }
  }
  return {
    has: (name) => flags.has(name)
  };
}
