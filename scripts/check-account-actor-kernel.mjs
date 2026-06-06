import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const selfTest = process.argv.includes("--self-test");
const contractPath = "docs/contracts/account-actor-kernel/account-actor-kernel-contract.json";
const contract = readJson(contractPath);
const oam = readJson("docs/contracts/oam.current.json");
const identityModule = readJson("modules/identity/oam-module.manifest.json");
const openApi = readJson("docs/contracts/workos-runtime.openapi.json");

if (selfTest) {
  const bad = structuredClone(contract);
  bad.login.allowedInputFields.push("role");
  const badFailures = runChecks(bad);
  if (!badFailures.some((item) => item.id === "contract.login_forbidden")) {
    throw new Error("Account Actor Kernel self-test did not detect login authority self-assignment.");
  }
  console.log("Account Actor Kernel self-test: PASS");
}

const violations = runChecks(contract);
writeReport(violations);

if (violations.length) {
  for (const item of violations) {
    console.error(`${item.id}: ${item.message}`);
  }
  throw new Error("Account Actor Kernel check failed.");
}

console.log("Account Actor Kernel check: PASS");

function runChecks(targetContract) {
  const violations = [];
  validateContract(targetContract, violations);
  validateOamBinding(violations);
  validateBackendTruth(violations);
  validateFrontendLogin(violations);
  validatePcGovernance(violations);
  validateApiContracts(violations);
  validateCiBinding(violations);
  return violations;
}

function validateContract(targetContract, violations) {
  if (targetContract.version !== "account-actor-kernel.v1") {
    fail(violations, "contract.version", "Account Actor Kernel contract version must be account-actor-kernel.v1.");
  }
  if (targetContract.architecture !== "Operations Management Architecture") {
    fail(violations, "contract.architecture", "Account Actor Kernel must bind to current OAM.");
  }
  for (const table of ["account_users", "account_audit_events", "runtime_sessions", "device_sessions"]) {
    requireArrayIncludes(targetContract.backendTruthObjects, table, "contract.backend_truth", violations);
  }
  for (const field of ["username", "displayName", "department", "businessLine", "roles", "capabilities", "status", "passwordHash", "tenantId"]) {
    requireArrayIncludes(targetContract.accountFields, field, "contract.account_fields", violations);
  }
  const allowedLogin = targetContract.login?.allowedInputFields || [];
  if (allowedLogin.length !== 2 || !allowedLogin.includes("username") || !allowedLogin.includes("password")) {
    fail(violations, "contract.login_fields", "Login may only accept username and password.");
  }
  for (const field of ["department", "businessLine", "role", "capability", "tenant", "deviceTrust"]) {
    requireArrayIncludes(targetContract.login?.forbiddenSelfAssignedFields, field, "contract.login_forbidden", violations);
    if (allowedLogin.includes(field)) {
      fail(violations, "contract.login_forbidden", `Login must not accept self-assigned authority field ${field}.`);
    }
  }
  for (const capability of ["account.user.manage", "pc.governance.admin"]) {
    requireArrayIncludes(targetContract.pcGovernance?.requiredCapabilities, capability, "contract.pc_capability", violations);
  }
  if (!String(targetContract.developmentIsolation?.productionLikeRequirement || "").includes("account_users") ||
      !String(targetContract.developmentIsolation?.productionLikeRequirement || "").includes("pbkdf2-sha256")) {
    fail(violations, "contract.production_requirement", "Production-like requirement must name account_users and pbkdf2-sha256.");
  }
}

function validateOamBinding(violations) {
  const identityCapability = oam.productCapabilities?.find((item) => item.id === "identity.account-actor");
  if (!identityCapability || identityCapability.module !== "identity") {
    fail(violations, "oam.identity_capability", "OAM contract must bind identity.account-actor to identity module.");
  }
  for (const capability of ["identity.account-actor", "governance.release-control"]) {
    requireArrayIncludes(identityModule.productCapability, capability, "module.identity_capability", violations);
  }
  for (const table of ["account_users", "account_audit_events", "runtime_sessions", "device_sessions"]) {
    requireArrayIncludes(identityModule.database, table, "module.identity_database", violations);
  }
}

