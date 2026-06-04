import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const cli = parseArgs(process.argv.slice(2));

if (cli.has("self-test")) {
  runSelfTest();
  process.exit(0);
}

const sources = readSources({
  "Program.cs": "services/core-api/WorkOS.Api/Program.cs",
  "OperationsRuntimeService.cs": "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
  "CanonicalOperationsApiService.cs": "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs",
  "OperationsRuntimeEndpoints.cs": "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeEndpoints.cs",
  "OperationsUnitOfWork.cs": "services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs",
  "OpenAPI": "docs/contracts/workos-runtime.openapi.json"
});

const violations = analyzeSources({
  ...sources,
  ...readOfficialRuntimeSources()
});

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`${violation.severity} ${violation.rule}: ${violation.message}`);
    if (violation.file) console.error(`  at ${violation.file}${violation.line ? `:${violation.line}` : ""}`);
  }
  process.exit(1);
}

console.log("Runtime write path guard: PASS");

function analyzeSources(files) {
  const violations = [];
  const add = (rule, message, file, line, severity = "P0") =>
    violations.push({ rule, message, file, line, severity });

  const program = files["Program.cs"] ?? "";
  const operationsRuntime = files["OperationsRuntimeService.cs"] ?? "";
  const canonical = files["CanonicalOperationsApiService.cs"] ?? "";
  const endpoints = files["OperationsRuntimeEndpoints.cs"] ?? "";
  const unitOfWork = files["OperationsUnitOfWork.cs"] ?? "";
  const openApi = files.OpenAPI ?? "";
  const operationsRuntimeCore = operationsRuntime.split("public sealed class ProjectionOperationsRuntimeAdapter")[0] ?? operationsRuntime;

  for (const [file, source] of Object.entries(files)) {
    if (!isOfficialRuntimeSource(file)) continue;
    forbidPattern(source, /\bshadow_runtime\b/i, "RT1-NO-SHADOW-RUNTIME-OFFICIAL", "Official API runtime source must not reference shadow_runtime.", file, add);
  }

  const retiredWrites = [
    "/api/workspaces/resource-setup/start",
    "/api/workspaces/start",
    "/api/workspaces/{workspaceId}/cards/{cardId}/prepare",
    "/api/workspaces/{workspaceId}/cards/{cardId}/confirm"
  ];
  for (const retired of retiredWrites) {
    forbidLiteral(program, retired, "RT1-RETIRED-WORKSPACE-COMPAT-ENDPOINT", "Retired Workspace/Card compatibility write endpoint must not be mapped.", "Program.cs", add);
    forbidLiteral(openApi, retired, "RT1-RETIRED-WORKSPACE-COMPAT-CONTRACT", "Retired Workspace/Card compatibility write endpoint must not be declared in OpenAPI.", "OpenAPI", add);
  }

  if (fs.existsSync(path.join(repoRoot, "services", "core-api", "WorkOS.Api", "Runtime", "WorkspaceCardCompatibilityAdapter.cs"))) {
    add("RT1-COMPAT-ADAPTER-DELETED", "WorkspaceCardCompatibilityAdapter.cs must be deleted; Operations Runtime is the only write path.", "WorkspaceCardCompatibilityAdapter.cs");
  }

  forbidPattern(operationsRuntimeCore, /\bCompatibilityApiResult\b/, "RT1-NO-COMPAT-RESULT", "OperationsRuntimeService must not expose compatibility API result types.", "OperationsRuntimeService.cs", add);
  forbidPattern(operationsRuntimeCore, /\bPrepareWorkspaceCard\b|\bConfirmWorkspaceCard\b|ValidateWorkspaceCardConfirmPolicy\b/, "RT1-NO-WORKSPACE-CARD-WRITE-FACADE", "OperationsRuntimeService must not expose Workspace/Card write facades.", "OperationsRuntimeService.cs", add);
  forbidPattern(operationsRuntimeCore, /\bruntime\.Prepare\s*\(/, "RT1-RUNTIME-DIRECT-PREPARE", "OperationsRuntimeService must not call runtime.Prepare.", "OperationsRuntimeService.cs", add);
  forbidPattern(operationsRuntimeCore, /\bruntime\.Confirm\s*\(/, "RT1-RUNTIME-DIRECT-CONFIRM", "OperationsRuntimeService must not call runtime.Confirm for formal fact commit.", "OperationsRuntimeService.cs", add);
  forbidPattern(operationsRuntimeCore, /ResolveWorkspaceCard\([^)]*request\.WorkspaceId|SplitWorkItemId|ToCompatibilityWorkItem|compatibilityRoute|workspace-card/i, "RT1-NO-WORKSPACE-CARD-IDENTITY-FALLBACK", "Operations Runtime must not derive WorkItem identity from Workspace/Card compatibility inputs.", "OperationsRuntimeService.cs", add);

  requirePattern(canonical, /private\s+readonly\s+OperationsUnitOfWork\s+unitOfWork;/, "RT1-CANONICAL-UOW-FIELD", "CanonicalOperationsApiService must own the OperationsUnitOfWork dependency.", "CanonicalOperationsApiService.cs", add);
  requirePattern(canonical, /\bunitOfWork\.Commit\s*\(/, "RT1-CANONICAL-UOW-COMMIT", "CanonicalOperationsApiService.ConfirmWorkItem must commit through OperationsUnitOfWork.", "CanonicalOperationsApiService.cs", add);
  requirePattern(canonical, /catalog\.RecordWorkItemTransition\s*\(/, "RT1-WORKITEM-LIFECYCLE", "Canonical confirm must record WorkItem lifecycle transition after committed UoW result.", "CanonicalOperationsApiService.cs", add);
  requirePattern(canonical, /StartWorkspaceCase\([\s\S]*CreateCase[\s\S]*CreateWorkItem/, "RT1-START-CREATES-CASE-WORKITEM", "Operations workspace start must create OperationCase and WorkItem through the runtime catalog.", "CanonicalOperationsApiService.cs", add);

  requirePattern(endpoints, /MapPost\("\/api\/operations\/work-items\/\{workItemId\}\/confirm"[\s\S]*CanonicalOperationsApiService\s+operations[\s\S]*operations\.ConfirmWorkItem\s*\(/, "RT1-OPERATIONS-ENDPOINT-CANONICAL", "Operations confirm endpoint must use CanonicalOperationsApiService.", "OperationsRuntimeEndpoints.cs", add);
  requirePattern(program, /MapPost\("\/api\/operations\/workspaces\/start"[\s\S]*StartOperationsWorkspace\s*\(/, "RT1-OPERATIONS-START-ENDPOINT", "Dormitory workspace start must use the Operations Runtime start endpoint.", "Program.cs", add);

  requirePattern(unitOfWork, /new\s+OperationsDomainEvent\([\s\S]*request\.WorkItemId/, "RT1-DOMAIN-EVENT-WORKITEM-REF", "DomainEvent materialization must reference the real WorkItemId.", "OperationsUnitOfWork.cs", add);
  requirePattern(unitOfWork, /OperationsCommandSubmission\.Pending\([\s\S]*envelope\)/, "RT1-SUBMISSION-WORKITEM-REF", "CommandSubmission must be started with the real WorkItemId.", "OperationsUnitOfWork.cs", add);
  requirePattern(unitOfWork, /GetFactTraceBySubmission\s*\(/, "RT1-TRACE-BY-SUBMISSION", "FactTrace store must resolve trace by CommandSubmission.", "OperationsUnitOfWork.cs", add);
  requirePattern(unitOfWork, /GetFactTracesByWorkItem\s*\(/, "RT1-TRACE-BY-WORKITEM", "FactTrace store must resolve traces by WorkItem.", "OperationsUnitOfWork.cs", add);
  requirePattern(unitOfWork, /GetFactTracesByCase\s*\(/, "RT1-TRACE-BY-CASE", "FactTrace store must resolve traces by OperationCase.", "OperationsUnitOfWork.cs", add);

  return violations;
}

function forbidLiteral(source, literal, rule, message, file, add) {
  const index = source.indexOf(literal);
  if (index >= 0) add(rule, message, file, lineFor(source, index));
}

function forbidPattern(source, pattern, rule, message, file, add) {
  const match = pattern.exec(source);
  if (match) add(rule, message, file, lineFor(source, match.index));
}

function requirePattern(source, pattern, rule, message, file, add) {
  if (!pattern.test(source)) add(rule, message, file);
}

function readSources(entries) {
  const result = {};
  for (const [name, relativePath] of Object.entries(entries)) {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) throw new Error(`Required runtime write path source is missing: ${relativePath}`);
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
    if (item.isDirectory()) files.push(...listCsFiles(fullPath));
    else if (item.isFile() && item.name.endsWith(".cs")) files.push(fullPath);
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
    "Program.cs": "app.MapPost(\"/api/operations/workspaces/start\", () => StartOperationsWorkspace());",
    "OperationsRuntimeService.cs": "public sealed class OperationsRuntimeService { public PrepareWorkItemResult? PrepareWorkItem() => null; } public sealed class ProjectionOperationsRuntimeAdapter {}",
    "CanonicalOperationsApiService.cs": "private readonly OperationsUnitOfWork unitOfWork; void StartWorkspaceCase(){ CreateCase(); CreateWorkItem(); } void Confirm(){ var commit = unitOfWork.Commit(command); catalog.RecordWorkItemTransition(); }",
    "OperationsRuntimeEndpoints.cs": "app.MapPost(\"/api/operations/work-items/{workItemId}/confirm\", (string workItemId, ConfirmWorkItemRequest request, CanonicalOperationsApiService operations) => { operations.ConfirmWorkItem(workItemId, request, actor, requestId); });",
    "OperationsUnitOfWork.cs": "void Commit(){ var submission = OperationsCommandSubmission.Pending(\"cmd\", scope, envelope); var e = new OperationsDomainEvent(request.WorkItemId); } FactTrace GetFactTraceBySubmission(){} IReadOnlyList<FactTrace> GetFactTracesByWorkItem(){} IReadOnlyList<FactTrace> GetFactTracesByCase(){}",
    "OpenAPI": "{\"paths\":{\"/api/operations/work-items/{workItemId}/confirm\":{},\"/api/operations/workspaces/start\":{}}}",
    "services/core-api/WorkOS.Api/Runtime/OfficialSource.cs": "public sealed class OfficialSource {}"
  };
  assertNoViolations("valid runtime write path", analyzeSources(valid));

  assertViolation("retired endpoint rejected", { ...valid, "Program.cs": "app.MapPost(\"/api/workspaces/start\", () => {});" }, "RT1-RETIRED-WORKSPACE-COMPAT-ENDPOINT");
  assertViolation("retired OpenAPI rejected", { ...valid, "OpenAPI": "{\"paths\":{\"/api/workspaces/{workspaceId}/cards/{cardId}/confirm\":{}}}" }, "RT1-RETIRED-WORKSPACE-COMPAT-CONTRACT");
  assertViolation("direct runtime confirm rejected", { ...valid, "OperationsRuntimeService.cs": "public sealed class OperationsRuntimeService { void X(){ runtime.Confirm(); } } public sealed class ProjectionOperationsRuntimeAdapter {}" }, "RT1-RUNTIME-DIRECT-CONFIRM");
  assertViolation("workspace card fallback rejected", { ...valid, "OperationsRuntimeService.cs": "public sealed class OperationsRuntimeService { void X(){ SplitWorkItemId(id); } } public sealed class ProjectionOperationsRuntimeAdapter {}" }, "RT1-NO-WORKSPACE-CARD-IDENTITY-FALLBACK");
  assertViolation("official shadow runtime reference rejected", { ...valid, "services/core-api/WorkOS.Api/Runtime/OfficialSource.cs": "const string Schema = \"shadow_runtime\";" }, "RT1-NO-SHADOW-RUNTIME-OFFICIAL");

  console.log("Runtime write path guard self-test: PASS");
}

function assertNoViolations(name, violations) {
  if (violations.length > 0) throw new Error(`${name} should pass, got ${violations.map((item) => item.rule).join(", ")}`);
}

function assertViolation(name, sources, expectedRule) {
  const violations = analyzeSources(sources);
  if (!violations.some((item) => item.rule === expectedRule)) {
    throw new Error(`${name} should fail with ${expectedRule}, got ${violations.map((item) => item.rule).join(", ") || "none"}`);
  }
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2)));
  return { has: (name) => flags.has(name) };
}
