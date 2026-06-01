using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class EvidenceTenantIsolationTests
{
    [TestMethod]
    public void EvidenceRuntimeTablesAndModelsAreTenantScoped()
    {
        var migration = SurfaceRuntimeGuardTestFiles.Read("infra", "db", "migrations", "036_evidence_tenant_scope.sql");
        var models = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "ProjectionModels.cs");
        var storage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeEvidenceStorage.cs");

        foreach (var table in new[] { "card_instances", "evidence_objects", "evidence_attachments", "evidence_requirements" })
        {
            StringAssert.Contains(migration, $"alter table {table} add column if not exists tenant_id text");
        }

        StringAssert.Contains(migration, "ux_evidence_objects_tenant_evidence");
        StringAssert.Contains(migration, "fk_evidence_attachments_tenant_evidence");
        StringAssert.Contains(migration, "fk_evidence_requirements_tenant_evidence");
        StringAssert.Contains(models, "string? TenantId = null");
        StringAssert.Contains(models, "public sealed record EvidenceObject(");
        StringAssert.Contains(models, "string TenantId,");
        StringAssert.Contains(storage, "request.TenantId");
        StringAssert.Contains(storage, "evidence.TenantId");
    }
}