function validateBackendTruth(violations) {
  const migration = read("infra/db/migrations/040_account_actor_kernel.sql");
  for (const token of [
    "create table if not exists account_users",
    "password_hash text not null",
    "capabilities jsonb not null",
    "development_only boolean not null",
    "create table if not exists account_audit_events"
  ]) {
    requireIncludes(migration, token, "backend.migration", `Account migration missing ${token}.`, violations);
  }

  const storage = read("services/core-api/WorkOS.Api/Runtime/AccountActorKernelStorage.cs");
  for (const token of [
    "RuntimePasswordHasher.Pbkdf2Sha256",
    "where account_users.development_only = true",
    "AccountUserCreated",
    "AccountUserDisabled",
    "AccountUserPasswordReset",
    "account_tenant_mismatch",
    "actor.TenantId"
  ]) {
    requireIncludes(storage, token, "backend.storage", `Account storage missing ${token}.`, violations);
  }

  const authSession = read("services/core-api/WorkOS.Api/Runtime/AuthSessionService.cs");
  for (const token of ["FindUserCredentialByUsername", "authOptions.AllowDevelopmentAccounts", "user.EffectiveCapabilities", "store.CreateSession(user)"]) {
    requireIncludes(authSession, token, "backend.login", `Login service missing ${token}.`, violations);
  }

  const actorAuth = read("services/core-api/WorkOS.Api/Runtime/RuntimeActorAuthentication.cs");
  for (const token of [
    "user.EffectiveCapabilities",
    "operations_confirm_policy_required",
    "search_read_policy_required",
    "account_user_manage_policy_required",
    "\"/api/pc-governance/account-users\"",
    "\"/api/pc-governance/account-audit\"",
    "admin.device_session.revoke"
  ]) {
    requireIncludes(actorAuth, token, "backend.admission", `Runtime auth/admission missing ${token}.`, violations);
  }

  const startup = read("services/core-api/WorkOS.Api/Runtime/RuntimeStartupValidator.cs");
  for (const table of ["account_users", "account_audit_events", "runtime_sessions", "device_sessions"]) {
    requireIncludes(startup, `"${table}"`, "backend.readiness", `Runtime readiness missing ${table}.`, violations);
  }
  const developmentSettings = read("services/core-api/WorkOS.Api/appsettings.Development.json");
  requireIncludes(developmentSettings, "\"AllowDevelopmentAccounts\": true", "backend.dev_config", "Development settings must explicitly enable development-only accounts.", violations);
}

function validateFrontendLogin(violations) {
  const loginView = read("apps/mobile/src/views/loginView.js");
  requireIncludes(loginView, "id=\"loginAccount\"", "frontend.login", "Login view must expose username input.", violations);
  requireIncludes(loginView, "id=\"loginPassword\"", "frontend.login", "Login view must expose password input.", violations);
  for (const token of ["loginDepartment", "loginRole", "login-account-hints", "frontdeskAccount", "operatorAccount", "financeAccount"]) {
    forbidIncludes(loginView, token, "frontend.login_forbidden", `Login view must not expose self-assigned authority token ${token}.`, violations);
  }

  const operationCopy = read("apps/mobile/src/i18n/operationCopy.js");
  requireIncludes(operationCopy, "部门、业务线、角色和权限由管理员在 PC 治理面分配", "frontend.copy", "Chinese login copy must say authority is assigned in PC governance.", violations);

  const authController = read("apps/mobile/src/authController.js");
  for (const token of ["#loginAccount", "#loginPassword", "registerDeviceSession", "logoutActor"]) {
    requireIncludes(authController, token, "frontend.auth_controller", `Auth controller missing ${token}.`, violations);
  }
  for (const token of ["#loginDepartment", "session.department =", "session.role =", "session.capabilities ="]) {
    forbidIncludes(authController, token, "frontend.auth_forbidden", `Auth controller must not self-assign session authority: ${token}.`, violations);
  }
}

