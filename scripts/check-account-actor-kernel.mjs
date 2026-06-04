import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = "docs/contracts/account-actor-kernel/account-actor-kernel-contract.json";
const contract = readJson(contractPath);
const violations = [];

validateContract();
validateBackendTruth();
validateFrontendLogin();
validatePcGovernance();
validateApiContracts();
validateBrowserAuditScript();
validateCiBinding();

writeReport();

if (violations.length) {
  for (const item of violations) {
    console.error(`${item.id}: ${item.message}`);
  }
  throw new Error("Account Actor Kernel check failed.");
}

console.log("Account Actor Kernel check: PASS");

function validateContract() {
  if (contract.version !== "account-actor-kernel.v1") {
    fail("contract.version", "Account Actor Kernel contract version must be account-actor-kernel.v1.");
  }
  for (const table of ["account_users", "account_audit_events", "runtime_sessions", "device_sessions"]) {
    requireArrayIncludes(contract.backendTruthObjects, table, "contract.backend_truth");
  }
  for (const field of ["username", "displayName", "department", "businessLine", "roles", "capabilities", "status", "passwordHash", "tenantId"]) {
    requireArrayIncludes(contract.accountFields, field, "contract.account_fields");
  }
  for (const field of ["username", "password"]) {
    requireArrayIncludes(contract.login?.allowedInputFields, field, "contract.login_fields");
  }
  for (const field of ["department", "businessLine", "role", "capability", "tenant", "deviceTrust"]) {
    requireArrayIncludes(contract.login?.forbiddenSelfAssignedFields, field, "contract.login_forbidden");
  }
  for (const capability of ["account.user.manage", "pc.governance.admin"]) {
    requireArrayIncludes(contract.pcGovernance?.requiredCapabilities, capability, "contract.pc_capability");
  }
  if (!String(contract.developmentIsolation?.productionLikeRequirement || "").includes("account_users") ||
      !String(contract.developmentIsolation?.productionLikeRequirement || "").includes("pbkdf2-sha256")) {
    fail("contract.production_requirement", "Production-like requirement must name account_users and pbkdf2-sha256.");
  }
}

function validateBackendTruth() {
  const migration = read("infra/db/migrations/040_account_actor_kernel.sql");
  for (const token of [
    "create table if not exists account_users",
    "password_hash text not null",
    "capabilities jsonb not null",
    "development_only boolean not null",
    "create table if not exists account_audit_events"
  ]) {
    requireIncludes(migration, token, "backend.migration", `Account migration missing ${token}.`);
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
    requireIncludes(storage, token, "backend.storage", `Account storage missing ${token}.`);
  }
  forbidIncludes(storage, "request.TenantId,\n            request.Department", "backend.tenant_body", "Account creation must not trust request tenant as write tenant.");

  const authSession = read("services/core-api/WorkOS.Api/Runtime/AuthSessionService.cs");
  for (const token of ["FindUserCredentialByUsername", "authOptions.AllowDevelopmentAccounts", "user.EffectiveCapabilities", "store.CreateSession(user)"]) {
    requireIncludes(authSession, token, "backend.login", `Login service missing ${token}.`);
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
    requireIncludes(actorAuth, token, "backend.admission", `Runtime auth/admission missing ${token}.`);
  }
  forbidIncludes(actorAuth, "StartsWithSegments(\"/api/pc-governance/account\"", "backend.account_prefix", "Account governance policy must use exact account-users/account-audit segments.");

  const startup = read("services/core-api/WorkOS.Api/Runtime/RuntimeStartupValidator.cs");
  for (const table of ["account_users", "account_audit_events", "runtime_sessions", "device_sessions"]) {
    requireIncludes(startup, `"${table}"`, "backend.readiness", `Runtime readiness missing ${table}.`);
  }
  forbidIncludes(startup, "Auth.PasswordSha256ByUsername 不能为空", "backend.production_password_config", "Production-like runtime must not require config password map as the user truth source.");

  const seed = read("services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs");
  requireIncludes(seed, "DevelopmentOnly: true", "backend.dev_seed", "Seed demo users must be marked development-only.");
  const developmentSettings = read("services/core-api/WorkOS.Api/appsettings.Development.json");
  requireIncludes(developmentSettings, "\"AllowDevelopmentAccounts\": true", "backend.dev_config", "Development settings must explicitly enable development-only accounts.");
}

