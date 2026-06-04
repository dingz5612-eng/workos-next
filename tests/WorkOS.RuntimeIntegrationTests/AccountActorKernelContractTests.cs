using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class AccountActorKernelContractTests
{
    [TestMethod]
    public void AccountActorKernelOwnsUsersCredentialsCapabilitiesAndAudit()
    {
        var migration = SurfaceRuntimeGuardTestFiles.Read("infra", "db", "migrations", "040_account_actor_kernel.sql");
        var storage = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "AccountActorKernelStorage.cs");

        StringAssert.Contains(migration, "create table if not exists account_users");
        StringAssert.Contains(migration, "password_hash text not null");
        StringAssert.Contains(migration, "capabilities jsonb not null");
        StringAssert.Contains(migration, "create table if not exists account_audit_events");
        StringAssert.Contains(storage, "RuntimePasswordHasher.Pbkdf2Sha256");
        StringAssert.Contains(storage, "where account_users.development_only = true");
        StringAssert.Contains(storage, "AccountUserCreated");
        StringAssert.Contains(storage, "AccountUserDisabled");
        StringAssert.Contains(storage, "AccountUserPasswordReset");
    }

    [TestMethod]
    public void LoginAndAdmissionUseBackendAccountSessionCapabilities()
    {
        var authSession = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "AuthSessionService.cs");
        var actorAuth = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeActorAuthentication.cs");
        var program = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Program.cs");

        StringAssert.Contains(authSession, "FindUserCredentialByUsername");
        StringAssert.Contains(authSession, "user.EffectiveCapabilities");
        StringAssert.Contains(actorAuth, "user.EffectiveCapabilities");
        StringAssert.Contains(actorAuth, "search_read_policy_required");
        StringAssert.Contains(actorAuth, "account_user_manage_policy_required");
        StringAssert.Contains(actorAuth, "\"/api/pc-governance/account-users\"");
        StringAssert.Contains(actorAuth, "\"/api/pc-governance/account-audit\"");
        StringAssert.Contains(actorAuth, "admin.device_session.revoke");
        StringAssert.Contains(program, "/api/pc-governance/account-users");
        StringAssert.Contains(program, "result.Department");
        StringAssert.Contains(program, "result.Capabilities");
        StringAssert.Contains(program, "Session = result.Session");
    }

    [TestMethod]
    public void DevelopmentDemoAccountsAreIsolatedFromProductionLikeRuntime()
    {
        var seed = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "ProjectionSeed.cs");
        var authOptions = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeAuthOptions.cs");
        var startup = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeStartupValidator.cs");
        var developmentSettings = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "appsettings.Development.json");

        StringAssert.Contains(seed, "DevelopmentOnly: true");
        StringAssert.Contains(authOptions, "AllowDevelopmentAccounts = true");
        StringAssert.Contains(developmentSettings, "\"AllowDevelopmentAccounts\": true");
        StringAssert.Contains(startup, "禁止启用 development-only demo accounts");
        StringAssert.Contains(startup, "IsDevelopment(environmentName)");
        Assert.IsFalse(startup.Contains("Auth.PasswordSha256ByUsername 不能为空"));
    }
}
