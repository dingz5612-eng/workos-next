using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class DeviceSessionTenantScopeTests
{
    [TestMethod]
    public void DeviceSessionIdentityIsTenantScoped()
    {
        var migration = SurfaceRuntimeGuardTestFiles.Read("infra", "db", "migrations", "037_device_session_tenant_scope.sql");
        var storage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeDeviceSessionStorage.cs");
        var actionRuntime = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "ActionRuntimeService.cs");

        StringAssert.Contains(migration, "drop index if exists ux_device_sessions_device");
        StringAssert.Contains(migration, "ux_device_sessions_tenant_device");
        StringAssert.Contains(migration, "on device_sessions(tenant_id, device_id)");
        StringAssert.Contains(storage, "on conflict(tenant_id, device_id)");
        StringAssert.Contains(storage, "Find(string tenantId, string deviceId)");
        StringAssert.Contains(storage, "where tenant_id = @tenantId and device_id = @deviceId");
        StringAssert.Contains(actionRuntime, "ResolveDeviceSession(workspace.Id, request)");
        StringAssert.Contains(actionRuntime, "store.FindDeviceSession(tenantId, deviceId)");
    }
}