function validateFrontendLogin() {
  const loginView = read("apps/mobile/src/views/loginView.js");
  requireIncludes(loginView, "id=\"loginAccount\"", "frontend.login", "Login view must expose username input.");
  requireIncludes(loginView, "id=\"loginPassword\"", "frontend.login", "Login view must expose password input.");
  for (const token of ["loginDepartment", "loginRole", "login-account-hints", "frontdeskAccount", "operatorAccount", "financeAccount"]) {
    forbidIncludes(loginView, token, "frontend.login_forbidden", `Login view must not expose self-assigned authority token ${token}.`);
  }

  const operationCopy = read("apps/mobile/src/i18n/operationCopy.js");
  for (const token of ["frontdeskAccount", "operatorAccount", "housekeepingAccount", "financeAccount", "managerAccount", "adminAccount", "releaseOwnerAccount", "loginDepartment", "loginDepartmentHelp", "loginRole", "loginAccountHelp"]) {
    forbidIncludes(operationCopy, `"${token}"`, "frontend.copy_forbidden", `Operation copy still contains retired login authority key ${token}.`);
  }
  requireIncludes(operationCopy, "部门、业务线、角色和权限由管理员在 PC 治理面分配", "frontend.copy", "Chinese login copy must say authority is assigned in PC governance.");

  const authController = read("apps/mobile/src/authController.js");
  for (const token of ["#loginAccount", "#loginPassword", "registerDeviceSession", "logoutActor"]) {
    requireIncludes(authController, token, "frontend.auth_controller", `Auth controller missing ${token}.`);
  }
  for (const token of ["#loginDepartment", "session.department =", "session.role =", "session.capabilities ="]) {
    forbidIncludes(authController, token, "frontend.auth_forbidden", `Auth controller must not self-assign session authority: ${token}.`);
  }

  const shellCss = read("apps/mobile/src/styles/shell.css");
  forbidIncludes(shellCss, "login-account-hints", "frontend.retired_style", "Retired account-hint styling must be deleted.");
}

function validatePcGovernance() {
  const view = read("apps/mobile/src/views/pcGovernanceView.js");
  for (const token of ["data-account-user-management", "data-account-user-create", "data-account-user-disable", "data-account-password-reset", "account.user.manage"]) {
    requireIncludes(view, token, "frontend.pc_governance", `PC account governance view missing ${token}.`);
  }
  for (const token of ["data-account-role-select", "data-account-capability", "account-capability-grid"]) {
    requireIncludes(view, token, "frontend.pc_authority_controls", `PC account governance must use governed role/capability controls: ${token}.`);
  }
  forbidIncludes(view, "<input id=\"accountRoles\"", "frontend.pc_freeform_role", "PC account role assignment must be a governed select, not a free-text input.");
  forbidIncludes(view, "id=\"accountCapabilities\"", "frontend.pc_freeform_capability", "PC account capability assignment must use governed checkboxes, not a free-text field.");

  const controller = read("apps/mobile/src/pcGovernanceController.js");
  for (const token of ["createAccountUser", "disableAccountUser", "resetAccountUserPassword", "fetchAccountAudit", "ctx.state.currentActor?.tenantId", "capabilitiesForAccountRole", "selectedAccountCapabilities", "data-account-capability"]) {
    requireIncludes(controller, token, "frontend.pc_controller", `PC governance controller missing ${token}.`);
  }
  forbidIncludes(controller, "splitCsv", "frontend.pc_authority_csv", "PC account authority assignment must not parse free-text comma-separated roles or capabilities.");

  const binder = read("apps/mobile/src/pcEventBinder.js");
  requireIncludes(binder, "applyAccountRolePreset", "frontend.pc_role_preset_binding", "PC event binder must apply role preset capabilities when role changes.");

  const catalog = read("apps/mobile/src/accountGovernanceCatalog.js");
  for (const token of ["accountRoleOptions", "accountCapabilityOptions", "capabilitiesForAccountRole", "operations.confirm", "account.user.manage"]) {
    requireIncludes(catalog, token, "frontend.pc_authority_catalog", `Account governance catalog missing ${token}.`);
  }

  const pcApi = read("apps/mobile/src/pcApiClient.js");
  for (const token of ["runtimeApiPaths.accountUsers", "runtimeApiPaths.accountAudit", "runtimeApiPaths.deviceSessions", "runtimeApiPaths.revokeDeviceSession"]) {
    requireIncludes(pcApi, token, "frontend.pc_api", `PC API client missing ${token}.`);
  }
}

