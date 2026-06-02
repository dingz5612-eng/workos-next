using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class RuntimeActorAuthenticationContractTests
{
    [TestMethod]
    public void RuntimeApiEnablesAuthenticationAuthorizationAndAccessPolicyMiddleware()
    {
        var program = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Program.cs");

        StringAssert.Contains(program, "AddAuthentication(RuntimeActorAuthenticationDefaults.Scheme)");
        StringAssert.Contains(program, "AddAuthorization(RuntimeActorAuthorization.Configure)");
        StringAssert.Contains(program, "UseAuthentication()");
        StringAssert.Contains(program, "UseWorkOSRuntimeAccessPolicies()");
        StringAssert.Contains(program, "UseAuthorization()");
    }

    [TestMethod]
    public void RuntimeActorContractRequiresSessionValidatedActorAndCsrfForCookieWrites()
    {
        var auth = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "RuntimeActorAuthentication.cs");

        StringAssert.Contains(auth, "authorization.StartsWith(\"Bearer \"");
        StringAssert.Contains(auth, "\"X-WorkOS-Actor-Token\"");
        StringAssert.Contains(auth, "workosnext_session");
        StringAssert.Contains(auth, "FindUserBySessionToken");
        StringAssert.Contains(auth, "csrf_token_required");
        StringAssert.Contains(auth, "WorkOSAuthenticated");
        StringAssert.Contains(auth, "WorkOSWrite");
        StringAssert.Contains(auth, "OperationsConfirmPolicy");
        StringAssert.Contains(auth, "HighRiskActionPolicy");
        StringAssert.Contains(auth, "RuntimeMaintenancePolicy");
        StringAssert.Contains(auth, "GovernanceExportPolicy");
    }

    [TestMethod]
    public void OperationsAndCompatibilityConfirmUseTrustedSessionToken()
    {
        var operationsEndpoints = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Runtime", "OperationsRuntimeEndpoints.cs");
        var program = SurfaceRuntimeGuardTestFiles.Read("services", "core-api", "WorkOS.Api", "Program.cs");

        StringAssert.Contains(operationsEndpoints, "httpRequest.SessionTokenForOperations()");
        StringAssert.Contains(program, "httpRequest.SessionTokenForOperations()");
        Assert.IsFalse(
            program.Contains("Headers[\"X-WorkOS-Actor-Id\"]", StringComparison.Ordinal),
            "写接口不得把 X-WorkOS-Actor-Id 当成可信身份来源。");
    }

    [TestMethod]
    public void RuntimeValidatorCoversUnauthenticatedAndDevelopmentCompatibilityFlow()
    {
        var validator = SurfaceRuntimeGuardTestFiles.Read("scripts", "validate-runtime-api.mjs");

        StringAssert.Contains(validator, "confirm without actor token must return 401");
        StringAssert.Contains(validator, "ensureRuntimeActorToken");
        StringAssert.Contains(validator, "Development login must return compatibility token");
        StringAssert.Contains(validator, "\"X-WorkOS-Actor-Token\"");
    }
}
