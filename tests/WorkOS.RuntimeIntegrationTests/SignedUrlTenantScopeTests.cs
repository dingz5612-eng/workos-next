using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class SignedUrlTenantScopeTests
{
    [TestMethod]
    public void SignedUrlRequiresTenantAndDeviceScope()
    {
        var program = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Program.cs");
        var storage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeEvidenceStorage.cs");
        var migration = SurfaceRuntimeGuardTestFiles.Read("infra", "db", "migrations", "037_device_session_tenant_scope.sql");

        StringAssert.Contains(program, "string? tenantId");
        StringAssert.Contains(program, "TenantId: tenantId");
        StringAssert.Contains(storage, "evidence_tenant_scope_mismatch");
        StringAssert.Contains(storage, "evidence_device_tenant_scope_mismatch");
        StringAssert.Contains(storage, "WriteFileAccessAudit(evidence.TenantId");
        StringAssert.Contains(migration, "alter table file_access_audits add column if not exists tenant_id text");
        StringAssert.Contains(migration, "ix_file_access_audits_tenant_evidence");
    }
}
