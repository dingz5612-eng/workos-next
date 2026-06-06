import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const artifactPath = path.join(root, "artifacts", "oma", "checks", "trust-boundary-result.json");
const violations = [];

function read(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) {
    violations.push({ code: "trust.file_missing", message: `缺少文件: ${relativePath}` });
    return "";
  }
  return fs.readFileSync(full, "utf8");
}

function requireIncludes(source, relativePath, terms) {
  for (const term of terms) {
    if (!source.includes(term)) {
      violations.push({ code: "trust.term_missing", file: relativePath, term, message: `${relativePath} 缺少 ${term}` });
    }
  }
}

const contracts = [
  "docs/trust/trust-boundary-kernel.yml",
  "docs/trust/evidence-tenant-isolation-contract.yml",
  "docs/trust/device-session-tenant-scope-contract.yml",
  "docs/trust/signed-url-tenant-scope-contract.yml",
  "docs/trust/pii-retention-contract.yml",
  "schemas/trust/trust-boundary-kernel.schema.json"
];
for (const file of contracts) read(file);

const evidenceMigration = read("infra/db/migrations/036_evidence_tenant_scope.sql");
requireIncludes(evidenceMigration, "infra/db/migrations/036_evidence_tenant_scope.sql", [
  "alter table card_instances add column if not exists tenant_id text",
  "alter table evidence_objects add column if not exists tenant_id text",
  "alter table evidence_attachments add column if not exists tenant_id text",
  "alter table evidence_requirements add column if not exists tenant_id text",
  "ux_evidence_objects_tenant_evidence",
  "fk_evidence_attachments_tenant_evidence",
  "fk_evidence_requirements_tenant_evidence"
]);

const deviceMigration = read("infra/db/migrations/037_device_session_tenant_scope.sql");
requireIncludes(deviceMigration, "infra/db/migrations/037_device_session_tenant_scope.sql", [
  "drop index if exists ux_device_sessions_device",
  "ux_device_sessions_tenant_device",
  "on device_sessions(tenant_id, device_id)",
  "alter table file_access_audits add column if not exists tenant_id text",
  "alter table governance_export_audits add column if not exists tenant_id text"
]);

const evidenceStorage = read("services/core-api/WorkOS.Api/Runtime/RuntimeEvidenceStorage.cs");
requireIncludes(evidenceStorage, "services/core-api/WorkOS.Api/Runtime/RuntimeEvidenceStorage.cs", [
  "request.TenantId",
  "evidence.TenantId",
  "evidence_tenant_scope_mismatch",
  "evidence_device_tenant_scope_mismatch",
  "evidence_device_revoked",
  "evidence_device_untrusted",
  "tenant_id, evidence_id",
  "file_access_audits"
]);

const deviceStorage = read("services/core-api/WorkOS.Api/Runtime/RuntimeDeviceSessionStorage.cs");
requireIncludes(deviceStorage, "services/core-api/WorkOS.Api/Runtime/RuntimeDeviceSessionStorage.cs", [
  "on conflict(tenant_id, device_id)",
  "Find(string tenantId, string deviceId)",
  "where tenant_id = @tenantId and device_id = @deviceId"
]);

const actionRuntime = read("services/core-api/WorkOS.Api/Runtime/ActionRuntimeService.cs");
requireIncludes(actionRuntime, "services/core-api/WorkOS.Api/Runtime/ActionRuntimeService.cs", [
  "ResolveDeviceSession(workspace.Id, request)",
  "store.FindDeviceSession(tenantId, deviceId)"
]);

const projectionModels = read("services/core-api/WorkOS.Api/Runtime/ProjectionModels.cs");
requireIncludes(projectionModels, "services/core-api/WorkOS.Api/Runtime/ProjectionModels.cs", [
  "string? TenantId = null",
  "string TenantId,"
]);

const exportStorage = read("services/core-api/WorkOS.Api/Runtime/RuntimeGovernanceExportStorage.cs");
requireIncludes(exportStorage, "services/core-api/WorkOS.Api/Runtime/RuntimeGovernanceExportStorage.cs", [
  "audit_event_id, tenant_id, export_type",
  "request.TenantId",
  "governance-tenant"
]);

const program = read("services/core-api/WorkOS.Api/Program.cs");
requireIncludes(program, "services/core-api/WorkOS.Api/Program.cs", [
  "string? tenantId",
  "TenantId: tenantId"
]);

for (const test of [
  "tests/WorkOS.RuntimeIntegrationTests/EvidenceTenantIsolationTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/EvidenceCrossTenantTamperTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/SignedUrlTenantScopeTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/WrongTenantEvidenceConfirmBlockedTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/DeviceSessionTenantScopeTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/RevokedDeviceHighRiskConfirmTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/UntrustedDeviceEvidenceAccessTests.cs"
]) {
  read(test);
}

const result = {
  status: violations.length === 0 ? "passed" : "failed",
  architecture: "OMA",
  generatedAtUtc: new Date().toISOString(),
  checks: {
    contracts: contracts.length,
    migrations: ["036_evidence_tenant_scope.sql", "037_device_session_tenant_scope.sql"],
    runtimeGuards: [
      "evidence_tenant_scope",
      "device_session_tenant_scope",
      "signed_url_tenant_scope",
      "revoked_device_blocked",
      "untrusted_device_blocked",
      "pii_export_audit_scope"
    ],
    outcomes: {
      Dormitory: "L1 Internal Pilot Observation",
      DormitoryL2: "blocked",
      BusinessProduction: "blocked",
      RepairPartsHR: "L0 Contract Preview"
    }
  },
  violations
};

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(result, null, 2)}\n`);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`${violation.code}: ${violation.message}`);
  }
  process.exit(1);
}

console.log("OMA_TRUST_BOUNDARY_KERNEL_LOCAL_PASSED");
