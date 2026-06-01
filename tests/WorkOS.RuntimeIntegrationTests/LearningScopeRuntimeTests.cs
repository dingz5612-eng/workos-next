using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class LearningScopeRuntimeTests
{
    [TestMethod]
    public void LearningContentIsScopedToRoleSurfaceAndTenant()
    {
        var learningContract = SurfaceRuntimeGuardTestFiles.Read("docs", "surface", "learning-center-contract.yml");
        var searchView = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "views", "searchView.js");
        var meView = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "views", "meView.js");
        var homeView = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "views", "homeView.js");

        StringAssert.Contains(learningContract, "\"scopeRules\": [\"role\", \"surface\", \"tenant\"]");
        StringAssert.Contains(searchView, "learningContentItems");
        StringAssert.Contains(meView, "learningCenter");
        StringAssert.Contains(homeView, "todayLearning");
        StringAssert.Contains(SurfaceRuntimeGuardTestFiles.Read("docs", "surface", "surface-runtime-guard-contract.yml"), "learning content scoped by role/surface/tenant");
    }
}
