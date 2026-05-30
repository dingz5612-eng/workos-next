using Microsoft.VisualStudio.TestTools.UnitTesting;
using WorkOS.Api.Slices.Accommodation.PeriodAnalytics.Persistence;

namespace WorkOS.UnitTests;

[TestClass]
public sealed class OperationSnapshotGeneratorTests
{
    [TestMethod]
    public void operation_snapshot_from_lenses()
    {
        var snapshot = OperationSnapshotGenerator.Generate(State(
            totalRooms: 12,
            totalBeds: 36,
            availableBeds: 20,
            occupiedBeds: 10,
            blockedBeds: 6,
            pendingCheckouts: 3,
            pendingInspections: 2,
            pendingCleaning: 4,
            serviceTaskBacklog: 7,
            overdueWorkItems: 5,
            openBlockers: 2,
            debtGuests: 8,
            highRiskCases: 1));

        Assert.AreEqual(12, snapshot.TotalRooms);
        Assert.AreEqual(36, snapshot.TotalBeds);
        Assert.AreEqual(20, snapshot.AvailableBeds);
        Assert.AreEqual(10, snapshot.OccupiedBeds);
        Assert.AreEqual(3, snapshot.PendingCheckouts);
        Assert.AreEqual(5, snapshot.OverdueWorkItems);
        Assert.AreEqual("beds:v1", snapshot.SourceLensVersions["BedInventoryLens"]);
        Assert.AreEqual("lens-events:456", snapshot.SourceEventHighWatermark);
        Assert.AreEqual(36, snapshot.Body["totalBeds"]);
    }

    [TestMethod]
    public void blocked_beds_from_resource_inventory()
    {
        var snapshot = OperationSnapshotGenerator.Generate(State(blockedBeds: 9));

        Assert.AreEqual(9, snapshot.BlockedBeds);
        Assert.AreEqual(9, snapshot.Body["blockedBeds"]);
        CollectionAssert.Contains(((IEnumerable<string>)snapshot.Body["rules"]!).ToArray(), "blocked_beds_from_resource_inventory");
    }

    [TestMethod]
    public void debt_guests_from_stay_balance()
    {
        var snapshot = OperationSnapshotGenerator.Generate(State(debtGuests: 6));

        Assert.AreEqual(6, snapshot.DebtGuests);
        Assert.AreEqual(6, snapshot.Body["debtGuests"]);
        Assert.IsTrue(snapshot.SourceLensVersions.ContainsKey("StayBalanceLens"));
    }

    [TestMethod]
    public void service_backlog_from_service_task_lens()
    {
        var snapshot = OperationSnapshotGenerator.Generate(State(serviceTaskBacklog: 11, pendingCleaning: 4));

        Assert.AreEqual(11, snapshot.ServiceTaskBacklog);
        Assert.AreEqual(4, snapshot.PendingCleaning);
        Assert.AreEqual("service:v1", snapshot.SourceLensVersions["ServiceTaskQueueLens"]);
    }

    [TestMethod]
    public void open_blockers_from_blocker_engine()
    {
        var snapshot = OperationSnapshotGenerator.Generate(State(openBlockers: 5, highRiskCases: 2));

        Assert.AreEqual(5, snapshot.OpenBlockers);
        Assert.AreEqual(2, snapshot.HighRiskCases);
        Assert.AreEqual("blockers:v1", snapshot.SourceLensVersions["BlockerEngine"]);
    }

    private static OperationSnapshotSourceState State(
        int totalRooms = 0,
        int totalBeds = 0,
        int availableBeds = 0,
        int occupiedBeds = 0,
        int blockedBeds = 0,
        int pendingCheckouts = 0,
        int pendingInspections = 0,
        int pendingCleaning = 0,
        int serviceTaskBacklog = 0,
        int overdueWorkItems = 0,
        int openBlockers = 0,
        int debtGuests = 0,
        int highRiskCases = 0) =>
        new(
            totalRooms,
            totalBeds,
            availableBeds,
            occupiedBeds,
            blockedBeds,
            pendingCheckouts,
            pendingInspections,
            pendingCleaning,
            serviceTaskBacklog,
            overdueWorkItems,
            openBlockers,
            debtGuests,
            highRiskCases,
            new Dictionary<string, object>
            {
                ["BedInventoryLens"] = "beds:v1",
                ["RoomReadinessLens"] = "rooms:v1",
                ["StayLifecycle"] = "stay:v1",
                ["StayBalanceLens"] = "balance:v1",
                ["ServiceTaskQueueLens"] = "service:v1",
                ["CheckoutQueueLens"] = "checkout:v1",
                ["BlockerEngine"] = "blockers:v1",
                ["WorkQueueLens"] = "work:v1"
            },
            "lens-events:456");
}