function validatePcGovernance(violations) {
  const view = read("apps/mobile/src/views/pcGovernanceView.js");
  for (const token of ["data-account-user-management", "data-account-user-create", "data-account-user-disable", "data-account-password-reset", "account.user.manage"]) {
    requireIncludes(view, token, "frontend.pc_governance", `PC account governance view missing ${token}.`, violations);
  }
  for (const token of ["data-account-role-select", "data-account-capability", "account-capability-grid"]) {
    requireIncludes(view, token, "frontend.pc_authority_controls", `PC account governance must use governed role/capability controls: ${token}.`, violations);
  }
  forbidIncludes(view, "<input id=\"accountRoles\"", "frontend.pc_freeform_role", "PC account role assignment must be a governed select, not a free-text input.", violations);
  forbidIncludes(view, "id=\"accountCapabilities\"", "frontend.pc_freeform_capability", "PC account capability assignment must use governed checkboxes, not a free-text field.", violations);

  const controller = read("apps/mobile/src/pcGovernanceController.js");
  for (const token of ["createAccountUser", "disableAccountUser", "resetAccountUserPassword", "fetchAccountAudit", "ctx.state.currentActor?.tenantId", "capabilitiesForAccountRole", "selectedAccountCapabilities", "data-account-capability"]) {
    requireIncludes(controller, token, "frontend.pc_controller", `PC governance controller missing ${token}.`, violations);
  }
  forbidIncludes(controller, "splitCsv", "frontend.pc_authority_csv", "PC account authority assignment must not parse free-text comma-separated roles or capabilities.", violations);

  const catalog = read("apps/mobile/src/accountGovernanceCatalog.js");
  for (const token of ["accountRoleOptions", "accountCapabilityOptions", "capabilitiesForAccountRole", "operations.confirm", "account.user.manage"]) {
    requireIncludes(catalog, token, "frontend.pc_authority_catalog", `Account governance catalog missing ${token}.`, violations);
  }
}

function validateApiContracts(violations) {
  for (const route of [
    "/api/auth/logout",
    "/api/device-sessions",
    "/api/device-sessions/{deviceId}/revoke",
    "/api/pc-governance/account-users",
    "/api/pc-governance/account-users/{userId}/disable",
    "/api/pc-governance/account-users/{userId}/reset-password",
    "/api/pc-governance/account-audit"
  ]) {
    if (!openApi.paths?.[route]) fail(violations, "api.openapi", `OpenAPI missing ${route}.`);
  }

  const writeRoutes = oam.apiBoundary?.writeRoutes || {};
  for (const route of [
    "POST /api/auth/logout",
    "POST /api/device-sessions",
    "POST /api/device-sessions/{deviceId}/revoke",
    "POST /api/pc-governance/account-users",
    "POST /api/pc-governance/account-users/{userId}/disable",
    "POST /api/pc-governance/account-users/{userId}/reset-password"
  ]) {
    const present = Object.values(writeRoutes).some((routes) => Array.isArray(routes) && routes.includes(route));
    if (!present) fail(violations, "api.oam_boundary", `OAM API boundary missing ${route}.`);
  }

  const runtimeApiPaths = read("apps/mobile/src/generated/runtimeApiPaths.js");
  for (const key of ["logout", "deviceSessions", "revokeDeviceSession", "accountUsers", "accountUserDisable", "accountUserResetPassword", "accountAudit"]) {
    requireIncludes(runtimeApiPaths, `${key}:`, "api.generated_paths", `Generated runtime API paths missing ${key}.`, violations);
  }
}

function validateCiBinding(violations) {
  const guard = read("scripts/guard-architecture.ps1");
  requireIncludes(guard, "scripts/check-account-actor-kernel.mjs", "ci.guard", "Architecture guard must run Account Actor Kernel check.", violations);
  const ci = read(".github/workflows/ci.yml");
  requireIncludes(ci, "scripts/check-account-actor-kernel.mjs", "ci.workflow", "CI must run Account Actor Kernel check.", violations);
}

function requireArrayIncludes(values, expected, id, violations) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    fail(violations, id, `Expected array to include ${expected}.`);
  }
}

function requireIncludes(source, token, id, message, violations) {
  if (!source.includes(token)) fail(violations, id, message);
}

function forbidIncludes(source, token, id, message, violations) {
  if (source.includes(token)) fail(violations, id, message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function fail(violations, id, message) {
  violations.push({ id, message });
}

function writeReport(violations) {
  const outPath = path.join(root, "artifacts", "oam", "checks", "account-actor-kernel-result.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({
    status: violations.length ? "failed" : "passed",
    checkedAtUtc: new Date().toISOString(),
    contractId: contract.contractId,
    violations
  }, null, 2));
}
