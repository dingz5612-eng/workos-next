using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Runtime;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class FieldContractCatalogTests
{
    [TestMethod]
    public void optional_note_fields_do_not_block_runtime_confirm()
    {
        var resource = WorkspaceSeedCatalog.All().Single(item => item.Id == "W-STAY-RESOURCE");
        var roomSetup = CardContractFactory.Create(resource.Cards.Single(item => item.Id == "roomSetup"));
        var rateSetup = CardContractFactory.Create(resource.Cards.Single(item => item.Id == "rateSetup"));
        var readiness = CardContractFactory.Create(resource.Cards.Single(item => item.Id == "roomReadiness"));
        var release = CardContractFactory.Create(resource.Cards.Single(item => item.Id == "roomRelease"));

        Assert.IsFalse(Field(roomSetup, "roomNote").Required);
        Assert.IsFalse(Field(rateSetup, "rateNote").Required);
        Assert.IsFalse(Field(readiness, "readinessNote").Required);
        Assert.IsFalse(Field(release, "releaseNote").Required);
    }

    [TestMethod]
    public void business_reason_fields_remain_required_for_auditability()
    {
        var resource = WorkspaceSeedCatalog.All().Single(item => item.Id == "W-STAY-RESOURCE");
        var block = CardContractFactory.Create(resource.Cards.Single(item => item.Id == "roomBlock"));

        Assert.IsTrue(Field(block, "blockedReason").Required);
    }

    private static FieldProjection Field(CardProjection card, string fieldId) =>
        card.Fields.Business.Single(field => field.Id == fieldId);
}