function validateApiContracts() {
  const openApi = readJson("docs/contracts/workos-runtime.openapi.json");
  for (const route of [
    "/api/auth/logout",
    "/api/device-sessions",
    "/api/device-sessions/{deviceId}/revoke",
    "/api/pc-governance/account-users",
    "/api/pc-governance/account-users/{userId}/disable",
    "/api/pc-governance/account-users/{userId}/reset-password",
    "/api/pc-governance/account-audit"
  ]) {
    if (!openApi.paths?.[route]) fail("api.openapi", `OpenAPI missing ${route}.`);
  }

  const apiBoundary = read("docs/rules/v5.5/api-boundary.yml");
  for (const route of [
    "POST /api/auth/logout",
    "POST /api/device-sessions",
    "POST /api/device-sessions/{deviceId}/revoke",
    "POST /api/pc-governance/account-users",
    "POST /api/pc-governance/account-users/{userId}/disable",
    "POST /api/pc-governance/account-users/{userId}/reset-password"
  ]) {
    requireIncludes(apiBoundary, route, "api.boundary", `API boundary missing ${route}.`);
  }

  const runtimeApiPaths = read("apps/mobile/src/generated/runtimeApiPaths.js");
  for (const key of ["logout", "deviceSessions", "revokeDeviceSession", "accountUsers", "accountUserDisable", "accountUserResetPassword", "accountAudit"]) {
    requireIncludes(runtimeApiPaths, `${key}:`, "api.generated_paths", `Generated runtime API paths missing ${key}.`);
  }
}

function validateBrowserAuditScript() {
  const audit = read("scripts/surface/run-dormitory-l1-browser-e2e-audit.mjs");
  forbidIncludes(audit, "#loginDepartment", "browser.audit_login", "Real browser audit must not use retired login department selector.");
  requireIncludes(audit, "#loginAccount", "browser.audit_login", "Real browser audit must use username input.");
  requireIncludes(audit, "#loginPassword", "browser.audit_login", "Real browser audit must use password input.");
}

function validateCiBinding() {
  const guard = read("scripts/guard-architecture.ps1");
  requireIncludes(guard, "scripts/check-account-actor-kernel.mjs", "ci.guard", "Architecture guard must run Account Actor Kernel check.");
  const ci = read(".github/workflows/ci.yml");
  requireIncludes(ci, "scripts/check-account-actor-kernel.mjs", "ci.workflow", "CI must run Account Actor Kernel check.");
  const index = readJson("docs/contracts/oam-cab/contract-index.json");
  if (index.contracts?.accountActorKernelContract !== contractPath) {
    fail("contract.index", "OAM-CAB contract index must register accountActorKernelContract.");
  }
}

function requireArrayIncludes(values, expected, id) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    fail(id, `Expected array to include ${expected}.`);
  }
}

function requireIncludes(source, token, id, message) {
  if (!source.includes(token)) fail(id, message);
}

function forbidIncludes(source, token, id, message) {
  if (source.includes(token)) fail(id, message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function fail(id, message) {
  violations.push({ id, message });
}

function writeReport() {
  const outPath = path.join(root, "artifacts", "surface", "account-actor-kernel-result.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({
    status: violations.length ? "failed" : "passed",
    checkedAtUtc: new Date().toISOString(),
    contractId: contract.contractId,
    violations
  }, null, 2));
}
