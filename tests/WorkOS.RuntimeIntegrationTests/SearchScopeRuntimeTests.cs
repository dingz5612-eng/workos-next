using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace WorkOS.RuntimeIntegrationTests;

[TestClass]
public sealed class SearchScopeRuntimeTests
{
    [TestMethod]
    public void MobileSearchContractBlocksPcGovernanceRawRecords()
    {
        var searchView = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "views", "searchView.js");
        var apiClient = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "apiClient.js");
        var meView = SurfaceRuntimeGuardTestFiles.Read("apps", "mobile", "src", "views", "meView.js");
        var contract = SurfaceRuntimeGuardTestFiles.Read("docs", "surface", "mobile-search-contract.yml");

        foreach (var section in new[] { "searchWorkItems", "searchRooms", "searchBeds", "searchStays" })
        {
            StringAssert.Contains(searchView, section);
        }

        foreach (var movedSection in new[] { "searchOperationCases", "searchEvidence", "searchLearning" })
        {
            Assert.IsFalse(searchView.Contains(movedSection, StringComparison.Ordinal), $"Mobile search must not render the moved personal library section {movedSection}.");
            StringAssert.Contains(contract, movedSection);
        }

        StringAssert.Contains(meView, "searchOperationCases");
        StringAssert.Contains(meView, "searchEvidence");
        StringAssert.Contains(meView, "learningCenter");
        StringAssert.Contains(meView, "completedWorkItems");
        StringAssert.Contains(meView, "recentTraces");
        StringAssert.Contains(contract, "\"personalLibraryOwner\": \"me\"");
        Assert.IsFalse(searchView.Contains("pcGovernance", StringComparison.Ordinal), "Mobile search must not expose PC governance raw records.");
        Assert.IsFalse(searchView.Contains("releaseControl", StringComparison.Ordinal), "Mobile search must not expose release raw records.");
        Assert.IsFalse(apiClient.Contains("fetchReleaseControlCenter", StringComparison.Ordinal), "Mobile apiClient must not expose release API.");
        StringAssert.Contains(contract, "\"pcRawRecordsVisible\": false");
        StringAssert.Contains(contract, "\"adminRecordsVisibleToOrdinaryMobile\": false");
        StringAssert.Contains(SurfaceRuntimeGuardTestFiles.Read("docs", "surface", "surface-runtime-guard-contract.yml"), "mobile search does not return PC governance raw records");
    }
}
