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
        var contract = SurfaceRuntimeGuardTestFiles.Read("docs", "surface", "mobile-search-contract.yml");

        foreach (var section in new[] { "searchWorkItems", "searchOperationCases", "searchRooms", "searchBeds", "searchStays", "searchEvidence", "searchSubmissionTrace", "searchLearning" })
        {
            StringAssert.Contains(searchView, section);
        }

        Assert.IsFalse(searchView.Contains("pcGovernance", StringComparison.Ordinal), "Mobile search must not expose PC governance raw records.");
        Assert.IsFalse(searchView.Contains("releaseControl", StringComparison.Ordinal), "Mobile search must not expose release raw records.");
        Assert.IsFalse(apiClient.Contains("fetchReleaseControlCenter", StringComparison.Ordinal), "Mobile apiClient must not expose release API.");
        StringAssert.Contains(contract, "\"pcRawRecordsVisible\": false");
        StringAssert.Contains(contract, "\"adminRecordsVisibleToOrdinaryMobile\": false");
        StringAssert.Contains(SurfaceRuntimeGuardTestFiles.Read("docs", "surface", "surface-runtime-guard-contract.yml"), "mobile search does not return PC governance raw records");
    }
}
