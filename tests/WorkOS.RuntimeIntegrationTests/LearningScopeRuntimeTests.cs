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
        Assert.IsFalse(searchView.Contains("learningContentItems", StringComparison.Ordinal), "Search must not render learning content after personal library consolidation.");
        StringAssert.Contains(meView, "learningCenter");
        Assert.IsFalse(homeView.Contains("todayLearning", StringComparison.Ordinal), "Home must stay focused on today's work, not learning catalog content.");
        StringAssert.Contains(SurfaceRuntimeGuardTestFiles.Read("docs", "surface", "surface-runtime-guard-contract.yml"), "learning content scoped by role/surface/tenant");
    }
}
